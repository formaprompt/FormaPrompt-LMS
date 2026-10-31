import { useEffect, useRef, useState } from 'react';
import { activateIagVideoGrant } from '../lib/iagIonVideo.js';

function usePrivateResource(api, lessonId, resourceId) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  // Keep the current media mounted during renewal of this exact owner/resource.
  // A different API instance or lesson/resource never inherits that media.
  const scope = `${lessonId}:${resourceId}`;
  useEffect(() => {
    let active = true, timer;
    const abort = new AbortController();
    api.resource(lessonId, resourceId).then(async resource => {
      if (!active) return;
      if (resource.videoGrant) {
        const url = await activateIagVideoGrant(resource, { lessonId, resourceId, signal: abort.signal, isCurrent: () => active });
        if (!active) return;
        resource = { ...resource, url };
      }
      setResult({ api, scope, resource, error: '' });
      timer = setTimeout(() => setRevision(value => value + 1), Math.max(1000, Date.parse(resource.expiresAt) - Date.now() - 15000));
    }).catch(error => {
      if (active) setResult({ api, scope, resource: null,
        error: error.code === 'IAG_RESOURCE_NOT_IMPORTED'
          ? 'Cette ressource privée n’est pas encore disponible. Les explications écrites restent consultables.'
          : error.code === 'IAG_RESOURCE_USE_DOCUMENT'
            ? 'Consultez la version écrite de ce document dans la leçon.'
            : error.message || 'Cette ressource ne peut pas être chargée.' });
    });
    return () => { active = false; abort.abort(); clearTimeout(timer); };
  }, [api, lessonId, resourceId, scope, revision]);
  return { resource: result?.api === api && result.scope === scope ? result.resource : null,
    error: result?.api === api && result.scope === scope ? result.error : '',
    renew: () => setRevision(value => value + 1) };
}

export function IagPrivateImage({ api, lessonId, resourceId, alt }) {
  const { resource, error, renew } = usePrivateResource(api, lessonId, resourceId);
  if (error) return <span><span role="status">{error}</span> <button type="button" onClick={renew}>Réessayer l’image</button></span>;
  if (!resource) return <span role="status">Chargement de l’image privée.</span>;
  if (!['image/png','image/jpeg'].includes(resource.mime)) return <span role="alert">Format d’image indisponible.</span>;
  return <img src={resource.url} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" />;
}

function CaptionTrack({ api, lessonId, resourceId }) {
  const { resource } = usePrivateResource(api, lessonId, resourceId);
  return resource?.mime === 'text/vtt' && resource.captionStatus === 'verified-synchronized'
    ? <track kind="captions" src={resource.url} srcLang="fr" label="Français" default /> : null;
}

export function IagPrivateVideo({ api, lessonId, resourceId, captionId, title }) {
  const { resource, error, renew } = usePrivateResource(api, lessonId, resourceId);
  const video = useRef(null);
  const position = useRef(0);
  const [playbackError, setPlaybackError] = useState('');
  useEffect(() => () => { position.current = 0; }, [lessonId, resourceId]);
  if (error) return <section><p role="status">{error}</p><button type="button" onClick={renew}>Réessayer la vidéo</button></section>;
  if (!resource) return <p role="status">Chargement de la vidéo privée.</p>;
  if (resource.mime !== 'video/mp4') return <p role="alert">Format vidéo indisponible.</p>;
  return <section aria-label={title || 'Vidéo de la leçon'}>
    <video ref={video} controls preload="metadata" crossOrigin={resource.videoGrant ? 'use-credentials' : 'anonymous'} className="course-video"
      aria-label={title || 'Vidéo de la leçon'} src={resource.url}
      onTimeUpdate={() => { position.current = video.current?.currentTime || 0; }}
      onLoadedMetadata={() => { if (video.current && Number.isFinite(position.current)) video.current.currentTime = position.current; }}
      onError={() => setPlaybackError('La vidéo ne peut pas être lue. Vous pouvez renouveler son accès ou lire la transcription.')}>
      {captionId && <CaptionTrack api={api} lessonId={lessonId} resourceId={captionId} />}
      Votre navigateur ne peut pas lire la vidéo. Consultez les explications écrites et la transcription de la leçon.
    </video>
    <p>Les sous-titres sont proposés lorsqu’une version synchronisée a été vérifiée. La transcription reste accessible dans les documents de la leçon.</p>
    {playbackError && <p role="alert">{playbackError}</p>}
    <button type="button" onClick={() => { setPlaybackError(''); renew(); }}>Renouveler l’accès à cette vidéo</button>
  </section>;
}

export function IagPrivateResourceLink({ api, lessonId, resourceId, children }) {
  const [opened, setOpened] = useState(false);
  return opened ? <OpenedResource key={`${lessonId}:${resourceId}`} api={api} lessonId={lessonId} resourceId={resourceId}>{children}</OpenedResource>
    : <button type="button" onClick={() => setOpened(true)}>{children}</button>;
}
function OpenedResource({ api, lessonId, resourceId, children }) {
  const { resource, error, renew } = usePrivateResource(api, lessonId, resourceId);
  if (error) return <span><span role="status">{error}</span> <button type="button" onClick={renew}>Réessayer la ressource</button></span>;
  if (!resource) return <span role="status">Préparation du lien privé.</span>;
  if (['text/plain', 'text/csv'].includes(resource.mime)) return <PrivateTextResource
    api={api} lessonId={lessonId} resourceId={resourceId} resource={resource} onRetry={renew}>{children}</PrivateTextResource>;
  return <a href={resource.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a>;
}

function PrivateTextResource({ api, lessonId, resourceId, resource, onRetry, children }) {
  const [result, setResult] = useState(null);
  const expires = Date.parse(resource.expiresAt);
  const current = result?.api === api && result.lessonId === lessonId && result.resourceId === resourceId && result.resource === resource;
  useEffect(() => {
    let active = true;
    let viewUrl = null, downloadUrl = null;
    const abort = new AbortController();
    const releaseUrls = () => {
      for (const url of [viewUrl, downloadUrl]) if (url) URL.revokeObjectURL(url);
      viewUrl = null;
      downloadUrl = null;
    };
    const save = value => { if (active) setResult({ api, lessonId, resourceId, resource, ...value }); };
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      save({ error: 'L’accès à ce support a expiré. Renouvelez son accès.', text: null, valid: false });
      releaseUrls();
      return () => { active = false; abort.abort(); };
    }
    const timer = setTimeout(() => {
      save({ error: 'L’accès à ce support a expiré. Renouvelez son accès.', text: null, valid: false });
      releaseUrls();
      active = false;
      abort.abort();
    }, expires - Date.now());
    (async () => {
      try {
        const response = await fetch(resource.url, {
          credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', signal: abort.signal,
        });
        if (!response.ok || response.redirected) throw new Error('PRIVATE_TEXT_FETCH_FAILED');
        const bytes = await response.arrayBuffer();
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (!active || abort.signal.aborted) return;
        if (Date.now() >= expires) throw new Error('PRIVATE_TEXT_EXPIRED');
        // Raw ArrayBuffers preserve every byte, including an existing CSV BOM.
        // The view MIME prevents browser charset guessing; Storage stays untouched.
        viewUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=utf-8' }));
        downloadUrl = URL.createObjectURL(new Blob([bytes], { type: `${resource.mime};charset=utf-8` }));
        save({ text, viewUrl, downloadUrl, error: '', valid: true });
      } catch {
        releaseUrls();
        // Never display signed URLs, response bodies or a guessed alternative encoding.
        save({ text: null, valid: Date.now() < expires, error: 'Le texte de ce support ne peut pas être lu. Renouvelez son accès ou utilisez le lien d’origine.' });
      }
    })();
    return () => { active = false; abort.abort(); clearTimeout(timer); releaseUrls(); };
  }, [api, lessonId, resourceId, resource, expires]);
  const valid = current && result.valid === true;
  const error = current ? result.error : '';
  const extension = resource.mime === 'text/csv' ? 'csv' : 'txt';
  const suggestedName = typeof resource.fileName === 'string'
    && new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]{0,150}[.]${extension}$`, 'i').test(resource.fileName)
    ? resource.fileName : `support-prive.${extension}`;
  return <span className="iag-private-text-resource">
    {valid && result.viewUrl && <span>
      <a href={result.viewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children} — lire la fiche</a>{' '}
      <a href={result.downloadUrl} download={suggestedName} referrerPolicy="no-referrer">Télécharger le fichier</a>{' '}
    </span>}
    {valid && <a href={resource.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Lien d’origine</a>}
    {error ? <span><span role="status">{error}</span> <button type="button" onClick={onRetry}>Renouveler l’accès au support</button></span>
      : current && valid && typeof result.text === 'string'
        ? <span aria-label="Contenu du support privé" style={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.text}</span>
        : <span role="status">Chargement du texte privé.</span>}
  </span>;
}
