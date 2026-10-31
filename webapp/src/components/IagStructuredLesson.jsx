import { createElement } from 'react';
import { iagElement, iagExternalLink } from '../lib/iagStructuredPolicy.js';
import { IagPrivateImage, IagPrivateResourceLink, IagPrivateVideo } from './IagPrivateResource.jsx';

export default function IagStructuredLesson({ document, lessonId, api, externalLinks, onDocument, onAction, headingOffset = 1 }) {
  function render(node, key) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'text') return typeof node.text === 'string' ? node.text : null;
    if (node.type !== 'element') return null;
    const children = (node.children || []).map((child,index) => render(child, `${key}-${index}`));
    const reference = node.reference || {};
    if (node.tag === 'a') {
      if (reference.documentId) return <button key={key} type="button" className="iag-document-link" onClick={() => onDocument(reference.documentId, reference.anchorId || null)}>{children}</button>;
      if (reference.applicationActionId && ['iag-course-outline','iag-progress-status'].includes(reference.applicationActionId)) return <button key={key} type="button" onClick={() => onAction(reference.applicationActionId)}>{children}</button>;
      if (reference.externalLinkId) {
        const href = iagExternalLink(externalLinks, reference.externalLinkId);
        return href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span key={key}>{children} (lien indisponible)</span>;
      }
      if (reference.resourceId) return <IagPrivateResourceLink key={key} api={api} lessonId={lessonId} resourceId={reference.resourceId}>{children}</IagPrivateResourceLink>;
      return <span key={key}>{children}</span>;
    }
    if (node.tag === 'img') return reference.resourceId ? <IagPrivateImage key={key} api={api} lessonId={lessonId} resourceId={reference.resourceId} alt={node.attributes?.alt || ''} /> : <span key={key}>Image indisponible.</span>;
    if (node.tag === 'video') {
      const source = node.children?.find(item => item.tag === 'source');
      const caption = node.children?.find(item => item.tag === 'track');
      return source?.reference?.resourceId ? <IagPrivateVideo key={key} api={api} lessonId={lessonId}
        resourceId={source.reference.resourceId} captionId={caption?.reference?.resourceId} title={node.attributes?.['aria-label'] || document.title} /> : <p key={key}>Vidéo indisponible ; consultez les explications écrites.</p>;
    }
    // source/track are only rendered inside the controlled video component.
    const element = iagElement(node, document.id);
    // The course owns H1; source headings retain their order and source anchors.
    if (element && /^h[1-6]$/.test(element.tag)) {
      const offset = Number.isInteger(headingOffset) && headingOffset >= 0 && headingOffset <= 5 ? headingOffset : 1;
      element.tag = `h${Math.min(6, Number(element.tag[1]) + offset)}`;
    }
    return element ? createElement(element.tag, { ...element.props, key }, ...children) : null;
  }
  return <article className="iag-structured-lesson" aria-label={document.title}>{document.blocks.map((node,index) => render(node, `node-${index}`))}</article>;
}
