import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateIagVideoGrant, validateIagVideoGrant, IAG_VIDEO_ENDPOINT } from './iagIonVideo.js';
import { createIagLearningApi, IAG_ID, IAG_VERSION, IAG_LESSONS } from './iagLearningApi.js';
const id = 'res-' + 'a'.repeat(24);
const make = () => ({ endpoint: IAG_VIDEO_ENDPOINT, courseId: IAG_ID, contentVersion: IAG_VERSION,
  lessonId: 'l11', resourceId: id, expiresAt: Math.floor(Date.now()/1000)+100, signature: 'b'.repeat(64) });
test('IAG grant checks endpoint, binding and bounded expiry without a signature URL', () => {
  const grant = make(); assert.equal(validateIagVideoGrant(grant,'l11',id),grant);
  for (const patch of [{endpoint:IAG_VIDEO_ENDPOINT+'?sig=fictive'},{endpoint:'https://other.example/iag-video.php'},
    {courseId:'other'},{contentVersion:'other'},{lessonId:'l12'},{resourceId:'res-'+'c'.repeat(24)},
    {expiresAt:Math.floor(Date.now()/1000)-1},{expiresAt:Math.floor(Date.now()/1000)+121},{signature:'invalid'}])
    assert.throws(()=>validateIagVideoGrant({...grant,...patch},'l11',id));
});
test('activation uses credentialed POST only, safe GET URL and no error body', async () => {
  const resource={videoGrant:make()};let called=0;
  const url=await activateIagVideoGrant(resource,{lessonId:'l11',resourceId:id,origin:'https://formaprompt.com',fetcher:async(endpoint,options)=>{
    called++;assert.equal(endpoint,IAG_VIDEO_ENDPOINT);assert.equal(options.credentials,'include');assert.equal(options.method,'POST');
    const expected={...resource.videoGrant};delete expected.endpoint;assert.deepEqual(JSON.parse(options.body),expected);return {status:204};
  }});
  assert.equal(called,1);assert.equal(url,IAG_VIDEO_ENDPOINT+'?lesson=l11&resource='+id);assert.equal(url.includes(resource.videoGrant.signature),false);
});
test('stale account or wrong origin cannot start activation; stale response cannot publish URL', async () => {
  let calls=0;const options={lessonId:'l11',resourceId:id,origin:'https://formaprompt.com',fetcher:async()=>{calls++;return {status:204};}};
  await assert.rejects(activateIagVideoGrant({videoGrant:make()},{...options,isCurrent:()=>false}));
  await assert.rejects(activateIagVideoGrant({videoGrant:make()},{...options,origin:'https://other.example'}));assert.equal(calls,0);
  let current=true;await assert.rejects(activateIagVideoGrant({videoGrant:make()},{...options,isCurrent:()=>current,fetcher:async()=>{current=false;return {status:204};}}));
});
test('learning API accepts video grants without URL, rejects mismatch and preserves Storage nonvideo', async () => {
  const grant=make(), issuedAt=new Date().toISOString(), expiresAt=new Date(grant.expiresAt*1000).toISOString();
  let resource={id,courseId:IAG_ID,contentVersion:IAG_VERSION,lessonId:'l11',mime:'video/mp4',videoGrant:grant,expiresIn:120,issuedAt,expiresAt};
  const descriptor={id,mime:'video/mp4',lessonIds:['l11']};
  const course={id:IAG_ID,contentVersion:IAG_VERSION,modules:IAG_LESSONS.map(id=>({id})),resources:[descriptor],structuredContent:{contract:'iag-structured-v1',documents:{}}};
  const api=createIagLearningApi({functions:{invoke:async(name,{body})=>({data:body.action==='course'?{course}:{resource}})}});
  await api.loadCourse();assert.equal((await api.resource('l11',id)).videoGrant,grant);
  resource={...resource,url:'https://storage.example/fictive'};await assert.rejects(api.resource('l11',id));delete resource.url;
  resource={...resource,expiresAt:new Date((grant.expiresAt+1)*1000).toISOString()};await assert.rejects(api.resource('l11',id));
  descriptor.mime='text/plain';resource={...resource,mime:'text/plain',url:'https://storage.example/fictive',expiresAt};delete resource.videoGrant;
  assert.equal((await api.resource('l11',id)).url,'https://storage.example/fictive');
});
