const axios = require("axios");

const BASE_URL = "https://api.github.com";

// ── Axios Instance ─────────────────────────────────────────────────────────────
const github = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN && {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    }),
  },
  timeout: 10000,
});

// ── Rate-limit aware request helper ───────────────────────────────────────────
async function ghGet(path, params = {}) {
  try {
    const res = await github.get(path, { params });
    return res.data;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 403 || status === 429) {
        const reset = err.response.headers["x-ratelimit-reset"];
        const resetDate = reset ? new Date(reset * 1000).toISOString() : "unknown";
        const e = new Error(`GitHub rate limit exceeded. Resets at ${resetDate}.`);
        e.status = 429;
        throw e;
      }
      if (status === 404) {
        const e = new Error(`GitHub resource not found: ${path}`);
        e.status = 404;
        throw e;
      }
      const e = new Error(
        err.response.data?.message || `GitHub API error (${status})`
      );
      e.status = status;
      throw e;
    }
    throw err;
  }
}

// ── Pagination helper – fetches ALL pages ─────────────────────────────────────
async function ghGetAll(path, params = {}, maxPages = 10) {
  const results = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await ghGet(path, { ...params, per_page: 100, page });
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break; // last page
    page++;
  }

  return results;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch a GitHub user's public profile.
 * @param {string} username
 */
async function getUser(username) {
  return ghGet(`/users/${username}`);
}

/**
 * Fetch all public repos for a user (sorted by push date).
 * @param {string} username
 */
async function getUserRepos(username) {
  return ghGetAll(`/users/${username}/repos`, { sort: "pushed", direction: "desc" });
}

/**
 * Fetch a single repo.
 * @param {string} owner
 * @param {string} repo
 */
async function getRepo(owner, repo) {
  return ghGet(`/repos/${owner}/${repo}`);
}

/**
 * Fetch commits for a repo, optionally filtered by author.
 * Caps at maxPages * 100 commits to avoid hammering the API.
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} author  GitHub username to filter by
 * @param {number} maxPages
 */
async function getCommits(owner, repo, author = null, maxPages = 5) {
  const params = {};
  if (author) params.author = author;
  return ghGetAll(`/repos/${owner}/${repo}/commits`, params, maxPages);
}

/**
 * Fetch the commit detail (including stats) for a single SHA.
 * @param {string} owner
 * @param {string} repo
 * @param {string} sha
 */
async function getCommitDetail(owner, repo, sha) {
  return ghGet(`/repos/${owner}/${repo}/commits/${sha}`);
}

/**
 * Fetch language breakdown (bytes) for a repo.
 * @param {string} owner
 * @param {string} repo
 */
async function getLanguages(owner, repo) {
  return ghGet(`/repos/${owner}/${repo}/languages`);
}

/**
 * Fetch pull requests for a repo.
 * @param {string} owner
 * @param {string} repo
 * @param {"open"|"closed"|"all"} state
 */
async function getPullRequests(owner, repo, state = "all") {
  return ghGetAll(`/repos/${owner}/${repo}/pulls`, { state });
}

/**
 * Fetch contributor stats for a repo.
 * GitHub may return 202 while it computes stats – we retry up to 3 times.
 * @param {string} owner
 * @param {string} repo
 */
async function getContributorStats(owner, repo) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await ghGet(`/repos/${owner}/${repo}/stats/contributors`);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (_) {
      // 202 comes back as an error from ghGet – wait and retry
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return [];
}

/**
 * Fetch commit activity (weekly counts for the past year).
 * @param {string} owner
 * @param {string} repo
 */
async function getCommitActivity(owner, repo) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await ghGet(`/repos/${owner}/${repo}/stats/commit_activity`);
      if (Array.isArray(data)) return data;
    } catch (_) {
      // may return 202 on first call
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return [];
}

/**
 * Fetch the top-level file tree for a repo (non-recursive, root only).
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 */
async function getFileTree(owner, repo, branch = "HEAD") {
  return ghGet(`/repos/${owner}/${repo}/git/trees/${branch}`, { recursive: 0 });
}

/**
 * High-level: collect everything needed to build a personality profile
 * for a given GitHub USERNAME across their most active repos.
 *
 * @param {string} username
 * @param {number} maxRepos   how many repos to deep-dive into
 */
async function collectUserProfile(username, maxRepos = 5) {
  // 1. User profile + all repos in parallel
  const [user, allRepos] = await Promise.all([
    getUser(username),
    getUserRepos(username),
  ]);

  // 2. Pick the most recently-pushed non-fork repos for deep analysis
  const targetRepos = allRepos
    .filter((r) => !r.fork)
    .slice(0, maxRepos);

  // 3. For each target repo gather commits + languages in parallel
  const repoDetails = await Promise.all(
    targetRepos.map(async (repo) => {
      const [commits, languages] = await Promise.all([
        getCommits(repo.owner.login, repo.name, username, 3).catch(() => []),
        getLanguages(repo.owner.login, repo.name).catch(() => ({})),
      ]);
      return { repo, commits, languages };
    })
  );

  return { user, allRepos, repoDetails };
}

/**
 * High-level: collect everything needed to build a personality profile
 * for a specific REPO (owner/repo).
 *
 * @param {string} owner
 * @param {string} repo
 */
async function collectRepoProfile(owner, repo) {
  const [repoData, commits, languages, prs, activity] = await Promise.all([
    getRepo(owner, repo),
    getCommits(owner, repo, null, 5).catch(() => []),
    getLanguages(owner, repo).catch(() => ({})),
    getPullRequests(owner, repo, "all").catch(() => []),
    getCommitActivity(owner, repo).catch(() => []),
  ]);

  return { repo: repoData, commits, languages, pullRequests: prs, activity };
}

module.exports = {
  getUser,
  getUserRepos,
  getRepo,
  getCommits,
  getCommitDetail,
  getLanguages,
  getPullRequests,
  getContributorStats,
  getCommitActivity,
  getFileTree,
  collectUserProfile,
  collectRepoProfile,
};
