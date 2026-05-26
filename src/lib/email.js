const { Resend } = require('resend');

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = 'NBTech Careers <no-reply@updates.navabharathtechnologies.com>';
const HR_EMAIL = process.env.HR_EMAIL || 'hr@navabharathtechnologies.com';
const PORTAL   = 'https://www.navabharathtechnologies.com/openings.html';
const LOGO_URL = 'https://www.navabharathtechnologies.com/assets/header-logo.png';
const SITE_URL = 'https://www.navabharathtechnologies.com';

// Human-readable status labels
const STATUS_LABELS = {
  APPLIED:             '📩 Application Received',
  SCREENING:           '🔍 Under Screening',
  INTERVIEW_SCHEDULED: '📅 Interview Scheduled',
  INTERVIEW_COMPLETED: '✅ Interview Completed',
  OFFER_EXTENDED:      '🎉 Offer Extended',
  HIRED:               '🎊 Congratulations — You\'re Hired!',
  REJECTED:            '🙏 Application Closed',
  WITHDRAWN:           '↩️ Application Withdrawn',
};

// ── Shared email shell ──────────────────────────────────────────────
function shell(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Navabharath Technologies</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Header with Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f2460 0%,#1a3c87 60%,#2563eb 100%);border-radius:14px 14px 0 0;padding:28px 36px;text-align:center;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Navabharath Technologies" width="160" style="height:auto;display:block;margin:0 auto;" onerror="this.style.display='none'">
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 14px 14px;padding:20px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">
                <strong style="color:#1a3c87;">Navabharath Technologies</strong> · Mysore, Karnataka, India
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="${SITE_URL}" style="color:#2563eb;text-decoration:none;">navabharathtechnologies.com</a>
                &nbsp;·&nbsp;
                <a href="mailto:hr@navabharathtechnologies.com" style="color:#2563eb;text-decoration:none;">hr@navabharathtechnologies.com</a>
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#cbd5e1;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Button helper ───────────────────────────────────────────────────
function btn(url, label) {
  return `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#1a3c87,#2563eb);color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;margin-top:8px;">${label}</a>`;
}

// ── Info row helper (for tables) ────────────────────────────────────
function infoRow(label, value, shaded) {
  const bg = shaded ? 'background:#f1f5ff;' : 'background:#ffffff;';
  return `<tr>
    <td style="${bg}padding:11px 16px;font-size:14px;font-weight:600;color:#374151;width:130px;border-bottom:1px solid #e2e8f0;">${label}</td>
    <td style="${bg}padding:11px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${value}</td>
  </tr>`;
}

// ── Welcome email on registration ───────────────────────────────────
async function sendWelcomeEmail({ to, name }) {
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">🎉</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#0f172a;">Welcome, ${name}!</h1>
      <p style="margin:0;font-size:16px;color:#64748b;">Your Navabharath Technologies account is ready.</p>
    </div>
    <div style="background:#f0f4ff;border-left:4px solid #2563eb;border-radius:8px;padding:18px 20px;margin:0 0 28px;">
      <p style="margin:0;font-size:15px;color:#1e3a8a;font-weight:500;">
        ✅ Account successfully created<br>
        ✅ You can now browse open roles<br>
        ✅ Submit an application at any time
      </p>
    </div>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 28px;">
      We're excited to have you here. Explore our open positions and take the first step toward your next career chapter with us.
    </p>
    <div style="text-align:center;">
      ${btn(PORTAL, 'View Open Jobs →')}
    </div>
  `;
  return resend.emails.send({ from: FROM, to, subject: 'Welcome to Navabharath Technologies Careers Portal', html: shell(body) });
}

// ── Application received confirmation ──────────────────────────────
async function sendApplicationConfirmation({ to, name, jobTitle, applicationId }) {
  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">📬</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Application Received!</h1>
      <p style="margin:0;font-size:16px;color:#64748b;">Hi <strong>${name}</strong>, we've got your application.</p>
    </div>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Thank you for applying for the <strong style="color:#1a3c87;">${jobTitle}</strong> position. Our team will carefully review your application and keep you updated at every stage.
    </p>
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin:0 0 28px;">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Application ID</p>
      <p style="margin:0;font-size:14px;color:#1a3c87;font-weight:700;font-family:monospace;word-break:break-all;">${applicationId}</p>
    </div>
    <div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
      <p style="margin:0;font-size:14px;color:#065f46;font-weight:500;">
        💡 <strong>What's next?</strong> Our team will review your profile within 2–5 business days. You'll receive an email update for every stage change.
      </p>
    </div>
    <div style="text-align:center;">
      ${btn(PORTAL, 'Track My Application →')}
    </div>
  `;
  return resend.emails.send({ from: FROM, to, subject: `Application Received — ${jobTitle}`, html: shell(body) });
}

// ── Status update email (triggered by ATS webhook) ──────────────────
async function sendStatusEmail({ to, name, jobTitle, status, note }) {
  const label = STATUS_LABELS[status] || status;
  const isGood = ['HIRED', 'OFFER_EXTENDED', 'INTERVIEW_SCHEDULED'].includes(status);
  const accentColor = isGood ? '#10b981' : status === 'REJECTED' ? '#ef4444' : '#2563eb';
  const bgColor     = isGood ? '#ecfdf5'  : status === 'REJECTED' ? '#fef2f2' : '#eff6ff';

  const body = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">📋</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Application Update</h1>
      <p style="margin:0;font-size:16px;color:#64748b;">Hi <strong>${name}</strong>, there's a new update on your application.</p>
    </div>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Your application for <strong style="color:#1a3c87;">${jobTitle}</strong> has been updated:
    </p>
    <div style="background:${bgColor};border-left:4px solid ${accentColor};border-radius:10px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:${accentColor};">${label}</p>
      ${note ? `<p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.6;">${note}</p>` : ''}
    </div>
    <div style="text-align:center;">
      ${btn(PORTAL, 'View Full Status →')}
    </div>
  `;
  return resend.emails.send({ from: FROM, to, subject: `Application Update — ${jobTitle}`, html: shell(body) });
}

// ── HR notification when candidate applies ──────────────────────────
async function sendHRNotification({ name, email, phone, jobTitle, department, location, experience, resumeUrl, coverLetter }) {
  const body = `
    <div style="margin-bottom:24px;">
      <div style="display:inline-block;background:#1a3c87;color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">New Application</div>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Job Application Received</h1>
      <p style="margin:0;font-size:15px;color:#64748b;">A candidate has applied for <strong style="color:#1a3c87;">${jobTitle}</strong></p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 24px;">
      ${infoRow('Name',       name,  false)}
      ${infoRow('Email',      `<a href="mailto:${email}" style="color:#2563eb;text-decoration:none;">${email}</a>`, true)}
      ${infoRow('Phone',      phone || '<span style="color:#94a3b8;">Not provided</span>', false)}
      ${infoRow('Department', department || '<span style="color:#94a3b8;">—</span>', true)}
      ${infoRow('Location',   location   || '<span style="color:#94a3b8;">—</span>', false)}
      ${infoRow('Experience', experience || '<span style="color:#94a3b8;">Not specified</span>', true)}
      ${infoRow('Role',       `<strong>${jobTitle}</strong>`, false)}
    </table>

    ${coverLetter ? `
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Cover Letter</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${coverLetter}</p>
    </div>` : ''}

    ${resumeUrl ? `
    <div style="text-align:center;">
      ${btn(resumeUrl, '📎 Download Resume →')}
    </div>` : ''}
  `;
  return resend.emails.send({ from: FROM, to: HR_EMAIL, subject: `New Application — ${jobTitle} (${name})`, html: shell(body) });
}

module.exports = {
  sendWelcomeEmail,
  sendApplicationConfirmation,
  sendStatusEmail,
  sendHRNotification,
};
