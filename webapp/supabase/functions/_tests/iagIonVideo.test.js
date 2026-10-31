import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createIagIonVideoGrant, IAG_ION_VIDEO_TTL_SECONDS } from '../_shared/iagIonVideo.js';
import { IAG_CONTENT_VERSION } from '../_shared/iagPrivateResourceAllowlist.js';

const courseId='formation-ia-generative-elearning';
const secret='fictitious-unit-test-key-not-a-real-secret-32';
const reference={courseId,contentVersion:IAG_CONTENT_VERSION,lessonId:'l11',resourceId:'res-'+ '1'.repeat(24)};
const environment={PAID_VIDEO_GATEWAY_URL:'https://formaprompt.com/paid-video.php',PAID_VIDEO_SIGNING_SECRET:secret};
const readEnv=name=>environment[name];
const now=new Date('2026-10-24T12:34:56.789Z');
const signingText=grant=>['iag-video-v1',grant.courseId,grant.contentVersion,grant.lessonId,grant.resourceId,String(grant.expiresAt)].join('\n');

test('IAG HMAC matches exact UTF8 namespace payload and 120-second integer expiry',async()=>{
  const grant=await createIagIonVideoGrant(reference,{readEnv,now});
  assert.equal(IAG_ION_VIDEO_TTL_SECONDS,120);
  assert.equal(grant.endpoint,'https://formaprompt.com/iag-video.php');
  assert.equal(grant.expiresAt,Math.floor(now.getTime()/1000)+120);
  assert.match(grant.signature,/^[a-f0-9]{64}$/);
  assert.equal(grant.signature,createHmac('sha256',secret).update(signingText(grant),'utf8').digest('hex'));
  assert.equal(Object.hasOwn(grant,'url'),false);
});

test('course, version, lesson, resource and expiry are each bound to the signature',async()=>{
  const grant=await createIagIonVideoGrant(reference,{readEnv,now});
  for(const change of [{courseId:'formation-ia'},{contentVersion:'invented'},{lessonId:'l61'},
    {resourceId:'res-'+'2'.repeat(24)},{expiresAt:grant.expiresAt+1}]) {
    assert.notEqual(grant.signature,createHmac('sha256',secret).update(signingText({...grant,...change}),'utf8').digest('hex'));
  }
  assert.notEqual(grant.signature,createHmac('sha256',secret).update(`${courseId}\n${grant.expiresAt}`,'utf8').digest('hex'));
});

test('signer refuses malformed identifiers, wrong version and unsafe/missing server configuration',async()=>{
  for(const change of [{courseId:'formation-ia'},{contentVersion:'invented'},{lessonId:'l11\nextra'},
    {resourceId:'../video.mp4'},{resourceId:'res-'+'a'.repeat(24)+'\n'}]) {
    await assert.rejects(createIagIonVideoGrant({...reference,...change},{readEnv,now}));
  }
  for(const url of ['http://formaprompt.com/paid-video.php','https://formaprompt.com.evil.invalid/x',
    'https://user@formaprompt.com/x','https://formaprompt.com:444/x','https://formaprompt.com/x?q=1','https://formaprompt.com/x#part']) {
    await assert.rejects(createIagIonVideoGrant(reference,{readEnv:name=>name==='PAID_VIDEO_GATEWAY_URL'?url:secret,now}));
  }
  await assert.rejects(createIagIonVideoGrant(reference,{readEnv:()=>undefined,now}));
  await assert.rejects(createIagIonVideoGrant(reference,{readEnv:name=>name==='PAID_VIDEO_GATEWAY_URL'?environment[name]:'short',now}));
});

const video={id:reference.resourceId,kind:'video',mime:'video/mp4',lessonIds:['l11'],objectKey:courseId+'/unit/video.mp4',sourceSha256:'a'.repeat(64),bytes:100};
const txt={id:'res-'+'2'.repeat(24),kind:'worksheet',mime:'text/plain',lessonIds:['l11'],objectKey:courseId+'/unit/example.txt',sourceSha256:'b'.repeat(64),bytes:17};
function receiptRow(resource,extras={}) {
  return {status:'VERIFIED',courseId,contentVersion:IAG_CONTENT_VERSION,objectKey:resource.objectKey,
    sha256:resource.sourceSha256,bytes:resource.bytes,mime:resource.mime,importBatchId:'synthetic-test-batch',
    verifiedAt:'2026-10-24T10:00:00Z',binaryReadbackVerified:true,...extras};
}
const ionRow=()=>receiptRow(video,{provider:'ionos',privateDirectoryVerified:true,fileKey:`.private/iag-video-files/${video.id}.mp4`});
const storageRow=resource=>receiptRow(resource,{bucket:'paid-course-content',privateBucketVerified:true});
const receiptFor=(resource,row)=>({schemaVersion:'iag-private-import-v1',status:'VERIFIED_IMPORT',contentVersion:IAG_CONTENT_VERSION,entries:{[resource.id]:row}});
const source=readFileSync(new URL('../_shared/iagPrivateDelivery.js',import.meta.url),'utf8')
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'').replace(/^export /gm,'');

// Synthetic catalogue only. The real helper body is executed unchanged;
// actual Auth/entitlement gates remain in the independently tested endpoint.
function fixture({receipt=receiptFor(video,ionRow()),env=environment}={}) {
  const resources={[video.id]:video,[txt.id]:txt};
  const calls={storage:[],grants:0};
  const values={iagPrivateCourseCatalog:{[courseId]:{modules:[{id:'l11'},{id:'l61'}],structuredContent:{documents:{unit:{id:'unit',lessonIds:['l11'],blocks:[]}}}}},
    iagPrivateRubrics:null,iagPrivateResourceAllowlist:resources,IAG_CONTENT_VERSION,iagResourceImportReceipt:receipt,
    PAID_COURSE_BUCKET:'paid-course-content',PAID_RESOURCE_URL_SECONDS:120,IAG_ION_VIDEO_TTL_SECONDS,
    lookupIagResource:payload=>{const row=resources[payload.resourceId];if(!row||payload.courseId!==courseId||payload.contentVersion!==IAG_CONTENT_VERSION||!row.lessonIds.includes(payload.lessonId))throw Error('Unknown synthetic lookup');return row;},
    createIagIonVideoGrant:async(ref,options)=>{calls.grants++;return createIagIonVideoGrant(ref,{...options,readEnv:name=>env[name]});}};
  const helpers=new Function(...Object.keys(values),source+'\nreturn {verifiedImport,handleIagPrivateAction};')(...Object.values(values));
  const adminClient={storage:{from:bucket=>({createSignedUrl:async(key,ttl)=>{calls.storage.push({bucket,key,ttl});return{data:{signedUrl:'https://storage.example.invalid/synthetic'},error:null};}})}};
  return {...helpers,calls,send:(payload=reference,action='iag_resource')=>helpers.handleIagPrivateAction({action,payload,adminClient})};
}

test('video receipt requires IONOS directory proof and exact immutable import fields',()=>{
  const f=fixture(); assert.equal(f.verifiedImport(video),true);
  assert.equal(f.verifiedImport(video,receiptFor(video,storageRow(video))),false);
  assert.equal(f.verifiedImport(video,{...receiptFor(video,ionRow()),status:'NOT_IMPORTED'}),false);
  for(const change of [{provider:'supabase'},{privateDirectoryVerified:false},{binaryReadbackVerified:false},
    {courseId:'formation-ia'},{contentVersion:'other'},{objectKey:'other'},{sha256:'c'.repeat(64)},
    {bytes:101},{mime:'text/plain'},{fileKey:'.private/other.mp4'},{fileKey:undefined},{importBatchId:''},{verifiedAt:'invalid'}]) {
    assert.equal(f.verifiedImport(video,receiptFor(video,{...ionRow(),...change})),false);
  }
});

test('video and renewal return IONOS grants only, never a Storage URL or Storage call',async()=>{
  const f=fixture();
  for(const action of ['iag_resource','iag_resource_renew']) {
    const response=await f.send({...reference,expiresAt:1,signature:'client-invented'},action);
    assert.equal(response.status,200);
    const resource=response.body.resource;
    assert.equal(resource.expiresIn,120);
    assert.equal(resource.videoGrant.expiresAt,Math.floor(Date.parse(resource.issuedAt)/1000)+120);
    assert.equal(Date.parse(resource.expiresAt),resource.videoGrant.expiresAt*1000);
    assert.equal(resource.videoGrant.resourceId,video.id);
    assert.equal(Object.hasOwn(resource,'url'),false);
  }
  assert.equal(f.calls.grants,2);assert.deepEqual(f.calls.storage,[]);
});

test('an old Supabase video receipt cannot cause a fallback or issue any grant',async()=>{
  const f=fixture({receipt:receiptFor(video,storageRow(video))});
  const response=await f.send();
  assert.equal(response.status,409);assert.equal(response.body.code,'IAG_RESOURCE_NOT_IMPORTED');
  assert.equal(f.calls.grants,0);assert.deepEqual(f.calls.storage,[]);
});

test('manipulated version/lesson/resource/path is refused before signing',async()=>{
  const f=fixture();
  for(const change of [{courseId:'formation-ia'},{contentVersion:'invented'},{lessonId:'l61'},
    {resourceId:'res-'+'f'.repeat(24)},{objectKey:video.objectKey},{receipt:receiptFor(video,ionRow())}]) {
    assert.ok([400,404].includes((await f.send({...reference,...change})).status));
  }
  assert.equal(f.calls.grants,0);assert.deepEqual(f.calls.storage,[]);
});

test('TXT continues to use the same private Storage bucket, URL and 120-second TTL',async()=>{
  const f=fixture({receipt:receiptFor(txt,storageRow(txt))});
  const response=await f.send({...reference,resourceId:txt.id});
  assert.equal(response.status,200);assert.equal(response.body.resource.url,'https://storage.example.invalid/synthetic');
  assert.equal(response.body.resource.expiresIn,120);assert.equal(Object.hasOwn(response.body.resource,'videoGrant'),false);
  assert.deepEqual(f.calls.storage,[{bucket:'paid-course-content',key:txt.objectKey,ttl:120}]);assert.equal(f.calls.grants,0);
});

test('structured documents remain unchanged and never request a video grant or Storage signature',async()=>{
  const f=fixture();const response=await f.send({...reference,documentId:'unit'},'iag_document');
  assert.equal(response.status,200);assert.deepEqual(response.body.document,{id:'unit',lessonIds:['l11'],blocks:[]});
  assert.equal(f.calls.grants,0);assert.deepEqual(f.calls.storage,[]);
});

test('unavailable signer configuration fails closed with no usable grant and no Storage fallback',async()=>{
  const f=fixture({env:{}});const response=await f.send();
  assert.equal(response.status,409);assert.equal(response.body.code,'IAG_RESOURCE_UNAVAILABLE');
  assert.equal(response.body.resource,undefined);assert.deepEqual(f.calls.storage,[]);
});
