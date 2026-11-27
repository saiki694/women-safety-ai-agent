import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#060A17] px-6 text-center text-slate-100">
          <div className="max-w-md rounded-3xl border border-slate-800 bg-[#0D1328] p-7">
            <h1 className="font-display text-xl font-bold text-white">SHE-SHIELD AI Recovery</h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{this.state.message}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Reload App
              </button>
              <a
                href="tel:112"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Emergency Call 112
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onNeedReload() {
        // Avoid unexpected forced reload loops in preview iframes
      },
      onRegisterError() {
        // Non-blocking if browser/iframe restricts service workers
      },
    });
  }
} catch {
  // Service worker registration is progressive enhancement
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
}
