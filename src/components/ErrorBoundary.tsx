import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught error:', error, errorInfo);

    this.setState({
      errorInfo: errorInfo.componentStack,
    });

    this.logErrorToDatabase(error, errorInfo).catch((err) => {
      console.error('Failed to log error to database:', err);
    });
  }

  async logErrorToDatabase(error: Error, errorInfo: any) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'error_boundary_caught',
        resource_type: 'system',
        resource_id: null,
        details: {
          error: error.toString(),
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
        ip_address: null,
      });
    } catch (logError) {
      console.error('Error logging failed:', logError);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
                <p className="text-gray-600 mt-1">
                  The application encountered an unexpected error
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
              <p className="text-sm text-gray-600 font-mono break-words">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Go to Homepage
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                This error has been logged and will be reviewed by our team. If the problem persists,
                please contact support.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                  Component Stack (Dev Only)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-4 rounded overflow-auto max-h-64">
                  {this.state.errorInfo}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
