import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';
import { SITE_CONFIG } from '../config/site';
import './Contact.css';

const CONTACT_LIMITS = {
  name: { min: 2, max: 150 },
  email: { max: 320 },
  message: { min: 10, max: 5000 },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactForm(formData) {
  const errors = {};
  const name = formData.name.trim();
  const email = formData.email.trim();
  const message = formData.message.trim();

  if (name.length < CONTACT_LIMITS.name.min) {
    errors.name = 'Indiquez votre nom ou celui de votre organisme (2 caractères minimum).';
  } else if (name.length > CONTACT_LIMITS.name.max) {
    errors.name = 'Le nom ne doit pas dépasser 150 caractères.';
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Saisissez une adresse e-mail valide, par exemple nom@entreprise.com.';
  } else if (email.length > CONTACT_LIMITS.email.max) {
    errors.email = 'L’adresse e-mail ne doit pas dépasser 320 caractères.';
  }

  if (message.length < CONTACT_LIMITS.message.min) {
    errors.message = 'Décrivez votre demande en au moins 10 caractères.';
  } else if (message.length > CONTACT_LIMITS.message.max) {
    errors.message = 'Le message ne doit pas dépasser 5 000 caractères.';
  }

  return errors;
}

export default function Contact() {
  const [searchParams] = useSearchParams();
  const isAiActRegistration = searchParams.get('formation') === 'ia-act';
  const initialFormData = {
    name: '',
    email: '',
    requestType: 'individual',
    subject: isAiActRegistration ? 'Demande de programme' : 'Demande de devis',
    message: isAiActRegistration
      ? "Je souhaite recevoir les modalités d'inscription à la formation « IA : acculturation et préparation à la conformité AI Act » au tarif promotionnel de 187 €."
      : '',
  };
  const [formData, setFormData] = useState(initialFormData);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const messageRef = useRef(null);
  const statusRef = useRef(null);

  const fieldRefs = {
    name: nameRef,
    email: emailRef,
    message: messageRef,
  };

  const focusAfterRender = (ref) => {
    window.setTimeout(() => ref.current?.focus(), 0);
  };

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    if (status === 'error') setStatus('idle');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateContactForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus('idle');
      const firstInvalidField = ['name', 'email', 'message'].find((field) => errors[field]);
      if (firstInvalidField) focusAfterRender(fieldRefs[firstInvalidField]);
      return;
    }

    setFieldErrors({});
    setStatus('loading');

    const request = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      request_type: formData.requestType,
      funding_requested: formData.requestType === 'funding',
      subject: formData.subject,
      message: formData.message.trim(),
    };

    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert([request]);

      if (error) throw error;

      setStatus('success');
      setFormData(initialFormData);
      focusAfterRender(statusRef);
    } catch (error) {
      console.error('Échec de la demande de contact', error);
      setStatus('error');
      focusAfterRender(statusRef);
    }
  };

  const messageLength = formData.message.trim().length;

  return (
    <>
      <SEO
        title="Contact – FormaPrompt"
        description="Échangez directement avec FormaPrompt au sujet de vos besoins en formation, accompagnement et accessibilité."
        url={`${SITE_CONFIG.baseUrl}/contact`}
        image={SITE_CONFIG.assets.logo}
      />

      <div className="contact-page container section">
        <header className="contact-hero">
          <p className="contact-eyebrow">Échangeons sur votre projet</p>
          <h1>Contacter FormaPrompt</h1>
          <p>
            Formation, programme, devis ou besoin d’accessibilité&nbsp;: présentez votre demande
            et recevez une réponse adaptée à votre situation.
          </p>
        </header>

        <div className="contact-layout">
          <aside className="contact-details" aria-labelledby="contact-details-title">
            <div>
              <h2 id="contact-details-title">Un échange simple et direct</h2>
              <p>
                Vous échangez directement avec {SITE_CONFIG.responsibleDisplayName},
                formateur et concepteur de FormaPrompt.
              </p>
            </div>

            <a className="contact-email" href={`mailto:${SITE_CONFIG.contactEmail}`}>
              <Mail aria-hidden="true" size={22} />
              <span>
                <strong>Écrire par courriel</strong>
                <span>{SITE_CONFIG.contactEmail}</span>
              </span>
            </a>

            <div className="contact-privacy-note">
              <ShieldCheck aria-hidden="true" size={22} />
              <p>
                Vos informations servent uniquement à répondre à votre demande. Ne transmettez
                pas de donnée sensible. <Link to="/confidentialite">En savoir plus</Link>
              </p>
            </div>
          </aside>

          <section className="contact-form-card" aria-labelledby="contact-form-title">
            {status === 'success' ? (
              <div
                className="contact-status contact-status-success"
                role="status"
                aria-live="polite"
                tabIndex="-1"
                ref={statusRef}
              >
                <CheckCircle2 aria-hidden="true" size={38} />
                <h2>Votre demande a bien été transmise</h2>
                <p>
                  FormaPrompt vous répondra à l’adresse indiquée dans les meilleurs délais.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="btn btn-outline"
                >
                  Envoyer une autre demande
                </button>
              </div>
            ) : (
              <>
                <div className="contact-form-heading">
                  <h2 id="contact-form-title">Parlez-moi de votre besoin</h2>
                  <p>Les champs marqués d’un astérisque sont obligatoires.</p>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">
                      Nom ou organisme <span aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={nameRef}
                      type="text"
                      id="name"
                      name="name"
                      required
                      minLength={CONTACT_LIMITS.name.min}
                      maxLength={CONTACT_LIMITS.name.max}
                      autoComplete="name"
                      className={`form-input ${fieldErrors.name ? 'contact-field-invalid' : ''}`}
                      placeholder="Votre nom ou le nom de votre organisme"
                      value={formData.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    />
                    {fieldErrors.name && (
                      <p className="contact-field-error" id="name-error" role="alert">
                        <AlertCircle aria-hidden="true" size={18} />
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="email">
                      Adresse e-mail <span aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      id="email"
                      name="email"
                      required
                      maxLength={CONTACT_LIMITS.email.max}
                      autoComplete="email"
                      inputMode="email"
                      className={`form-input ${fieldErrors.email ? 'contact-field-invalid' : ''}`}
                      placeholder="nom@entreprise.com"
                      value={formData.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    />
                    {fieldErrors.email && (
                      <p className="contact-field-error" id="email-error" role="alert">
                        <AlertCircle aria-hidden="true" size={18} />
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="request-type">
                      Votre situation
                    </label>
                    <select
                      id="request-type"
                      name="requestType"
                      className="form-input"
                      value={formData.requestType}
                      onChange={(event) => updateField('requestType', event.target.value)}
                    >
                      <option value="individual">Particulier</option>
                      <option value="professional">Entreprise ou professionnel</option>
                      <option value="beneficiary">Bénéficiaire d’une formation</option>
                      <option value="funding">Demande avec financement</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="subject">
                      Sujet de votre demande
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      className="form-input"
                      value={formData.subject}
                      onChange={(event) => updateField('subject', event.target.value)}
                    >
                      <option>Demande de devis</option>
                      <option>Demande de programme</option>
                      <option>Formation sur mesure</option>
                      <option>Autre question</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <div className="contact-label-row">
                      <label className="form-label" htmlFor="message">
                        Message <span aria-hidden="true">*</span>
                      </label>
                      <span className="contact-character-count" aria-hidden="true">
                        {messageLength} / {CONTACT_LIMITS.message.max}
                      </span>
                    </div>
                    <textarea
                      ref={messageRef}
                      id="message"
                      name="message"
                      required
                      minLength={CONTACT_LIMITS.message.min}
                      maxLength={CONTACT_LIMITS.message.max}
                      className={`form-textarea ${fieldErrors.message ? 'contact-field-invalid' : ''}`}
                      placeholder="Décrivez votre besoin, le public concerné et le résultat attendu."
                      value={formData.message}
                      onChange={(event) => updateField('message', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.message)}
                      aria-describedby={`message-help${fieldErrors.message ? ' message-error' : ''}`}
                    />
                    <p className="contact-field-help" id="message-help">
                      10 caractères minimum. Évitez toute donnée personnelle ou sensible inutile.
                    </p>
                    {fieldErrors.message && (
                      <p className="contact-field-error" id="message-error" role="alert">
                        <AlertCircle aria-hidden="true" size={18} />
                        {fieldErrors.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="btn btn-primary contact-submit"
                  >
                    <Send aria-hidden="true" size={19} />
                    {status === 'loading' ? 'Envoi en cours…' : 'Envoyer ma demande'}
                  </button>

                  <div className="contact-feedback-slot">
                    {status === 'error' && (
                      <div
                        className="contact-status contact-status-error"
                        role="alert"
                        aria-live="assertive"
                        tabIndex="-1"
                        ref={statusRef}
                      >
                        <AlertCircle aria-hidden="true" size={24} />
                        <div>
                          <h3>Votre demande n’a pas pu être envoyée</h3>
                          <p>
                            Vos informations sont conservées à l’écran. Réessayez dans quelques
                            instants ou écrivez directement à{' '}
                            <a href={`mailto:${SITE_CONFIG.contactEmail}`}>
                              {SITE_CONFIG.contactEmail}
                            </a>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
