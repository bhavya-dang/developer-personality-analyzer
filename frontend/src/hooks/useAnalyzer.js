/**
 * Custom React hook that manages the full lifecycle of a personality analysis
 * request — input parsing, loading state, result caching, and error handling.
 
 */
import axios from "axios";
import { useState, useCallback, useRef } from "react";
import { analyzeUser, detectInputType } from "../utils/api";

// ── Constants ──────────────────────────────────────────────────────────────────

/** How long (ms) to keep a cached result before re-fetching on the same input. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Initial state ──────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  result: null, // the full API response object
  loading: false,
  error: null, // normalised error message string
  inputType: null, // "user" | "repo" | null
  query: null, // the last successfully resolved query string
  analyzedAt: null, // Date of last successful analysis
};

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * @param {object} [opts={}]
 * @param {boolean}  [opts.ai]         Force AI on/off (undefined = backend decides)
 * @param {number}   [opts.maxRepos=5] Max repos for user analysis (1–10)
 * @param {boolean}  [opts.cache=true] Enable in-memory result caching
 */
export function useAnalyzer({ ai, maxRepos = 5, cache = true } = {}) {
  const [state, setState] = useState(INITIAL_STATE);

  // In-memory cache: key → { result, inputType, timestamp }
  const cacheRef = useRef({});

  // AbortController ref so we can cancel an in-flight request if the user
  // submits a new one before the previous finishes.
  const abortRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Merge partial state updates (avoids spreading the whole object everywhere). */
  const patch = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Check the cache for a fresh result.
   * @param {string} cacheKey
   * @returns {object|null}  Cached entry or null if stale/missing.
   */
  const getFromCache = useCallback(
    (cacheKey) => {
      if (!cache) return null;
      const entry = cacheRef.current[cacheKey];
      if (!entry) return null;
      const age = Date.now() - entry.timestamp;
      if (age > CACHE_TTL_MS) {
        delete cacheRef.current[cacheKey]; // evict stale entry
        return null;
      }
      return entry;
    },
    [cache],
  );

  /**
   * Store a result in the cache.
   * @param {string} cacheKey
   * @param {object} result
   * @param {"user"|"repo"} inputType
   */
  const setInCache = useCallback(
    (cacheKey, result, inputType) => {
      if (!cache) return;
      cacheRef.current[cacheKey] = { result, inputType, timestamp: Date.now() };
    },
    [cache],
  );

  // ── Main analyze function ──────────────────────────────────────────────────

  /**
   * Trigger a personality analysis for a GitHub user or repo.
   *
   * @param {string} rawInput  GitHub username ("torvalds") or "owner/repo" ("facebook/react")
   * @returns {Promise<object|null>}  The result data, or null on error.
   */
  const analyze = useCallback(
    async (rawInput) => {
      const input = (rawInput || "").trim();

      // ── 1. Validate input ──────────────────────────────────────────────
      const inputType = detectInputType(input);

      if (inputType === "invalid") {
        patch({
          error: `"${input}" doesn't look like a valid GitHub username`,
          loading: false,
        });
        return null;
      }

      // ── 2. Cache lookup ────────────────────────────────────────────────
      const cacheKey = `${inputType}:${input.toLowerCase()}`;
      const cached = getFromCache(cacheKey);

      if (cached) {
        patch({
          result: cached.result,
          inputType: cached.inputType,
          query: input,
          loading: false,
          error: null,
          analyzedAt: new Date(cached.timestamp),
        });
        return cached.result;
      }

      // ── 3. Cancel any in-flight request ───────────────────────────────
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      // ── 4. Start loading ───────────────────────────────────────────────
      patch({
        loading: true,
        error: null,
        result: null,
        inputType,
        query: input,
        analyzedAt: null,
      });

      // ── 5. Fetch ───────────────────────────────────────────────────────
      try {
        let data;

        if (inputType === "user") {
          data = await analyzeUser(input, {
            ai,
            maxRepos,
            signal: abortRef.current.signal,
          });
        }
        // } else {
        //   const { owner, repo } = parseRepoInput(input);
        //   data = await analyzeRepo(owner, repo, { ai });
        // }

        // ── 6. Success ───────────────────────────────────────────────────
        const now = new Date();
        setInCache(cacheKey, data, inputType);

        patch({
          result: data,
          loading: false,
          error: null,
          inputType,
          query: input,
          analyzedAt: now,
        });

        return data;
      } catch (err) {
        // Ignore aborted requests (user started a new search)
        if (axios.isCancel?.(err) || err.code === "ERR_CANCELED") {
          return null;
        }

        const errorMessage =
          err.normalised?.message ||
          err.message ||
          "Something went wrong. Please try again.";

        patch({
          loading: false,
          error: errorMessage,
          result: null,
          analyzedAt: null,
        });

        return null;
      }
    },
    [ai, maxRepos, getFromCache, setInCache, patch],
  );

  // ── Reset ──────────────────────────────────────────────────────────────────

  /**
   * Clear the current result and error state (but preserve the cache).
   */
  const reset = useCallback(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  /**
   * Wipe the entire in-memory cache.
   * Useful if the user wants to force a fresh fetch for a previously-seen input.
   */
  const clearCache = useCallback(() => {
    cacheRef.current = {};
  }, []);

  /**
   * Re-run the last query (bypass cache).
   * @returns {Promise<object|null>}
   */
  const refresh = useCallback(() => {
    if (!state.query) return Promise.resolve(null);
    // Evict the cached entry so analyze() doesn't return stale data
    const cacheKey = `${state.inputType}:${state.query.toLowerCase()}`;
    delete cacheRef.current[cacheKey];
    return analyze(state.query);
  }, [state.query, state.inputType, analyze]);

  // ── Derived convenience values ─────────────────────────────────────────────

  /** True while a request is in flight. */
  const isLoading = state.loading;

  /** True if we have a successful result ready to display. */
  const hasResult = Boolean(state.result && !state.loading);

  /** True if the last request ended in an error. */
  const hasError = Boolean(state.error && !state.loading);

  /**
   * Shortcut accessors into the result tree so components don't need to do
   * deep optional chaining everywhere.
   */
  const profile = state.result?.profile ?? null;
  const languages = state.result?.languages ?? null;
  const commitStats = state.result?.commitStats ?? null;
  const summary = state.result?.summary ?? null;
  const subject = state.result?.subject ?? null;
  const weeklyActivity = state.result?.weeklyActivity ?? null;
  const pullRequests = state.result?.pullRequests ?? null;
  const meta = state.result?.meta ?? null;

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // Actions
    analyze,
    reset,
    refresh,
    clearCache,

    // State
    loading: state.loading,
    error: state.error,
    result: state.result,
    inputType: state.inputType,
    query: state.query,
    analyzedAt: state.analyzedAt,

    // Derived booleans
    isLoading,
    hasResult,
    hasError,

    // Convenience result accessors
    profile,
    languages,
    commitStats,
    summary,
    subject,
    weeklyActivity,
    pullRequests,
    meta,
  };
}

export default useAnalyzer;
