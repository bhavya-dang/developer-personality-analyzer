import { motion } from "framer-motion";
import { Code2 } from "lucide-react";

export default function LanguageBar({ languages: langInfo }) {
  if (!langInfo || !langInfo.languages || langInfo.languages.length === 0) {
    return (
      <div className="langbar-card">
        <h3 className="langbar-title">
          <Code2 size={16} />
          Languages
        </h3>
        <p className="langbar-empty">No language data available.</p>
      </div>
    );
  }

  const { languages, stackArchetype, polyglotScore, funFact, languageCount } =
    langInfo;

  // Only show top 8 languages in the stacked bar; group the rest as "Other"
  const MAX_DISPLAY = 8;
  const top = languages.slice(0, MAX_DISPLAY);
  const rest = languages.slice(MAX_DISPLAY);
  const otherPct = rest.reduce((sum, l) => sum + l.percentage, 0);

  // Segments for the stacked bar (top langs + optional "Other" slice)
  const segments = [
    ...top,
    ...(otherPct > 0
      ? [
          {
            name: "Other",
            percentage: Math.round(otherPct * 10) / 10,
            meta: { category: "other" },
            isOther: true,
          },
        ]
      : []),
  ];

  // ── Colour palette ──────────────────────────────────────────────────────────
  // A hand-picked set of vibrant colours that look good on dark backgrounds.
  // We cycle through them for unknown languages.
  const LANG_COLORS = {
    javascript: "#f7df1e",
    typescript: "#3178c6",
    python: "#3572a5",
    rust: "#dea584",
    go: "#00add8",
    java: "#b07219",
    kotlin: "#a97bff",
    swift: "#f05138",
    "c#": "#239120",
    "c++": "#f34b7d",
    c: "#555555",
    ruby: "#701516",
    php: "#4f5d95",
    html: "#e34c26",
    css: "#563d7c",
    scss: "#c6538c",
    sass: "#a53b70",
    shell: "#89e051",
    "bash script": "#89e051",
    vue: "#41b883",
    svelte: "#ff3e00",
    dart: "#00b4ab",
    scala: "#c22d40",
    elixir: "#6e4a7e",
    haskell: "#5e5086",
    clojure: "#db5855",
    r: "#198ce7",
    julia: "#a270ba",
    elm: "#60b5cc",
    dockerfile: "#384d54",
    yaml: "#cb171e",
    other: "#666680",
  };

  const FALLBACK_COLORS = [
    "#6366f1",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
    "#84cc16",
    "#06b6d4",
    "#a855f7",
    "#ef4444",
  ];

  let fallbackIdx = 0;

  function getColor(name, isOther = false) {
    if (isOther) return LANG_COLORS.other;
    const key = (name || "").toLowerCase().trim();
    return (
      LANG_COLORS[key] ||
      FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length]
    );
  }

  // Pre-compute colours so they're consistent between bar + legend
  const segmentsWithColor = segments.map((seg) => ({
    ...seg,
    color: getColor(seg.name, seg.isOther),
  }));

  // ── Polyglot score label ────────────────────────────────────────────────────
  function polyglotLabel(score) {
    if (score >= 80) return "Extreme Polyglot 🌍";
    if (score >= 60) return "Polyglot 🌐";
    if (score >= 40) return "Multi-language 🗺️";
    if (score >= 20) return "Bilingual 🗣️";
    return "Specialist 🎯";
  }

  // ── Animation variants ──────────────────────────────────────────────────────
  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut", delay: 0.05 },
    },
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="langbar-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <div className="langbar-header">
        <h3 className="langbar-title">
          <Code2 size={16} />
          Languages
        </h3>
        <div className="langbar-meta">
          {stackArchetype && (
            <span className="langbar-archetype">
              {stackArchetype.emoji} {stackArchetype.label}
            </span>
          )}
          <span className="langbar-polyglot-badge">
            {polyglotLabel(polyglotScore ?? 0)}
          </span>
        </div>
      </div>

      {/* ── Stacked bar ── */}
      <div
        className="langbar-stacked"
        role="img"
        aria-label={`Language breakdown: ${segmentsWithColor
          .map((s) => `${s.name} ${s.percentage}%`)
          .join(", ")}`}
      >
        {segmentsWithColor.map((seg, i) => (
          <motion.div
            key={seg.name}
            className="langbar-segment"
            title={`${seg.name}: ${seg.percentage}%`}
            style={{
              backgroundColor: seg.color,
              // Give first and last segments rounded corners
              borderRadius:
                i === 0
                  ? "6px 0 0 6px"
                  : i === segmentsWithColor.length - 1
                    ? "0 6px 6px 0"
                    : "0",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${seg.percentage}%` }}
            transition={{
              duration: 0.7,
              ease: "easeOut",
              delay: i * 0.04,
            }}
          />
        ))}
      </div>

      {/* ── Legend / detail rows ── */}
      <ul className="langbar-legend" aria-label="Language details">
        {segmentsWithColor.map((seg, i) => (
          <motion.li
            key={seg.name}
            className="langbar-legend-item"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
              delay: 0.1 + i * 0.05,
            }}
          >
            {/* Colour dot */}
            <span
              className="langbar-dot"
              style={{ backgroundColor: seg.color }}
              aria-hidden="true"
            />

            {/* Language name + vibe */}
            <div className="langbar-lang-info">
              <span className="langbar-lang-name">{seg.name}</span>
              {seg.meta?.vibe && !seg.isOther && (
                <span className="langbar-lang-vibe">{seg.meta.vibe}</span>
              )}
            </div>

            {/* Animated progress bar + percentage */}
            <div className="langbar-row-right">
              <div className="langbar-row-bar-track">
                <motion.div
                  className="langbar-row-bar-fill"
                  style={{ backgroundColor: seg.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${seg.percentage}%` }}
                  transition={{
                    duration: 0.7,
                    ease: "easeOut",
                    delay: 0.15 + i * 0.05,
                  }}
                />
              </div>
              <span className="langbar-pct">{seg.percentage}%</span>
            </div>
          </motion.li>
        ))}
      </ul>

      {/* ── Fun fact ── */}
      {funFact && (
        <motion.p
          className="langbar-funfact"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          💡 {funFact}
        </motion.p>
      )}

      {/* ── Footer stats ── */}
      <div className="langbar-footer">
        <span className="langbar-footer-stat">
          {languageCount} language{languageCount !== 1 ? "s" : ""} detected
        </span>
        {stackArchetype?.description && (
          <span className="langbar-footer-desc">
            {stackArchetype.description}
          </span>
        )}
      </div>
    </motion.div>
  );
}
