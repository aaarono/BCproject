import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md p-10 text-center">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="mb-4 text-muted-foreground">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
