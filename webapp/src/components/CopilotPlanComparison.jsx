import './CopilotPlanComparison.css';

// Les droits et les prix sont fournis par la page après vérification des sources.
function MobileLabel({ children }) {
  return <span className="copilot-plan-mobile-label" aria-hidden="true">{children}</span>;
}

export default function CopilotPlanComparison({ id, title, introduction, plans, personal = false }) {
  return <section className="copilot-plan-group" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{title}</h3>
    {introduction && <p>{introduction}</p>}
    <div className="copilot-plan-table-wrap">
      <table className={`copilot-plan-table ${personal ? 'copilot-personal-table' : 'copilot-business-table'}`}>
        <caption>{title} : prix, accès et limites</caption>
        <thead><tr>{(personal ? ['Offre personnelle', 'Au mois TTC', 'À l’année TTC', 'Office + Copilot', 'Niveau IA'] : ['Offre et prix HT / utilisateur', 'Chat et fichiers', 'Word, Excel, PowerPoint, Outlook', 'Licence et limites']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{plans.map(plan => personal ? <tr key={plan.name}>
          <th scope="row"><span className="copilot-plan-name">{plan.name}</span></th>
          <td><MobileLabel>Au mois TTC</MobileLabel><strong className="copilot-plan-price">{plan.monthly}</strong></td>
          <td><MobileLabel>À l’année TTC</MobileLabel><strong className="copilot-plan-price">{plan.annual}</strong>{plan.equivalent && <span className="copilot-plan-commitment">{plan.equivalent}</span>}</td>
          <td><MobileLabel>Office + Copilot</MobileLabel><p>{plan.apps}</p><strong>{plan.holder}</strong></td>
          <td><MobileLabel>Niveau IA</MobileLabel><p>{plan.level}</p></td>
        </tr> : <tr key={plan.name}>
          <th scope="row"><span className="copilot-plan-name">{plan.name}</span>{plan.prices.map(([label, amount]) => <p className="copilot-business-price" key={label}><span>{label}</span><strong>{amount}</strong></p>)}<strong className="copilot-base-required">{plan.base}</strong></th>
          <td><MobileLabel>Chat et fichiers</MobileLabel><p>{plan.chat}</p><p>{plan.files}</p></td>
          <td><MobileLabel>Dans les applications</MobileLabel><p>{plan.apps}</p></td>
          <td><MobileLabel>Licence et limites</MobileLabel><p>{plan.license}</p><p>{plan.limits}</p></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
