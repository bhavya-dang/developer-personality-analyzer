/**
 * commitAnalyzer.js
 *
 * Extracts rich behavioral metrics from an array of raw GitHub commit objects.
 * All functions are pure (no side effects, no API calls) so they are trivially
 * testable and reusable across user-level and repo-level analysis.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Conventional-commit prefixes we recognise (lowercase). */
const COMMIT_TYPE_PATTERNS = [
  { type: "feat", regex: /^feat(\(.+\))?[!]?:/i },
  { type: "fix", regex: /^fix(\(.+\))?[!]?:/i },
  { type: "chore", regex: /^chore(\(.+\))?[!]?:/i },
  { type: "refactor", regex: /^refactor(\(.+\))?[!]?:/i },
  { type: "docs", regex: /^docs(\(.+\))?[!]?:/i },
  { type: "style", regex: /^style(\(.+\))?[!]?:/i },
  { type: "test", regex: /^test(\(.+\))?[!]?:/i },
  { type: "perf", regex: /^perf(\(.+\))?[!]?:/i },
  { type: "ci", regex: /^ci(\(.+\))?[!]?:/i },
  { type: "build", regex: /^build(\(.+\))?[!]?:/i },
  { type: "revert", regex: /^revert(\(.+\))?[!]?:/i },
];

/** Hour-of-day buckets (24-hour clock, local commit time is preserved). */
const TIME_BUCKETS = {
  earlyMorning: { label: "Early Morning", start: 5, end: 8 }, // 05:00–08:59
  morning: { label: "Morning", start: 9, end: 11 }, // 09:00–11:59
  afternoon: { label: "Afternoon", start: 12, end: 16 }, // 12:00–16:59
  evening: { label: "Evening", start: 17, end: 20 }, // 17:00–20:59
  night: { label: "Night", start: 21, end: 23 }, // 21:00–23:59
  lateNight: { label: "Late Night", start: 0, end: 4 }, // 00:00–04:59
};

/** Day-of-week index → name (Date.getDay() convention). */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely extract the author date from a raw GitHub commit object.
 * Returns a Date or null.
 * @param {object} commit  Raw GitHub commit (REST API shape)
 */
function extractDate(commit) {
  const dateStr =
    commit?.commit?.author?.date || commit?.commit?.committer?.date || null;
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extract the first line of a commit message (the "subject").
 * @param {object} commit
 */
function extractSubject(commit) {
  const msg = commit?.commit?.message || "";
  return msg.split("\n")[0].trim();
}

/**
 * Return the full commit message body (everything after the first blank line).
 * @param {object} commit
 */
function extractBody(commit) {
  const msg = commit?.commit?.message || "";
  const idx = msg.indexOf("\n\n");
  return idx === -1 ? "" : msg.slice(idx + 2).trim();
}

/**
 * Classify a commit subject into a known conventional-commit type, or "other".
 * @param {string} subject
 * @returns {string}
 */
function classifyType(subject) {
  for (const { type, regex } of COMMIT_TYPE_PATTERNS) {
    if (regex.test(subject)) return type;
  }
  // Fallback: look for bare keywords at the start
  const lower = subject.toLowerCase();
  if (/^(add|added|adds)\b/.test(lower)) return "feat";
  if (/^(fix|fixes|fixed)\b/.test(lower)) return "fix";
  if (/^(remove|delete|cleanup)\b/.test(lower)) return "chore";
  if (/^(update|bump|upgrade)\b/.test(lower)) return "chore";
  if (/^(refactor|refactored|cleanup)\b/.test(lower)) return "refactor";
  if (/^(wip|todo|temp)\b/i.test(lower)) return "wip";
  if (/^(merge)\b/i.test(lower)) return "merge";
  if (/^(init|initial|bootstrap)\b/i.test(lower)) return "init";
  return "other";
}

/**
 * Map an hour (0–23) to one of the TIME_BUCKET keys.
 * @param {number} hour
 * @returns {string}
 */
function hourToBucket(hour) {
  for (const [key, { start, end }] of Object.entries(TIME_BUCKETS)) {
    if (start <= end) {
      if (hour >= start && hour <= end) return key;
    } else {
      // wraps midnight (lateNight: 0–4)
      if (hour >= start || hour <= end) return key;
    }
  }
  return "other";
}

/**
 * Count the number of words in a string.
 * @param {string} str
 */
function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate the median of a numeric array.
 * @param {number[]} arr
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate the standard deviation of a numeric array.
 * @param {number[]} arr
 */
function stddev(arr) {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Return an object where every key maps to 0 (used to initialise counters).
 * @param {string[]} keys
 */
function zeroMap(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

// ── Core analysis functions ────────────────────────────────────────────────────

/**
 * Build a per-hour-of-day histogram (0–23).
 * @param {Date[]} dates
 * @returns {number[]}  length-24 array
 */
function buildHourHistogram(dates) {
  const hist = new Array(24).fill(0);
  for (const d of dates) {
    hist[d.getHours()]++;
  }
  return hist;
}

/**
 * Build a per-day-of-week histogram (0 = Sunday … 6 = Saturday).
 * @param {Date[]} dates
 * @returns {{ counts: number[], labels: string[] }}
 */
function buildDayOfWeekHistogram(dates) {
  const counts = new Array(7).fill(0);
  for (const d of dates) {
    counts[d.getDay()]++;
  }
  return { counts, labels: DAY_NAMES };
}

/**
 * Calculate timing metrics from an array of commit dates.
 * @param {Date[]} dates
 * @returns {object}
 */
function analyzeTimings(dates) {
  if (dates.length === 0) {
    return {
      hourHistogram: new Array(24).fill(0),
      dayOfWeekHistogram: { counts: new Array(7).fill(0), labels: DAY_NAMES },
      timeBuckets: zeroMap(Object.keys(TIME_BUCKETS)),
      timeBucketPercentages: zeroMap(Object.keys(TIME_BUCKETS)),
      peakHour: null,
      peakDayOfWeek: null,
      dominantBucket: null,
      isWeekendWarrior: false,
      weekendPercentage: 0,
    };
  }

  const hourHistogram = buildHourHistogram(dates);
  const { counts: dowCounts, labels: dowLabels } =
    buildDayOfWeekHistogram(dates);

  // Time bucket tallies
  const timeBuckets = zeroMap(Object.keys(TIME_BUCKETS));
  for (const d of dates) {
    const bucket = hourToBucket(d.getHours());
    if (bucket in timeBuckets) timeBuckets[bucket]++;
  }

  // Percentages
  const total = dates.length;
  const timeBucketPercentages = {};
  for (const [key, count] of Object.entries(timeBuckets)) {
    timeBucketPercentages[key] = Math.round((count / total) * 100);
  }

  // Peak hour (0–23)
  const peakHour = hourHistogram.indexOf(Math.max(...hourHistogram));

  // Peak day of week
  const maxDow = Math.max(...dowCounts);
  const peakDayOfWeek = dowLabels[dowCounts.indexOf(maxDow)];

  // Dominant time bucket
  const dominantBucket = Object.entries(timeBuckets).reduce(
    (best, [k, v]) => (v > best[1] ? [k, v] : best),
    ["", -1],
  )[0];

  // Weekend warrior: >40% commits on Sat/Sun
  const weekendCount = dowCounts[0] + dowCounts[6]; // Sun + Sat
  const weekendPercentage = Math.round((weekendCount / total) * 100);
  const isWeekendWarrior = weekendPercentage >= 40;

  return {
    hourHistogram,
    dayOfWeekHistogram: { counts: dowCounts, labels: dowLabels },
    timeBuckets,
    timeBucketPercentages,
    peakHour,
    peakDayOfWeek,
    dominantBucket,
    isWeekendWarrior,
    weekendPercentage,
  };
}

/**
 * Analyze commit message characteristics.
 * @param {object[]} commits  Raw GitHub commit objects
 * @returns {object}
 */
function analyzeMessages(commits) {
  if (commits.length === 0) {
    return {
      averageSubjectLength: 0,
      medianSubjectLength: 0,
      averageWordCount: 0,
      medianWordCount: 0,
      hasBodyPercentage: 0,
      emojiPercentage: 0,
      uppercasePercentage: 0,
      averageBodyLength: 0,
      subjectLengthStddev: 0,
      commitTypes: {},
      dominantType: null,
      conventionalCommitPercentage: 0,
      wipPercentage: 0,
    };
  }

  const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;

  const subjects = commits.map((c) => extractSubject(c));
  const bodies = commits.map((c) => extractBody(c));

  const subjectLengths = subjects.map((s) => s.length);
  const subjectWords = subjects.map((s) => wordCount(s));
  const bodyLengths = bodies.map((b) => b.length);

  const totalCount = commits.length;

  // Conventional commit detection
  const types = {};
  let conventionalCount = 0;
  let wipCount = 0;

  for (const subject of subjects) {
    const t = classifyType(subject);
    types[t] = (types[t] || 0) + 1;

    // "other", "wip", "merge", "init" are not conventional
    if (!["other", "wip", "merge", "init"].includes(t)) {
      conventionalCount++;
    }
    if (t === "wip") wipCount++;
  }

  const dominantType = Object.entries(types).reduce(
    (best, [k, v]) => (v > best[1] ? [k, v] : best),
    ["", -1],
  )[0];

  // Emoji usage
  const emojiCount = subjects.filter((s) => EMOJI_REGEX.test(s)).length;

  // ALL-CAPS subject check (shout-y commits)
  const uppercaseCount = subjects.filter((s) => {
    const letters = s.replace(/[^a-zA-Z]/g, "");
    if (letters.length < 3) return false;
    return letters === letters.toUpperCase();
  }).length;

  // Commits that have a body
  const hasBodyCount = bodies.filter((b) => b.length > 0).length;

  return {
    averageSubjectLength: Math.round(
      subjectLengths.reduce((s, v) => s + v, 0) / totalCount,
    ),
    medianSubjectLength: Math.round(median(subjectLengths)),
    averageWordCount:
      Math.round((subjectWords.reduce((s, v) => s + v, 0) / totalCount) * 10) /
      10,
    medianWordCount: Math.round(median(subjectWords) * 10) / 10,
    hasBodyPercentage: Math.round((hasBodyCount / totalCount) * 100),
    emojiPercentage: Math.round((emojiCount / totalCount) * 100),
    uppercasePercentage: Math.round((uppercaseCount / totalCount) * 100),
    averageBodyLength: Math.round(
      bodyLengths.reduce((s, v) => s + v, 0) / totalCount,
    ),
    subjectLengthStddev: Math.round(stddev(subjectLengths) * 10) / 10,
    commitTypes: types,
    dominantType,
    conventionalCommitPercentage: Math.round(
      (conventionalCount / totalCount) * 100,
    ),
    wipPercentage: Math.round((wipCount / totalCount) * 100),
  };
}

/**
 * Analyze the cadence / velocity of commits over time.
 * @param {Date[]} dates  Sorted (newest first is fine) array of commit dates.
 * @returns {object}
 */
function analyzeCadence(dates) {
  if (dates.length < 2) {
    return {
      totalCommits: dates.length,
      firstCommitDate: dates[0] ?? null,
      lastCommitDate: dates[0] ?? null,
      activeDays: dates.length,
      streakDays: 1,
      commitsPerDay: 0,
      commitsPerWeek: 0,
      burstyScore: 0,
      averageGapHours: 0,
      medianGapHours: 0,
    };
  }

  // Sort ascending
  const sorted = [...dates].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Unique active days
  const daySet = new Set(sorted.map((d) => d.toISOString().slice(0, 10)));
  const activeDays = daySet.size;

  // Span in days
  const spanMs = last - first;
  const spanDays = spanMs / (1000 * 60 * 60 * 24) || 1;

  // Commit velocity
  const commitsPerDay = Math.round((dates.length / spanDays) * 10) / 10;
  const commitsPerWeek = Math.round(commitsPerDay * 7 * 10) / 10;

  // Gap between consecutive commits (hours)
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60));
  }
  const averageGapHours =
    Math.round((gaps.reduce((s, v) => s + v, 0) / gaps.length) * 10) / 10;
  const medianGapHours = Math.round(median(gaps) * 10) / 10;

  // Streak: longest consecutive calendar days with at least one commit
  const dayArray = [...daySet].sort();
  let maxStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < dayArray.length; i++) {
    const prev = new Date(dayArray[i - 1]);
    const curr = new Date(dayArray[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Bursty score: stddev of daily commit counts (0 = perfectly regular)
  const dailyCounts = {};
  for (const d of sorted) {
    const key = d.toISOString().slice(0, 10);
    dailyCounts[key] = (dailyCounts[key] || 0) + 1;
  }
  const countValues = Object.values(dailyCounts);
  const burstyScore = Math.round(stddev(countValues) * 100) / 100;

  return {
    totalCommits: dates.length,
    firstCommitDate: first,
    lastCommitDate: last,
    activeDays,
    streakDays: maxStreak,
    commitsPerDay,
    commitsPerWeek,
    burstyScore,
    averageGapHours,
    medianGapHours,
  };
}

/**
 * Analyze commit size signals from an array of commit detail objects
 * (each must include a `.stats` field – requires the single-commit GitHub endpoint).
 * Safe to call with an empty array.
 *
 * @param {object[]} commitDetails  Objects with shape { sha, stats: { additions, deletions, total } }
 * @returns {object}
 */
function analyzeCommitSizes(commitDetails) {
  if (commitDetails.length === 0) {
    return {
      sampledCount: 0,
      averageAdditions: 0,
      averageDeletions: 0,
      averageChangedLines: 0,
      medianChangedLines: 0,
      largeCommitPercentage: 0,
      microCommitPercentage: 0,
      sizeProfile: "unknown",
    };
  }

  const additions = commitDetails.map((c) => c?.stats?.additions ?? 0);
  const deletions = commitDetails.map((c) => c?.stats?.deletions ?? 0);
  const totals = commitDetails.map((c) => c?.stats?.total ?? 0);

  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const total = commitDetails.length;

  const avgAdditions = Math.round(avg(additions));
  const avgDeletions = Math.round(avg(deletions));
  const avgChangedLines = Math.round(avg(totals));
  const medChangedLines = Math.round(median(totals));

  // Large commit: >300 lines changed
  const largeCount = totals.filter((t) => t > 300).length;
  // Micro commit: ≤5 lines changed
  const microCount = totals.filter((t) => t <= 5).length;

  const largeCommitPercentage = Math.round((largeCount / total) * 100);
  const microCommitPercentage = Math.round((microCount / total) * 100);

  // Derive a simple size profile label
  let sizeProfile;
  if (largeCommitPercentage >= 40) {
    sizeProfile = "massive"; // huge blobs of work
  } else if (largeCommitPercentage >= 20) {
    sizeProfile = "large";
  } else if (microCommitPercentage >= 50) {
    sizeProfile = "micro"; // tiny, focused commits
  } else if (avgChangedLines <= 30) {
    sizeProfile = "small";
  } else {
    sizeProfile = "moderate";
  }

  return {
    sampledCount: total,
    averageAdditions: avgAdditions,
    averageDeletions: avgDeletions,
    averageChangedLines: avgChangedLines,
    medianChangedLines: medChangedLines,
    largeCommitPercentage,
    microCommitPercentage,
    sizeProfile,
  };
}

// ── Main export function ───────────────────────────────────────────────────────

/**
 * Run the full commit analysis pipeline on an array of raw GitHub commit objects.
 *
 * @param {object[]} commits      Raw GitHub REST API commit objects
 * @param {object[]} [commitDetails=[]]
 * @returns {{
 *   totalCommits: number,
 *   timings: object,
 *   messages: object,
 *   cadence: object,
 *   sizes: object,
 * }}
 */
function analyzeCommits(commits, commitDetails = []) {
  if (!Array.isArray(commits)) {
    throw new TypeError("analyzeCommits: `commits` must be an array");
  }

  // Extract valid dates once
  const dates = commits.map(extractDate).filter(Boolean);

  const timings = analyzeTimings(dates);
  const messages = analyzeMessages(commits);
  const cadence = analyzeCadence(dates);
  const sizes = analyzeCommitSizes(commitDetails);

  return {
    totalCommits: commits.length,
    timings,
    messages,
    cadence,
    sizes,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  analyzeCommits,
  // sub-analyzers for unit testing
  // analyzeTimings,
  // analyzeMessages,
  // analyzeCadence,
  // analyzeCommitSizes,
  // Expose helpers
  classifyType,
  extractSubject,
  extractDate,
  hourToBucket,
  TIME_BUCKETS,
  COMMIT_TYPE_PATTERNS,
};
