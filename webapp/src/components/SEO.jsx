import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, url, image, type = 'website' }) {
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
      {/* Structured data for Organization */}
      <script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "url": "${url}",
            "logo": "${image || ''}",
            "name": "FormaPrompt"
          }
        `}
      </script>
    </Helmet>
  );
}
