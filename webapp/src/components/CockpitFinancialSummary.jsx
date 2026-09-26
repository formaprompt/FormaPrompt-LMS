import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/cockpitAdministration';

function FinancialRow({ label, value, important = false }) {
  return <div className={important ? 'is-important' : ''}><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function CockpitFinancialSummary({ rows = [], stripeActionCount = 0 }) {
  return (
    <section className="cockpit-panel cockpit-financial-detail" aria-labelledby="cockpit-finance-title">
      <div className="cockpit-section-heading">
        <div>
          <p>Période sélectionnée</p>
          <h2 id="cockpit-finance-title">Suivi financier détaillé</h2>
        </div>
        <span>{stripeActionCount} alerte{stripeActionCount === 1 ? '' : 's'} Stripe</span>
      </div>

      {rows.length ? (
        <div className="cockpit-financial-detail__currencies">
          {rows.map((row) => (
            <article key={row.currency}>
              <header><h3>{String(row.currency || 'eur').toUpperCase()}</h3><span>Estimation locale</span></header>
              <dl>
                <FinancialRow label="Formation encaissée brute" value={formatMoney(row.gross_training_cents, row.currency)} />
                <FinancialRow label="Frais de déplacement" value={formatMoney(row.travel_fee_cents, row.currency)} />
                <FinancialRow label="Remboursements confirmés" value={formatMoney(row.successful_refund_cents, row.currency)} />
                <FinancialRow label="Litiges ouverts" value={formatMoney(row.open_dispute_cents, row.currency)} />
                <FinancialRow label="Litiges perdus" value={formatMoney(row.lost_dispute_cents, row.currency)} />
                <FinancialRow label="Net formation estimé" value={formatMoney(row.estimated_net_training_cents, row.currency)} important />
                <FinancialRow label="Net Stripe estimé" value={formatMoney(row.estimated_net_stripe_cents, row.currency)} important />
              </dl>
            </article>
          ))}
        </div>
      ) : <p className="cockpit-muted">Aucun mouvement Stripe sur la période.</p>}

      <footer>
        <p>Ces montants proviennent des registres locaux. Ils ne remplacent ni le solde Stripe ni le relevé bancaire.</p>
        <div>
          <Link to="/admin/finance">Ouvrir la synthèse financière</Link>
          <Link to="/admin/stripe-apres-paiement">Contrôler le registre Stripe</Link>
        </div>
      </footer>
    </section>
  );
}
