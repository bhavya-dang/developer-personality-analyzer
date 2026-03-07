import { useState, useEffect, useRef } from "react";
import {
  Search,
  Github,
  User,
  GitBranch,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import { detectInputType } from "../utils/api";

export default function SearchBar({
  onSubmit,
  loading = false,
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);
  const [inputType, setType] = useState("invalid"); // "user"  | "invalid"
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  // Re-detect the type on every keystroke
  useEffect(() => {
    setType(detectInputType(value));
  }, [value]);

  // Sync if the parent updates initialValue
  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading || inputType !== "user") return;
    onSubmit(trimmed);
  }

  function handleClear() {
    setValue("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") handleClear();
  }

  // ── Derived UI values ────────────────────────────────────────────────────────

  const isValid = inputType === "user";
  const trimmed = value.trim();
  const hasValue = trimmed.length > 0;
  const canSubmit = isValid && hasValue && !loading;

  const badge = (() => {
    if (!hasValue) return null;

    if (inputType === "user") {
      return {
        icon: <User size={12} />,
        label: "User",
        className: "badge-user",
      };
    }

    if (inputType === "repo") {
      return {
        icon: <GitBranch size={12} />,
        label: "Repo",
        className: "badge-repo",
      };
    }

    return {
      icon: null,
      label: "Invalid",
      className: "badge-invalid",
    };
  })();

  const placeholder = "GitHub username..";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="search-form" noValidate>
      <div className="search-main-row">
        {/* ── Input wrapper ── */}
        <div
          className={`search-wrapper ${focused ? "focused" : ""} ${!isValid && hasValue ? "invalid" : ""}`}
        >
          {/* Left icon */}
          <span className="search-icon-left" aria-hidden="true">
            <Github size={20} />
          </span>

          {/* The actual input */}
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="GitHub username or repository"
            aria-describedby={!isValid && hasValue ? "search-hint" : undefined}
          />

          {/* Type badge */}
          {badge && (
            <span
              className={`search-badge ${badge.className}`}
              aria-live="polite"
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>
          )}

          {/* Clear button */}
          {hasValue && !loading && (
            <button
              type="button"
              className="search-clear"
              onClick={handleClear}
              aria-label="Clear input"
              tabIndex={-1}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Submit button ── */}
        <button
          type="submit"
          className={`search-btn ${canSubmit ? "enabled" : "disabled"}`}
          disabled={!canSubmit}
          aria-label={loading ? "Analyzing…" : "Analyze"}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spin" />
              <span>Analyzing…</span>
            </>
          ) : (
            <>
              <ArrowRight size={18} />
              {/* <span>Analyze</span> */}
            </>
          )}
        </button>
      </div>

      {/* ── Hint text ── */}
      <p
        id="search-hint"
        className={`search-hint ${!isValid && hasValue ? "visible" : ""}`}
      >
        Enter a GitHub username (e.g. <code>torvalds</code>)
      </p>

      {/* ── Examples ── */}
      {!hasValue && !loading && (
        <div className="search-examples" aria-label="Example searches">
          <span className="examples-label">Try:</span>
          {[
            { label: "torvalds", type: "user" },
            { label: "gaearon", type: "user" },
          ].map(({ label }) => (
            <button
              key={label}
              type="button"
              className="example-chip"
              onClick={() => {
                setValue(label);
                // Slight delay so the value propagates before submit
                setTimeout(() => onSubmit(label), 50);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
