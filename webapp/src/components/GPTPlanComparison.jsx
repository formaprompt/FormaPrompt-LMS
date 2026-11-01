import { organizationPlans, personalPlans, planAccess, pricingCheckedOn, pricingCurrencyNote, pricingNotes, pricingSources } from '../data/gptPlanComparison';

function PriceTable({ caption, rows }) {
  return <div className="gpt6-price-table-wrap"><table className="gpt6-price-table" role="table">
    <caption>{caption}</caption>
    <thead><tr><th scope="col">Offre</th><th scope="col">Tarif de référence</th><th scope="col">À retenir</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.name}>
      <th scope="row">{row.name}</th>
      <td><span className="gpt6-price-mobile-label" aria-hidden="true">Tarif de référence</span><strong className="gpt6-price">{row.price}</strong><span className="gpt6-price-small">{row.billing}</span></td>
      <td><span className="gpt6-price-mobile-label" aria-hidden="true">À retenir</span>{row.note}</td>
    </tr>)}</tbody>
  </table></div>;
}

export default function GPTPlanComparison() {
  return <section className="gpt-section gpt6-plans container" id="gpt6-abonnements" aria-labelledby="gpt6-plans-title">
    <div className="gpt-section-heading"><span className="gpt-step">Abonnements</span><h2 id="gpt6-plans-title">Prix et accès : choisir son forfait ChatGPT</h2><p>Le prix du forfait, les modèles accessibles et les limites d’usage sont trois repères à examiner séparément.</p></div>
    <p className="gpt6-price-date"><strong>Repères vérifiés le {pricingCheckedOn}.</strong> {pricingCurrencyNote}</p>
    <PriceTable caption="Comptes personnels : prix de référence en USD" rows={personalPlans} />
    <p>{pricingNotes.personal}</p>
    <details className="gpt6-team-plans"><summary>Équipes et organisations : Business et Enterprise</summary>
      <PriceTable caption="Organisations : prix de référence en USD par siège" rows={organizationPlans} />
      <p>{pricingNotes.business}</p>
    </details>

    <h3 id="gpt6-access-table-title">Les accès diffèrent entre Chat et Work/Codex</h3>
    <div className="gpt6-price-table-wrap"><table className="gpt6-price-table gpt6-access-table" role="table">
      <caption>Droits utiles au guide, selon le forfait et le déploiement</caption>
      <thead><tr><th scope="col">Offre</th><th scope="col">Chat classique</th><th scope="col">ChatGPT Work et Codex</th></tr></thead>
      <tbody>{planAccess.map((row) => <tr key={row.name}>
        <th scope="row">{row.name}</th>
        <td><span className="gpt6-price-mobile-label" aria-hidden="true">Chat classique</span>{row.chat}</td>
        <td><span className="gpt6-price-mobile-label" aria-hidden="true">ChatGPT Work et Codex</span>{row.work}</td>
      </tr>)}</tbody>
    </table></div>
    <p>{pricingNotes.access}</p>
    <p className="gpt6-plan-note">{pricingNotes.limits}</p>
    <p>{pricingNotes.speed}</p>

    <div className="gpt6-api-note"><h3>L’API suit une facturation distincte</h3><p>{pricingNotes.api}</p><a href={pricingSources[6].href} target="_blank" rel="noopener noreferrer">Vérifier les conditions des crédits API<span className="sr-only"> (nouvel onglet)</span></a></div>
    <p className="gpt6-price-sources">Sources officielles : {pricingSources.map((source, index) => <span key={source.href}>{index > 0 && ', '}<a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}<span className="sr-only"> (nouvel onglet)</span></a></span>)}.</p>
  </section>;
}
