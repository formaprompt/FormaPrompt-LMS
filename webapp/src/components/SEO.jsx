import { Helmet } from 'react-helmet-async';

export default function SEO({
  title,
  description,
  url,
  image,
  type = 'website',
  jsonLd,
  robots = 'index, follow',
}) {
  const structuredData = jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    url,
    logo: image || '',
    name: 'FormaPrompt',
  };

  return (
    <Helmet>
      <title data-formaprompt-seo="true">{title}</title>
      <meta data-formaprompt-seo="true" name="description" content={description} />
      <meta data-formaprompt-seo="true" name="robots" content={robots} />
      {url && <link data-formaprompt-seo="true" rel="canonical" href={url} />}
      {/* Open Graph */}
      <meta data-formaprompt-seo="true" property="og:title" content={title} />
      <meta data-formaprompt-seo="true" property="og:description" content={description} />
      <meta data-formaprompt-seo="true" property="og:type" content={type} />
      {url && <meta data-formaprompt-seo="true" property="og:url" content={url} />}
      {image && <meta data-formaprompt-seo="true" property="og:image" content={image} />}
      {/* Twitter Card */}
      <meta data-formaprompt-seo="true" name="twitter:card" content="summary_large_image" />
      <meta data-formaprompt-seo="true" name="twitter:title" content={title} />
      <meta data-formaprompt-seo="true" name="twitter:description" content={description} />
      {image && <meta data-formaprompt-seo="true" name="twitter:image" content={image} />}
      {/* Données structurées adaptées à chaque page, ou Organization par défaut. */}
      <script data-formaprompt-seo="true" type="application/ld+json">
        {JSON.stringify(structuredData).replace(/</g, '\\u003c')}
      </script>
    </Helmet>
  );
}
