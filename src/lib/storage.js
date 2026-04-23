const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Disk storage (Render Disk / local) ──────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

// ── Allow only PDF / Word documents ─────────────────────────────
const fileFilter = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Returns a publicly accessible URL for the resume file
function getResumeUrl(filename) {
  const base = process.env.BACKEND_URL || 'https://company-website-backend-91ia.onrender.com';
  return `${base}/uploads/${filename}`;
}

module.exports = { upload, getResumeUrl, UPLOAD_DIR };
