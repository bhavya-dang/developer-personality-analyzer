/**
 * personalityEngine.js
 *
 * Maps raw analyzed metrics (from commitAnalyzer, language data, PR data, etc.)
 * into a structured developer personality profile:
 *   - Primary personality type  (e.g. "Night Owl Engineer 🦉")
 *   - Secondary type modifier   (e.g. "with Perfectionist tendencies")
 *   - Trait list                (bullet-point observations)
 *   - D&D-style alignment       (e.g. "Chaotic Neutral Hacker")
 *   - Coding style summary      (one-liner)
 *   - Radar chart scores        (6 axes, 0–100)
 *   - Fun developer "class"     (Wizard, Rogue, Paladin, …)
 */

"use strict";

// ── Personality Type Definitions ──────────────────────────────────────────────

/**
 * Each entry describes ONE primary type.
 * `score(metrics)` returns a numeric affinity (higher = stronger match).
 * Types are ranked by score; the highest wins.
 */
const PERSONALITY_TYPES = [
  {
    id: "night_owl",
    label: "Night Owl Engineer",
    emoji: "🦉",
    description:
      "You do your best work when the rest of the world is asleep. Darkness fuels your creativity.",
    score({ timings }) {
      const { timeBucketPercentages: t } = timings;
      return (t.lateNight || 0) * 1.5 + (t.night || 0) * 0.8;
    },
  },
  {
    id: "early_bird",
    label: "Early Bird Coder",
    emoji: "🐦",
    description:
      "You're productive before most people have finished their first coffee. Dawn is your IDE.",
    score({ timings }) {
      const { timeBucketPercentages: t } = timings;
      return (t.earlyMorning || 0) * 1.5 + (t.morning || 0) * 0.8;
    },
  },
  {
    id: "nine_to_five",
    label: "9-to-5 Professional",
    emoji: "💼",
    description:
      "You treat coding like the craft it is — structured, scheduled, and sustainably paced.",
    score({ timings }) {
      const { timeBucketPercentages: t } = timings;
      return (t.morning || 0) * 0.9 + (t.afternoon || 0) * 1.2;
    },
  },
  {
    id: "weekend_warrior",
    label: "Weekend Warrior",
    emoji: "⚔️",
    description:
      "Monday-to-Friday is just the build-up. Your real coding sprints happen on weekends.",
    score({ timings }) {
      return (timings.weekendPercentage || 0) * 1.6;
    },
  },
  {
    id: "perfectionist",
    label: "Perfectionist Craftsman",
    emoji: "🔬",
    description:
      "Every line of code is a statement about who you are. You refactor until it's right.",
    score({ messages, sizes }) {
      let s = 0;
      s += (messages.commitTypes?.refactor || 0) * 3;
      s += (messages.conventionalCommitPercentage || 0) * 0.8;
      s += (sizes.microCommitPercentage || 0) * 0.5;
      s += messages.hasBodyPercentage * 0.4;
      return s;
    },
  },
  {
    id: "chaos_engineer",
    label: "Chaos Engineer",
    emoji: "💥",
    description:
      "Big bang commits, fearless refactors, and commit messages that tell a story — or a thriller.",
    score({ sizes, messages, cadence }) {
      let s = 0;
      s += (sizes.largeCommitPercentage || 0) * 1.2;
      s += (cadence.burstyScore || 0) * 10;
      s += (messages.wipPercentage || 0) * 1.5;
      return s;
    },
  },
  {
    id: "micro_optimizer",
    label: "Micro-Optimizer",
    emoji: "🔩",
    description:
      "Tiny, atomic, surgical commits. You slice problems into the smallest possible pieces.",
    score({ sizes, cadence }) {
      let s = 0;
      s += (sizes.microCommitPercentage || 0) * 1.4;
      s += Math.max(0, 40 - (sizes.averageChangedLines || 0)) * 0.5;
      s += (cadence.commitsPerDay || 0) * 3;
      return s;
    },
  },
  {
    id: "polyglot",
    label: "Polyglot Developer",
    emoji: "🌐",
    description:
      "Languages are just tools to you. You pick the right one for the job without hesitation.",
    score({ languages }) {
      const count = Object.keys(languages || {}).length;
      return count >= 5 ? 80 + count * 3 : count * 12;
    },
  },
  {
    id: "documentation_hero",
    label: "Documentation Hero",
    emoji: "📚",
    description:
      "Future-you (and future teammates) will thank you. You write code AND explain it.",
    score({ messages }) {
      let s = 0;
      s += (messages.hasBodyPercentage || 0) * 0.9;
      s += (messages.commitTypes?.docs || 0) * 4;
      s += (messages.averageSubjectLength || 0) * 0.3;
      return s;
    },
  },
  {
    id: "feature_factory",
    label: "Feature Factory",
    emoji: "🏭",
    description:
      "Ship it. Then ship more. Your commit log reads like a product roadmap.",
    score({ messages }) {
      const feat = messages.commitTypes?.feat || 0;
      const total = Object.values(messages.commitTypes || {}).reduce(
        (a, b) => a + b,
        0
      );
      if (total === 0) return 0;
      return (feat / total) * 100 * 1.2;
    },
  },
  {
    id: "bug_slayer",
    label: "Bug Slayer",
    emoji: "🐛",
    description:
      "Where others see bugs, you see puzzles. Your fix-to-feature ratio is a badge of honour.",
    score({ messages }) {
      const fix = messages.commitTypes?.fix || 0;
      const total = Object.values(messages.commitTypes || {}).reduce(
        (a, b) => a + b,
        0
      );
      if (total === 0) return 0;
      return (fix / total) * 100 * 1.2;
    },
  },
  {
    id: "devops_monk",
    label: "DevOps Monk",
    emoji: "🧘",
    description:
      "CI green, pipelines humming, chores done. You keep the temple clean.",
    score({ messages }) {
      const chore = messages.commitTypes?.chore || 0;
      const ci    = messages.commitTypes?.ci    || 0;
      const build = messages.commitTypes?.build || 0;
      const total = Object.values(messages.commitTypes || {}).reduce(
        (a, b) => a + b,
        0
      );
      if (total === 0) return 0;
      return ((chore + ci + build) / total) * 100 * 1.1;
    },
  },
];

// ── Alignment Matrix ──────────────────────────────────────────────────────────

/**
 * D&D-style two-axis alignment.
 * Law axis:    Lawful ←→ Chaotic   (based on conventionality / commit discipline)
 * Good axis:   Good   ←→ Evil      (based on documentation & test coverage signals)
 *
 * Returns one of the 9 classic alignments.
 */
function deriveAlignment(metrics) {
  const { messages, sizes, cadence } = metrics;

  // ── Law score (0 = pure Chaotic, 100 = pure Lawful) ──
  let lawScore = 50; // start neutral

  // Conventional commits → lawful
  lawScore += (messages.conventionalCommitPercentage || 0) * 0.3;
  // Micro commits → lawful (disciplined)
  lawScore += (sizes.microCommitPercentage || 0) * 0.15;
  // WIP commits → chaotic
  lawScore -= (messages.wipPercentage || 0) * 0.6;
  // Large blobs → chaotic
  lawScore -= (sizes.largeCommitPercentage || 0) * 0.2;
  // Bursty cadence → chaotic
  lawScore -= (cadence.burstyScore || 0) * 5;
  // High stddev in subject length → chaotic
  lawScore -= (messages.subjectLengthStddev || 0) * 0.1;
  // Emoji → slightly chaotic (fun)
  lawScore -= (messages.emojiPercentage || 0) * 0.1;

  lawScore = Math.max(0, Math.min(100, lawScore));

  // ── Good score (0 = Evil/Selfish, 100 = Good/Helpful) ──
  let goodScore = 50;

  // Docs commits → good
  goodScore += (messages.commitTypes?.docs  || 0) * 2;
  // Test commits → good
  goodScore += (messages.commitTypes?.test  || 0) * 2;
  // Commit bodies → good (explains reasoning for others)
  goodScore += (messages.hasBodyPercentage || 0) * 0.3;
  // Perf commits → good
  goodScore += (messages.commitTypes?.perf  || 0) * 1.5;
  // ALL CAPS messages → slightly evil (aggressive)
  goodScore -= (messages.uppercasePercentage || 0) * 0.4;
  // WIP → neutral/selfish
  goodScore -= (messages.wipPercentage || 0) * 0.2;

  goodScore = Math.max(0, Math.min(100, goodScore));

  // ── Map scores to labels ──
  const lawLabel =
    lawScore >= 66 ? "Lawful" : lawScore >= 33 ? "Neutral" : "Chaotic";
  const goodLabel =
    goodScore >= 66 ? "Good" : goodScore >= 33 ? "Neutral" : "Evil";

  const alignmentMap = {
    "Lawful Good":      { label: "Lawful Good",      emoji: "⚖️",  tagline: "The Senior Dev Everyone Wants on Their Team" },
    "Lawful Neutral":   { label: "Lawful Neutral",   emoji: "📋",  tagline: "The Process Enforcer" },
    "Lawful Evil":      { label: "Lawful Evil",       emoji: "😈",  tagline: "The Ticket-Closer (Won't Fix)" },
    "Neutral Good":     { label: "Neutral Good",     emoji: "😊",  tagline: "The Helpful Collaborator" },
    "True Neutral":     { label: "True Neutral",     emoji: "⚪",  tagline: "The Pragmatic Problem Solver" },
    "Neutral Evil":     { label: "Neutral Evil",     emoji: "🕶️",  tagline: "The Silent Codebase Ninja" },
    "Chaotic Good":     { label: "Chaotic Good",     emoji: "🦸",  tagline: "The Creative Genius Who Ships" },
    "Chaotic Neutral":  { label: "Chaotic Neutral",  emoji: "🎲",  tagline: "The Hacker — Move Fast, Break Things" },
    "Chaotic Evil":     { label: "Chaotic Evil",     emoji: "💀",  tagline: "The Legendary 3am Cowboy Deployer" },
  };

  const key =
    lawLabel === "Neutral" && goodLabel === "Neutral"
      ? "True Neutral"
      : `${lawLabel} ${goodLabel}`;

  return {
    lawScore:  Math.round(lawScore),
    goodScore: Math.round(goodScore),
    ...(alignmentMap[key] || alignmentMap["True Neutral"]),
  };
}

// ── Developer Class ───────────────────────────────────────────────────────────

const DEVELOPER_CLASSES = [
  {
    id: "wizard",
    label: "Wizard 🧙",
    description: "Master of arcane abstractions and dark framework magic.",
    match: ({ languages, messages }) => {
      const langs = Object.keys(languages || {});
      const hasTypeScript = langs.some((l) => l.toLowerCase() === "typescript");
      const hasFP = langs.some((l) =>
        ["haskell", "elm", "clojure", "scala", "ocaml", "fsharp"].includes(
          l.toLowerCase()
        )
      );
      return (hasTypeScript ? 20 : 0) + (hasFP ? 40 : 0) +
        (messages.conventionalCommitPercentage || 0) * 0.3;
    },
  },
  {
    id: "rogue",
    label: "Rogue 🗡️",
    description: "Fast, silent, and deadly. Slips features in under the radar.",
    match: ({ sizes, cadence, timings }) =>
      (sizes.microCommitPercentage || 0) * 0.5 +
      (cadence.commitsPerDay || 0) * 4 +
      (timings.timeBucketPercentages?.lateNight || 0) * 0.4,
  },
  {
    id: "paladin",
    label: "Paladin 🛡️",
    description: "Righteous guardian of code quality and team standards.",
    match: ({ messages }) =>
      (messages.conventionalCommitPercentage || 0) * 0.6 +
      (messages.hasBodyPercentage || 0) * 0.5 +
      (messages.commitTypes?.test || 0) * 3 +
      (messages.commitTypes?.docs || 0) * 3,
  },
  {
    id: "barbarian",
    label: "Barbarian 🪓",
    description: "Massive commits, raw power, no mercy for legacy code.",
    match: ({ sizes, cadence }) =>
      (sizes.largeCommitPercentage || 0) * 1.2 +
      (cadence.burstyScore || 0) * 8,
  },
  {
    id: "bard",
    label: "Bard 🎵",
    description: "Expressive commit messages, emojis, and code that tells a story.",
    match: ({ messages }) =>
      (messages.emojiPercentage || 0) * 1.5 +
      (messages.hasBodyPercentage || 0) * 0.6 +
      (messages.averageSubjectLength || 0) * 0.4,
  },
  {
    id: "ranger",
    label: "Ranger 🏹",
    description: "Polyglot hunter comfortable in any codebase terrain.",
    match: ({ languages }) => {
      const count = Object.keys(languages || {}).length;
      return count * 15;
    },
  },
  {
    id: "cleric",
    label: "Cleric ⛪",
    description: "Healer of broken builds, fixer of flaky tests, keeper of the CI green.",
    match: ({ messages }) =>
      (messages.commitTypes?.fix   || 0) * 2.5 +
      (messages.commitTypes?.ci    || 0) * 3 +
      (messages.commitTypes?.test  || 0) * 2.5,
  },
  {
    id: "monk",
    label: "Monk 🥋",
    description: "Disciplined, consistent, and methodical. Clean code is a way of life.",
    match: ({ cadence, sizes, messages }) =>
      (sizes.microCommitPercentage || 0) * 0.6 +
      Math.max(0, 50 - (cadence.burstyScore || 0) * 10) +
      (messages.commitTypes?.refactor || 0) * 2,
  },
];

function deriveClass(metrics) {
  const scores = DEVELOPER_CLASSES.map((cls) => ({
    ...cls,
    score: cls.match(metrics),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0];
}

// ── Radar Chart Axes ──────────────────────────────────────────────────────────

/**
 * Produces 6 axis scores (0–100) for a radar/spider chart.
 *
 * Axes:
 *  1. Consistency   – how regular and predictable the commit cadence is
 *  2. Productivity  – raw commit velocity and active days
 *  3. Code Quality  – signals: tests, docs, refactors, conventional commits
 *  4. Creativity    – variety of languages, emoji, expressive messages
 *  5. Collaboration – PR activity, descriptive commit bodies
 *  6. Night Owl     – degree to which work happens after hours
 */
function buildRadarScores(metrics) {
  const { timings, messages, cadence, sizes, languages, pullRequests } = metrics;

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // 1. Consistency
  const consistency = clamp(
    Math.max(0, 80 - (cadence.burstyScore || 0) * 15) +
    (messages.conventionalCommitPercentage || 0) * 0.2
  );

  // 2. Productivity
  const productivity = clamp(
    Math.min(100, (cadence.commitsPerWeek || 0) * 4) * 0.6 +
    Math.min(100, (cadence.activeDays     || 0) * 1.5) * 0.4
  );

  // 3. Code Quality
  const testCount   = messages.commitTypes?.test    || 0;
  const docsCount   = messages.commitTypes?.docs    || 0;
  const refactCount = messages.commitTypes?.refactor || 0;
  const codeQuality = clamp(
    (messages.conventionalCommitPercentage || 0) * 0.35 +
    (messages.hasBodyPercentage            || 0) * 0.2 +
    testCount   * 2 +
    docsCount   * 2 +
    refactCount * 1.5 +
    (sizes.microCommitPercentage || 0) * 0.1
  );

  // 4. Creativity
  const langCount  = Object.keys(languages || {}).length;
  const creativity = clamp(
    langCount * 8 +
    (messages.emojiPercentage        || 0) * 0.6 +
    (messages.averageSubjectLength   || 0) * 0.2 +
    (messages.averageWordCount       || 0) * 2
  );

  // 5. Collaboration
  const prCount      = (pullRequests || []).length;
  const collaboration = clamp(
    Math.min(50, prCount * 3) +
    (messages.hasBodyPercentage || 0) * 0.5
  );

  // 6. Night Owl
  const { timeBucketPercentages: t } = timings;
  const nightOwl = clamp(
    (t.lateNight || 0) * 1.2 +
    (t.night     || 0) * 0.7
  );

  return {
    consistency,
    productivity,
    codeQuality,
    creativity,
    collaboration,
    nightOwl,
  };
}

// ── Trait Generator ───────────────────────────────────────────────────────────

/**
 * Generates an array of human-readable trait strings from raw metrics.
 * Each trait is a short, punchy observation (like the example in the spec).
 *
 * @param {object} metrics
 * @param {object} profile   Already-computed { primaryType, alignment, devClass, radar }
 * @returns {string[]}
 */
function generateTraits(metrics, profile) {
  const { timings, messages, cadence, sizes, languages } = metrics;
  const traits = [];

  // ── Timing traits ──
  const { timeBucketPercentages: t, weekendPercentage, peakHour } = timings;

  if ((t.lateNight || 0) >= 30) {
    traits.push(
      `🌙 ${t.lateNight}% of commits happen between midnight and 4am`
    );
  } else if ((t.night || 0) >= 35) {
    traits.push(`🌆 ${t.night}% of commits happen in the evening (9pm–midnight)`);
  } else if ((t.earlyMorning || 0) >= 25) {
    traits.push(`🌅 ${t.earlyMorning}% of commits happen before 9am`);
  } else if ((t.afternoon || 0) >= 40) {
    traits.push(`☀️ Most productive in the afternoon (${t.afternoon}% of commits)`);
  }

  if (weekendPercentage >= 40) {
    traits.push(`⚔️ Weekend warrior — ${weekendPercentage}% of commits on Sat/Sun`);
  } else if (weekendPercentage <= 5) {
    traits.push(`📅 Strictly a weekday coder (only ${weekendPercentage}% weekend commits)`);
  }

  if (peakHour !== null) {
    const ampm =
      peakHour === 0
        ? "midnight"
        : peakHour < 12
        ? `${peakHour}am`
        : peakHour === 12
        ? "noon"
        : `${peakHour - 12}pm`;
    traits.push(`⏰ Peak coding hour: ${ampm}`);
  }

  // ── Cadence traits ──
  if (cadence.streakDays >= 7) {
    traits.push(`🔥 Longest commit streak: ${cadence.streakDays} consecutive days`);
  }
  if (cadence.commitsPerWeek >= 20) {
    traits.push(
      `⚡ Prolific committer — averages ${cadence.commitsPerWeek} commits per week`
    );
  } else if (cadence.commitsPerWeek >= 7) {
    traits.push(`💪 Commits daily (${cadence.commitsPerWeek} commits/week on average)`);
  }

  // ── Message traits ──
  if (messages.conventionalCommitPercentage >= 70) {
    traits.push(
      `📐 ${messages.conventionalCommitPercentage}% conventional commits — highly structured`
    );
  } else if (messages.conventionalCommitPercentage <= 15) {
    traits.push(`✍️ Freestyle commit messages — no conventional format`);
  }

  if (messages.hasBodyPercentage >= 50) {
    traits.push(
      `📝 Writes detailed commit bodies ${messages.hasBodyPercentage}% of the time`
    );
  }

  if (messages.emojiPercentage >= 20) {
    traits.push(`🎨 Commits with emojis ${messages.emojiPercentage}% of the time`);
  }

  if (messages.wipPercentage >= 15) {
    traits.push(
      `🚧 ${messages.wipPercentage}% WIP commits — commits early and iterates`
    );
  }

  if (messages.averageSubjectLength >= 60) {
    traits.push(
      `📖 Writes long commit messages (avg ${messages.averageSubjectLength} chars)`
    );
  } else if (messages.averageSubjectLength <= 20) {
    traits.push(
      `⚡ Terse commit style (avg ${messages.averageSubjectLength} chars per message)`
    );
  }

  // ── Commit type traits ──
  const types = messages.commitTypes || {};
  const total = Object.values(types).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const refactPct = Math.round(((types.refactor || 0) / total) * 100);
    const featPct   = Math.round(((types.feat    || 0) / total) * 100);
    const fixPct    = Math.round(((types.fix     || 0) / total) * 100);
    const docsPct   = Math.round(((types.docs    || 0) / total) * 100);
    const testPct   = Math.round(((types.test    || 0) / total) * 100);

    if (refactPct >= 20) traits.push(`🔄 Refactors frequently (${refactPct}% of commits)`);
    if (featPct   >= 40) traits.push(`🚀 Feature-focused — ${featPct}% of commits are new features`);
    if (fixPct    >= 35) traits.push(`🐛 Bug-hunting specialist (${fixPct}% fix commits)`);
    if (docsPct   >= 15) traits.push(`📚 Dedicated documenter (${docsPct}% docs commits)`);
    if (testPct   >= 15) traits.push(`🧪 Test-driven mindset (${testPct}% test commits)`);
  }

  // ── Size traits ──
  if (sizes.sizeProfile === "massive") {
    traits.push(
      `💣 Commits huge changesets — avg ${sizes.averageChangedLines} lines per commit`
    );
  } else if (sizes.sizeProfile === "micro") {
    traits.push(
      `🔬 Micro-commit practitioner — avg ${sizes.averageChangedLines} lines per commit`
    );
  }

  if (sizes.largeCommitPercentage >= 30) {
    traits.push(
      `🏗️ ${sizes.largeCommitPercentage}% of commits change 300+ lines`
    );
  }

  // ── Language traits ──
  const langs = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  if (langs.length > 0) {
    const [topLang, topBytes] = langs[0];
    const totalBytes = langs.reduce((s, [, b]) => s + b, 0);
    const topPct = Math.round((topBytes / totalBytes) * 100);
    traits.push(`💻 Primary language: ${topLang} (${topPct}% of code)`);
  }
  if (langs.length >= 5) {
    traits.push(`🌐 Polyglot — codes in ${langs.length} languages`);
  }

  return traits;
}

// ── Coding Style Summary ──────────────────────────────────────────────────────

const STYLE_SUMMARIES = [
  {
    test: ({ sizes, cadence, messages }) =>
      sizes.largeCommitPercentage >= 30 && cadence.burstyScore >= 2,
    label: "Chaotic but productive 🔥",
  },
  {
    test: ({ messages, sizes }) =>
      messages.conventionalCommitPercentage >= 60 &&
      sizes.sizeProfile === "micro",
    label: "Methodical and precise 🎯",
  },
  {
    test: ({ messages, cadence }) =>
      messages.commitTypes?.refactor >= 10 &&
      cadence.commitsPerWeek >= 5,
    label: "Iterative perfectionist 🔄",
  },
  {
    test: ({ messages }) => messages.emojiPercentage >= 20,
    label: "Expressive and creative 🎨",
  },
  {
    test: ({ timings }) => timings.timeBucketPercentages?.lateNight >= 30,
    label: "Nocturnal and inspired 🌙",
  },
  {
    test: ({ messages }) => messages.hasBodyPercentage >= 50,
    label: "Thorough and communicative 📝",
  },
  {
    test: ({ cadence }) => cadence.commitsPerWeek >= 15,
    label: "High-velocity and relentless ⚡",
  },
  {
    test: ({ languages }) => Object.keys(languages || {}).length >= 5,
    label: "Versatile and language-agnostic 🌐",
  },
  {
    test: () => true, // default
    label: "Pragmatic and adaptable 🛠️",
  },
];

function deriveCodingStyle(metrics) {
  for (const { test, label } of STYLE_SUMMARIES) {
    if (test(metrics)) return label;
  }
  return "Pragmatic and adaptable 🛠️";
}

// ── Secondary Type Modifier ───────────────────────────────────────────────────

/**
 * After picking the primary type, find the 2nd-highest scoring type
 * to use as a modifier ("…with Perfectionist tendencies").
 */
function deriveSecondaryType(metrics, primaryTypeId) {
  const ranked = PERSONALITY_TYPES.map((pt) => ({
    ...pt,
    score: pt.score(metrics),
  }))
    .filter((pt) => pt.id !== primaryTypeId)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  const second = ranked[0];

  // Only surface it if it has a meaningful score
  if (second.score < 15) return null;

  return {
    id:    second.id,
    label: second.label,
    emoji: second.emoji,
  };
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Build the full developer personality profile from analyzed metrics.
 *
 * @param {{
 *   timings:       object,
 *   messages:      object,
 *   cadence:       object,
 *   sizes:         object,
 *   languages:     object,   // { "JavaScript": 12345, "TypeScript": 6789, … }
 *   pullRequests:  object[],
 * }} metrics
 *
 * @returns {{
 *   primaryType:    { id, label, emoji, description },
 *   secondaryType:  { id, label, emoji } | null,
 *   alignment:      { label, emoji, tagline, lawScore, goodScore },
 *   devClass:       { id, label, description },
 *   traits:         string[],
 *   codingStyle:    string,
 *   radarScores:    { consistency, productivity, codeQuality, creativity, collaboration, nightOwl },
 * }}
 */
function buildPersonalityProfile(metrics) {
  if (!metrics || typeof metrics !== "object") {
    throw new TypeError("buildPersonalityProfile: `metrics` must be an object");
  }

  // Normalize missing optional fields so scorers never crash
  const m = {
    timings:      metrics.timings      || { timeBucketPercentages: {}, hourHistogram: [], dayOfWeekHistogram: { counts: [], labels: [] }, timeBuckets: {}, weekendPercentage: 0, peakHour: null, dominantBucket: null },
    messages:     metrics.messages     || { commitTypes: {}, conventionalCommitPercentage: 0, hasBodyPercentage: 0, emojiPercentage: 0, wipPercentage: 0 },
    cadence:      metrics.cadence      || { commitsPerDay: 0, commitsPerWeek: 0, burstyScore: 0, streakDays: 0, activeDays: 0, totalCommits: 0 },
    sizes:        metrics.sizes        || { largeCommitPercentage: 0, microCommitPercentage: 0, averageChangedLines: 0, sizeProfile: "unknown" },
    languages:    metrics.languages    || {},
    pullRequests: metrics.pullRequests || [],
  };

  // 1. Score every personality type, pick the winner
  const ranked = PERSONALITY_TYPES.map((pt) => ({
    ...pt,
    _score: pt.score(m),
  })).sort((a, b) => b._score - a._score);

  const primaryTypeFull = ranked[0];
  const primaryType = {
    id:          primaryTypeFull.id,
    label:       primaryTypeFull.label,
    emoji:       primaryTypeFull.emoji,
    description: primaryTypeFull.description,
  };

  // 2. Secondary type modifier
  const secondaryType = deriveSecondaryType(m, primaryType.id);

  // 3. Alignment
  const alignment = deriveAlignment(m);

  // 4. Developer class
  const devClass = (() => {
    const c = deriveClass(m);
    return { id: c.id, label: c.label, description: c.description };
  })();

  // 5. Radar scores
  const radarScores = buildRadarScores(m);

  // 6. Traits (generated last so it can reference other profile data)
  const traits = generateTraits(m, { primaryType, alignment, devClass, radarScores });

  // 7. Coding style summary
  const codingStyle = deriveCodingStyle(m);

  return {
    primaryType,
    secondaryType,
    alignment,
    devClass,
    traits,
    codingStyle,
    radarScores,
  };
}

module.exports = {
  buildPersonalityProfile,
  // Expose internals for unit testing
  deriveAlignment,
  deriveClass,
  buildRadarScores,
  generateTraits,
  deriveCodingStyle,
  deriveSecondaryType,
  PERSONALITY_TYPES,
  DEVELOPER_CLASSES,
};
