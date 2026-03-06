import { motion } from "framer-motion";
import {
  Sparkles,
  Shield,
  Sword,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

export default function PersonalityCard({ profile, subject }) {
  const [traitsExpanded, setTraitsExpanded] = useState(false);

  if (!profile) return null;

  const {
    primaryType,
    secondaryType,
    alignment,
    devClass,
    traits = [],
    codingStyle,
  } = profile;

  const displayName =
    subject?.name ||
    subject?.username ||
    (subject?.owner && subject?.repo
      ? `${subject.owner}/${subject.repo}`
      : "Developer");

  const avatarUrl = subject?.avatarUrl;

  // Show first 4 traits by default, rest behind "show more"
  const VISIBLE_COUNT = 4;
  const visibleTraits = traitsExpanded
    ? traits
    : traits.slice(0, VISIBLE_COUNT);
  const hiddenCount = traits.length - VISIBLE_COUNT;

  // ── Alignment colour map ──────────────────────────────────────────────────
  const alignmentColors = {
    "Lawful Good": { bg: "alignment-lawful-good", text: "Lawful Good" },
    "Lawful Neutral": {
      bg: "alignment-lawful-neutral",
      text: "Lawful Neutral",
    },
    "Lawful Evil": { bg: "alignment-lawful-evil", text: "Lawful Evil" },
    "Neutral Good": { bg: "alignment-neutral-good", text: "Neutral Good" },
    "True Neutral": { bg: "alignment-true-neutral", text: "True Neutral" },
    "Neutral Evil": { bg: "alignment-neutral-evil", text: "Neutral Evil" },
    "Chaotic Good": { bg: "alignment-chaotic-good", text: "Chaotic Good" },
    "Chaotic Neutral": {
      bg: "alignment-chaotic-neutral",
      text: "Chaotic Neutral",
    },
    "Chaotic Evil": { bg: "alignment-chaotic-evil", text: "Chaotic Evil" },
  };
  const alignStyle = alignmentColors[alignment?.label] || {
    bg: "alignment-true-neutral",
  };

  // ── Animation variants ────────────────────────────────────────────────────
  const cardVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const traitVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.06, duration: 0.3, ease: "easeOut" },
    }),
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="personality-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <div className="pc-header">
        {avatarUrl && (
          <div className="pc-avatar-wrap">
            <img
              src={avatarUrl}
              alt={`${displayName}'s avatar`}
              className="pc-avatar"
            />
            <span className="pc-avatar-emoji" aria-hidden="true">
              {primaryType?.emoji}
            </span>
          </div>
        )}

        <div className="pc-header-text">
          <p className="pc-report-label">
            <Sparkles size={14} />
            Developer Personality Report
          </p>
          <h2 className="pc-name">{displayName}</h2>

          {/* Primary type */}
          <div className="pc-primary-type">
            <span className="pc-type-emoji" aria-hidden="true">
              {primaryType?.emoji}
            </span>
            <span className="pc-type-label">{primaryType?.label}</span>
          </div>

          {/* Secondary modifier */}
          {secondaryType && (
            <p className="pc-secondary-type">
              …with{" "}
              <span>
                {secondaryType.emoji} {secondaryType.label}
              </span>{" "}
              tendencies
            </p>
          )}
        </div>
      </div>

      {/* ── Type description ── */}
      {primaryType?.description && (
        <p className="pc-type-description">
          &ldquo;{primaryType.description}&rdquo;
        </p>
      )}

      {/* ── Badges row ── */}
      <div className="pc-badges">
        {/* Alignment */}
        <div className={`pc-badge ${alignStyle.bg}`}>
          <span className="badge-icon" aria-hidden="true">
            {alignment?.emoji}
          </span>
          <div className="badge-content">
            <span className="badge-title">Alignment</span>
            <span className="badge-value">{alignment?.label}</span>
            <span className="badge-sub">{alignment?.tagline}</span>
          </div>
        </div>

        {/* Developer class */}
        <div className="pc-badge badge-class">
          <span className="badge-icon" aria-hidden="true">
            <Sword size={20} />
          </span>
          <div className="badge-content">
            <span className="badge-title">Class</span>
            <span className="badge-value">{devClass?.label}</span>
            <span className="badge-sub">{devClass?.description}</span>
          </div>
        </div>

        {/* Coding style */}
        <div className="pc-badge badge-style">
          <span className="badge-icon" aria-hidden="true">
            <Shield size={20} />
          </span>
          <div className="badge-content">
            <span className="badge-title">Coding Style</span>
            <span className="badge-value">{codingStyle}</span>
          </div>
        </div>
      </div>

      {/* ── Traits ── */}
      {traits.length > 0 && (
        <div className="pc-traits">
          <h3 className="pc-traits-heading">
            <Star size={16} />
            Observed Traits
          </h3>

          <ul className="pc-traits-list">
            {visibleTraits.map((trait, i) => (
              <motion.li
                key={trait}
                className="pc-trait-item"
                custom={i}
                variants={traitVariants}
                initial="hidden"
                animate="visible"
              >
                {trait}
              </motion.li>
            ))}
          </ul>

          {/* Show more / less toggle */}
          {traits.length > VISIBLE_COUNT && (
            <button
              className="pc-traits-toggle"
              onClick={() => setTraitsExpanded((v) => !v)}
              aria-expanded={traitsExpanded}
            >
              {traitsExpanded ? (
                <>
                  <ChevronUp size={16} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show {hiddenCount} more trait{hiddenCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
