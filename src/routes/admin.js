const express = require('express');
const router  = express.Router();

const { prisma }          = require('../lib/prisma');
const { requireAdminKey } = require('../middleware/adminKey');
const { validate, jobSchema } = require('../middleware/validate');

// All admin routes require X-Admin-Key header
router.use(requireAdminKey);

// ── POST /api/admin/jobs — create a new job ─────────────────────
router.post('/jobs', validate(jobSchema), async (req, res) => {
  try {
    const job = await prisma.job.create({ data: req.body });
    return res.status(201).json({ job });
  } catch (err) {
    console.error('Create job error:', err);
    return res.status(500).json({ error: 'Failed to create job' });
  }
});

// ── PATCH /api/admin/jobs/:id — update or deactivate a job ─────
router.patch('/jobs/:id', async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    return res.json({ job });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Job not found' });
    return res.status(500).json({ error: 'Failed to update job' });
  }
});

// ── DELETE /api/admin/jobs/:id — soft delete (deactivate) ───────
router.delete('/jobs/:id', async (req, res) => {
  try {
    await prisma.job.update({
      where: { id: req.params.id },
      data:  { isActive: false },
    });
    return res.json({ message: 'Job deactivated' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Job not found' });
    return res.status(500).json({ error: 'Failed to deactivate job' });
  }
});

// ── GET /api/admin/applications — paginated list with filters ───
router.get('/applications', async (req, res) => {
  try {
    const { status, jobId, page = '1', limit = '20' } = req.query;
    const where = {};
    if (status) where.status = status;
    if (jobId)  where.jobId  = jobId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidate: { select: { name: true, email: true, phone: true } },
          job:       { select: { title: true, team: true } },
          events:    { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.application.count({ where }),
    ]);

    return res.json({
      applications,
      total,
      page:  parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Admin applications error:', err);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// ── GET /api/admin/applications/:id — full application detail ───
router.get('/applications/:id', async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where:   { id: req.params.id },
      include: {
        candidate: true,
        job:       true,
        events:    { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json({ application });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// ── GET /api/admin/stats — dashboard summary ────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [totalJobs, totalCandidates, totalApplications, byStatus] = await Promise.all([
      prisma.job.count({ where: { isActive: true } }),
      prisma.candidate.count(),
      prisma.application.count(),
      prisma.application.groupBy({ by: ['status'], _count: { status: true } }),
    ]);

    return res.json({
      totalJobs,
      totalCandidates,
      totalApplications,
      byStatus: byStatus.reduce((acc, row) => {
        acc[row.status] = row._count.status;
        return acc;
      }, {}),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
