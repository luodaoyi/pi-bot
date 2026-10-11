import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={32} />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                出错了
              </h1>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                应用遇到了一个错误。请尝试刷新页面，如果问题持续存在，请联系支持团队。
              </p>

              {this.state.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="font-mono text-sm text-red-800 dark:text-red-200 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100">
                        查看堆栈跟踪
                      </summary>
                      <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto max-h-64">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const PageErrorBoundary: React.FC<{
  children: ReactNode;
  pageName?: string;
}> = ({ children, pageName }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-full p-8">
          <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-500" size={24} />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {pageName || '页面'}加载失败
              </h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              无法加载此页面的内容，请尝试刷新。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};
