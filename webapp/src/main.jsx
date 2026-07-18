import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

async function renderApplication() {
  const isPublicStudio = window.location.pathname === '/studio' || window.location.pathname === '/studio/';
  let application = app;

  if (!isPublicStudio) {
    const { AuthProvider } = await import('./contexts/AuthContext');
    application = <AuthProvider>{app}</AuthProvider>;
  }

  const rootElement = document.getElementById('root');

  if (isPublicStudio && rootElement.hasChildNodes()) {
    ReactDOM.hydrateRoot(rootElement, application);
    return;
  }

  ReactDOM.createRoot(rootElement).render(application);
}

renderApplication();
