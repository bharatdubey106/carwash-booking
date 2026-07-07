// components/dashboard/DashboardErrorBoundary.tsx
'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}
interface State {
  hasError: boolean;
  message: string;
}

export default class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Something went wrong.' };
  }

  componentDidCatch(error: unknown) {
    console.error('Dashboard panel crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700">{this.props.fallbackTitle ?? 'This panel failed to load.'}</p>
          <p className="mt-1 text-xs text-red-600">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}