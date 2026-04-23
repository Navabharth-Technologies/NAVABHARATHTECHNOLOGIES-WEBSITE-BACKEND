/**
 * NBT Careers Portal ↔ HR Internal Tool Integration
 * Drop this file into your HR tool's backend (Node.js/Express)
 *
 * Install deps if not already present:
 *   npm install node-fetch crypto express
 */

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────
// CONFIGURATION — set these as env variables in YOUR HR tool
// ─────────────────────────────────────────────────────────────────────
const CAREERS_BACKEND  = 'https://company-website-backend-91ia.onrender.com';
const ADMIN_API_KEY    = process.env.NBT_ADMIN_KEY    || '3bec00ca0c3b71053899c9de96085aaba8124dba7fd1efa903b47e23be80a746';
const WEBHOOK_SECRET   = process.env.NBT_WEBHOOK_SECRET; // Must match ATS_WEBHOOK_SECRET on Render

// ═════════════════════════════════════════════════════════════════════
// PART 1: OUTGOING — HR Tool → Careers Website
// ═════════════════════════════════════════════════════════════════════

// ── 1A. Post a new job (call this when HR creates a job) ─────────────
async function publishJobToWebsite({
  title,
  team,
  location,
  type,         // 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
  experience,
  description,
  atsJobId,     // Your internal job ID — store as reference
  isActive = true,
}) {
  const res = await fetch(`${CAREERS_BACKEND}/api/admin/jobs`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key':  ADMIN_API_KEY,
    },
    body: JSON.stringify({ title, team, location, type, experience, description, atsJobId, isActive }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to publish job: ${JSON.stringify(data)}`);

  console.log(`✅ Job published to website: ${data.job.id}`);
  return data.job; // { id, title, ... } — save data.job.id as websiteJobId in your DB
}

// ── 1B. Deactivate a job (call this when HR closes a position) ───────
async function deactivateJobOnWebsite(websiteJobId) {
  const res = await fetch(`${CAREERS_BACKEND}/api/admin/jobs/${websiteJobId}`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key':  ADMIN_API_KEY,
    },
    body: JSON.stringify({ isActive: false }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to deactivate job: ${JSON.stringify(data)}`);
  console.log(`✅ Job deactivated on website: ${websiteJobId}`);
  return data;
}

// ── 1C. Push a status update (call this when HR moves an application) ─
async function pushStatusUpdate({
  websiteApplicationId, // The ID returned by our backend when candidate applied
  status,               // One of the valid statuses below
  note = '',            // Optional message shown to candidate
}) {
  /*
    Valid statuses:
    APPLIED | SCREENING | INTERVIEW_SCHEDULED | INTERVIEW_COMPLETED
    OFFER_EXTENDED | HIRED | REJECTED | WITHDRAWN
  */
  const payload = JSON.stringify({
    applicationId: websiteApplicationId,  // our backend's application UUID
    status,                               // e.g. "INTERVIEW_SCHEDULED"
    note,
    eventId: `${websiteApplicationId}-${status}-${Date.now()}`, // unique idempotency key
  });

  // Sign the payload with HMAC-SHA256 (bare hex — no sha256= prefix needed)
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const res = await fetch(`${CAREERS_BACKEND}/api/webhooks/ats-update`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-ats-signature': signature,
    },
    body: payload,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Status update failed: ${JSON.stringify(data)}`);

  console.log(`✅ Status updated on website: ${status} for application ${websiteApplicationId}`);
  return data;
}

// ═════════════════════════════════════════════════════════════════════
// PART 2: INCOMING — Careers Website → HR Tool
// ═════════════════════════════════════════════════════════════════════
// Mount this router in your Express app:
//   const { incomingRouter } = require('./nbt-integration');
//   app.use('/webhooks/nbt', incomingRouter);
// Then set on Render:
//   ATS_WEBHOOK_URL = https://your-hr-tool.com/webhooks/nbt/application

const express = require('express');
const incomingRouter = express.Router();

incomingRouter.use(express.json());

// ── 2A. Receive new application from careers website ─────────────────
incomingRouter.post('/application', async (req, res) => {
  try {
    const {
      source,           // "navabharathtechnologies-website"
      candidateName,
      email,
      phone,
      jobTitle,
      atsJobId,         // Your internal job ID (the one you passed when publishing the job)
      resumeUrl,        // Direct download link to the resume PDF
      coverLetter,
      appliedAt,
      websiteApplicationId, // Our backend's application UUID — save this! needed for status updates
    } = req.body;

    console.log(`📩 New application received: ${candidateName} → ${jobTitle}`);

    // ──────────────────────────────────────────────────────────────
    // TODO: Save this application in YOUR HR tool's database
    // Example (adapt to your ORM):
    // ──────────────────────────────────────────────────────────────
    //
    // await db.application.create({
    //   data: {
    //     candidateName,
    //     email,
    //     phone,
    //     jobTitle,
    //     internalJobId:        atsJobId,           // links to your job
    //     websiteApplicationId,                      // ← MUST SAVE: needed for pushStatusUpdate()
    //     resumeUrl,
    //     coverLetter,
    //     status:               'NEW',
    //     appliedAt:            new Date(appliedAt),
    //   }
    // });
    //
    // ──────────────────────────────────────────────────────────────

    // Acknowledge receipt — IMPORTANT: respond 200 quickly
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('❌ Error processing incoming application:', err.message);
    return res.status(500).json({ error: 'Failed to process application' });
  }
});

// ═════════════════════════════════════════════════════════════════════
// PART 3: USAGE EXAMPLES — Wire into your HR tool's existing routes
// ═════════════════════════════════════════════════════════════════════

/*
  ── Example 1: Auto-publish job when HR creates one ─────────────────

  // In your HR tool's job creation route:
  router.post('/jobs', async (req, res) => {
    const job = await db.job.create({ data: req.body });

    // Push to careers website
    try {
      const websiteJob = await publishJobToWebsite({
        title:       job.title,
        team:        job.department,
        location:    job.location,
        type:        job.employmentType,   // map to: Full-time/Part-time/Contract/Internship
        experience:  job.experienceRequired,
        description: job.description,
        atsJobId:    job.id,               // your internal ID
      });
      await db.job.update({ where: { id: job.id }, data: { websiteJobId: websiteJob.id } });
    } catch (e) {
      console.error('Website sync failed (non-blocking):', e.message);
    }

    return res.status(201).json({ job });
  });


  ── Example 2: Auto-update status when HR moves application ─────────

  // In your HR tool's status update route:
  router.patch('/applications/:id/status', async (req, res) => {
    const { status, note } = req.body;
    const app = await db.application.findUnique({ where: { id: req.params.id } });

    await db.application.update({ where: { id: app.id }, data: { status } });

    // Sync to careers website → triggers candidate email automatically
    if (app.websiteApplicationId) {
      try {
        await pushStatusUpdate({
          websiteApplicationId: app.websiteApplicationId,
          status:  mapToWebsiteStatus(status), // see mapping below
          note,
        });
      } catch (e) {
        console.error('Status sync failed (non-blocking):', e.message);
      }
    }

    return res.json({ success: true });
  });


  ── Status Mapping Helper ─────────────────────────────────────────────

  function mapToWebsiteStatus(internalStatus) {
    const map = {
      'NEW':                 'APPLIED',
      'REVIEWING':           'SCREENING',
      'PHONE_SCREEN':        'SCREENING',
      'INTERVIEW_BOOKED':    'INTERVIEW_SCHEDULED',
      'INTERVIEW_DONE':      'INTERVIEW_COMPLETED',
      'OFFER_SENT':          'OFFER_EXTENDED',
      'HIRED':               'HIRED',
      'REJECTED':            'REJECTED',
      'WITHDRAWN':           'WITHDRAWN',
    };
    return map[internalStatus] || 'SCREENING';
  }
*/

// ═════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════
module.exports = {
  publishJobToWebsite,
  deactivateJobOnWebsite,
  pushStatusUpdate,
  incomingRouter,
};
