import { useState, useCallback, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Sparkles } from "lucide-react";

import SearchBar from "./components/SearchBar";
import PersonalityCard from "./components/PersonalityCard";
import RadarChart from "./components/RadarChart";
import LanguageBar from "./components/LanguageBar";
import CommitStats from "./components/CommitStats";
import CommitHeatmap from "./components/CommitHeatmap";
import AISummary from "./components/AISummary";
import LoadingState from "./components/LoadingState";

import { useAnalyzer } from "./hooks/useAnalyzer";
import ErrorBoundary from "./components/ErrorBoundary";

// ── Page transition variants ───────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -16, transition: { duration: 0.25, ease: "easeIn" } },
};

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState("");

  const {
    analyze,
    reset,
    refresh,
    isLoading,
    hasResult,
    hasError,
    error,
    profile,
    languages,
    commitStats,
    summary,
    subject,
    weeklyActivity,
    inputType,
    query: analyzedQuery,
    analyzedAt,
    meta,
  } = useAnalyzer({ maxRepos: 5 });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    async (input) => {
      setQuery(input);
      const result = await analyze(input);
      if (!result) return; // error state already set by the hook
      toast.success(`Profile loaded for ${input}`, {
        icon: "✅",
        duration: 2500,
        style: { fontSize: "0.875rem" },
      });
    },
    [analyze],
  );

  const handleBack = useCallback(() => {
    reset();
    setQuery("");
  }, [reset]);

  const handleRefresh = useCallback(async () => {
    const result = await refresh();
    if (result) {
      toast.success("Refreshed!", { icon: "🔄", duration: 2000 });
    }
  }, [refresh]);

  // Show an error toast whenever the error value changes (must be in useEffect,
  // never during render — calling setState or toast during render causes crashes)
  const lastToastedError = useRef(null);
  useEffect(() => {
    if (hasError && error && error !== lastToastedError.current) {
      lastToastedError.current = error;
      toast.error(error, { duration: 5000, style: { fontSize: "0.875rem" } });
    }
    if (!hasError) {
      lastToastedError.current = null;
    }
  }, [hasError, error]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const showResults = hasResult && !isLoading;
  const showLoading = isLoading;
  const showSearch = !isLoading && !hasResult;

  const subjectLabel =
    subject?.type === "repo"
      ? `${subject.owner}/${subject.repo}`
      : subject?.name || subject?.username || analyzedQuery || "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* ── Toast notifications ── */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
          },
        }}
      />

      {/* ── Main content ── */}
      <main className="app-main">
        <AnimatePresence mode="wait">
          {/* ── Search / Landing page ── */}
          {showSearch && (
            <motion.div
              key="search"
              className="search-page"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* Hero */}
              <div className="hero">
                <motion.div
                  className="hero-badge"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <Sparkles size={14} />
                  Powered by GitHub API + Deepseek V3
                </motion.div>

                <motion.h1
                  className="hero-title"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.5 }}
                >
                  What is your
                  <br />
                  <span className="hero-title-accent">
                    Developer Personality?
                  </span>
                </motion.h1>

                <motion.p
                  className="hero-subtitle"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28, duration: 0.45 }}
                >
                  Drop your GitHub username or repo. We'll analyze your commits
                  and generate a personality profile.
                </motion.p>
              </div>

              {/* Search form */}
              <motion.div
                className="search-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.45 }}
              >
                <SearchBar
                  onSubmit={handleSearch}
                  loading={isLoading}
                  initialValue={query}
                />
              </motion.div>

              {/* Error message under the search bar */}
              {hasError && error && (
                <motion.div
                  className="search-error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  role="alert"
                >
                  ⚠️ {error}
                </motion.div>
              )}

              {/* Feature highlights */}
              <motion.div
                className="feature-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                {[
                  {
                    icon: "🦉",
                    title: "Personality Type",
                    desc: "Night Owl, Chaos Engineer, Perfectionist & more",
                  },
                  {
                    icon: "⚔️",
                    title: "D&D Alignment",
                    desc: "Lawful Good to Chaotic Evil — all 9 archetypes",
                  },
                  {
                    icon: "📊",
                    title: "Personality Radar",
                    desc: "6-axis spider chart of your dev superpowers",
                  },
                  {
                    icon: "🗓️",
                    title: "Activity Heatmap",
                    desc: "GitHub-style contribution calendar",
                  },
                  {
                    icon: "💻",
                    title: "Language Profile",
                    desc: "Stack archetype and polyglot score",
                  },
                  {
                    icon: "🤖",
                    title: "AI Report",
                    desc: "Optional GPT-4o mini narrative personality summary",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="feature-card">
                    <span className="feature-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <div>
                      <h3 className="feature-title">{title}</h3>
                      <p className="feature-desc">{desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ── Loading state ── */}
          {showLoading && (
            <motion.div
              key="loading"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <LoadingState query={analyzedQuery || query} />
            </motion.div>
          )}

          {/* ── Results page ── */}
          {showResults && (
            <motion.div
              key="results"
              className="results-page"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* ── Sticky mini search bar at top of results ── */}
              <div className="results-search-bar">
                <SearchBar
                  onSubmit={handleSearch}
                  loading={isLoading}
                  initialValue={analyzedQuery || query}
                />
              </div>

              {/* ── Results header ── */}
              <div className="results-header">
                <div className="results-header-left">
                  <h2 className="results-title">
                    Report for{" "}
                    <span className="results-subject">{subjectLabel}</span>
                  </h2>
                  {analyzedAt && (
                    <p className="results-meta">
                      Analyzed {analyzedAt.toLocaleTimeString()} ·{" "}
                      {meta?.commitsAnalyzed ?? "?"} commits
                      {meta?.reposAnalyzed != null && inputType === "user"
                        ? ` · ${meta.reposAnalyzed} repos`
                        : ""}
                      {meta?.aiEnabled && (
                        <span className="results-ai-badge">
                          <Sparkles size={11} /> AI
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {subject?.type === "user" && subject?.profileUrl && (
                  <a
                    className="results-github-link"
                    href={subject.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${subjectLabel} on GitHub`}
                  >
                    <Github size={16} />
                    View on GitHub
                  </a>
                )}
                {subject?.type === "repo" && subject?.url && (
                  <a
                    className="results-github-link"
                    href={subject.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${subjectLabel} on GitHub`}
                  >
                    <Github size={16} />
                    View repo
                  </a>
                )}
              </div>

              {/* ── Main results grid ── */}
              <ErrorBoundary onReset={handleBack}>
                <div className="results-grid">
                  {/* Row 1: Personality card (full width) */}
                  {profile && (
                    <div className="results-col-full">
                      <PersonalityCard profile={profile} subject={subject} />
                    </div>
                  )}

                  {/* Row 2: Radar chart + Language bar (side by side) */}
                  <div className="results-col-half">
                    {profile?.radarScores && (
                      <RadarChart
                        radarScores={profile.radarScores}
                        label={subjectLabel}
                      />
                    )}
                  </div>
                  <div className="results-col-half">
                    {languages && <LanguageBar languages={languages} />}
                  </div>

                  {/* Row 3: AI / Template summary (full width) */}
                  {summary && (
                    <div className="results-col-full">
                      <AISummary
                        summary={summary}
                        onRefresh={!meta?.aiEnabled ? handleRefresh : undefined}
                      />
                    </div>
                  )}

                  {/* Row 4: Commit stats (full width) */}
                  {commitStats && (
                    <div className="results-col-full">
                      <CommitStats commitStats={commitStats} />
                    </div>
                  )}

                  {/* Row 5: Activity heatmap (repo only — user endpoint doesn't return weekly activity) */}
                  {weeklyActivity && weeklyActivity.length > 0 && (
                    <div className="results-col-full">
                      <CommitHeatmap
                        weeklyActivity={weeklyActivity}
                        title={`${subjectLabel} — Commit Activity`}
                      />
                    </div>
                  )}

                  {/* Row 6: Analyzed repos list (user mode only) */}
                  {subject?.type === "user" &&
                    subject?.analyzedRepos &&
                    subject.analyzedRepos.length > 0 && (
                      <div className="results-col-full">
                        <motion.div
                          className="analyzed-repos-card"
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: "easeOut",
                            delay: 0.1,
                          }}
                        >
                          <h3 className="ar-title">
                            <Github size={16} />
                            Repos Analyzed
                          </h3>
                          <ul className="ar-list">
                            {subject.analyzedRepos.map((repo) => (
                              <li key={repo.fullName} className="ar-item">
                                <a
                                  href={repo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ar-link"
                                >
                                  {repo.name}
                                </a>
                                <span className="ar-meta">
                                  ⭐ {repo.stars.toLocaleString()} ·{" "}
                                  {repo.commits} commits analyzed
                                </span>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      </div>
                    )}
                </div>
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Global footer ── */}
      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="app-footer-tagline">
            <span className="app-footer-tagline-text">
              Find your developer personality.
            </span>{" "}
            Built by Bhavya with ❤️
            {/* © 2026 All rights reserved. Built by Bhavya with ❤️ */}
          </p>

          <a
            className="app-footer-link"
            href="https://github.com/bhavya-dang"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={18} />
            {/* <span>@bhavya-dang</span> */}
          </a>
        </div>
      </footer>
    </div>
  );
}
