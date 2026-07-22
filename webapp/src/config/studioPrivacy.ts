import { SITE_CONFIG } from './site';

export const STUDIO_PRIVACY_COPY = {
  home: `Votre brouillon est conservé uniquement dans votre navigateur. Aucune saisie n’est envoyée à ${SITE_CONFIG.name} ou à un fournisseur d’intelligence artificielle.`,
  storage: `Les informations saisies restent dans votre navigateur. Elles ne sont envoyées ni à ${SITE_CONFIG.name} ni à un fournisseur d’intelligence artificielle. Le brouillon est enregistré uniquement dans le stockage local de ce navigateur et peut être supprimé à tout moment.`,
  safeSituation: 'Vous pouvez décrire une situation professionnelle réelle, mais remplacez les noms, coordonnées, informations confidentielles et données sensibles par des termes génériques.',
  form: 'Décrivez votre situation sans saisir de nom, coordonnée, information confidentielle ou donnée sensible.',
} as const;
