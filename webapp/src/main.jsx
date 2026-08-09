import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { registerFormaPromptServiceWorker } from './pwa/registerServiceWorker.js';
import './index.css';

registerFormaPromptServiceWorker();

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);

function renderApplication() {
  const rootElement = document.getElementById('root');

  // Le build public contient des balises SEO sérialisées par le prérendu.
  // Elles doivent être retirées avant que React 19 ne crée ses propres balises
  // dans <head>, sinon deux propriétaires tentent de supprimer les mêmes nœuds.
  document.head
    .querySelectorAll('[data-formaprompt-seo="true"]')
    .forEach((element) => element.remove());

  ReactDOM.createRoot(rootElement).render(app);
}

renderApplication();
