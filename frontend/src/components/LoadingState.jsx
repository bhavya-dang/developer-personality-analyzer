import { motion } from "framer-motion";
import { Github, Loader2 } from "lucide-react";

const LOADING_STEPS = [
  { icon: "🔍", text: "Fetching GitHub profile" },
  { icon: "📦", text: "Loading repositories" },
  { icon: "🔬", text: "Analyzing commit history" },
  { icon: "🕐", text: "Mapping activity patterns" },
  { icon: "🧬", text: "Detecting personality traits" },
  { icon: "🎨", text: "Building your report" },
];

export default function LoadingState({ query = "" }) {
  return (
    <motion.div
      className="loading-state"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Hero loading indicator ── */}
      <div className="loading-hero">
        <div className="loading-spinner-wrap">
          <motion.div
            className="loading-orbit"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
          >
            <span className="loading-orbit-dot" />
          </motion.div>
          <div className="loading-github-icon">
            <Github size={28} />
          </div>
        </div>

        <div className="loading-hero-text">
          <motion.h2
            className="loading-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            Analyzing{" "}
            <span className="loading-query">{query || "developer"}</span>
          </motion.h2>

          <motion.p
            className="loading-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            Analysis make take some time...
          </motion.p>
        </div>

        {/* ── Cycling step messages ── */}
        <div
          className="loading-steps"
          aria-live="polite"
          aria-label="Loading progress"
        >
          {LOADING_STEPS.map((step, i) => (
            <motion.div
              key={step.text}
              className="loading-step"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: [0, 1, 1, 0], x: 0 }}
              transition={{
                duration: 1.8,
                delay: i * 1.1,
                repeat: Infinity,
                repeatDelay: LOADING_STEPS.length * 1.1 - 1.8,
                times: [0, 0.15, 0.75, 1],
              }}
            >
              <span className="step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span className="step-text">{step.text}</span>
              <motion.span
                className="step-dots"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                …
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Skeleton cards – mirror the real result layout ── */}
      <div className="loading-skeletons">
        {/* Personality card skeleton */}
        <SkeletonCard delay={0.1} className="skeleton-personality">
          <div className="sk-row">
            <SkeletonCircle size={64} />
            <div className="sk-col sk-col-grow">
              <SkeletonLine width="40%" height={12} />
              <SkeletonLine width="70%" height={22} />
              <SkeletonLine width="50%" height={16} />
            </div>
          </div>
          <SkeletonLine width="90%" height={14} />
          <SkeletonLine width="80%" height={14} />
          <div className="sk-badges-row">
            <SkeletonRect width={160} height={72} />
            <SkeletonRect width={160} height={72} />
            <SkeletonRect width={160} height={72} />
          </div>
          <SkeletonLine width="30%" height={14} />
          {[1, 2, 3, 4].map((n) => (
            <SkeletonLine key={n} width={`${85 - n * 5}%`} height={13} />
          ))}
        </SkeletonCard>

        <div className="loading-skeletons-row">
          {/* Radar chart skeleton */}
          <SkeletonCard delay={0.18} className="skeleton-radar">
            <SkeletonLine width="50%" height={16} />
            <SkeletonLine width="70%" height={12} />
            <div className="sk-radar-placeholder">
              <SkeletonHexagon />
            </div>
            <div className="sk-col">
              {[90, 75, 82, 60, 70, 55].map((w, i) => (
                <div key={i} className="sk-radar-row">
                  <SkeletonLine width="40%" height={11} />
                  <SkeletonLine width={`${w}%`} height={8} />
                </div>
              ))}
            </div>
          </SkeletonCard>

          {/* Language bar skeleton */}
          <SkeletonCard delay={0.24} className="skeleton-languages">
            <SkeletonLine width="40%" height={16} />
            <SkeletonRect width="100%" height={14} />
            <div className="sk-col">
              {[65, 20, 10, 5].map((w, i) => (
                <div key={i} className="sk-lang-row">
                  <SkeletonCircle size={10} />
                  <SkeletonLine width="35%" height={12} />
                  <SkeletonLine width={`${w}%`} height={8} />
                  <SkeletonLine width="8%" height={12} />
                </div>
              ))}
            </div>
            <SkeletonLine width="80%" height={13} />
          </SkeletonCard>
        </div>

        {/* AI summary skeleton */}
        <SkeletonCard delay={0.3} className="skeleton-summary">
          <div className="sk-row">
            <SkeletonLine width="35%" height={16} />
            <SkeletonRect width={100} height={22} />
          </div>
          {[100, 95, 88, 92, 75, 85, 60].map((w, i) => (
            <SkeletonLine key={i} width={`${w}%`} height={13} />
          ))}
        </SkeletonCard>

        {/* Commit stats skeleton */}
        <SkeletonCard delay={0.36} className="skeleton-commits">
          <SkeletonLine width="40%" height={16} />
          <div className="sk-metrics-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SkeletonRect key={n} width="100%" height={80} />
            ))}
          </div>
          <div className="sk-charts-row">
            <SkeletonRect width="100%" height={160} />
            <SkeletonRect width="100%" height={160} />
          </div>
        </SkeletonCard>
      </div>
    </motion.div>
  );
}

// ── Skeleton primitive components ─────────────────────────────────────────────

function SkeletonCard({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={`skeleton-card ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function SkeletonLine({ width = "100%", height = 14 }) {
  return (
    <div
      className="sk-line shimmer"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
        borderRadius: `${Math.ceil(height / 2)}px`,
      }}
    />
  );
}

function SkeletonRect({ width = "100%", height = 60 }) {
  return (
    <div
      className="sk-rect shimmer"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: "8px",
      }}
    />
  );
}

function SkeletonCircle({ size = 40 }) {
  return (
    <div
      className="sk-circle shimmer"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * A rough hexagonal placeholder to hint at the radar chart shape.
 * Built from a single rotated square — close enough for a skeleton.
 */
function SkeletonHexagon() {
  return (
    <div className="sk-hexagon-wrap">
      <motion.div
        className="sk-hexagon shimmer"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Axis lines */}
      {[0, 30, 60, 90, 120, 150].map((deg) => (
        <div
          key={deg}
          className="sk-hexagon-axis"
          style={{ transform: `rotate(${deg}deg)` }}
        />
      ))}
    </div>
  );
}
