import { motion } from "framer-motion";
import { useMemo } from "react";
import { Calendar } from "lucide-react";

export default function CommitHeatmap({
  weeklyActivity = [],
  title = "Commit Activity",
}) {
  // ── Build the full 52-week grid ──────────────────────────────────────────────

  const { weeks, maxCount, totalCommits, monthLabels } = useMemo(() => {
    if (!weeklyActivity || weeklyActivity.length === 0) {
      return { weeks: [], maxCount: 0, totalCommits: 0, monthLabels: [] };
    }

    // Use at most the last 52 weeks
    const sliced = weeklyActivity.slice(-52);

    let maxCount = 0;
    let totalCommits = 0;

    // Build a grid: array of weeks, each week = array of 7 day objects
    const weeks = sliced.map((week) => {
      const days = (week.days || [0, 0, 0, 0, 0, 0, 0]).map(
        (count, dayIndex) => {
          if (count > maxCount) maxCount = count;
          totalCommits += count;

          // Compute the actual calendar date for this cell
          const weekDate = new Date(week.weekStart + "T00:00:00Z");
          weekDate.setUTCDate(weekDate.getUTCDate() + dayIndex);

          return {
            count,
            date: weekDate.toISOString().slice(0, 10),
            dayIndex,
          };
        },
      );

      return { weekStart: week.weekStart, days };
    });

    // ── Month label positions ──────────────────────────────────────────────────
    // Walk through weeks and record the column index where each new month starts
    const monthLabels = [];
    let lastMonth = -1;

    weeks.forEach((week, colIndex) => {
      const d = new Date(week.weekStart + "T00:00:00Z");
      const month = d.getUTCMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          label: d.toLocaleString("default", { month: "short" }),
          colIndex,
        });
        lastMonth = month;
      }
    });

    return { weeks, maxCount, totalCommits, monthLabels };
  }, [weeklyActivity]);

  // ── Colour intensity helper ──────────────────────────────────────────────────

  /**
   * Map a commit count to one of 5 intensity levels (0–4).
   * Level 0 = empty/no commits, 4 = most active.
   */
  function getLevel(count) {
    if (!count || count === 0) return 0;
    if (maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.7) return 3;
    return 4;
  }

  // ── Tooltip text ─────────────────────────────────────────────────────────────

  function formatTooltip(day) {
    if (!day.date) return "";
    const d = new Date(day.date + "T00:00:00Z");
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    if (day.count === 0) return `No commits on ${formatted}`;
    return `${day.count} commit${day.count !== 1 ? "s" : ""} on ${formatted}`;
  }

  // ── Day-of-week labels (left axis) ───────────────────────────────────────────
  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Only show Mon / Wed / Fri to avoid crowding
  const SHOW_DOW = new Set([1, 3, 5]);

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (weeks.length === 0) {
    return (
      <div className="heatmap-card">
        <h3 className="heatmap-title">
          <Calendar size={16} />
          {title}
        </h3>
        <p className="heatmap-empty">
          No activity data available for this user.
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="heatmap-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
    >
      {/* ── Header ── */}
      <div className="heatmap-header">
        <h3 className="heatmap-title">
          <Calendar size={16} />
          {title}
        </h3>
        <span className="heatmap-total">
          {totalCommits.toLocaleString()} commits in the past year
        </span>
      </div>

      {/* ── Grid wrapper (enables horizontal scroll on small screens) ── */}
      <div
        className="heatmap-scroll-area"
        role="img"
        aria-label={`Commit activity heatmap: ${totalCommits} commits in the past year`}
      >
        <div className="heatmap-inner">
          {/* Month labels row */}
          <div className="heatmap-month-row">
            {/* Spacer for the day-of-week column */}
            <div className="heatmap-dow-spacer" />

            <div className="heatmap-month-labels">
              {monthLabels.map(({ label, colIndex }) => (
                <span
                  key={`${label}-${colIndex}`}
                  className="heatmap-month-label"
                  style={{ gridColumnStart: colIndex + 1 }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Main grid (day-of-week labels + cells) */}
          <div className="heatmap-body">
            {/* Day-of-week labels (left column) */}
            <div className="heatmap-dow-labels" aria-hidden="true">
              {DOW_LABELS.map((d, i) => (
                <span key={d} className="heatmap-dow-label">
                  {SHOW_DOW.has(i) ? d : ""}
                </span>
              ))}
            </div>

            {/* Week columns */}
            <div className="heatmap-grid">
              {weeks.map((week, weekIdx) => (
                <div key={week.weekStart} className="heatmap-week-col">
                  {week.days.map((day) => {
                    const level = getLevel(day.count);
                    const tooltip = formatTooltip(day);

                    return (
                      <motion.div
                        key={day.date}
                        className={`heatmap-cell level-${level}`}
                        title={tooltip}
                        aria-label={tooltip}
                        role="gridcell"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.25,
                          ease: "easeOut",
                          // Stagger: later weeks animate in later
                          delay: weekIdx * 0.012,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="heatmap-legend" aria-hidden="true">
        <span className="legend-label">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`heatmap-cell level-${level} legend-cell`}
            title={
              level === 0
                ? "No commits"
                : level === 1
                  ? "1–15% of max"
                  : level === 2
                    ? "16–40% of max"
                    : level === 3
                      ? "41–70% of max"
                      : "71–100% of max"
            }
          />
        ))}
        <span className="legend-label">More</span>
      </div>
    </motion.div>
  );
}
