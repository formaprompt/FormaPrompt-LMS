import test from 'node:test';
import assert from 'node:assert/strict';
import { getIagOffer, resolveIagIntentPurchase, validateIagStripeCatalog } from '../_shared/iagOffer.js';
import { getPurchaseConfig } from '../_shared/purchaseConfig.js';

test('IAG price switches exactly at midnight Paris on 1 January 2027', () => {
  const before=getPurchaseConfig('formation-ia-generative-elearning',new Date('2026-12-31T22:59:59.999Z'));
  const after=getPurchaseConfig('formation-ia-generative-elearning',new Date('2026-12-31T23:00:00.000Z'));
  assert.equal(before.amountTotal,7900);
  assert.equal(before.priceEnvName,'STRIPE_IAG_ELEARNING_INTRO_PRICE_ID');
  assert.equal(after.amountTotal,9900);
  assert.equal(after.priceEnvName,'STRIPE_IAG_ELEARNING_STANDARD_PRICE_ID');
});

test('locked 79 EUR snapshot is preserved when resuming after the date switch', () => {
  const current=getIagOffer(new Date('2027-02-01T12:00:00Z'));
  const intent={course_id:current.courseId,original_amount_cents:7900,catalog_price_id:'price_fictitious_intro',checkout_configuration_locked_at:'2026-12-31T22:59:00Z'};
  const env=name=>name==='STRIPE_IAG_ELEARNING_INTRO_PRICE_ID'?'price_fictitious_intro':'price_fictitious_standard';
  const resumed=resolveIagIntentPurchase(current,intent,env);
  assert.equal(current.amountTotal,9900);
  assert.equal(resumed.amountTotal,7900);
  assert.equal(resumed.priceEnvName,'STRIPE_IAG_ELEARNING_INTRO_PRICE_ID');
  assert.throws(()=>resolveIagIntentPurchase(current,{...intent,checkout_configuration_locked_at:null},env),/incohérente/);
  assert.throws(()=>resolveIagIntentPurchase(current,{...intent,catalog_price_id:'price_fictitious_other'},env),/incohérente/);
});

function catalog(amount,liveMode) {
  const purchase=getIagOffer(new Date(amount===7900?'2026-12-31T22:59:59Z':'2027-01-01T00:00:00Z'));
  return {purchase,price:{active:true,livemode:liveMode,currency:'eur',unit_amount:amount,recurring:null,metadata:{course_id:purchase.courseId}},
    product:{active:true,livemode:liveMode,metadata:{course_id:purchase.courseId,delivery_kind:'self_paced_elearning'}}};
}

test('IAG Stripe catalog accepts only its expected 79/99 EUR one-time prices in the requested mode', () => {
  for(const amount of [7900,9900]) for(const liveMode of [false,true]) {
    const {purchase,price,product}=catalog(amount,liveMode);
    assert.equal(validateIagStripeCatalog(purchase,price,product,liveMode),null);
  }
});

test('IAG Stripe catalog rejects wrong amount, currency, mode, recurrence and metadata', () => {
  const {purchase,price,product}=catalog(7900,false);
  const wrongPrices=[{active:false},{unit_amount:49700},{currency:'usd'},{livemode:true},{recurring:{interval:'month'}},{metadata:{}},{metadata:{course_id:'formation-ia'}}];
  for(const change of wrongPrices) assert.equal(typeof validateIagStripeCatalog(purchase,{...price,...change},product,false),'string');
  const wrongProducts=[{active:false},{deleted:true},{livemode:true},{metadata:{}},{metadata:{course_id:'formation-ia',delivery_kind:'self_paced_elearning'}},{metadata:{course_id:purchase.courseId,delivery_kind:'in_person'}}];
  for(const change of wrongProducts) assert.equal(typeof validateIagStripeCatalog(purchase,price,{...product,...change},false),'string');
});

test('historical 497 EUR formation-ia is unchanged by the IAG date and resume helpers', () => {
  const old=getPurchaseConfig('formation-ia',new Date('2026-12-31T22:59:59.999Z'));
  const after=getPurchaseConfig('formation-ia',new Date('2026-12-31T23:00:00Z'));
  assert.equal(old.amountTotal,49700);
  assert.equal(after,old);
  assert.equal(resolveIagIntentPurchase(old,{},()=>{throw Error('IAG config must not be read');}),old);
  assert.equal(validateIagStripeCatalog(old,null,null,false),null);
});

test('three written corrections, one revision each and two Paris calendar days remain contractual', () => {
  for(const instant of ['2026-12-31T22:59:59.999Z','2026-12-31T23:00:00Z']) {
    const offer=getIagOffer(new Date(instant));
    assert.deepEqual(offer.serviceCommitments,{writtenCorrections:3,revisionPassesPerWork:1,responseTimeDays:2,responseTimeBasis:'calendar_days',timeZone:'Europe/Paris',weekendsAndHolidaysIncluded:true});
    assert.deepEqual(offer.components,{service:true,digitalContent:true});
    assert.equal(offer.serviceTermsValidationRequired,true);
  }
});
