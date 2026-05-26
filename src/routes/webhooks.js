const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const { prisma }             = require('../lib/prisma');
const { enqueueStatusEmail } = require('../lib/queue');

const ATS_WEBHOOK_SECRET = process.env.ATS_WEBHOOK_SECRET;

const VALID_STATUSES = [
  'APPLIED', 'SCREENING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
  'OFFER_EXTENDED', 'HIRED', 'REJECTED', 'WITHDRAWN',
];

// ── HMAC-SHA256 verification ─────────────────────────────────────────
// Accepts bare hex OR "sha256=hex" format from either side
function verifySignature(rawBody, signatureHeader) {
  if (!ATS_WEBHOOK_SECRET) {
    console.warn('⚠️  ATS_WEBHOOK_SECRET not set — skipping signature check');
    return true; // allow through if secret not configured yet
  }
  if (!signatureHeader) return false;

  // Strip "sha256=" prefix if present (GitHub-style)
  const incomingSig = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expected = crypto
    .createHmac('sha256', ATS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incomingSig));
  } catch {
    return false;
  }
}

// ── POST /api/webhooks/ats-update ────────────────────────────────────
// Called by HR tool when an application status changes.
// Payload (from nbt-integration.js pushStatusUpdate):
//   { applicationId, status, note }
//
// NOTE: express.raw() is used to preserve the raw body for HMAC verification
// before any JSON parsing occurs.
router.post(
  '/ats-update',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    // 1. Verify HMAC signature
    const sig = req.headers['x-ats-signature'];
    if (!verifySignature(req.body, sig)) {
      console.warn('⚠️  Webhook: invalid signature from', req.ip);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // 2. Parse body
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Accept both naming conventions:
    // New (nbt-integration.js): { applicationId, status, note }
    // Legacy (Zoho/custom):     { atsAppId, newStatus, note, eventId }
    const applicationId = payload.applicationId || null;
    const atsAppId      = payload.atsAppId      || null;
    const status        = payload.status        || payload.newStatus;
    const note          = payload.note          || null;
    const changedBy     = payload.updatedBy     || 'hr';
    // Generate eventId if not provided (for idempotency)
    const eventId       = payload.eventId       || `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // 3. Validate required fields
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status (or newStatus)' });
    }
    if (!applicationId && !atsAppId) {
      return res.status(400).json({ error: 'Missing required field: applicationId (or atsAppId)' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status: "${status}". Valid: ${VALID_STATUSES.join(', ')}` });
    }

    // 4. Idempotency — skip if already processed (only if eventId was explicitly provided)
    if (payload.eventId) {
      const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
      if (existing) {
        console.log(`ℹ️  Webhook duplicate ignored: ${eventId}`);
        return res.status(200).json({ message: 'Already processed' });
      }
    }

    // 5. Find application — try by our UUID first, then by atsAppId
    let application;
    if (applicationId) {
      application = await prisma.application.findUnique({
        where:   { id: applicationId },
        include: { candidate: true, job: true },
      });
    }
    if (!application && atsAppId) {
      application = await prisma.application.findUnique({
        where:   { atsAppId },
        include: { candidate: true, job: true },
      });
    }

    if (!application) {
      console.warn(`⚠️  Webhook: no application found for applicationId=${applicationId} atsAppId=${atsAppId}`);
      await prisma.webhookEvent.create({
        data: { source: 'ats', eventId, payload, status: 'failed' },
      }).catch(() => {});
      return res.status(404).json({ error: 'Application not found' });
    }

    // 6. Atomic update: status + audit event + idempotency record
    await prisma.$transaction([
      prisma.application.update({
        where: { id: application.id },
        data:  { status },
      }),
      prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStatus:    application.status,
          toStatus:      status,
          note,
          changedBy,
        },
      }),
      prisma.webhookEvent.create({
        data: { source: 'ats', eventId, payload, status: 'processed' },
      }),
    ]);

    // 7. Send status update email to candidate (queued, retried on failure)
    enqueueStatusEmail({
      to:       application.candidate.email,
      name:     application.candidate.name,
      jobTitle: application.job.title,
      status,
      note,
    }).catch((e) => console.error('Failed to enqueue status email:', e.message));

    console.log(`✅ Status synced: app=${application.id} → ${status}`);
    return res.status(200).json({ message: 'Status updated successfully', applicationId: application.id, status });
  }
);

module.exports = router;
