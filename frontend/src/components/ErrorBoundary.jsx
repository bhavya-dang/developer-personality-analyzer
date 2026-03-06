import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[ErrorBoundary] Render error caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 720,
            margin: "60px auto",
            padding: "32px 28px",
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16,
            fontFamily: "inherit",
            color: "#fca5a5",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: 12,
              color: "#f87171",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚠️ Something went wrong rendering this section
          </h2>

          <p style={{ fontSize: "0.875rem", marginBottom: 16, color: "#fca5a5" }}>
            The API response was received but a component crashed while trying to
            display it. The error message below should pinpoint the cause.
          </p>

          {/* Error message */}
          <pre
            style={{
              background: "rgba(0,0,0,0.35)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: "0.8rem",
              color: "#fecaca",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: 12,
            }}
          >
            {this.state.error?.toString()}
          </pre>

          {/* Component stack */}
          {this.state.info?.componentStack && (
            <details style={{ marginBottom: 20 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  color: "#fca5a5",
                  marginBottom: 6,
                  userSelect: "none",
                }}
              >
                Component stack
              </summary>
              <pre
                style={{
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: "0.72rem",
                  color: "#fda4af",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginTop: 6,
                }}
              >
                {this.state.info.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={() => {
              this.setState({ error: null, info: null });
              if (this.props.onReset) this.props.onReset();
            }}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
