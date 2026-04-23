const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

// ── Token generators ────────────────────────────────────────────
function signAccessToken(candidateId) {
  return jwt.sign(
    { sub: candidateId, type: 'access' },
    ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

function signRefreshToken(candidateId) {
  return jwt.sign(
    { sub: candidateId, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Token verifiers ─────────────────────────────────────────────
function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_SECRET);
  if (payload.type !== 'access') throw new Error('Wrong token type');
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, REFRESH_SECRET);
  if (payload.type !== 'refresh') throw new Error('Wrong token type');
  return payload;
}

// ── Password helpers ────────────────────────────────────────────
async function hashPassword(password) {
  return bcrypt.hash(password, 12); // cost factor 12
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── Auth middleware ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.candidateId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  requireAuth,
};
