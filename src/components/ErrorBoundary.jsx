import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-6 max-w-lg mx-auto my-8 bg-white rounded-lg shadow-xl border-l-4 border-red-500">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="mb-4 text-gray-700">
            The application encountered an error. You can try refreshing the page.
          </p>
          <details className="bg-gray-100 p-4 rounded-md">
            <summary className="cursor-pointer font-medium mb-2">Error details</summary>
            <p className="text-red-500 font-mono text-sm whitespace-pre-wrap">
              {this.state.error && this.state.error.toString()}
            </p>
            <div className="mt-3 text-xs font-mono bg-gray-200 p-2 rounded overflow-auto max-h-40">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 bg-primary text-white px-4 py-2 rounded hover:bg-primary-light transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 