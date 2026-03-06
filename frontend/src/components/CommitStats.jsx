import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  BarController,
} from "chart.js";
import {
  Clock,
  GitCommit,
  Flame,
  TrendingUp,
  Calendar,
  MessageSquare,
  Zap,
} from "lucide-react";

// Register Chart.js components
Chart.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  BarController,
);

export default function CommitStats({ commitStats }) {
  const hourChartRef = useRef(null);
  const dowChartRef = useRef(null);
  const hourChart = useRef(null);
  const dowChart = useRef(null);

  const { totalCommits, cadence, timings, messages, sizes } = commitStats || {};

  // ── Build charts ────────────────────────────────────────────────────────────

  // Shared Chart.js style helpers
  function getCSSVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  // Hourly chart (0–23)
  useEffect(() => {
    if (!hourChartRef.current || !timings?.hourHistogram) return;

    const accent = getCSSVar("--color-accent") || "#7c3aed";
    const accent2 = getCSSVar("--color-accent2") || "#a78bfa";
    const border = getCSSVar("--color-border") || "rgba(255,255,255,0.1)";
    const muted = getCSSVar("--color-text-muted") || "rgba(255,255,255,0.5)";

    // const ctx = hourChartRef.current.getContext("2d");
    const canvas = hourChartRef.current;

    // Destroy any chart already attached to this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext("2d");

    const labels = Array.from({ length: 24 }, (_, i) => {
      if (i === 0) return "12am";
      if (i === 12) return "12pm";
      if (i < 12) return `${i}am`;
      return `${i - 12}pm`;
    });

    const data = timings.hourHistogram || new Array(24).fill(0);

    // Color bars by time-of-day zone
    const barColors = data.map((_, i) => {
      if (i >= 0 && i <= 4) return "rgba(139, 92, 246, 0.85)"; // late night – purple
      if (i >= 5 && i <= 8) return "rgba(251, 191, 36, 0.85)"; // early morning – gold
      if (i >= 9 && i <= 11) return "rgba(34, 197, 94, 0.85)"; // morning – green
      if (i >= 12 && i <= 16) return "rgba(59, 130, 246, 0.85)"; // afternoon – blue
      if (i >= 17 && i <= 20) return "rgba(249, 115, 22, 0.85)"; // evening – orange
      return "rgba(168, 85, 247, 0.85)"; // night – violet
    });

    if (hourChart.current) {
      hourChart.current.data.datasets[0].data = data;
      hourChart.current.data.datasets[0].backgroundColor = barColors;
      hourChart.current.update("active");
      return;
    }

    hourChart.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Commits",
            data,
            backgroundColor: barColors,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: "easeInOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 10, 30, 0.95)",
            titleColor: "#fff",
            bodyColor: accent2,
            borderColor: accent,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.raw} commit${c.raw !== 1 ? "s" : ""}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: border, lineWidth: 0.5 },
            ticks: {
              color: muted,
              font: { size: 10 },
              maxRotation: 0,
              // Only show every other label to avoid crowding
              callback: (_, i) => (i % 2 === 0 ? labels[i] : ""),
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: border, lineWidth: 0.5 },
            ticks: { color: muted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    });

    return () => {
      if (hourChart.current) {
        hourChart.current.destroy();
        hourChart.current = null;
      }
    };
  }, [timings?.hourHistogram]);

  // Day-of-week chart
  useEffect(() => {
    if (!dowChartRef.current || !timings?.dayOfWeekHistogram) return;

    const accent = getCSSVar("--color-accent") || "#7c3aed";
    const accent2 = getCSSVar("--color-accent2") || "#a78bfa";
    const border = getCSSVar("--color-border") || "rgba(255,255,255,0.1)";
    const muted = getCSSVar("--color-text-muted") || "rgba(255,255,255,0.5)";

    const canvas = dowChartRef.current;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext("2d");
    const { counts = [], labels: dowLabels = [] } = timings.dayOfWeekHistogram;

    // Weekend days get a different hue
    const barColors = (dowLabels || []).map(
      (d) =>
        d === "Saturday" || d === "Sunday"
          ? "rgba(236, 72, 153, 0.85)" // weekend – pink
          : "rgba(99, 102, 241, 0.85)", // weekday – indigo
    );

    if (dowChart.current) {
      dowChart.current.data.datasets[0].data = counts;
      dowChart.current.update("active");
      return;
    }

    dowChart.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: (dowLabels || []).map((d) => d.slice(0, 3)), // "Mon", "Tue"…
        datasets: [
          {
            label: "Commits",
            data: counts,
            backgroundColor: barColors,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: "easeInOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 10, 30, 0.95)",
            titleColor: "#fff",
            bodyColor: accent2,
            borderColor: accent,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.raw} commit${c.raw !== 1 ? "s" : ""}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: border, lineWidth: 0.5 },
            ticks: { color: muted, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: border, lineWidth: 0.5 },
            ticks: { color: muted, font: { size: 10 }, precision: 0 },
          },
        },
      },
    });

    return () => {
      if (dowChart.current) {
        dowChart.current.destroy();
        dowChart.current = null;
      }
    };
  }, [timings?.dayOfWeekHistogram]);

  // ── Early return after all hooks ─────────────────────────────────────────
  if (!commitStats) return null;

  // ── Derived display values ──────────────────────────────────────────────────

  const peakHourStr = (() => {
    const h = timings?.peakHour;
    if (h === null || h === undefined) return "—";
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    if (h < 12) return `${h}am`;
    return `${h - 12}pm`;
  })();

  const dominantBucket = (() => {
    const buckets = timings?.timeBuckets || {};
    const pcts = timings?.timeBucketPercentages || {};
    const labels = {
      earlyMorning: "Early Morning 🌅",
      morning: "Morning ☀️",
      afternoon: "Afternoon 🌤️",
      evening: "Evening 🌆",
      night: "Night 🌙",
      lateNight: "Late Night 🌑",
    };
    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    if (!top) return "—";
    return `${labels[top[0]] || top[0]} (${pcts[top[0]] || 0}%)`;
  })();

  // Commit type breakdown (sorted by count)
  const commitTypeEntries = Object.entries(messages?.commitTypes || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const totalTyped = commitTypeEntries.reduce((s, [, c]) => s + c, 0);

  const TYPE_COLORS = {
    feat: "#22c55e",
    fix: "#ef4444",
    chore: "#6b7280",
    refactor: "#a78bfa",
    docs: "#60a5fa",
    style: "#f472b6",
    test: "#34d399",
    perf: "#fb923c",
    ci: "#38bdf8",
    build: "#fbbf24",
    revert: "#f87171",
    wip: "#d97706",
    merge: "#94a3b8",
    init: "#4ade80",
    other: "#64748b",
  };

  // Metric cards
  const metricCards = [
    {
      icon: <GitCommit size={18} />,
      label: "Total Commits",
      value: (totalCommits || 0).toLocaleString(),
      sub: `across ${cadence?.activeDays || 0} active days`,
      color: "metric-purple",
    },
    {
      icon: <Flame size={18} />,
      label: "Longest Streak",
      value: `${cadence?.streakDays || 0}d`,
      sub: "consecutive days",
      color: "metric-orange",
    },
    {
      icon: <TrendingUp size={18} />,
      label: "Weekly Velocity",
      value: `${cadence?.commitsPerWeek || 0}`,
      sub: "commits per week",
      color: "metric-green",
    },
    {
      icon: <Clock size={18} />,
      label: "Peak Hour",
      value: peakHourStr,
      sub: dominantBucket,
      color: "metric-blue",
    },
    {
      icon: <Calendar size={18} />,
      label: "Weekend Commits",
      value: `${timings?.weekendPercentage || 0}%`,
      sub: `peak day: ${timings?.peakDayOfWeek || "—"}`,
      color: "metric-pink",
    },
    {
      icon: <MessageSquare size={18} />,
      label: "Avg Message",
      value: `${messages?.averageSubjectLength || 0} chars`,
      sub: `${messages?.conventionalCommitPercentage || 0}% conventional`,
      color: "metric-teal",
    },
    ...(sizes?.sampledCount > 0
      ? [
          {
            icon: <Zap size={18} />,
            label: "Avg Commit Size",
            value: `${sizes.averageChangedLines} lines`,
            sub: sizes.sizeProfile
              ? `${sizes.sizeProfile} commits`
              : `${sizes.microCommitPercentage}% micro`,
            color: "metric-yellow",
          },
        ]
      : []),
  ];

  // ── Animation variants ──────────────────────────────────────────────────────

  const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" },
    },
  };

  const staggerList = {
    visible: {
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemFade = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="commit-stats"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Section heading ── */}
      <h3 className="cs-section-title">
        <GitCommit size={18} />
        Commit Analysis
      </h3>

      {/* ── Metric cards grid ── */}
      <motion.div
        className="cs-metrics-grid"
        variants={staggerList}
        initial="hidden"
        animate="visible"
      >
        {metricCards.map((card) => (
          <motion.div
            key={card.label}
            className={`cs-metric-card ${card.color}`}
            variants={itemFade}
          >
            <span className="cs-metric-icon">{card.icon}</span>
            <div className="cs-metric-body">
              <span className="cs-metric-value">{card.value}</span>
              <span className="cs-metric-label">{card.label}</span>
              {card.sub && <span className="cs-metric-sub">{card.sub}</span>}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Charts row ── */}
      <div className="cs-charts-row">
        {/* Hourly activity */}
        <div className="cs-chart-card">
          <h4 className="cs-chart-title">
            <Clock size={14} />
            Commits by Hour
          </h4>
          <div className="cs-chart-canvas-wrap">
            <canvas ref={hourChartRef} aria-label="Commits by hour of day" />
          </div>
          {/* Time zone note */}
          <p className="cs-chart-note">Times reflect commit author timezone</p>
        </div>

        {/* Day-of-week */}
        <div className="cs-chart-card">
          <h4 className="cs-chart-title">
            <Calendar size={14} />
            Commits by Day
          </h4>
          <div className="cs-chart-canvas-wrap">
            <canvas ref={dowChartRef} aria-label="Commits by day of week" />
          </div>
          <div className="cs-dow-legend">
            <span className="cs-dow-legend-item weekday">■ Weekday</span>
            <span className="cs-dow-legend-item weekend">■ Weekend</span>
          </div>
        </div>
      </div>

      {/* ── Commit type breakdown ── */}
      {commitTypeEntries.length > 0 && (
        <div className="cs-types-card">
          <h4 className="cs-chart-title">
            <GitCommit size={14} />
            Commit Types
          </h4>

          <ul className="cs-types-list">
            {commitTypeEntries.map(([type, count], i) => {
              const pct =
                totalTyped > 0 ? Math.round((count / totalTyped) * 100) : 0;
              const color = TYPE_COLORS[type] || TYPE_COLORS.other;
              return (
                <motion.li
                  key={type}
                  className="cs-type-row"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <span
                    className="cs-type-dot"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="cs-type-name">{type}</span>
                  <div className="cs-type-bar-track">
                    <motion.div
                      className="cs-type-bar-fill"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.7,
                        ease: "easeOut",
                        delay: 0.1 + i * 0.04,
                      }}
                    />
                  </div>
                  <span className="cs-type-count">{count}</span>
                  <span className="cs-type-pct">{pct}%</span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Message style flags ── */}
      <div className="cs-message-flags">
        {[
          {
            label: "Conventional",
            value: `${messages?.conventionalCommitPercentage ?? 0}%`,
            tip: "Follow the conventional-commits spec",
            high: (messages?.conventionalCommitPercentage ?? 0) >= 50,
          },
          {
            label: "Have a body",
            value: `${messages?.hasBodyPercentage ?? 0}%`,
            tip: "Include a multi-line description",
            high: (messages?.hasBodyPercentage ?? 0) >= 30,
          },
          {
            label: "Use emojis",
            value: `${messages?.emojiPercentage ?? 0}%`,
            tip: "Contain at least one emoji",
            high: (messages?.emojiPercentage ?? 0) >= 15,
          },
          {
            label: "WIP commits",
            value: `${messages?.wipPercentage ?? 0}%`,
            tip: "Marked as work-in-progress",
            high: false,
          },
        ].map(({ label, value, tip, high }) => (
          <div
            key={label}
            className={`cs-flag-pill ${high ? "flag-high" : "flag-low"}`}
            title={tip}
          >
            <span className="cs-flag-value">{value}</span>
            <span className="cs-flag-label">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
