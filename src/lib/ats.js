/**
 * ATS Push — sends new applications to the HR internal tool
 * Env vars required on Render:
 *   ATS_WEBHOOK_URL  — full URL of your HR tool's incoming endpoint
 *                      e.g. https://your-hr-tool.com/webhooks/nbt/application
 *   ATS_WEBHOOK_SECRET — shared HMAC secret (same on both sides)
 */

const crypto = require('crypto');

async function pushToATS({
  applicationId,  // Our DB application UUID — HR tool must save this for status updates
  jobTitle,
  atsJobId,
  candidateName,
  email,
  phone,
  resumeUrl,
  coverLetter,
}) {
  const ATS_WEBHOOK_URL    = process.env.ATS_WEBHOOK_URL;
  const ATS_WEBHOOK_SECRET = process.env.ATS_WEBHOOK_SECRET;

  if (!ATS_WEBHOOK_URL) {
    console.warn('⚠️  ATS_WEBHOOK_URL not set — skipping HR tool sync');
    return null;
  }

  const payload = JSON.stringify({
    source:                 'navabharathtechnologies-website',
    websiteApplicationId:   applicationId,   // ← HR tool saves this for status updates
    candidateName,
    email,
    phone:                  phone || '',
    jobTitle,
    atsJobId:               atsJobId || null,
    resumeUrl,
    coverLetter:            coverLetter || '',
    appliedAt:              new Date().toISOString(),
  });

  // Sign with HMAC if secret is configured
  const headers = { 'Content-Type': 'application/json' };
  if (ATS_WEBHOOK_SECRET) {
    headers['x-ats-signature'] = crypto
      .createHmac('sha256', ATS_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  }

  try {
    const response = await fetch(ATS_WEBHOOK_URL, {
      method:  'POST',
      headers,
      body:    payload,
      signal:  AbortSignal.timeout(15_000), // 15s timeout
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HR tool returned ${response.status}: ${text}`);
    }

    console.log(`✅ Application pushed to HR tool — websiteApplicationId: ${applicationId}`);
    return applicationId;

  } catch (err) {
    // Non-fatal: application is saved in our DB. HR team still gets email notification.
    console.error('❌ HR tool push failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { pushToATS };
