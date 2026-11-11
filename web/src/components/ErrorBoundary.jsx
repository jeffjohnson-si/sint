import { Component } from 'react';

/**
 * Without this, one thrown error inside a page unmounts the whole tree and the
 * user gets a blank white screen with no way back.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('SINT screen crashed', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="empty" style={{ paddingTop: 64 }}>
        <div className="empty-title">Something broke on this screen</div>
        <p className="small muted" style={{ marginBottom: 4 }}>
          {error.message || 'Unexpected error'}
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
            Reload SINT
          </button>
        </div>
      </div>
    );
  }
}
