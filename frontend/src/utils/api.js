/**
 * api.js
 *
 * Centralised API client for the Developer Personality Analyzer frontend.
 * All requests go through the single `api` axios instance so base URL,
 * timeout, and error normalisation are handled in one place.
 */

import axios from "axios";

// ── Axios instance ─────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "https://developer-personality-analyzer.fly.dev/api",
  timeout: 60_000, // GitHub + optional OpenAI can be slow
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Response interceptor – normalise errors ────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Build a clean, predictable error object for consumers
    const normalised = {
      message: "An unexpected error occurred.",
      status: null,
      isNetwork: false,
      isTimeout: false,
      isNotFound: false,
      isRateLimit: false,
      raw: error,
    };

    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      normalised.isTimeout = true;
      normalised.message =
        "The request timed out. GitHub may be slow — please try again.";
    } else if (!error.response) {
      // Network error (backend not running, CORS, etc.)
      normalised.isNetwork = true;
      normalised.message =
        "Cannot reach the server. The API may be down or unreachable.";
    } else {
      normalised.status = error.response.status;
      const serverMessage = error.response.data?.error;

      if (error.response.status === 404) {
        normalised.isNotFound = true;
        normalised.message =
          serverMessage || "GitHub user or repository not found.";
      } else if (error.response.status === 429) {
        normalised.isRateLimit = true;
        normalised.message =
          serverMessage ||
          "GitHub API rate limit exceeded. Try adding a GITHUB_TOKEN to the backend or wait a while.";
      } else if (error.response.status === 400) {
        normalised.message = serverMessage || "Invalid input provided.";
      } else if (error.response.status >= 500) {
        normalised.message =
          serverMessage || "Server error. Check the backend logs for details.";
      } else {
        normalised.message =
          serverMessage || `Request failed (${error.response.status}).`;
      }
    }

    // Attach the normalised object to the error so callers can inspect it
    error.normalised = normalised;
    return Promise.reject(error);
  },
);

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Analyse a GitHub user's personality across their repos.
 *
 * @param {string}  username   GitHub username
 * @param {object}  [opts={}]
 * @param {boolean} [opts.ai]        true  → force AI summary
 *                                   false → force template summary
 *                                   undefined → backend decides
 * @param {number}  [opts.maxRepos]  1–10, how many repos to analyse (default 5)
 * @returns {Promise<object>}  Full personality report
 */
export async function analyzeUser(username, { ai, maxRepos, signal } = {}) {
  const params = {};
  if (ai !== undefined) params.ai = ai;
  if (maxRepos !== undefined) params.maxRepos = maxRepos;

  const { data } = await api.get(
    `/analyzer/user/${encodeURIComponent(username)}`,
    {
      params,
      signal,
    },
  );

  return data;
}

/**
 * Analyse a specific GitHub repository's personality.
 *
 * @param {string}  owner     Repo owner (username or org)
 * @param {string}  repo      Repo name
 * @param {object}  [opts={}]
 * @param {boolean} [opts.ai] OpenAI override (same as analyzeUser)
 * @returns {Promise<object>}  Full personality report
 */
// export async function analyzeRepo(owner, repo, { ai } = {}) {
//   const params = {};
//   if (ai !== undefined) params.ai = ai;

//   const { data } = await api.get(
//     `/analyzer/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
//     { params },
//   );
//   return data;
// }

/**
 * Parse a "owner/repo" string into { owner, repo }.
 * Returns null if the format is invalid.
 *
 * @param {string} input
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseRepoInput(input) {
  const trimmed = (input || "").trim();
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Determine whether a search string is a "owner/repo" format (→ repo analysis)
 * or a plain username (→ user analysis).
 *
 * @param {string} input
 * @returns {"user" | "invalid"}
 */
export function detectInputType(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "invalid";

  const slashCount = (trimmed.match(/\//g) || []).length;

  if (slashCount === 0) {
    // GitHub username rules: 1–39 chars, alphanumeric + hyphens, no leading hyphen
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(trimmed)
      ? "user"
      : "invalid";
  }

  if (slashCount === 1) {
    const { owner, repo } = parseRepoInput(trimmed) || {};
    const validSegment = /^[a-zA-Z0-9_.\-]{1,100}$/; // eslint-disable-line no-useless-escape
    return owner && repo && validSegment.test(owner) && validSegment.test(repo)
      ? "repo"
      : "invalid";
  }

  return "invalid";
}

/**
 * Fetch the backend health status (useful for a connectivity check on mount).
 * @returns {Promise<object>}
 */
export async function fetchHealth() {
  const { data } = await api.get("/analyzer/health");
  return data;
}

export default api;
