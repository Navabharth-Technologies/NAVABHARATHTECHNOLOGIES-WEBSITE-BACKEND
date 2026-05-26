const express = require('express');
const router  = express.Router();

const { prisma }       = require('../lib/prisma');
const { requireAuth }  = require('../lib/auth');
const { upload, getResumeUrl } = require('../lib/storage');
const { pushToATS }    = require('../lib/ats');
const { sendApplicationConfirmation, sendHRNotification } = require('../lib/email');
const { applyLimiter } = require('../middleware/rateLimit');

// ── POST /api/applications — submit application ─────────────────
// multipart/form-data: fields (jobId, coverLetter) + file (resume)
router.post(
  '/',
  requireAuth,
  applyLimiter,
  upload.single('resume'),
  async (req, res) => {
    try {
      const { jobId, coverLetter, phone, department, location, experience } = req.body;
      const candidateId = req.candidateId;

      // 1. Validate job exists and is active
      const job = await prisma.job.findFirst({ where: { id: jobId, isActive: true } });
      if (!job) {
        return res.status(404).json({ error: 'Job not found or no longer available' });
      }

      // 2. Check duplicate application
      const duplicate = await prisma.application.findUnique({
        where: { candidateId_jobId: { candidateId, jobId } },
      });
      if (duplicate) {
        return res.status(409).json({ error: 'You have already applied for this position' });
      }

      // 3. Resume is required
      if (!req.file) {
        return res.status(400).json({ error: 'Resume file is required (PDF, DOC, or DOCX)' });
      }

      const resumeUrl = getResumeUrl(req.file.filename);
      let candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });

      // Save phone to candidate record if provided and not already set
      if (phone && !candidate.phone) {
        candidate = await prisma.candidate.update({
          where: { id: candidateId },
          data:  { phone },
        });
      }

      // 4. Create application + initial audit event (atomic)
      const application = await prisma.application.create({
        data: {
          candidateId,
          jobId,
          coverLetter: coverLetter || null,
          resumeUrl,
          status: 'APPLIED',
          events: {
            create: {
              toStatus:  'APPLIED',
              changedBy: 'system',
              note:      'Application submitted by candidate',
            },
          },
        },
      });

      // 5. Push to ATS asynchronously (non-blocking — failures don't break the response)
      pushToATS({
        applicationId: application.id,
        jobTitle:      job.title,
        atsJobId:      job.atsJobId,
        candidateName: candidate.name,
        email:         candidate.email,
        phone:         phone || candidate.phone,
        department:    department || job.team,
        location:      location  || job.location,
        experience:    experience ? `${experience} year(s)` : '',
        resumeUrl,
        coverLetter,
      }).catch((e) => console.error('HR tool push failed:', e.message));

      // 6. Send emails asynchronously (non-blocking)
      sendApplicationConfirmation({
        to: candidate.email, name: candidate.name,
        jobTitle: job.title, applicationId: application.id,
      }).catch((e) => console.error('Confirmation email failed:', e.message));

      sendHRNotification({
        name: candidate.name, email: candidate.email,
        phone: phone || candidate.phone, jobTitle: job.title,
        department: department || job.team,
        location:   location  || job.location,
        experience: experience ? `${experience} year(s)` : 'Not specified',
        resumeUrl, coverLetter,
      }).catch((e) => console.error('HR notification failed:', e.message));

      return res.status(201).json({
        message:     'Application submitted successfully',
        application: {
          id:          application.id,
          status:      'APPLIED',
          jobTitle:    job.title,
          submittedAt: application.submittedAt,
        },
      });
    } catch (err) {
      console.error('Apply error:', err);
      return res.status(500).json({ error: 'Failed to submit application' });
    }
  }
);

// ── GET /api/applications/mine — candidate's own applications ───
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where:   { candidateId: req.candidateId },
      include: {
        job:    { select: { title: true, team: true, location: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ applications });
  } catch (err) {
    console.error('Get applications error:', err);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// ── GET /api/applications/:id — single application + history ────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const application = await prisma.application.findFirst({
      where:   { id: req.params.id, candidateId: req.candidateId },
      include: {
        job:    true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json({ application });
  } catch (err) {
    console.error('Get application error:', err);
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// ── DELETE /api/applications/:id — withdraw application ─────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, candidateId: req.candidateId },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const nonWithdrawable = ['HIRED', 'REJECTED', 'WITHDRAWN'];
    if (nonWithdrawable.includes(application.status)) {
      return res.status(400).json({
        error: `Cannot withdraw — current status is ${application.status}`,
      });
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id: application.id },
        data:  { status: 'WITHDRAWN' },
      }),
      prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStatus:    application.status,
          toStatus:      'WITHDRAWN',
          changedBy:     'candidate',
          note:          'Withdrawn by candidate',
        },
      }),
    ]);

    return res.json({ message: 'Application withdrawn successfully' });
  } catch (err) {
    console.error('Withdraw error:', err);
    return res.status(500).json({ error: 'Failed to withdraw application' });
  }
});

module.exports = router;
