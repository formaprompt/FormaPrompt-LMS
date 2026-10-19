import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPrerenderRequest, unavailableCalendarResponse } from './prerender-network-policy.mjs';

const request = {
  method: 'POST',
  url: 'https://crxodkbcukhjdejlcfpg.supabase.co/functions/v1/get-unified-availability',
  postData: JSON.stringify({ purpose: 'public_calendar', month: '2026-10' }),
};

test('le pré-rendu remplace exclusivement la lecture publique mensuelle exacte par une indisponibilité explicite', () => {
  assert.equal(classifyPrerenderRequest(request), 'unavailable_calendar');
  assert.equal(unavailableCalendarResponse.status, 503);
  assert.equal(unavailableCalendarResponse.headers['Cache-Control'], 'no-store');
  const payload = JSON.parse(unavailableCalendarResponse.body);
  assert.equal(payload.code, 'CALENDAR_UNAVAILABLE');
  assert.equal('slots' in payload, false);
  assert.equal('blocks' in payload, false);
  assert.notEqual(payload.status, 'available');
});

for (const [label, patch] of [
  ['autre projet', {url:request.url.replace('crxodkbcukhjdejlcfpg','otherproject')}],
  ['autre hôte', {url:'https://example.com/functions/v1/get-unified-availability'}],
  ['HTTP', {url:request.url.replace('https:','http:')}],
  ['query ajoutée', {url:request.url+'?admin=true'}],
  ['autre fonction', {url:request.url.replace('get-unified-availability','manage-calendar-booking')}],
  ['lecture administrative', {postData:JSON.stringify({purpose:'admin_cohort',month:'2026-10'})}],
  ['lecture formation', {postData:JSON.stringify({purpose:'course_booking',month:'2026-10'})}],
  ['champ supplémentaire', {postData:JSON.stringify({purpose:'public_calendar',month:'2026-10',action:'create'})}],
  ['mois invalide', {postData:JSON.stringify({purpose:'public_calendar',month:'2026-13'})}],
  ['tableau', {postData:JSON.stringify([{purpose:'public_calendar',month:'2026-10'}])}],
  ['JSON invalide', {postData:'not-json'}],
  ['absence corps', {postData:undefined}],
  ['PUT', {method:'PUT'}],
  ['DELETE', {method:'DELETE'}],
]) test(`aucune exception de mutation pour ${label}`, () => {
  assert.equal(classifyPrerenderRequest({...request,...patch}), 'block_mutation');
});

test('les lectures historiques GET/HEAD/OPTIONS restent autorisées', () => {
  for (const method of ['GET','HEAD','OPTIONS']) assert.equal(classifyPrerenderRequest({...request,method}), 'allow');
});
