import { iagPrivateCourseCatalog, iagPrivateRubrics } from './iagPrivateCourseCatalog.js';
import { iagPrivateResourceAllowlist, IAG_CONTENT_VERSION, lookupIagResource } from './iagPrivateResourceAllowlist.js';
import { iagResourceImportReceipt } from './iagResourceImportReceipt.js';
import { PAID_COURSE_BUCKET, PAID_RESOURCE_URL_SECONDS } from './paidCourseAccess.js';
import { createIagIonVideoGrant, IAG_ION_VIDEO_TTL_SECONDS } from './iagIonVideo.js';

const COURSE_ID = 'formation-ia-generative-elearning';
const course = iagPrivateCourseCatalog[COURSE_ID];
const lessonIds = new Set((course?.modules ?? []).map(({id}) => id));
const servedMimes = new Set(['video/mp4','image/png','image/jpeg','text/plain','text/csv','text/vtt']);
function error(code,message,status=400,extra={}) {return {status,body:{code,error:message,...extra}};}

// Ce reçu est exclusivement une configuration serveur, jamais le payload client.
export function verifiedImport(resource, receipt=iagResourceImportReceipt) {
  if (receipt?.schemaVersion !== 'iag-private-import-v1' || receipt.status !== 'VERIFIED_IMPORT'
      || receipt.contentVersion !== IAG_CONTENT_VERSION) return false;
  const row=receipt.entries?.[resource.id];
  const destinationVerified = resource.mime === 'video/mp4'
    ? row?.provider === 'ionos' && row.privateDirectoryVerified === true
      && row.fileKey === `.private/iag-video-files/${resource.id}.mp4`
    : row?.bucket === PAID_COURSE_BUCKET && row.privateBucketVerified === true;
  return Boolean(row && row.status === 'VERIFIED'
    && row.courseId === COURSE_ID && row.contentVersion === IAG_CONTENT_VERSION
    && destinationVerified && row.objectKey === resource.objectKey
    && row.sha256 === resource.sourceSha256 && /^[a-f0-9]{64}$/.test(row.sha256)
    && Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes === resource.bytes && row.mime === resource.mime
    && typeof row.importBatchId === 'string' && row.importBatchId.length > 0
    && Number.isFinite(Date.parse(row.verifiedAt))
    && row.binaryReadbackVerified === true
    && (resource.mime !== 'text/vtt' || row.captionsSynchronizedVerified === true));
}

// Appelé UNIQUEMENT après les gates existants du véritable endpoint. Ce helper
// ne constitue pas lui-même une API ni un substitut à l'autorisation.
export async function handleIagPrivateAction({action,payload,adminClient}) {
  if (!course) return error('IAG_PRIVATE_BUNDLE_REQUIRED','Le contenu privé de cette formation est indisponible.',503);
  if (action === 'iag_rubrics') {
    if (payload.courseId !== COURSE_ID || payload.contentVersion !== IAG_CONTENT_VERSION) return error('IAG_CONTENT_REQUEST_INVALID','Version ou formation invalide.');
    if (!iagPrivateRubrics) return error('IAG_PRIVATE_BUNDLE_REQUIRED','Les grilles privées sont indisponibles.',503);
    return {status:200,body:{rubrics:iagPrivateRubrics,rubricVersion:'v7-2026-10-21'}};
  }
  if (payload.courseId !== COURSE_ID || payload.contentVersion !== IAG_CONTENT_VERSION
      || !lessonIds.has(payload.lessonId)) return error('IAG_CONTENT_REQUEST_INVALID','Version ou leçon invalide.');
  if (['objectKey','path','url','bucket','userId','user_id','receipt'].some(key=>Object.hasOwn(payload,key))) {
    return error('IAG_CONTENT_REQUEST_INVALID','Référence de contenu invalide.');
  }
  if (action === 'iag_document') {
    const id=payload.documentId;
    const documents=course.structuredContent.documents;
    if (typeof id !== 'string' || !Object.hasOwn(documents,id)) return error('IAG_DOCUMENT_UNKNOWN','Document inconnu.',404);
    const document=documents[id];
    // Les pages complémentaires appartiennent au cours entier ; les leçons et
    // supports/corrigés avec lessonIds restent limités à cette relation exacte.
    if (document.lessonIds.length && !document.lessonIds.includes(payload.lessonId)) {
      return error('IAG_DOCUMENT_UNKNOWN','Document inconnu pour cette leçon.',404);
    }
    return {status:200,body:{document,courseId:COURSE_ID,contentVersion:IAG_CONTENT_VERSION,lessonId:payload.lessonId}};
  }
  if (!['iag_resource','iag_resource_renew'].includes(action)) return error('IAG_ACTION_INVALID','Action inconnue.');
  let resource;
  try {resource=lookupIagResource(payload);} catch {return error('IAG_RESOURCE_UNKNOWN','Ressource inconnue pour cette leçon/version.',404);}
  if (!Object.hasOwn(iagPrivateResourceAllowlist,resource.id)) return error('IAG_RESOURCE_UNKNOWN','Ressource inconnue.',404);
  // HTML conservé en AST privé, SRT source jamais servi comme track ; aucun HTML
  // actif signé. Le client utilise iag_document pour supports/corrigés HTML.
  if (!servedMimes.has(resource.mime)) return error('IAG_RESOURCE_USE_DOCUMENT','Utilisez le document structuré ou une ressource compatible.',409,{resourceId:resource.id,mime:resource.mime});
  if (!verifiedImport(resource)) return error('IAG_RESOURCE_NOT_IMPORTED','La ressource privée n’a pas encore de reçu d’import vérifié.',409,{resourceId:resource.id,mime:resource.mime,
    ...(resource.mime === 'text/vtt' ? {captionStatus:'synchronization-unverified'} : {})});
  const issuedAt = new Date();
  if (resource.mime === 'video/mp4') {
    try {
      const videoGrant = await createIagIonVideoGrant({courseId:COURSE_ID,contentVersion:IAG_CONTENT_VERSION,
        lessonId:payload.lessonId,resourceId:resource.id},{now:issuedAt});
      return {status:200,body:{resource:{id:resource.id,courseId:COURSE_ID,contentVersion:IAG_CONTENT_VERSION,
        lessonId:payload.lessonId,mime:resource.mime,videoGrant,expiresIn:IAG_ION_VIDEO_TTL_SECONDS,
        issuedAt:issuedAt.toISOString(),expiresAt:new Date(videoGrant.expiresAt*1000).toISOString()}}};
    } catch {
      return error('IAG_RESOURCE_UNAVAILABLE','Ressource momentanément indisponible.',409);
    }
  }
  const expiresIn=PAID_RESOURCE_URL_SECONDS;
  const {data,error:signError}=await adminClient.storage.from(PAID_COURSE_BUCKET).createSignedUrl(resource.objectKey,expiresIn);
  if (signError || !data?.signedUrl) return error('IAG_RESOURCE_UNAVAILABLE','Ressource momentanément indisponible.',409);
  return {status:200,body:{resource:{id:resource.id,courseId:COURSE_ID,contentVersion:IAG_CONTENT_VERSION,
    lessonId:payload.lessonId,mime:resource.mime,url:data.signedUrl,expiresIn,
    ...(resource.mime === 'text/vtt' ? {captionStatus:'verified-synchronized'} : {}),
    issuedAt:issuedAt.toISOString(),expiresAt:new Date(issuedAt.getTime()+expiresIn*1000).toISOString()}}};
}
