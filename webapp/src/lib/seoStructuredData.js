const SITE_URL = 'https://formaprompt.com'
const HOME_URL = `${SITE_URL}/`
const ABOUT_URL = `${SITE_URL}/a-propos`
const LOGO_URL = `${SITE_URL}/assets/logo-new.png`
const PORTRAIT_URL = `${SITE_URL}/assets/Photo_thierry_frezard.jpg?v=20260809`

const organization = {
  '@type': 'EducationalOrganization',
  '@id': `${SITE_URL}/#organization`,
  name: 'FormaPrompt',
  url: HOME_URL,
  logo: LOGO_URL,
}

function createBreadcrumb(url, label) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: HOME_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: label,
        item: url,
      },
    ],
  }
}

export function createCourseStructuredData({
  name,
  description,
  url,
  image,
  timeRequired,
  audience,
  teaches,
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Course',
        '@id': `${url}#course`,
        name,
        description,
        url,
        image,
        inLanguage: 'fr-FR',
        provider: { '@id': organization['@id'] },
        ...(timeRequired ? { timeRequired } : {}),
        ...(audience ? { audience: { '@type': 'Audience', audienceType: audience } } : {}),
        ...(teaches?.length ? { teaches } : {}),
      },
      createBreadcrumb(url, name),
    ],
  }
}

export function createServiceStructuredData({
  name,
  description,
  url,
  serviceType,
  audience,
  price,
  priceCurrency,
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name,
        description,
        url,
        inLanguage: 'fr-FR',
        provider: { '@id': organization['@id'] },
        serviceType,
        audience: { '@type': 'Audience', audienceType: audience },
        offers: {
          '@type': 'Offer',
          price,
          priceCurrency,
          url,
        },
      },
      createBreadcrumb(url, name),
    ],
  }
}

export function createAboutStructuredData() {
  const url = ABOUT_URL

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Person',
        '@id': `${url}#thierry-frezard`,
        name: 'Thierry FREZARD',
        url,
        image: PORTRAIT_URL,
        jobTitle: "Formateur professionnel d'adultes",
        worksFor: { '@id': organization['@id'] },
        knowsAbout: ['Intelligence artificielle générative', 'Prompt Engineering', 'Bureautique', 'Formation professionnelle'],
      },
      createBreadcrumb(url, 'À propos'),
    ],
  }
}
