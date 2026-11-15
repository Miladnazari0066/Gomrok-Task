import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'خطای غیرمنتظره در اجرای سامانه رخ داد.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearSessionAndRetry = () => {
    try {
      sessionStorage.clear();
    } catch {
      // Ignore storage access errors in restricted browser contexts
    }
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen w-full bg-[#040711] text-slate-100 flex items-center justify-center p-6 font-sans"
        >
          <div className="glass-panel max-w-lg w-full p-6 sm:p-8 space-y-5 text-right border border-white/15">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center shrink-0 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-lalezar text-2xl text-slate-100">
                  خطا در بارگذاری سامانه گمرک
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  به‌جای نمایش صفحه سفید، جزئیات خطا جهت بازیابی سریع ثبت شد.
                </p>
              </div>
            </div>

            <div className="glass-panel-subtle p-3.5 text-xs text-rose-200/90 font-mono break-words border border-rose-500/25">
              {this.state.errorMessage}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="ios-glass-btn-cyan px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span>بارگذاری مجدد سامانه</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearSessionAndRetry}
                className="ios-glass-btn px-4 py-2.5 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>پاکسازی نشست و تلاش مجدد</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
