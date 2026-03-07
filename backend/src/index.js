require("dotenv").config();
const express = require("express");
const cors = require("cors");

const analyzerRouter = require("./routes/analyzer");

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "https://what-is-my-developer-personality.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.options("/*path", cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/analyzer", analyzerRouter);

// Health-check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  Dev Personality Analyzer API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(
    `   OpenRouter: ${process.env.OPENROUTER_API_KEY ? "✅ enabled" : "⚠️  disabled (no OPENROUTER_API_KEY)"}`,
  );
  console.log(
    `   GitHub: ${process.env.GITHUB_TOKEN ? "✅ authenticated" : "⚠️  unauthenticated (rate-limited to 60 req/hr)"}`,
  );
});
