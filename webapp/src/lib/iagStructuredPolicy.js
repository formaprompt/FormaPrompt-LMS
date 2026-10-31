const tags = new Set('main section div article nav header footer aside h1 h2 h3 h4 h5 h6 p span label ul ol li dl dt dd table caption thead tbody tfoot tr th td strong em b i small mark code pre details summary figure figcaption br hr blockquote abbr'.split(' '));
export function iagAnchor(documentId, anchorId) {
  return /^iag-d-[a-f0-9]{20}$/.test(documentId || '') && /^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(anchorId || '')
    ? `iag-${documentId}-${anchorId}` : undefined;
}
export function iagElement(node, documentId) {
  if (!tags.has(node?.tag)) return null;
  const source = node.attributes || {}, props = {};
  const id = iagAnchor(documentId, source.id);
  if (id) props.id = id;
  for (const field of ['title','aria-label','lang']) if (typeof source[field] === 'string') props[field] = source[field].slice(0,500);
  if (['row','col','rowgroup','colgroup'].includes(source.scope)) props.scope = source.scope;
  for (const [field, prop] of [['colspan','colSpan'],['rowspan','rowSpan']]) {
    const number = Number(source[field]);
    if (Number.isInteger(number) && number >= 1 && number <= 50) props[prop] = number;
  }
  return { tag: node.tag === 'main' ? 'div' : node.tag === 'label' ? 'span' : node.tag, props };
}
export function iagExternalLink(links, id) {
  const candidate = Array.isArray(links) ? links.find(item => item.id === id) : null;
  try {
    const url = new URL(candidate?.url);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
