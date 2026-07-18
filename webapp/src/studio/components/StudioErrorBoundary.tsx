import { Component, type ErrorInfo, type ReactNode } from 'react';

interface StudioErrorBoundaryProps {
  children: ReactNode;
}

interface StudioErrorBoundaryState {
  hasError: boolean;
}

export class StudioErrorBoundary extends Component<StudioErrorBoundaryProps, StudioErrorBoundaryState> {
  state: StudioErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): StudioErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Le Studio n’a pas pu être affiché.', error, errorInfo);
  }

  private reloadStudio = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="studio-error-fallback" role="alert" aria-labelledby="studio-error-title">
        <div className="container">
          <p className="studio-eyebrow">Studio momentanément indisponible</p>
          <h1 id="studio-error-title">La page n’a pas pu être affichée</h1>
          <p>
            Votre saisie n’a pas été enregistrée ni transmise. Actualisez la page pour réessayer.
            Si le problème persiste, revenez à l’accueil et signalez-le à FormaPrompt.
          </p>
          <div className="studio-error-actions">
            <button type="button" className="btn btn-primary" onClick={this.reloadStudio}>Actualiser le Studio</button>
            <a className="btn btn-outline" href="/">Revenir à l’accueil</a>
          </div>
        </div>
      </section>
    );
  }
}
