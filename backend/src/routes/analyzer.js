/**
 * analyzer.js  —  Express router
 *
 * Endpoints
 * ──────────
 * GET  /api/analyzer/user/:username
 *      Full personality profile for a GitHub user (aggregated across their repos)
 *
 * GET  /api/analyzer/repo/:owner/:repo
 *      Full personality profile for a specific repository
 *
 * GET  /api/analyzer/health
 *      Service health + configuration status
 *
 * Query params (both user + repo endpoints)
 * ──────────────────────────────────────────
 *   ?ai=true      Force an AI-generated summary (requires OPENROUTER_API_KEY)
 *   ?ai=false     Force the template fallback even if key is present
 *   ?maxRepos=N   (user endpoint only) How many repos to deep-dive (default 5, max 10)
 */

"use strict";

const express = require("express");
const router = express.Router();

const githubService = require("../services/githubService");
const aiService = require("../services/aiService");
const { analyzeCommits } = require("../analyzers/commitAnalyzer");
const { buildPersonalityProfile } = require("../analyzers/personalityEngine");
const {
  analyzeLanguages,
  mergeLanguageMaps,
} = require("../analyzers/languageAnalyzer");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Clamp a number between min and max.
 */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Parse the `?ai` query param.
 *   - undefined / missing  → use default (generate if key present)
 *   - "true"               → force AI
 *   - "false"              → force template
 * @param {string|undefined} raw
 * @returns {"auto"|"force_ai"|"force_template"}
 */
function parseAiParam(raw) {
  if (raw === "true") return "force_ai";
  if (raw === "false") return "force_template";
  return "auto";
}

/**
 * Decide whether to use the AI path based on the param + env configuration.
 * @param {"auto"|"force_ai"|"force_template"} mode
 * @returns {boolean}
 */
function shouldUseAI(mode) {
  if (mode === "force_template") return false;
  if (mode === "force_ai") return true;
  // auto: use AI only if the key is configured
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Lightweight async wrapper so route handlers don't need individual try/catch.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Re-throw GitHub 404s as proper 404 responses; everything else as 500.
 */
function handleGithubError(err, res) {
  if (err.status === 404) {
    return res.status(404).json({ error: err.message });
  }
  if (err.status === 429) {
    return res.status(429).json({ error: err.message });
  }
  throw err; // let the global handler deal with it
}

// ── GET /api/analyzer/health ──────────────────────────────────────────────────

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const aiHealth = await aiService.checkAIHealth();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        github: {
          authenticated: Boolean(process.env.GITHUB_TOKEN),
          rateLimit: process.env.GITHUB_TOKEN
            ? "5000 req/hr"
            : "60 req/hr (unauthenticated)",
        },
        openrouter: aiHealth,
      },
    });
  }),
);

// ── GET /api/analyzer/user/:username ─────────────────────────────────────────

router.get(
  "/user/:username",
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    const aiMode = parseAiParam(req.query.ai);
    const maxRepos = clamp(parseInt(req.query.maxRepos, 10) || 5, 1, 10);

    if (!username || !/^[a-zA-Z0-9_.-]{1,39}$/.test(username)) {
      return res.status(400).json({ error: "Invalid GitHub username." });
    }

    // ── 1. Fetch raw GitHub data ──────────────────────────────────────────
    let rawData;
    try {
      rawData = await githubService.collectUserProfile(username, maxRepos);
    } catch (err) {
      return handleGithubError(err, res);
    }

    const { user, repoDetails } = rawData;

    // ── 2. Aggregate commits & languages across all fetched repos ─────────
    const allCommits = repoDetails.flatMap((rd) => rd.commits);

    const mergedLanguageBytes = mergeLanguageMaps(
      repoDetails.map((rd) => rd.languages),
    );

    // ── 3. Analyze ────────────────────────────────────────────────────────
    const commitAnalysis = analyzeCommits(allCommits);
    const langInfo = analyzeLanguages(mergedLanguageBytes);

    // Build the flat metrics object the personality engine expects
    const metrics = {
      timings: commitAnalysis.timings,
      messages: commitAnalysis.messages,
      cadence: commitAnalysis.cadence,
      sizes: commitAnalysis.sizes,
      languages: mergedLanguageBytes,
      pullRequests: [], // PRs not fetched at user level (would hit rate limits)
    };

    const profile = buildPersonalityProfile(metrics);

    // ── 4. AI summary ─────────────────────────────────────────────────────
    const summaryResult = await aiService.generatePersonalitySummary(
      username,
      profile,
      metrics,
      langInfo,
      user,
      /* useAI */ shouldUseAI(aiMode)
        ? undefined // let the service decide
        : "template", // signal to skip OpenAI
    );

    // ── 5. Assemble response ──────────────────────────────────────────────
    const response = {
      subject: {
        type: "user",
        username: user.login,
        name: user.name || null,
        bio: user.bio || null,
        avatarUrl: user.avatar_url,
        profileUrl: user.html_url,
        publicRepos: user.public_repos,
        followers: user.followers,
        following: user.following,
        createdAt: user.created_at,
        analyzedRepos: repoDetails.map((rd) => ({
          name: rd.repo.name,
          fullName: rd.repo.full_name,
          url: rd.repo.html_url,
          stars: rd.repo.stargazers_count,
          commits: rd.commits.length,
        })),
      },
      profile,
      languages: langInfo,
      commitStats: {
        totalCommits: commitAnalysis.totalCommits,
        cadence: commitAnalysis.cadence,
        timings: {
          hourHistogram: commitAnalysis.timings.hourHistogram,
          dayOfWeekHistogram: commitAnalysis.timings.dayOfWeekHistogram,
          timeBuckets: commitAnalysis.timings.timeBuckets,
          timeBucketPercentages: commitAnalysis.timings.timeBucketPercentages,
          peakHour: commitAnalysis.timings.peakHour,
          peakDayOfWeek: commitAnalysis.timings.peakDayOfWeek,
          weekendPercentage: commitAnalysis.timings.weekendPercentage,
        },
        messages: {
          commitTypes: commitAnalysis.messages.commitTypes,
          conventionalCommitPercentage:
            commitAnalysis.messages.conventionalCommitPercentage,
          averageSubjectLength: commitAnalysis.messages.averageSubjectLength,
          medianSubjectLength: commitAnalysis.messages.medianSubjectLength,
          hasBodyPercentage: commitAnalysis.messages.hasBodyPercentage,
          emojiPercentage: commitAnalysis.messages.emojiPercentage,
          wipPercentage: commitAnalysis.messages.wipPercentage,
          dominantType: commitAnalysis.messages.dominantType,
        },
        sizes: commitAnalysis.sizes,
      },
      summary: summaryResult,
      meta: {
        analyzedAt: new Date().toISOString(),
        commitsAnalyzed: commitAnalysis.totalCommits,
        reposAnalyzed: repoDetails.length,
        aiEnabled: summaryResult.source === "openrouter",
      },
    };

    res.json(response);
  }),
);

// ── GET /api/analyzer/repo/:owner/:repo ───────────────────────────────────────

router.get(
  "/repo/:owner/:repo",
  asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const aiMode = parseAiParam(req.query.ai);

    // Basic input validation
    const validSegment = /^[a-zA-Z0-9_.\-]{1,100}$/;
    if (!validSegment.test(owner) || !validSegment.test(repo)) {
      return res.status(400).json({ error: "Invalid owner or repo name." });
    }

    // ── 1. Fetch raw GitHub data ──────────────────────────────────────────
    let rawData;
    try {
      rawData = await githubService.collectRepoProfile(owner, repo);
    } catch (err) {
      return handleGithubError(err, res);
    }

    const {
      repo: repoData,
      commits,
      languages,
      pullRequests,
      activity,
    } = rawData;

    // ── 2. Analyze ────────────────────────────────────────────────────────
    const commitAnalysis = analyzeCommits(commits);
    const langInfo = analyzeLanguages(languages);

    const metrics = {
      timings: commitAnalysis.timings,
      messages: commitAnalysis.messages,
      cadence: commitAnalysis.cadence,
      sizes: commitAnalysis.sizes,
      languages,
      pullRequests,
    };

    const profile = buildPersonalityProfile(metrics);

    // Derive a display username from the most frequent committer
    const authorCounts = {};
    for (const c of commits) {
      const login = c.author?.login || c.commit?.author?.name || "unknown";
      authorCounts[login] = (authorCounts[login] || 0) + 1;
    }
    const topAuthor =
      Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || owner;

    // ── 3. AI summary ─────────────────────────────────────────────────────
    const summaryResult = await aiService.generatePersonalitySummary(
      `${owner}/${repo}`,
      profile,
      metrics,
      langInfo,
      { name: repoData.full_name, bio: repoData.description },
    );

    // ── 4. Weekly activity heatmap (last 52 weeks) ────────────────────────
    const weeklyActivity = (activity || []).map((week) => ({
      weekStart: new Date(week.week * 1000).toISOString().slice(0, 10),
      total: week.total,
      days: week.days, // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    }));

    // PR metrics
    const prMetrics = (() => {
      if (!pullRequests || pullRequests.length === 0) {
        return { total: 0, open: 0, closed: 0, merged: 0, avgTitleLength: 0 };
      }
      const open = pullRequests.filter((p) => p.state === "open").length;
      const merged = pullRequests.filter((p) => p.merged_at != null).length;
      const closed = pullRequests.filter(
        (p) => p.state === "closed" && !p.merged_at,
      ).length;
      const avgTitleLength = Math.round(
        pullRequests.reduce((s, p) => s + (p.title?.length || 0), 0) /
          pullRequests.length,
      );
      return {
        total: pullRequests.length,
        open,
        closed,
        merged,
        avgTitleLength,
      };
    })();

    // ── 5. Assemble response ──────────────────────────────────────────────
    const response = {
      subject: {
        type: "repo",
        owner,
        repo: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || null,
        url: repoData.html_url,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        defaultBranch: repoData.default_branch,
        createdAt: repoData.created_at,
        pushedAt: repoData.pushed_at,
        topAuthor,
      },
      profile,
      languages: langInfo,
      commitStats: {
        totalCommits: commitAnalysis.totalCommits,
        cadence: commitAnalysis.cadence,
        timings: {
          hourHistogram: commitAnalysis.timings.hourHistogram,
          dayOfWeekHistogram: commitAnalysis.timings.dayOfWeekHistogram,
          timeBuckets: commitAnalysis.timings.timeBuckets,
          timeBucketPercentages: commitAnalysis.timings.timeBucketPercentages,
          peakHour: commitAnalysis.timings.peakHour,
          peakDayOfWeek: commitAnalysis.timings.peakDayOfWeek,
          weekendPercentage: commitAnalysis.timings.weekendPercentage,
        },
        messages: {
          commitTypes: commitAnalysis.messages.commitTypes,
          conventionalCommitPercentage:
            commitAnalysis.messages.conventionalCommitPercentage,
          averageSubjectLength: commitAnalysis.messages.averageSubjectLength,
          medianSubjectLength: commitAnalysis.messages.medianSubjectLength,
          hasBodyPercentage: commitAnalysis.messages.hasBodyPercentage,
          emojiPercentage: commitAnalysis.messages.emojiPercentage,
          wipPercentage: commitAnalysis.messages.wipPercentage,
          dominantType: commitAnalysis.messages.dominantType,
        },
        sizes: commitAnalysis.sizes,
      },
      pullRequests: prMetrics,
      weeklyActivity,
      summary: summaryResult,
      meta: {
        analyzedAt: new Date().toISOString(),
        commitsAnalyzed: commitAnalysis.totalCommits,
        aiEnabled: summaryResult.source === "openrouter",
      },
    };

    res.json(response);
  }),
);

module.exports = router;
