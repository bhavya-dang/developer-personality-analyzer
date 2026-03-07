import { motion } from "framer-motion";
import { Sparkles, Bot, FileText, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AISummary({ summary, onRefresh, loading = false }) {
  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ai-summary-card">
        <div className="ai-summary-header">
          <span className="ai-badge ai-badge-loading">
            <Sparkles size={13} />
            Generating report…
          </span>
        </div>
        <div className="ai-skeleton">
          {[100, 88, 95, 72, 90, 60].map((w, i) => (
            <div
              key={i}
              className="ai-skeleton-line shimmer"
              style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!summary || !summary.summary) {
    return null;
  }

  const { summary: text, source, error } = summary;
  const isAI = source === "openrouter";

  // ── Split text into paragraphs ───────────────────────────────────────────────
  // The text may come with \n\n paragraph breaks or just single \n breaks.
  // const paragraphs = text
  //   .split(/\n{2,}/) // split on blank lines first
  //   .flatMap((chunk) =>
  //     chunk.includes("\n")
  //       ? chunk.split("\n").filter(Boolean) // then split on single newlines
  //       : [chunk],
  //   )
  //   .map((p) => p.trim())
  //   .filter(Boolean);

  // ── Animation variants ───────────────────────────────────────────────────────
  const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  // const paraVariants = {
  //   hidden: { opacity: 0, y: 12 },
  //   visible: (i) => ({
  //     opacity: 1,
  //     y: 0,
  //     transition: { duration: 0.4, ease: "easeOut", delay: 0.1 + i * 0.08 },
  //   }),
  // };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="ai-summary-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <div className="ai-summary-header">
        <div className="ai-summary-title-row">
          <h3 className="ai-summary-title">
            {isAI ? <Bot size={17} /> : <FileText size={17} />}
            Personality Report
          </h3>

          {/* Source badge */}
          <span
            className={`ai-badge ${isAI ? "ai-badge-openrouter" : "ai-badge-template"}`}
          >
            {isAI ? (
              <>
                <Sparkles size={12} />
                AI-generated
              </>
            ) : (
              <>
                <FileText size={12} />
                Template
              </>
            )}
          </span>
        </div>

        {/* Optional: model + token usage info for AI results */}
        {/* {isAI && (model || tokensUsed) && (
          <p className="ai-model-info">
            {model && <span>Model: {model}</span>}
            {model && tokensUsed && <span className="ai-meta-dot">·</span>}
            {tokensUsed && <span>{tokensUsed} tokens used</span>}
          </p>
        )} */}

        {/* Show a soft notice if the AI call failed and we fell back */}
        {error && !isAI && (
          <p className="ai-fallback-notice">
            ⚠️ AI summary unavailable ({error}). Showing template report
            instead.
          </p>
        )}
      </div>

      {/* ── Prose body ── */}
      <div className="ai-summary-body">
        {/* {paragraphs.map((para, i) => {
          // Last paragraph gets a special "verdict" styling
          const isVerdict =
            i === paragraphs.length - 1 && paragraphs.length > 1;

          return (
            <motion.p
              key={i}
              className={`ai-paragraph ${isVerdict ? "ai-verdict" : ""}`}
              custom={i}
              variants={paraVariants}
              initial="hidden"
              animate="visible"
            >
              {isVerdict && (
                <span className="ai-verdict-icon" aria-hidden="true">
                  ✦
                </span>
              )}
              {para}
            </motion.p>
          );
        })} */}
        <div className="ai-summary-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="ai-summary-footer">
        {/* If we used the template and OpenRouter might be available, offer to retry with AI */}
        {!isAI && onRefresh && (
          <button
            className="ai-retry-btn"
            onClick={onRefresh}
            title="Re-analyze with AI summary (requires OPENROUTER_API_KEY on the server)"
          >
            <RefreshCw size={14} />
            Try AI summary
          </button>
        )}

        {/* Attribution */}
        {/* <span className="ai-attribution">
          {isAI
            ? `Via OpenRouter${summary.model ? ` · ${summary.model}` : ""} · For entertainment purposes`
            : "Deterministic report · Add OPENROUTER_API_KEY for AI summaries"}
        </span> */}
      </div>
    </motion.div>
  );
}
