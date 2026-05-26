/**
 * Admin API key middleware.
 * Protects internal admin routes from public access.
 * Set ADMIN_API_KEY in Render environment variables.
 */
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden — invalid or missing admin key' });
  }
  next();
}

module.exports = { requireAdminKey };
