const rateLimit = require('express-rate-limit');

// ── Global limiter — all routes (60 req / min) ──────────────────
const globalLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests, please try again later' },
});

// ── Auth limiter — login/register (10 req / min) ────────────────
const authLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many authentication attempts, please try again in a minute' },
});

// ── Apply limiter — job applications (5 per hour) ───────────────
const applyLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Application limit reached, please try again later' },
});

module.exports = { globalLimiter, authLimiter, applyLimiter };
