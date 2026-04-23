const { z } = require('zod');

// ── Middleware factory ──────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    req.body = result.data; // use coerced/parsed data
    next();
  };
}

// ── Auth schemas ────────────────────────────────────────────────
const registerSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  phone:    z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Job schema (admin) ──────────────────────────────────────────
const jobSchema = z.object({
  title:       z.string().min(2).max(200),
  team:        z.string().min(2).max(100),
  location:    z.string().min(2).max(200),
  type:        z.enum(['Full-time', 'Part-time', 'Contract', 'Internship']),
  experience:  z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  isActive:    z.boolean().optional().default(true),
  atsJobId:    z.string().optional(),
});

module.exports = { validate, registerSchema, loginSchema, refreshSchema, jobSchema };
