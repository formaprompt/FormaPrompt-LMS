import {createServer} from 'node:http';
import {fixtures} from './test-ai-act-challenge-harness.mjs';
import {createPrivacyHarness} from './test-ai-act-challenge-privacy-harness.mjs';
import {randomUUID} from 'node:crypto';
if(process.argv[2])process.env.PGLITE_RUNTIME_PATH=process.argv[2];
const harness=await createPrivacyHarness();
const demo=process.env.CHALLENGE_RECIPE_DEMO==='1';
if(demo){
  for(const [user,first,last] of [['learner','Camille','Exemple'],['learner2','Dominique','Test']]){
    await harness.db.query("INSERT INTO training_enrollments(id,user_id,course_id,status,learner_first_name,learner_last_name,enrolled_at) VALUES($1,$2,$3,'validated',$4,$5,now())",[randomUUID(),fixtures[user],harness.course,first,last]);
  }
  await harness.rpc('admin','grant',{user_id:fixtures.trainer,course_id:harness.course,active:true});
  let state=await harness.rpc('learner2','start',{request_id:randomUUID()});
  const questions=(await harness.db.query('SELECT code,correct_option FROM private.challenge_questions WHERE version_id=$1 ORDER BY position',[state.version])).rows;
  for(const [index,q] of questions.entries()){
    const attempt=state.attempts.find(a=>a.status==='in_progress');
    state=await harness.rpc('learner2','save',{attempt_id:attempt.id,question_code:q.code,option_code:index<9?q.correct_option:(q.correct_option==='A'?'B':'A'),expected_revision:attempt.revision,request_id:randomUUID()});
  }
  const attempt=state.attempts.find(a=>a.status==='in_progress');
  await harness.rpc('learner2','finish',{attempt_id:attempt.id,expected_revision:attempt.revision,confirmed:true});
}
const port=Number(process.env.CHALLENGE_RECIPE_PORT||4177);
const server=createServer(async(req,res)=> {
  res.setHeader('Content-Type','application/json');
  const host=req.headers.host||''; const origin=req.headers.origin;
  if(!/^127\.0\.0\.1(?::\d+)?$/.test(host)|| (origin&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))) {res.writeHead(403);res.end(JSON.stringify({error:'LOCAL_ONLY'}));return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','content-type,x-fixture-user');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.url==='/health'){res.end(JSON.stringify({local:true,demo,engine:'PGlite',migrations:harness.migrations,migrationHashes:harness.migrationHashes}));return;}
  if(req.method!=='POST'||req.url!=='/rpc'){res.writeHead(404);res.end('{}');return;}
  try {
    const user=req.headers['x-fixture-user']||'learner';
    if(!Object.hasOwn(fixtures,user))throw Error('INVALID_FIXTURE');
    let text='';for await(const chunk of req){text+=chunk;if(text.length>16384)throw Error('BODY_TOO_LARGE');}
    const {action,payload,rpc}=JSON.parse(text);
    const method=rpc==='challenge_training_status'?harness.training:rpc==='admin_challenge_training'?harness.trainingAdmin:rpc==='admin_challenge_privacy'?harness.privacy:harness.rpc;
    const data=await method(user,action,payload);
    res.end(JSON.stringify({data,error:null}));
  }catch(error){res.writeHead(400);res.end(JSON.stringify({data:null,error:{message:error.message}}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Recette SQL locale : http://127.0.0.1:${port}`));
async function close(){server.close();await harness.close();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
