// components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignorer les erreurs de rate limiting et réseau
    if (error.message.includes('rate limit') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('429')) {
      console.warn('Erreur non critique capturée:', error.message);
      this.setState({ hasError: false });
      return;
    }
    
    console.error('Erreur capturée:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Oups ! Quelque chose s'est mal passé
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'Une erreur inattendue est survenue'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
