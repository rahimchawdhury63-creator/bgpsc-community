import { Component, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Report to error monitoring
    supabase.from('error_events').insert({
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      user_agent: navigator.userAgent,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="card max-w-md text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="mt-4 text-xl font-bold">কিছু একটা সমস্যা হয়েছে</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Something went wrong. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary mt-4"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
