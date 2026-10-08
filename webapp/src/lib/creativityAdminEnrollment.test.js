import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAdminCreativityCohortCandidates, enrollAdminCreativityCohort } from './courseCohorts.js';
test('les candidats proviennent du filtre groupe de l’API admin, sans liste globale des comptes', async () => {
  const calls=[];
  const candidates=[{user_id:'gift-group',name:'Test local',email:'local@example.test',access_source:'gift',already_enrolled:false}];
  const client={functions:{invoke:async(...args)=>{calls.push(args);return {data:{candidates},error:null};}}};
  assert.deepEqual(await fetchAdminCreativityCohortCandidates(client,'cohort-local'),candidates);
  assert.deepEqual(calls,[['manage-course-cohorts',{body:{action:'creativity_candidates',cohort_id:'cohort-local'}}]]);
});
test('l’inscription transmet seulement cohorte et compte existant, sans achat ni cadeau implicite', async () => {
  const calls=[]; const enrollment={id:'enrollment-local',cohort_id:'cohort-local',status:'active'};
  const client={functions:{invoke:async(...args)=>{calls.push(args);return {data:{enrollment},error:null};}}};
  assert.deepEqual(await enrollAdminCreativityCohort(client,'cohort-local','gift-group'),enrollment);
  assert.deepEqual(calls,[['manage-course-cohorts',{body:{action:'enroll_creativity',cohort_id:'cohort-local',user_id:'gift-group'}}]]);
});
test('les refus de droit groupe et de capacité restent des erreurs visibles, sans succès fictif',async()=>{
  for(const message of ['Droit groupe actif requis.','Cette cohorte est complète.']){
    const client={functions:{invoke:async()=>({data:null,error:{context:{json:async()=>({error:message})}}})}};
    await assert.rejects(enrollAdminCreativityCohort(client,'cohort-local','individual-only'),{message});
  }
});
