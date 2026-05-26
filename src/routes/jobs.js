const express = require('express');
const router  = express.Router();
const { prisma } = require('../lib/prisma');

// ── GET /api/jobs — all active jobs (public) ───────────────────
router.get('/', async (_req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where:   { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, team: true, location: true,
        type: true, experience: true, description: true, createdAt: true,
      },
    });
    return res.json({ jobs });
  } catch (err) {
    console.error('Get jobs error:', err);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ── GET /api/jobs/:id — single job (public) ────────────────────
router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, isActive: true },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (err) {
    console.error('Get job error:', err);
    return res.status(500).json({ error: 'Failed to fetch job' });
  }
});

module.exports = router;
