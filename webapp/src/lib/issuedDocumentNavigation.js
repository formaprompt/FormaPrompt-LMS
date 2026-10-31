const IAG='formation-ia-generative-elearning';
const titles={iag_completion:'Certificat de fin de formation',iag_success:'Certificat de fin de formation — mention Réussite'};
function kind(row){return row.document_type||row.documentType;}
function isIag(row){return (row.course_id||row.courseId)===IAG&&Object.hasOwn(titles,kind(row));}
export function iagIssuedDocumentTitle(row){return isIag(row)?titles[kind(row)]:null;}
export function issuedDocumentPath(row){
  if(!isIag(row))return `/attestations/${row.id}`;
  // The new dedicated RPC transports bigint as text. Never guess a rounded ID
  // received from a historical generic projection; fail closed in that case.
  if(typeof row.id==='number'&&!Number.isSafeInteger(row.id))return null;
  const id=String(row.id);
  return /^[1-9][0-9]{0,18}$/.test(id)?`/course/${IAG}/certificats/${id}`:null;
}
