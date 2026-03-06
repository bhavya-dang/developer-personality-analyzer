/**
 * languageAnalyzer.js
 *
 * Processes raw GitHub language byte-count maps (e.g. { "JavaScript": 48210, "CSS": 3200 })
 * into enriched insights used by the personality engine:
 *   - Percentage breakdown
 *   - Primary / secondary language
 *   - Language category tags  (systems, scripting, functional, web, data, etc.)
 *   - Polyglot score
 *   - Stack archetype         (e.g. "Full-Stack Web", "ML / Data Science", "Systems")
 *   - Fun language personality traits
 */

"use strict";

// ── Language Metadata ─────────────────────────────────────────────────────────

/**
 * Rich metadata for well-known languages.
 * Keys are lowercase so lookups are case-insensitive.
 */
const LANGUAGE_META = {
  // ── Web / Frontend ──────────────────────────────────────────────────────
  javascript: {
    display: "JavaScript",
    category: "web",
    paradigms: ["scripting", "oop", "functional"],
    vibe: "the language everyone loves to hate (but uses anyway)",
    tier: "mainstream",
  },
  typescript: {
    display: "TypeScript",
    category: "web",
    paradigms: ["scripting", "oop", "typed"],
    vibe: "JavaScript but grown-up",
    tier: "mainstream",
  },
  html: {
    display: "HTML",
    category: "markup",
    paradigms: ["markup"],
    vibe: "not a real programming language (but we respect it)",
    tier: "mainstream",
  },
  css: {
    display: "CSS",
    category: "styling",
    paradigms: ["declarative"],
    vibe: "deceptively simple, endlessly frustrating",
    tier: "mainstream",
  },
  scss: {
    display: "SCSS",
    category: "styling",
    paradigms: ["declarative"],
    vibe: "CSS with superpowers",
    tier: "mainstream",
  },
  sass: {
    display: "Sass",
    category: "styling",
    paradigms: ["declarative"],
    vibe: "CSS with opinions",
    tier: "mainstream",
  },
  vue: {
    display: "Vue",
    category: "web",
    paradigms: ["scripting", "oop"],
    vibe: "the friendly framework",
    tier: "mainstream",
  },
  svelte: {
    display: "Svelte",
    category: "web",
    paradigms: ["scripting", "declarative"],
    vibe: "the cool kid at the framework party",
    tier: "emerging",
  },

  // ── Backend / General Purpose ────────────────────────────────────────────
  python: {
    display: "Python",
    category: "scripting",
    paradigms: ["scripting", "oop", "functional"],
    vibe: "readable, elegant, and secretly running everything",
    tier: "mainstream",
  },
  ruby: {
    display: "Ruby",
    category: "scripting",
    paradigms: ["oop", "scripting"],
    vibe: "optimized for developer happiness",
    tier: "mainstream",
  },
  php: {
    display: "PHP",
    category: "web",
    paradigms: ["scripting", "oop"],
    vibe: "the language that powers the internet despite itself",
    tier: "mainstream",
  },
  go: {
    display: "Go",
    category: "systems",
    paradigms: ["compiled", "concurrent"],
    vibe: "fast, opinionated, and allergic to generics (until recently)",
    tier: "mainstream",
  },
  rust: {
    display: "Rust",
    category: "systems",
    paradigms: ["systems", "functional", "typed"],
    vibe: "memory safe or the borrow checker will haunt your dreams",
    tier: "emerging",
  },
  java: {
    display: "Java",
    category: "oop",
    paradigms: ["oop", "compiled", "typed"],
    vibe: "enterprise-grade verbosity with enterprise-grade reliability",
    tier: "mainstream",
  },
  kotlin: {
    display: "Kotlin",
    category: "oop",
    paradigms: ["oop", "functional", "typed"],
    vibe: "Java but you actually enjoy writing it",
    tier: "mainstream",
  },
  swift: {
    display: "Swift",
    category: "systems",
    paradigms: ["oop", "functional", "typed"],
    vibe: "Apple's gift to the safety-conscious",
    tier: "mainstream",
  },
  "objective-c": {
    display: "Objective-C",
    category: "systems",
    paradigms: ["oop", "compiled"],
    vibe: "pre-Swift Apple dev — you've seen things",
    tier: "legacy",
  },
  "c#": {
    display: "C#",
    category: "oop",
    paradigms: ["oop", "functional", "typed"],
    vibe: "Java's cooler, Microsoft-flavored cousin",
    tier: "mainstream",
  },
  "c++": {
    display: "C++",
    category: "systems",
    paradigms: ["systems", "oop", "compiled"],
    vibe: "all the power, all the footguns",
    tier: "mainstream",
  },
  c: {
    display: "C",
    category: "systems",
    paradigms: ["systems", "compiled", "procedural"],
    vibe: "the foundation everything else is built on",
    tier: "mainstream",
  },

  // ── Functional ───────────────────────────────────────────────────────────
  haskell: {
    display: "Haskell",
    category: "functional",
    paradigms: ["functional", "typed", "lazy"],
    vibe: "you've read SICP at least twice",
    tier: "esoteric",
  },
  elm: {
    display: "Elm",
    category: "functional",
    paradigms: ["functional", "typed", "web"],
    vibe: "zero runtime errors is not a dream, it's a constraint",
    tier: "esoteric",
  },
  clojure: {
    display: "Clojure",
    category: "functional",
    paradigms: ["functional", "lisp", "dynamic"],
    vibe: "parentheses are a lifestyle choice",
    tier: "esoteric",
  },
  erlang: {
    display: "Erlang",
    category: "functional",
    paradigms: ["functional", "concurrent", "distributed"],
    vibe: "let it crash (on purpose)",
    tier: "esoteric",
  },
  elixir: {
    display: "Elixir",
    category: "functional",
    paradigms: ["functional", "concurrent"],
    vibe: "Erlang for people who enjoy their work",
    tier: "emerging",
  },
  fsharp: {
    display: "F#",
    category: "functional",
    paradigms: ["functional", "typed", "oop"],
    vibe: "ML on the .NET runtime — powerful and underappreciated",
    tier: "esoteric",
  },
  scala: {
    display: "Scala",
    category: "functional",
    paradigms: ["functional", "oop", "typed"],
    vibe: "Java + Haskell had a very complex child",
    tier: "emerging",
  },
  ocaml: {
    display: "OCaml",
    category: "functional",
    paradigms: ["functional", "typed", "imperative"],
    vibe: "the secret weapon of compilers and trading systems",
    tier: "esoteric",
  },

  // ── Data / ML / Science ──────────────────────────────────────────────────
  r: {
    display: "R",
    category: "data",
    paradigms: ["statistical", "functional"],
    vibe: "statisticians' playground",
    tier: "niche",
  },
  julia: {
    display: "Julia",
    category: "data",
    paradigms: ["scientific", "functional", "compiled"],
    vibe: "Python's speed-obsessed scientist sibling",
    tier: "emerging",
  },
  matlab: {
    display: "MATLAB",
    category: "data",
    paradigms: ["scientific", "procedural"],
    vibe: "used in academia and never quite escaped",
    tier: "niche",
  },
  "jupyter notebook": {
    display: "Jupyter Notebook",
    category: "data",
    paradigms: ["scientific", "interactive"],
    vibe: "the PowerPoint of data science",
    tier: "mainstream",
  },

  // ── Systems / Low-level ──────────────────────────────────────────────────
  assembly: {
    display: "Assembly",
    category: "systems",
    paradigms: ["low-level", "procedural"],
    vibe: "you speak to machines directly",
    tier: "esoteric",
  },
  "assembly language": {
    display: "Assembly",
    category: "systems",
    paradigms: ["low-level", "procedural"],
    vibe: "you speak to machines directly",
    tier: "esoteric",
  },
  zig: {
    display: "Zig",
    category: "systems",
    paradigms: ["systems", "compiled"],
    vibe: "Rust's younger, more explicit sibling",
    tier: "emerging",
  },
  nim: {
    display: "Nim",
    category: "systems",
    paradigms: ["systems", "scripting", "compiled"],
    vibe: "Python syntax, C performance, tiny community",
    tier: "esoteric",
  },

  // ── Scripting / DevOps / Config ──────────────────────────────────────────
  shell: {
    display: "Shell",
    category: "scripting",
    paradigms: ["scripting", "procedural"],
    vibe: "glue for the Unix universe",
    tier: "mainstream",
  },
  "bash script": {
    display: "Bash",
    category: "scripting",
    paradigms: ["scripting"],
    vibe: "glue for the Unix universe",
    tier: "mainstream",
  },
  powershell: {
    display: "PowerShell",
    category: "scripting",
    paradigms: ["scripting", "oop"],
    vibe: "Windows automation that's actually usable",
    tier: "mainstream",
  },
  dockerfile: {
    display: "Dockerfile",
    category: "devops",
    paradigms: ["declarative"],
    vibe: "it works on my container",
    tier: "mainstream",
  },
  "hcl": {
    display: "HCL (Terraform)",
    category: "devops",
    paradigms: ["declarative", "infrastructure"],
    vibe: "infrastructure as code, seriously",
    tier: "emerging",
  },
  yaml: {
    display: "YAML",
    category: "devops",
    paradigms: ["declarative", "config"],
    vibe: "indentation is law",
    tier: "mainstream",
  },
  nix: {
    display: "Nix",
    category: "devops",
    paradigms: ["functional", "declarative", "config"],
    vibe: "reproducible environments or bust",
    tier: "esoteric",
  },

  // ── Mobile ───────────────────────────────────────────────────────────────
  dart: {
    display: "Dart",
    category: "mobile",
    paradigms: ["oop", "typed"],
    vibe: "Flutter's reason for existing",
    tier: "emerging",
  },

  // ── Query / Domain Specific ──────────────────────────────────────────────
  sql: {
    display: "SQL",
    category: "query",
    paradigms: ["declarative", "relational"],
    vibe: "relational algebra for the masses",
    tier: "mainstream",
  },
  graphql: {
    display: "GraphQL",
    category: "query",
    paradigms: ["declarative", "schema"],
    vibe: "REST but you specify exactly what you want",
    tier: "emerging",
  },
  prolog: {
    display: "Prolog",
    category: "logic",
    paradigms: ["logic", "declarative"],
    vibe: "unification engine, debugger not included",
    tier: "esoteric",
  },
};

// ── Stack Archetypes ──────────────────────────────────────────────────────────

/**
 * Each archetype has a scoring function and a human-readable label.
 * The top-scoring archetype wins.
 */
const STACK_ARCHETYPES = [
  {
    id: "fullstack_web",
    label: "Full-Stack Web Developer",
    emoji: "🌐",
    description: "Comfortable from the database to the DOM.",
    score(categoryScores, langKeys) {
      const webScore = (categoryScores.web || 0) + (categoryScores.markup || 0) + (categoryScores.styling || 0);
      const backScore = (categoryScores.scripting || 0) + (categoryScores.oop || 0);
      return webScore >= 20 && backScore >= 10 ? webScore + backScore : 0;
    },
  },
  {
    id: "frontend_specialist",
    label: "Frontend Specialist",
    emoji: "🎨",
    description: "Lives in the browser. Pixels and components are your domain.",
    score(categoryScores) {
      const frontend = (categoryScores.web || 0) + (categoryScores.markup || 0) + (categoryScores.styling || 0);
      return frontend >= 50 ? frontend : 0;
    },
  },
  {
    id: "backend_engineer",
    label: "Backend Engineer",
    emoji: "⚙️",
    description: "APIs, databases, and distributed systems are your playground.",
    score(categoryScores) {
      const backend = (categoryScores.scripting || 0) + (categoryScores.oop || 0) + (categoryScores.query || 0);
      const noWeb   = (categoryScores.web || 0) + (categoryScores.markup || 0) < 15;
      return noWeb && backend >= 40 ? backend : 0;
    },
  },
  {
    id: "systems_programmer",
    label: "Systems Programmer",
    emoji: "🔧",
    description: "You think in bytes and cache lines. The metal is your friend.",
    score(categoryScores) {
      return (categoryScores.systems || 0) >= 30
        ? categoryScores.systems
        : 0;
    },
  },
  {
    id: "ml_data",
    label: "ML / Data Scientist",
    emoji: "📊",
    description: "Turning data into decisions, one model at a time.",
    score(categoryScores, langKeys) {
      const dataScore = categoryScores.data || 0;
      const hasPython = langKeys.includes("python");
      const hasR      = langKeys.includes("r");
      return dataScore >= 10 || (hasPython && dataScore > 0)
        ? dataScore + (hasPython ? 20 : 0) + (hasR ? 15 : 0)
        : 0;
    },
  },
  {
    id: "functional_purist",
    label: "Functional Purist",
    emoji: "λ",
    description: "Side effects are banned. Immutability is the truth.",
    score(categoryScores) {
      return (categoryScores.functional || 0) >= 20
        ? categoryScores.functional * 1.5
        : 0;
    },
  },
  {
    id: "devops_platform",
    label: "DevOps / Platform Engineer",
    emoji: "🚀",
    description: "You build the infrastructure others take for granted.",
    score(categoryScores) {
      return (categoryScores.devops || 0) >= 15
        ? categoryScores.devops * 1.4
        : 0;
    },
  },
  {
    id: "mobile_dev",
    label: "Mobile Developer",
    emoji: "📱",
    description: "Swipe gestures and push notifications are second nature.",
    score(categoryScores, langKeys) {
      const mobileScore = categoryScores.mobile || 0;
      const hasSwift    = langKeys.includes("swift");
      const hasKotlin   = langKeys.includes("kotlin");
      const hasDart     = langKeys.includes("dart");
      return mobileScore + (hasSwift ? 30 : 0) + (hasKotlin ? 25 : 0) + (hasDart ? 25 : 0);
    },
  },
  {
    id: "polyglot_hacker",
    label: "Polyglot Hacker",
    emoji: "🌍",
    description: "No single language defines you. You pick the right tool for every job.",
    score(categoryScores, langKeys) {
      return langKeys.length >= 5 ? langKeys.length * 8 : 0;
    },
  },
  {
    id: "generalist",
    label: "Generalist Developer",
    emoji: "🛠️",
    description: "Comfortable across the stack. A little bit of everything.",
    score() {
      return 1; // always matches — lowest-priority fallback
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a language name to a consistent lowercase lookup key.
 * @param {string} name
 * @returns {string}
 */
function normalizeKey(name) {
  return name.toLowerCase().trim();
}

/**
 * Return the metadata entry for a language, or a sensible default.
 * @param {string} name
 */
function getMeta(name) {
  return (
    LANGUAGE_META[normalizeKey(name)] || {
      display: name,
      category: "other",
      paradigms: [],
      vibe: "a language of mystery",
      tier: "unknown",
    }
  );
}

/**
 * Build a category → total-bytes map from a language → bytes map.
 * @param {Record<string, number>} languageBytes
 * @returns {Record<string, number>}
 */
function buildCategoryBytes(languageBytes) {
  const categoryBytes = {};
  for (const [lang, bytes] of Object.entries(languageBytes)) {
    const { category } = getMeta(lang);
    categoryBytes[category] = (categoryBytes[category] || 0) + bytes;
  }
  return categoryBytes;
}

// ── Core Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze a raw language bytes map and return enriched insights.
 *
 * @param {Record<string, number>} languageBytes
 *   Example: { "JavaScript": 48210, "TypeScript": 29000, "CSS": 3100 }
 *
 * @returns {{
 *   totalBytes:         number,
 *   languages:          Array<{ name, bytes, percentage, meta }>,
 *   primaryLanguage:    { name, bytes, percentage, meta } | null,
 *   secondaryLanguage:  { name, bytes, percentage, meta } | null,
 *   languageCount:      number,
 *   categoryBreakdown:  Record<string, { bytes, percentage }>,
 *   stackArchetype:     { id, label, emoji, description },
 *   polyglotScore:      number,   // 0-100
 *   diversityIndex:     number,   // Shannon entropy, rounded
 *   hasMarkup:          boolean,
 *   hasStyling:         boolean,
 *   hasSystems:         boolean,
 *   hasTests:           boolean,
 *   funFact:            string,
 *   dominantParadigms:  string[],
 *   tierBreakdown:      Record<string, number>,  // tier → count
 * }}
 */
function analyzeLanguages(languageBytes) {
  // Guard: empty or non-object input
  if (
    !languageBytes ||
    typeof languageBytes !== "object" ||
    Array.isArray(languageBytes)
  ) {
    return buildEmptyResult();
  }

  const entries = Object.entries(languageBytes).filter(
    ([, bytes]) => typeof bytes === "number" && bytes > 0
  );

  if (entries.length === 0) return buildEmptyResult();

  // ── 1. Totals and sorted list ─────────────────────────────────────────────
  const totalBytes = entries.reduce((sum, [, b]) => sum + b, 0);

  const languages = entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10, // 1 decimal place
      meta: getMeta(name),
    }));

  const primaryLanguage   = languages[0] || null;
  const secondaryLanguage = languages[1] || null;
  const languageCount     = languages.length;

  // ── 2. Category breakdown ─────────────────────────────────────────────────
  const rawCategoryBytes = buildCategoryBytes(languageBytes);
  const categoryBreakdown = {};
  for (const [cat, bytes] of Object.entries(rawCategoryBytes)) {
    categoryBreakdown[cat] = {
      bytes,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10,
    };
  }

  // ── 3. Category percentage scores (plain number) for archetypes ───────────
  const categoryScores = {};
  for (const [cat, { percentage }] of Object.entries(categoryBreakdown)) {
    categoryScores[cat] = percentage;
  }

  const langKeys = languages.map((l) => normalizeKey(l.name));

  // ── 4. Stack archetype ────────────────────────────────────────────────────
  const archetypeScores = STACK_ARCHETYPES.map((a) => ({
    ...a,
    _score: a.score(categoryScores, langKeys),
  })).sort((a, b) => b._score - a._score);

  const stackArchetype = (() => {
    const winner = archetypeScores[0];
    return {
      id:          winner.id,
      label:       winner.label,
      emoji:       winner.emoji,
      description: winner.description,
    };
  })();

  // ── 5. Polyglot score (0-100) ─────────────────────────────────────────────
  // Non-linear: 1 lang = 0, 3 langs = 30, 5 langs = 60, 8+ = 100
  const polyglotScore = Math.min(
    100,
    Math.round(
      languageCount <= 1
        ? 0
        : languageCount <= 3
        ? languageCount * 10
        : languageCount <= 6
        ? 30 + (languageCount - 3) * 12
        : 66 + (languageCount - 6) * 7
    )
  );

  // ── 6. Shannon diversity index ─────────────────────────────────────────────
  // H = -∑(p * log2(p)) — higher = more diverse distribution
  const diversityIndex =
    Math.round(
      languages.reduce((h, { percentage }) => {
        const p = percentage / 100;
        return p > 0 ? h - p * Math.log2(p) : h;
      }, 0) * 100
    ) / 100;

  // ── 7. Boolean flags ─────────────────────────────────────────────────────
  const hasMarkup   = langKeys.some((k) => ["html", "xml", "markdown", "mdx"].includes(k));
  const hasStyling  = langKeys.some((k) => ["css", "scss", "sass", "less", "stylus"].includes(k));
  const hasSystems  = languages.some((l) => l.meta.category === "systems");
  // Heuristic: look for common test file patterns in the language name
  const hasTests    = langKeys.some((k) => k.includes("test") || k.includes("spec") || k === "gherkin");

  // ── 8. Dominant paradigms ─────────────────────────────────────────────────
  const paradigmCounts = {};
  for (const { meta, percentage } of languages) {
    for (const p of meta.paradigms) {
      paradigmCounts[p] = (paradigmCounts[p] || 0) + percentage;
    }
  }
  const dominantParadigms = Object.entries(paradigmCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);

  // ── 9. Tier breakdown ─────────────────────────────────────────────────────
  const tierBreakdown = {};
  for (const { meta } of languages) {
    tierBreakdown[meta.tier] = (tierBreakdown[meta.tier] || 0) + 1;
  }

  // ── 10. Fun fact ──────────────────────────────────────────────────────────
  const funFact = generateFunFact({
    primaryLanguage,
    secondaryLanguage,
    languageCount,
    stackArchetype,
    polyglotScore,
    tierBreakdown,
    dominantParadigms,
  });

  return {
    totalBytes,
    languages,
    primaryLanguage,
    secondaryLanguage,
    languageCount,
    categoryBreakdown,
    stackArchetype,
    polyglotScore,
    diversityIndex,
    hasMarkup,
    hasStyling,
    hasSystems,
    hasTests,
    funFact,
    dominantParadigms,
    tierBreakdown,
  };
}

// ── Fun Fact Generator ────────────────────────────────────────────────────────

/**
 * Generate a short, punchy fun fact about the developer's language usage.
 * @param {object} opts
 * @returns {string}
 */
function generateFunFact(opts) {
  const {
    primaryLanguage,
    secondaryLanguage,
    languageCount,
    stackArchetype,
    polyglotScore,
    tierBreakdown,
    dominantParadigms,
  } = opts;

  const esotericCount = tierBreakdown.esoteric || 0;
  const emergingCount = tierBreakdown.emerging  || 0;

  // Esoteric language fan
  if (esotericCount >= 2) {
    return `You code in ${esotericCount} esoteric languages. Most devs haven't even heard of them. 🧠`;
  }

  // Cutting-edge stack
  if (emergingCount >= 3) {
    return `${emergingCount} emerging languages in your stack — you're living on the bleeding edge. 🔪`;
  }

  // Pure functional
  if (dominantParadigms[0] === "functional" && polyglotScore < 40) {
    return `Your code has fewer side effects than a glass of water. Pure functional all the way. λ`;
  }

  // Polyglot
  if (polyglotScore >= 80) {
    return `${languageCount} languages strong. You're a linguistic shapeshifter. 🌍`;
  }

  // Primary language quirks
  if (primaryLanguage) {
    const meta = primaryLanguage.meta;
    const pct  = primaryLanguage.percentage;

    if (pct >= 90) {
      return `${pct}% ${primaryLanguage.name}. You found your language and you're sticking with it. 💍`;
    }

    if (meta.tier === "esoteric") {
      return `Your primary language is ${primaryLanguage.name} — ${meta.vibe}. Respect. 🎩`;
    }

    // JavaScript special cases
    if (normalizeKey(primaryLanguage.name) === "javascript" && secondaryLanguage) {
      if (normalizeKey(secondaryLanguage.name) === "typescript") {
        return `JavaScript first, TypeScript close behind. The migration is happening. 📈`;
      }
    }

    if (normalizeKey(primaryLanguage.name) === "rust") {
      return `The borrow checker has sculpted your mind. You think in lifetimes now. 🦀`;
    }

    if (normalizeKey(primaryLanguage.name) === "python") {
      return `Python developer confirmed. Tabs vs spaces debate status: firmly resolved. 🐍`;
    }

    if (normalizeKey(primaryLanguage.name) === "go") {
      return `You've embraced the Go way: simple, fast, and no unnecessary features. 🐹`;
    }

    if (
      ["c", "c++", "assembly"].includes(normalizeKey(primaryLanguage.name))
    ) {
      return `You manage your own memory. Fear is not in your vocabulary. 💪`;
    }

    return `${primaryLanguage.name} is ${pct}% of your code. ${meta.vibe}. 💻`;
  }

  return "Your language usage is as unique as your commit history. 🌟";
}

// ── Empty Result ──────────────────────────────────────────────────────────────

function buildEmptyResult() {
  return {
    totalBytes: 0,
    languages: [],
    primaryLanguage: null,
    secondaryLanguage: null,
    languageCount: 0,
    categoryBreakdown: {},
    stackArchetype: {
      id: "generalist",
      label: "Generalist Developer",
      emoji: "🛠️",
      description: "Comfortable across the stack.",
    },
    polyglotScore: 0,
    diversityIndex: 0,
    hasMarkup: false,
    hasStyling: false,
    hasSystems: false,
    hasTests: false,
    funFact: "No language data available yet.",
    dominantParadigms: [],
    tierBreakdown: {},
  };
}

// ── Aggregation helper ─────────────────────────────────────────────────────────

/**
 * Merge multiple language-byte maps (e.g. one per repo) into a single map,
 * summing bytes across repos so the analysis reflects the user's overall usage.
 *
 * @param {Array<Record<string, number>>} languageMaps
 * @returns {Record<string, number>}
 */
function mergeLanguageMaps(languageMaps) {
  const merged = {};
  for (const map of languageMaps) {
    if (!map || typeof map !== "object") continue;
    for (const [lang, bytes] of Object.entries(map)) {
      if (typeof bytes === "number" && bytes > 0) {
        merged[lang] = (merged[lang] || 0) + bytes;
      }
    }
  }
  return merged;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  analyzeLanguages,
  mergeLanguageMaps,
  getMeta,
  normalizeKey,
  buildCategoryBytes,
  // Expose constants for tests / external use
  LANGUAGE_META,
  STACK_ARCHETYPES,
};
