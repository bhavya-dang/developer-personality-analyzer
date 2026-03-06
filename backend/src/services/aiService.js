/**
 * aiService.js
 *
 * AI layer that uses OpenRouter (https://openrouter.ai) to generate a rich,
 * narrative personality summary from the structured profile data produced by
 * the personality engine.
 *
 * OpenRouter exposes an OpenAI-compatible Chat Completions API, so we use the
 * official `openai` npm package pointed at OpenRouter's base URL.
 *
 * Required env var:
 *   OPENROUTER_API_KEY   – your OpenRouter API key (sk-or-v1-...)
 *
 * Optional env vars:
 *   OPENROUTER_MODEL     – model slug (default: "deepseek/deepseek-chat")
 *   OPENROUTER_SITE_URL  – your app's URL sent in HTTP-Referer (default: http://localhost:5173)
 *   OPENROUTER_SITE_NAME – your app's name sent in X-Title (default: DevPersonality)
 *
 * If no OPENROUTER_API_KEY is set the service gracefully degrades and returns
 * a deterministic template-based summary instead — the app works fully without
 * an API key.
 */

"use strict";

const OpenAI = require("openai");

// ── Constants ─────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "deepseek/deepseek-chat";

const MAX_TOKENS = 600;
const TEMPERATURE = 0.85;
const TIMEOUT_MS = 25_000;

// ── Client  ────────

let _client = null;

function getClient() {
  if (_client) return _client;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  _client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "DevPersonality",
    },
  });

  return _client;
}

function getModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

// ── Prompt Builders ───────────────────────────────────────────────────────────

/**
 * Build the system prompt that defines the AI's persona.
 * @returns {string}
 */
function buildSystemPrompt() {
  return `You are a witty, insightful developer personality analyst.
Your job is to write a short, punchy, and entertaining developer personality report
based on structured data extracted from a GitHub profile.

Guidelines:
- Tone: fun, conversational, slightly roast-y but ultimately celebratory.
- Length: 3–5 short paragraphs. No bullet lists. Flowing prose only.
- Avoid repeating the raw numbers verbatim — interpret them into character insights.
- Reference the developer's primary language, commit style, and timing habits naturally.
- End with one memorable one-liner "verdict" sentence.
- Do NOT use markdown headers or bold text. Plain paragraphs only.
- Do NOT make up facts. Only use the data provided.`;
}

/**
 * Build the user prompt from structured profile + metrics data.
 *
 * @param {string} username
 * @param {object} profile   Output of personalityEngine.buildPersonalityProfile()
 * @param {object} metrics   Raw analyzed metrics (timings, messages, cadence, etc.)
 * @param {object} langInfo  Output of languageAnalyzer.analyzeLanguages()
 * @param {object} userInfo  GitHub user object (name, bio, followers, etc.)
 * @returns {string}
 */
function buildUserPrompt(username, profile, metrics, langInfo, userInfo) {
  const {
    primaryType,
    secondaryType,
    alignment,
    devClass,
    traits,
    codingStyle,
    radarScores,
  } = profile;

  const { timings, messages, cadence, sizes } = metrics;

  const topLangs = (langInfo.languages || [])
    .slice(0, 4)
    .map((l) => `${l.name} (${l.percentage}%)`)
    .join(", ");

  const commitTypeSummary = Object.entries(messages.commitTypes || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const peakHourStr =
    timings.peakHour !== null && timings.peakHour !== undefined
      ? timings.peakHour === 0
        ? "midnight"
        : timings.peakHour < 12
          ? `${timings.peakHour}am`
          : timings.peakHour === 12
            ? "noon"
            : `${timings.peakHour - 12}pm`
      : "unknown";

  const dataBlock = [
    `GitHub username: ${username}`,
    userInfo?.name ? `Name: ${userInfo.name}` : null,
    userInfo?.bio ? `Bio: ${userInfo.bio}` : null,
    `Public repos: ${userInfo?.public_repos ?? "?"}`,
    `Followers: ${userInfo?.followers ?? "?"}`,
    ``,
    `--- Personality Profile ---`,
    `Primary type: ${primaryType.emoji} ${primaryType.label}`,
    secondaryType
      ? `Secondary tendency: ${secondaryType.emoji} ${secondaryType.label}`
      : null,
    `D&D Alignment: ${alignment.emoji} ${alignment.label} — "${alignment.tagline}"`,
    `Developer Class: ${devClass.label}`,
    `Coding style: ${codingStyle}`,
    ``,
    `--- Radar Scores (0-100) ---`,
    `Consistency: ${radarScores.consistency}`,
    `Productivity: ${radarScores.productivity}`,
    `Code Quality: ${radarScores.codeQuality}`,
    `Creativity: ${radarScores.creativity}`,
    `Collaboration: ${radarScores.collaboration}`,
    `Night Owl: ${radarScores.nightOwl}`,
    ``,
    `--- Commit Behavior ---`,
    `Total commits analyzed: ${cadence.totalCommits}`,
    `Commits per week (avg): ${cadence.commitsPerWeek}`,
    `Longest streak: ${cadence.streakDays} consecutive days`,
    `Peak coding hour: ${peakHourStr}`,
    `Late-night commits (midnight–4am): ${timings.timeBucketPercentages?.lateNight ?? 0}%`,
    `Weekend commits: ${timings.weekendPercentage ?? 0}%`,
    `Avg commit message length: ${messages.averageSubjectLength} characters`,
    `Conventional commits: ${messages.conventionalCommitPercentage}%`,
    `Commits with body: ${messages.hasBodyPercentage}%`,
    `Emoji commits: ${messages.emojiPercentage}%`,
    `WIP commits: ${messages.wipPercentage}%`,
    commitTypeSummary ? `Commit type breakdown: ${commitTypeSummary}` : null,
    ``,
    sizes.sampledCount > 0
      ? `Avg lines changed per commit: ${sizes.averageChangedLines}`
      : null,
    sizes.sampledCount > 0
      ? `Large commits (300+ lines): ${sizes.largeCommitPercentage}%`
      : null,
    sizes.sampledCount > 0
      ? `Micro commits (≤5 lines): ${sizes.microCommitPercentage}%`
      : null,
    ``,
    `--- Languages ---`,
    topLangs ? `Top languages: ${topLangs}` : "No language data",
    `Total languages used: ${langInfo.languageCount ?? 0}`,
    langInfo.stackArchetype
      ? `Stack archetype: ${langInfo.stackArchetype.emoji} ${langInfo.stackArchetype.label}`
      : null,
    langInfo.funFact ? `Language fun fact: ${langInfo.funFact}` : null,
    ``,
    `--- Observed Traits ---`,
    ...(traits || []).map((t) => `• ${t}`),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `Write a developer personality report for the GitHub user described below.\n\n` +
    dataBlock
  );
}

// ── Template Fallback ─────────────────────────────────────────────────────────

/**
 * Generate a deterministic, template-based summary when OpenRouter is
 * unavailable (no key set, or the API call fails). Reads the same
 * profile/metrics objects as the AI path so the output is still data-driven.
 *
 * @param {string} username
 * @param {object} profile
 * @param {object} metrics
 * @param {object} langInfo
 * @param {object} userInfo
 * @returns {string}
 */
function buildTemplateSummary(username, profile, metrics, langInfo, userInfo) {
  const { primaryType, alignment, devClass, codingStyle, radarScores } =
    profile;
  const { timings, cadence, messages } = metrics;

  const displayName = userInfo?.name || username;
  const topLang = langInfo?.primaryLanguage?.name || "code";
  const topLangPct = langInfo?.primaryLanguage?.percentage || 0;

  const peakHour = timings.peakHour;
  const peakHourStr =
    peakHour === null || peakHour === undefined
      ? "at unpredictable hours"
      : peakHour === 0
        ? "at midnight"
        : peakHour < 12
          ? `at ${peakHour}am`
          : peakHour === 12
            ? "at noon"
            : `at ${peakHour - 12}pm`;

  const lateNightPct = timings.timeBucketPercentages?.lateNight ?? 0;
  const weekendPct = timings.weekendPercentage ?? 0;
  const streakDays = cadence.streakDays ?? 0;
  const cpw = cadence.commitsPerWeek ?? 0;
  const convPct = messages.conventionalCommitPercentage ?? 0;

  // Opening
  const opening =
    `${displayName} is a textbook ${primaryType.emoji} ${primaryType.label}. ` +
    `Their GitHub history tells the story of someone who writes ` +
    `${topLangPct > 0 ? `primarily ${topLang} (${topLangPct}%) ` : ""}` +
    `with a coding style best described as: ${codingStyle}.`;

  // Timing
  let timingPara;
  if (lateNightPct >= 30) {
    timingPara =
      `The commit timestamps don't lie — ${lateNightPct}% of their work happens after midnight. ` +
      `This developer is most productive ${peakHourStr}, when the world is quiet and the keyboard is loud.`;
  } else if (weekendPct >= 40) {
    timingPara =
      `With ${weekendPct}% of commits landing on weekends, ${displayName} doesn't believe in work-life ` +
      `balance — they've merged them entirely. Peak hour: ${peakHourStr}.`;
  } else {
    timingPara =
      `They tend to commit ${peakHourStr}, keeping a ${cpw >= 7 ? "relentless" : "steady"} pace ` +
      `of around ${cpw} commits per week` +
      `${streakDays >= 7 ? `, with a personal best streak of ${streakDays} consecutive days` : ""}.`;
  }

  // Commit style
  let stylePara;
  if (convPct >= 70) {
    stylePara =
      `Every commit message follows the rules. Conventional Commits at ${convPct}% adoption means this ` +
      `developer takes their git history as seriously as their production code. Future-them will be grateful.`;
  } else if (convPct <= 20) {
    stylePara =
      `Commit messages are an art form here — unconstrained by convention, each one a unique expression ` +
      `of what was happening at that exact moment.` +
      `${messages.emojiPercentage >= 20 ? " The emojis help." : ""}`;
  } else {
    stylePara =
      `A mix of conventional structure and freestyle prose in their commit history suggests a developer ` +
      `who knows the rules well enough to decide when to follow them.`;
  }

  // Alignment / class
  const alignPara =
    `Alignment: ${alignment.emoji} ${alignment.label} — ${alignment.tagline}. ` +
    `In RPG terms, ${displayName} is a ${devClass.label}: ${devClass.description}`;

  // Verdict
  const topAxis = Object.entries(radarScores).sort((a, b) => b[1] - a[1])[0];
  const axisLabels = {
    consistency: "Consistency",
    productivity: "Productivity",
    codeQuality: "Code Quality",
    creativity: "Creativity",
    collaboration: "Collaboration",
    nightOwl: "Night Owl Energy",
  };
  const verdict =
    `Strongest trait: ${axisLabels[topAxis[0]] ?? topAxis[0]} (${topAxis[1]}/100). ` +
    `This is a developer worth watching — and maybe worth cloning.`;

  return [opening, timingPara, stylePara, alignPara, verdict]
    .filter(Boolean)
    .join("\n\n");
}

// ── Main Service Function ─────────────────────────────────────────────────────

/**
 * Generate an AI (or template) personality summary via OpenRouter.
 *
 * @param {string} username
 * @param {object} profile   Output of personalityEngine.buildPersonalityProfile()
 * @param {object} metrics   { timings, messages, cadence, sizes }
 * @param {object} langInfo  Output of languageAnalyzer.analyzeLanguages()
 * @param {object} [userInfo={}]  GitHub user object
 *
 * @returns {Promise<{
 *   summary:      string,
 *   source:       "openrouter" | "template",
 *   model?:       string,
 *   tokensUsed?:  number,
 *   error?:       string,
 * }>}
 */
async function generatePersonalitySummary(
  username,
  profile,
  metrics,
  langInfo,
  userInfo = {},
) {
  const client = getClient();

  // No API key configured — use the template fallback immediately
  if (!client) {
    return {
      summary: buildTemplateSummary(
        username,
        profile,
        metrics,
        langInfo,
        userInfo,
      ),
      source: "template",
    };
  }

  // Call OpenRouter
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let completion;
    try {
      completion = await client.chat.completions.create(
        {
          model: getModel(),
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            {
              role: "user",
              content: buildUserPrompt(
                username,
                profile,
                metrics,
                langInfo,
                userInfo,
              ),
            },
          ],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    const summary = completion.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error("OpenRouter returned an empty response");
    }

    return {
      summary,
      source: "openrouter",
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens,
    };
  } catch (err) {
    // Gracefully fall back to the template on any error (network, quota, etc.)
    console.warn(
      "[aiService] OpenRouter call failed, falling back to template summary:",
      err.message,
    );

    return {
      summary: buildTemplateSummary(
        username,
        profile,
        metrics,
        langInfo,
        userInfo,
      ),
      source: "template",
      error: err.message,
    };
  }
}

// ── Health Check ──────────────────────────────────────────────────────────────

/**
 * Quick connectivity test — verifies the key is configured and OpenRouter
 * responds. Uses a 1-token completion to avoid burning credits.
 *
 * @returns {Promise<{ ok: boolean, model?: string, error?: string }>}
 */
async function checkAIHealth() {
  const client = getClient();
  if (!client) {
    return { ok: false, error: "OPENROUTER_API_KEY not configured" };
  }

  try {
    const result = await client.chat.completions.create({
      model: getModel(),
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true, model: result.model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  generatePersonalitySummary,
  checkAIHealth,
  // Expose for testing
  buildSystemPrompt,
  buildUserPrompt,
  buildTemplateSummary,
  getModel,
};
