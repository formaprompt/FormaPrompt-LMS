import { Helmet } from 'react-helmet-async';
import { useEffect } from 'react';

export default function SEO({ title, description, url, image, type = 'website', jsonLd }) {
  useEffect(() => {
    const expectedHeadValues = [
      ['meta[name="description"]', 'content', description],
      ['meta[property="og:title"]', 'content', title],
      ['meta[property="og:description"]', 'content', description],
      ['meta[property="og:type"]', 'content', type],
      ['meta[property="og:url"]', 'content', url],
      ['meta[property="og:image"]', 'content', image],
      ['meta[name="twitter:card"]', 'content', 'summary_large_image'],
      ['meta[name="twitter:title"]', 'content', title],
      ['meta[name="twitter:description"]', 'content', description],
      ['meta[name="twitter:image"]', 'content', image],
      ['link[rel="canonical"]', 'href', url],
    ];

    const animationFrame = window.requestAnimationFrame(() => {
      expectedHeadValues.forEach(([selector, attribute, expectedValue]) => {
        const elements = Array.from(document.head.querySelectorAll(selector));

        if (!expectedValue) {
          elements.forEach((element) => element.remove());
          return;
        }

        let currentElement = elements.find(
          (element) => element.getAttribute(attribute) === expectedValue,
        ) || elements.at(-1);

        if (!currentElement && selector === 'link[rel="canonical"]') {
          currentElement = document.createElement('link');
          currentElement.setAttribute('rel', 'canonical');
          document.head.appendChild(currentElement);
        }

        currentElement?.setAttribute(attribute, expectedValue);
        elements
          .filter((element) => element !== currentElement)
          .forEach((element) => element.remove());
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [title, description, url, image, type]);

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
      {/* Données structurées adaptées à chaque page, ou Organization par défaut. */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData).replace(/</g, '\\u003c')}
      </script>
    </Helmet>
  );
}
