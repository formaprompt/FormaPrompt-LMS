import assert from 'node:assert/strict'
import test from 'node:test'

import { createAboutStructuredData, createCourseStructuredData, createServiceStructuredData } from './seoStructuredData.js'

test('les pages de formation exposent un Course relié à FormaPrompt et un fil d’Ariane', () => {
  const url = 'https://formaprompt.com/formation-test'
  const data = createCourseStructuredData({
    name: 'Formation test',
    description: 'Description de test',
    url,
    image: 'https://formaprompt.com/assets/test.png',
    timeRequired: 'PT7H',
    audience: 'Professionnels',
    teaches: ['Structurer une demande', 'Vérifier un résultat'],
  })

  const course = data['@graph'].find((item) => item['@type'] === 'Course')
  const provider = data['@graph'].find((item) => item['@type'] === 'EducationalOrganization')
  const breadcrumb = data['@graph'].find((item) => item['@type'] === 'BreadcrumbList')

  assert.equal(course.provider['@id'], provider['@id'])
  assert.equal(course.timeRequired, 'PT7H')
  assert.deepEqual(course.teaches, ['Structurer une demande', 'Vérifier un résultat'])
  assert.equal(breadcrumb.itemListElement[1].item, url)
})

test('les champs facultatifs absents ne produisent pas de données vides', () => {
  const data = createCourseStructuredData({
    name: 'Parcours sur mesure',
    description: 'Description de test',
    url: 'https://formaprompt.com/parcours-sur-mesure',
    image: 'https://formaprompt.com/assets/test.png',
  })
  const course = data['@graph'].find((item) => item['@type'] === 'Course')

  assert.equal('timeRequired' in course, false)
  assert.equal('audience' in course, false)
  assert.equal('teaches' in course, false)
})

test('la page à propos identifie Thierry FREZARD et son activité de formation', () => {
  const data = createAboutStructuredData()
  const person = data['@graph'].find((item) => item['@type'] === 'Person')

  assert.equal(person.name, 'Thierry FREZARD')
  assert.match(person.jobTitle, /Formateur/)
  assert.ok(person.knowsAbout.includes('Prompt Engineering'))
})

test('le Diagnostic IA expose un Service sans avis ni disponibilité inventés', () => {
  const url = 'https://formaprompt.com/diagnostic-ia'
  const data = createServiceStructuredData({
    name: 'Diagnostic IA Express',
    description: 'Diagnostic de test',
    url,
    serviceType: 'Diagnostic et conseil en usages de l’intelligence artificielle',
    audience: 'Professionnels et particuliers',
    price: '149',
    priceCurrency: 'EUR',
  })
  const service = data['@graph'].find((item) => item['@type'] === 'Service')

  assert.equal(service.offers.price, '149')
  assert.equal(service.offers.priceCurrency, 'EUR')
  assert.equal(service.provider['@id'], 'https://formaprompt.com/#organization')
  assert.equal('aggregateRating' in service, false)
  assert.equal('review' in service, false)
  assert.equal('availability' in service.offers, false)
})
