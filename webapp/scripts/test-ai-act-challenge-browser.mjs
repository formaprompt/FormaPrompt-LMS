import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fileURLToPath} from 'node:url';
import {fixtures,course,defaultQaDirectory} from './test-ai-act-challenge-harness.mjs';
const base=process.env.CHALLENGE_RECIPE_URL||'http://127.0.0.1:4189';
const qa=process.env.CHALLENGE_QA_DIR||fileURLToPath(defaultQaDirectory);
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const blocked=[];const errors=[];const checks=[];const accessibility=[];
context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){blocked.push(url.href);await route.abort();}else await route.continue();});
const test=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
async function axe(screen){const result=await new AxeBuilder({page}).include('.aac').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();accessibility.push({screen,violations:result.violations});}
const rpc=async(user,action,payload={})=>{
  const response=await context.request.post(`${base}/rpc`,{headers:{'x-fixture-user':user},data:{action,payload}});const body=await response.json();if(body.error)throw Error(body.error.message);return body.data;
};
async function answer(index,letter){
  await page.locator(`input[name="Q${String(index+1).padStart(2,'0')}"]`).nth('ABC'.indexOf(letter)).click();
  await page.getByRole('status').filter({hasText:'Réponse enregistrée et confirmée'}).waitFor();
}
try{
 await test('Accueil SQL réel, responsive et clavier',async()=>{
  await page.goto(`${base}/?view=learner`);await page.getByRole('button',{name:'Commencer',exact:true}).waitFor();
  await page.screenshot({path:`${qa}/learner-home-desktop.png`,fullPage:true});await axe('accueil-desktop');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:`${qa}/learner-home-mobile.png`,fullPage:true});await axe('accueil-mobile');
  await page.getByRole('button',{name:'Commencer',exact:true}).focus();await page.keyboard.press('Enter');
  await page.getByText('Question 1/12 · Tentative 1',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Terminer ma tentative'}).isEnabled(),false);
 });
 await test('Sauvegarde confirmée, reprise après rechargement sans nouvelle tentative',async()=>{
  await answer(0,'B');await page.reload();await page.getByRole('button',{name:'Reprendre ma tentative 1'}).click();
  await page.getByText('1/12 réponses sont enregistrées. La reprise conserve cette tentative.').waitFor();
  await page.getByRole('button',{name:'Reprendre les questions'}).click();await page.getByText('Question 2/12 · Tentative 1',{exact:true}).waitFor();
  assert.equal((await rpc('learner','state')).attempts.length,1);
 });
 await test('Douze sauvegardes SQL, confirmation et résultat 9/12',async()=>{
  const letters='BACBAABACBCC';
  for(let i=1;i<12;i++){await answer(i,i>=9?(letters[i]==='A'?'B':'A'):letters[i]);if(i<11)await page.getByRole('button',{name:'Question suivante →'}).click();}
  await page.screenshot({path:`${qa}/learner-question-mobile.png`,fullPage:true});await axe('question-mobile');
  await page.getByRole('button',{name:'Terminer ma tentative'}).click();await page.getByRole('button',{name:'Confirmer la clôture définitive'}).click();
  await page.getByRole('heading',{name:'9/12 — Réussi'}).waitFor();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`${qa}/learner-result-desktop.png`,fullPage:true});await axe('resultat');
  await page.getByRole('button',{name:'Voir toutes les corrections'}).click();assert.equal(await page.locator('.aac-corrections article').count(),12);
  await page.getByText('Comprendre la règle juridique',{exact:true}).first().click();
 });
 await test('Seconde après réussite vierge puis 8/12 : meilleur9, dernier8, aucun troisième',async()=>{
  await page.getByRole('button',{name:'Commencer la tentative 2',exact:true}).click();await page.getByRole('button',{name:'Commencer la tentative 2',exact:true}).click();
  await page.getByText('Question 1/12 · Tentative 2',{exact:true}).waitFor();assert.equal(await page.locator('input[type="radio"]:checked').count(),0);
  const letters='BACBAABACBCC';
  for(let i=0;i<12;i++){await answer(i,i>=8?(letters[i]==='A'?'B':'A'):letters[i]);if(i<11)await page.getByRole('button',{name:'Question suivante →'}).click();}
  await page.getByRole('button',{name:'Terminer ma tentative'}).click();await page.getByRole('button',{name:'Confirmer la clôture définitive'}).click();await page.getByRole('heading',{name:'8/12 — Non réussi'}).waitFor();
  await page.getByRole('button',{name:'Voir mon bilan final'}).click();const state=await rpc('learner','state');assert.equal(state.best_score,9);assert.equal(state.last_score,8);assert.equal(state.status,'passed');assert.equal(state.can_start,false);
  await page.screenshot({path:`${qa}/learner-summary-desktop.png`,fullPage:true});assert.equal(await page.getByRole('button',{name:'Commencer la tentative 2',exact:true}).count(),0);
 });
 await test('Formateur habilité lit le résultat SQL, retrait bloque immédiatement la consultation',async()=>{
  await rpc('admin','grant',{user_id:fixtures.trainer,course_id:course,active:true});
  await page.goto(`${base}/?view=trainer`);await page.getByRole('heading',{name:'Vue générale',exact:true}).waitFor();
  await page.screenshot({path:`${qa}/trainer-desktop.png`,fullPage:true});await axe('formateur');
  await page.getByRole('button',{name:/Voir le détail/}).first().click();await page.getByRole('heading',{name:/détail en lecture seule/}).waitFor();
  await rpc('admin','grant',{user_id:fixtures.trainer,course_id:course,active:false});
  await page.getByRole('button',{name:'Actualiser les résultats'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('heading',{name:'Vue générale',exact:true}).count(),0);
 });
 await test('Administration gère une habilitation, employee et compte sans accès refusés',async()=>{
  await page.goto(`${base}/?view=admin`);await page.getByRole('heading',{name:'Habilitations formateur'}).waitFor();
  await page.getByLabel('Identifiant utilisateur (UUID)').fill(fixtures.trainer);await page.getByRole('button',{name:'Accorder l’habilitation AI Act'}).click();await page.getByRole('status').filter({hasText:'Habilitation enregistrée'}).waitFor();
  await page.screenshot({path:`${qa}/admin-desktop.png`,fullPage:true});await axe('administration');
  await page.goto(`${base}/?view=employee`);await page.getByRole('alert').waitFor();
  await page.goto(`${base}/?view=outsider`);await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Commencer',exact:true}).count(),0);
 });
 await test('Erreur réseau : aucune fausse sauvegarde, répétition contrôlée puis conflit autre appareil',async()=>{
  await page.goto(`${base}/?view=learner2`);await page.getByRole('button',{name:'Commencer',exact:true}).click();await page.getByText('Question 1/12 · Tentative 1',{exact:true}).waitFor();
  let failedRequest;let failOnce=true;
  await page.route('**/rpc',async route=>{
    const body=route.request().postDataJSON();if(body?.action==='save'&&failOnce){failOnce=false;failedRequest=body.payload.request_id;await route.abort('failed');}else await route.continue();
  });
  await page.locator('input[name="Q01"]').nth(1).click();await page.getByRole('alert').waitFor();
  assert.equal((await rpc('learner2','state')).attempts[0].answered_count,0);
  assert.equal(await page.locator('input[type="radio"]:checked').count(),0);assert.equal(await page.getByRole('button',{name:'Terminer ma tentative'}).isEnabled(),false);
  const nextSave=page.waitForRequest(req=>{try{return req.postDataJSON()?.action==='save';}catch{return false;}});
  await page.getByRole('button',{name:'Réessayer',exact:true}).click();const retry=await nextSave;assert.equal(retry.postDataJSON().payload.request_id,failedRequest);
  await page.getByRole('status').filter({hasText:'Réponse enregistrée et confirmée'}).waitFor();
  const a=(await rpc('learner2','state')).attempts[0];
  await rpc('learner2','save',{attempt_id:a.id,question_code:'Q01',option_code:'A',expected_revision:a.revision,request_id:crypto.randomUUID()});
  await page.locator('input[name="Q01"]').nth(2).click();await page.getByRole('button',{name:'Recharger les réponses',exact:true}).waitFor();
  assert.equal((await rpc('learner2','state')).attempts[0].answers.Q01,'A');
  await page.getByRole('button',{name:'Recharger les réponses',exact:true}).click();await page.getByRole('button',{name:'Reprendre ma tentative 1'}).waitFor();
  await page.unroute('**/rpc');
 });
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(blocked.length,0,blocked.join('\n'));
 const violations=accessibility.flatMap(x=>x.violations.map(v=>({screen:x.screen,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
 assert.equal(violations.length,0,JSON.stringify(violations));
 const databaseSnapshot=await (await context.request.get('http://127.0.0.1:4177/health')).json();
 await writeFile(`${qa}/browser-results.json`,JSON.stringify({passed:true,checks,databaseSnapshot,blockedExternalRequests:blocked,pageErrors:errors,accessibility:violations},null,2));
 console.log(`PASS ${checks.length} groupes navigateur ; ${violations.length} violations axe à examiner`);
}catch(error){await page.screenshot({path:`${qa}/browser-failure.png`,fullPage:true});await writeFile(`${qa}/browser-results.json`,JSON.stringify({passed:false,checks,error:error.message,stack:error.stack,pageErrors:errors,blockedExternalRequests:blocked,accessibility},null,2));console.error(error);process.exitCode=1;}
finally{await browser.close();}
