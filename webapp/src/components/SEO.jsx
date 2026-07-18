import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, url, image, type = 'website', jsonLd }) {
  const structuredData = jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    url,
    logo: image || '',
    name: 'FormaPrompt',
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
      {/* Canonical */}
      <link rel="canonical" href={url} />
      {/* Données structurées adaptées à chaque page, ou Organization par défaut. */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData).replace(/</g, '\\u003c')}
      </script>
    </Helmet>
  );
}
