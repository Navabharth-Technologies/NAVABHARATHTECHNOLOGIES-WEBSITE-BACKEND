const express = require('express');
const router  = express.Router();

const { prisma }        = require('../lib/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashPassword, comparePassword } = require('../lib/auth');
const { sendWelcomeEmail }    = require('../lib/email');
const { validate, registerSchema, loginSchema, refreshSchema } = require('../middleware/validate');
const { authLimiter }   = require('../middleware/rateLimit');

// ── POST /api/auth/register ─────────────────────────────────────
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existing = await prisma.candidate.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const candidate    = await prisma.candidate.create({
      data: { name, email, passwordHash, phone: phone || null },
    });

    // Welcome email — non-blocking
    sendWelcomeEmail({ to: email, name }).catch((e) =>
      console.error('Welcome email failed:', e.message)
    );

    return res.status(201).json({
      accessToken:  signAccessToken(candidate.id),
      refreshToken: signRefreshToken(candidate.id),
      candidate:    { id: candidate.id, name: candidate.name, email: candidate.email },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const candidate = await prisma.candidate.findUnique({ where: { email } });
    // Same error for both cases — prevents user enumeration
    if (!candidate || !(await comparePassword(password, candidate.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({
      accessToken:  signAccessToken(candidate.id),
      refreshToken: signRefreshToken(candidate.id),
      candidate:    { id: candidate.id, name: candidate.name, email: candidate.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────────
router.post('/refresh', validate(refreshSchema), async (req, res) => {
  try {
    const payload   = verifyRefreshToken(req.body.refreshToken);
    const candidate = await prisma.candidate.findUnique({ where: { id: payload.sub } });
    if (!candidate) return res.status(401).json({ error: 'Account not found' });

    return res.json({
      accessToken:  signAccessToken(candidate.id),
      refreshToken: signRefreshToken(candidate.id),
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────
// Client-side: discard both tokens. No server state to clear (stateless JWT).
router.post('/logout', (_req, res) => {
  return res.json({ message: 'Logged out successfully' });
});

module.exports = router;
