const PgBoss   = require('pg-boss');
const { sendStatusEmail } = require('./email');

let boss;

// ── Start the Postgres-backed job queue ─────────────────────────
async function startQueue() {
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    // Required for Render's managed Postgres (self-signed cert)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  boss.on('error', (err) => console.error('pg-boss error:', err));
  await boss.start();

  // Worker: send candidate status update emails
  // retryLimit/retryBackoff set per-job at enqueue time
  await boss.work('send-status-email', { teamSize: 3 }, async (job) => {
    const { to, name, jobTitle, status, note } = job.data;
    await sendStatusEmail({ to, name, jobTitle, status, note });
    console.log(`✔ Status email sent → ${to} | ${jobTitle} | ${status}`);
  });

  console.log('✔ Job queue started (pg-boss)');
}

// ── Enqueue a status email with exponential retry ───────────────
// Schedule: 60s → 120s → 240s → 480s → 960s → give up
async function enqueueStatusEmail(data) {
  if (!boss) throw new Error('Queue not started — call startQueue() first');
  await boss.send('send-status-email', data, {
    retryLimit:   5,
    retryDelay:   60,       // seconds before first retry
    retryBackoff: true,     // doubles each attempt
    expireInHours: 24,
  });
}

module.exports = { startQueue, enqueueStatusEmail };
