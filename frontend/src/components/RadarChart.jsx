import { useEffect, useRef } from "react";
import {
  Chart,
  RadialLinearScale,
  RadarController,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { motion } from "framer-motion";

// Register the Chart.js components we need for a radar chart
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

export default function RadarChart({
  radarScores,
  label = "Developer",
  animate = true,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // ── Axis config ─────────────────────────────────────────────────────────────
  const AXES = [
    { key: "consistency", label: "Consistency 📐" },
    { key: "productivity", label: "Productivity ⚡" },
    { key: "codeQuality", label: "Code Quality 🔬" },
    { key: "creativity", label: "Creativity 🎨" },
    { key: "collaboration", label: "Collaboration 🤝" },
    { key: "nightOwl", label: "Night Owl 🦉" },
  ];

  // ── Build / update chart ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !radarScores) return;

    const canvas = canvasRef.current;
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = canvas.getContext("2d");

    // Read CSS custom properties so colours are theme-aware
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue("--color-accent").trim() || "#7c3aed";
    const accent2 =
      style.getPropertyValue("--color-accent2").trim() || "#a78bfa";
    const gridCol =
      style.getPropertyValue("--color-border").trim() ||
      "rgba(255,255,255,0.12)";
    const textCol =
      style.getPropertyValue("--color-text-muted").trim() ||
      "rgba(255,255,255,0.55)";

    const data = AXES.map(({ key }) => radarScores[key] ?? 0);

    // Build gradient fill (centre → edge)
    const gradient = ctx.createRadialGradient(
      canvasRef.current.width / 2,
      canvasRef.current.height / 2,
      0,
      canvasRef.current.width / 2,
      canvasRef.current.height / 2,
      canvasRef.current.width / 2,
    );
    gradient.addColorStop(0, hexToRgba(accent, 0.35));
    gradient.addColorStop(0.7, hexToRgba(accent, 0.18));
    gradient.addColorStop(1, hexToRgba(accent, 0.05));

    const chartConfig = {
      type: "radar",
      data: {
        labels: AXES.map(({ label: l }) => l),
        datasets: [
          {
            label,
            data,
            backgroundColor: gradient,
            borderColor: accent2,
            borderWidth: 2.5,
            pointBackgroundColor: accent,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: accent,
            pointHoverBorderWidth: 2,
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: animate
          ? { duration: 900, easing: "easeInOutQuart" }
          : false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 10, 30, 0.92)",
            titleColor: "#fff",
            bodyColor: accent2,
            borderColor: accent,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}/100`,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            beginAtZero: true,
            ticks: {
              stepSize: 20,
              color: textCol,
              backdropColor: "transparent",
              font: { size: 10, family: "inherit" },
              callback: (v) => (v === 0 ? "" : v), // hide "0" label
            },
            grid: {
              color: gridCol,
              lineWidth: 1,
              circular: false,
            },
            angleLines: {
              color: gridCol,
              lineWidth: 1,
            },
            pointLabels: {
              color: textCol,
              font: { size: 12, family: "inherit", weight: "500" },
              padding: 8,
            },
          },
        },
      },
    };

    // If a chart already exists on this canvas, update it instead of re-creating
    if (chartRef.current) {
      const chart = chartRef.current;
      chart.data.datasets[0].data = data;
      // Re-apply gradient in case canvas was resized
      chart.data.datasets[0].backgroundColor = gradient;
      chart.update("active");
    } else {
      chartRef.current = new Chart(ctx, chartConfig);
    }

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarScores, label]);

  // ── Score legend ─────────────────────────────────────────────────────────────

  const sortedAxes = [...AXES]
    .map(({ key, label: l }) => ({
      key,
      label: l,
      score: radarScores?.[key] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  const topAxis = sortedAxes[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="radar-chart-card"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
    >
      <h3 className="radar-title">Personality Radar</h3>

      {topAxis && (
        <p className="radar-subtitle">
          Strongest trait: <strong>{topAxis.label}</strong> — {topAxis.score}
          /100
        </p>
      )}

      {/* Chart canvas */}
      <div className="radar-canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label="Developer personality radar chart"
          role="img"
        />
      </div>

      {/* Score legend below the chart */}
      <div className="radar-legend">
        {AXES.map(({ key, label: axisLabel }) => {
          const score = radarScores?.[key] ?? 0;
          const pct = score; // already 0-100
          const tier = score >= 75 ? "high" : score >= 40 ? "mid" : "low";
          return (
            <div key={key} className={`radar-legend-item tier-${tier}`}>
              <div className="rli-header">
                <span className="rli-label">{axisLabel}</span>
                <span className="rli-score">{score}</span>
              </div>
              <div className="rli-bar-track">
                <motion.div
                  className="rli-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Convert a 3 or 6-digit hex colour to rgba(…).
 * Falls back gracefully if the input isn't a valid hex string.
 * @param {string} hex   e.g. "#7c3aed" or "#abc"
 * @param {number} alpha 0–1
 * @returns {string}
 */
function hexToRgba(hex, alpha = 1) {
  const clean = (hex || "").replace(/^#/, "");
  let r, g, b;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    // Not a valid hex — return a transparent fallback
    return `rgba(124, 58, 237, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
