import { Bot, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { trackStudioEvent } from '../analytics';
import {
  copyPromptForExternalService,
  EXTERNAL_AI_SERVICES,
  type ExternalAiService,
  type ExternalAiServiceId,
} from '../externalAi';

export function ExternalAiLauncher({ prompt }: { prompt: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [preparedService, setPreparedService] = useState<ExternalAiService | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');

  const prepareService = async (serviceId: ExternalAiServiceId) => {
    setPreparedService(null);
    try {
      const service = await copyPromptForExternalService(prompt, serviceId);
      setPreparedService(service);
      setStatus('ready');
      trackStudioEvent('external_service_selected', { actionType: serviceId });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="studio-external-launcher">
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={isOpen}
        aria-controls="studio-external-services"
        onClick={() => {
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState) trackStudioEvent('external_menu_opened');
        }}
      >
        <Bot aria-hidden="true" /> Tester dans mon IA
      </button>

      {isOpen && (
        <div id="studio-external-services">
          <h3 id="studio-external-title">Choisir un service externe</h3>
          <p>Le prompt sera d’abord copié. Aucun contenu ne sera ajouté à l’adresse du service.</p>
          <div className="studio-external-service-list">
            {EXTERNAL_AI_SERVICES.map((service) => (
              <button key={service.id} type="button" onClick={() => prepareService(service.id)}>
                {service.label} <span className="sr-only">— service externe</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="studio-external-status" aria-live="polite">
        {status === 'ready' && preparedService && (
          <div>
            <p><Check aria-hidden="true" /> Votre prompt a été copié. Le service sélectionné peut maintenant s’ouvrir dans un nouvel onglet. Vous pourrez y coller votre prompt.</p>
            <a href={preparedService.url} target="_blank" rel="noopener noreferrer">
              Ouvrir {preparedService.label} <ExternalLink aria-hidden="true" />
              <span className="sr-only"> dans un nouvel onglet — service externe</span>
            </a>
          </div>
        )}
        {status === 'error' && (
          <p>La copie a échoué. Copiez d’abord le prompt avec le bouton principal avant d’ouvrir un service externe.</p>
        )}
      </div>
    </section>
  );
}
