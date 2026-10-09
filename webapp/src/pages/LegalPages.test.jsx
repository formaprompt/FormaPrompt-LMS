import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CGVConsumer from './CGVConsumer';
import CGVProfessional from './CGVProfessional';
import InternalRules from './InternalRules';
import Legal from './Legal';
import PrecontractualInformation from './PrecontractualInformation';
import Privacy from './Privacy';
import Footer from '../components/Footer';
import AiActChallengePrivacyNotice from '../components/AiActChallengePrivacyNotice';

vi.mock('../components/SEO', () => ({ default: () => null }));

function renderPage(Page) {
  return render(<MemoryRouter><Page /></MemoryRouter>);
}

describe('documents juridiques publiables', () => {
  afterEach(() => cleanup());

  it('sépare clairement les CGV particuliers et professionnels', () => {
    renderPage(CGVConsumer);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('particuliers');
    expect(screen.getByText(/dix jours à compter de la signature/i)).toBeVisible();
    expect(screen.getByText(/quatorze jours à compter de la conclusion/i)).toBeVisible();
    expect(screen.getByText(/21 juillet 2028/i)).toBeVisible();
    expect(screen.queryByText(/document préparatoire/i)).not.toBeInTheDocument();
    cleanup();

    renderPage(CGVProfessional);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('professionnels');
    expect(screen.queryByText(/droit de rétractation de quatorze jours/i)).not.toBeInTheDocument();
  });

  it('identifie les versions stables sans avertissement préparatoire', () => {
    renderPage(CGVConsumer);
    expect(screen.getByText('CGV B2C — version 2026-08-26')).toBeVisible();
    expect(screen.queryByText(/publication après validation/i)).not.toBeInTheDocument();
    cleanup();
    renderPage(CGVProfessional);
    expect(screen.getByText('CGV B2B — version 2026-08-26')).toBeVisible();
  });

  it('affiche la règle LMS de référence sans garantie perpétuelle', () => {
    renderPage(PrecontractualInformation);
    expect(screen.getByText(/sans limitation de durée prédéfinie/i)).toBeVisible();
    expect(screen.getByText(/tant que le service FormaPrompt et cette formation demeurent exploités/i)).toBeVisible();
  });

  it('décrit les traitements actuels et les prestataires réels', () => {
    renderPage(Privacy);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('confidentialité');
    expect(screen.getByText(/journal d’audit conserve les actions administratives sensibles/i)).toBeVisible();
    expect(screen.getAllByText(/Google Meet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Microsoft Teams/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/nécessite votre accord explicite dans la bannière/i)).toBeVisible();
    expect(screen.getByText(/aucun script ni signal publicitaire Google n'est chargé/i)).toBeVisible();
    expect(screen.getByText(/Le refus n'empêche pas la navigation, la connexion ou l'achat/i)).toBeVisible();
    expect(screen.getByText(/un ancien accord relatif aux stockages techniques ne vaut pas accord publicitaire/i)).toBeVisible();
    expect(screen.getByText(/retirer votre accord à tout moment via « Gérer mes cookies »/i)).toBeVisible();
    expect(screen.getByText(/recharge la page si la mesure a été chargée, sans supprimer les informations nécessaires à votre connexion/i)).toBeVisible();
    expect(screen.getByText(/montant, la devise et un identifiant de transaction opaque/i)).toBeVisible();
    expect(screen.getByText(/sans paramètres, fragments ni identifiants de session/i)).toBeVisible();
    expect(screen.getByText(/ni nom, adresse électronique, téléphone, identifiant de compte ou données de carte/i)).toBeVisible();
    expect(screen.getByText(/ni conversions avancées, ni remarketing, ni personnalisation publicitaire\. L'accord publicitaire ne vaut pas accord pour la mesure d'audience/i)).toBeVisible();
    screen.getAllByRole('link', { name: 'informations de confidentialité de Google' }).forEach((link) => expect(link).toHaveAttribute('href', 'https://policies.google.com/privacy'));
  });

  it('préserve les consentements et durées GA4 publiés avec le complément Challenge', () => {
    renderPage(Privacy);
    expect(screen.getByText(/Les choix publicitaire et d'audience sont séparés et facultatifs/i)).toBeVisible();
    expect(screen.getByText(/données d'événement pendant 2 mois et les données utilisateur pendant 14 mois/i)).toBeVisible();
    expect(screen.getByText(/Les espaces de connexion, de compte, d'administration et de formation/i)).toBeVisible();
    expect(screen.getByText(/Le choix d'audience est conservé 150 jours/i)).toBeVisible();
    expect(screen.getByText(/retrait de l'accord d'audience bloque les nouvelles mesures/i)).toBeVisible();
    expect(document.getElementById('ai-act-challenge')).toBeInTheDocument();
    expect(screen.getByText(/la base proposée est l’article 6, paragraphe 1 f\)/i)).toBeVisible();
    expect(screen.getByText(/Le jeu est facultatif/i)).toBeVisible();
    expect(screen.getByText(/La demande est examinée par une personne/i)).toBeVisible();
    expect(screen.getByText(/Les statistiques individuelles restent des données personnelles/i)).toBeVisible();
    expect(screen.getByText(/garanties des éventuels transferts hors de l’Espace économique européen/i)).toBeVisible();
    expect(screen.getByText(/contrats et exigences des financeurs reste à confirmer/i)).toBeVisible();
    expect(screen.getByText(/pas sur une autorisation générale de conserver toutes les données pendant 24 mois/i)).toBeVisible();
    expect(screen.getByText(/Aucune suppression automatique de données réelles n’est activée/i)).toBeVisible();
  });

  it('rend l’opposition accessible depuis la notice sans promettre un effacement automatique', () => {
    render(<AiActChallengePrivacyNotice />);
    expect(screen.getByText(/Le jeu est facultatif/i)).toBeVisible();
    expect(screen.getByText(/La demande est examinée par une personne/i)).not.toBeVisible();
    fireEvent.click(screen.getByText('Conservation et droits', { exact: true }));
    expect(screen.getByText(/elle n’entraîne pas automatiquement une suspension ou un effacement/i)).toBeVisible();
    expect(screen.getByText(/accompagnement pédagogique sans utiliser ce jeu/i)).toBeVisible();
    expect(screen.getByText(/exclues des vues et statistiques des formateurs/i)).toBeVisible();
    expect(screen.getByText(/sans réponse, score ni compteur de tentatives/i)).toBeVisible();
    expect(screen.getByText(/une date de revue passée ne réactivent pas la collecte/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'thierry@formaprompt.com' })).toHaveAttribute('href', 'mailto:thierry@formaprompt.com');
    expect(screen.getByText(/une prolongation motivée de deux mois/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'CNIL' })).toHaveAttribute('href', 'https://www.cnil.fr/');
  });

  it('présente CM2C dans les mentions légales', () => {
    renderPage(Legal);
    expect(screen.getByText(/Centre de la Médiation de la Consommation/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'www.cm2c.net' })).toHaveAttribute('href', 'https://www.cm2c.net/');
  });

  it('conserve la franchise en base sans inventer de TVA applicable', () => {
    for (const Page of [Legal, CGVConsumer, CGVProfessional, PrecontractualInformation]) {
      const { unmount } = renderPage(Page);
      const taxMentions = screen.getAllByText('TVA non applicable - article 293 B du CGI');
      expect(taxMentions).toHaveLength(Page === CGVProfessional ? 2 : 1);
      taxMentions.forEach((mention) => expect(mention).toBeVisible());
      expect(screen.queryByText(/^TVA applicable$/i)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('articule le règlement avec le workflow disciplinaire du Sprint 1', () => {
    renderPage(InternalRules);
    expect(screen.getByText(/mesure conservatoire/i)).toBeVisible();
    expect(screen.getByText(/décision disciplinaire est humaine/i)).toBeVisible();
    expect(screen.getByText(/conséquence technique éventuelle/i)).toBeVisible();
  });

  it('rend tous les documents prioritaires accessibles depuis le Footer', () => {
    renderPage(Footer);
    expect(screen.getByRole('link', { name: 'CGV particuliers' })).toHaveAttribute('href', '/cgv-particuliers');
    expect(screen.getByRole('link', { name: 'CGV professionnels' })).toHaveAttribute('href', '/cgv-professionnels');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/politique-confidentialite');
    expect(screen.getByRole('button', { name: 'Gérer mes cookies' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Règlement intérieur' })).toHaveAttribute('href', '/reglement-interieur');
    expect(screen.getByRole('link', { name: 'Informations précontractuelles' })).toHaveAttribute('href', '/informations-precontractuelles');
    expect(screen.getByRole('link', { name: 'Renoncer au contrat ici' })).toHaveAttribute('href', '/retractation');
  });
});
