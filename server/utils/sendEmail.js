const nodemailer = require('nodemailer');

function getTransporter() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Send email via Brevo HTTPS REST API (allows sending to ANY recipient on free tier without custom domain)
 */
async function sendViaBrevo(mailOptions) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return null;

  const senderEmail = (process.env.EMAIL_USER || 'sanzidis99@gmail.com').trim();
  const payload = {
    sender: {
      name: 'RUET Feedback System',
      email: senderEmail
    },
    to: (Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]).map(e => ({ email: e })),
    subject: mailOptions.subject,
    htmlContent: mailOptions.html,
  };

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachment = mailOptions.attachments.map(att => ({
      name: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
    }));
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Brevo HTTPS delivery failed');
  }
  return { accepted: mailOptions.to, rejected: [], messageId: data.messageId };
}

/**
 * Send email via Resend HTTPS API (bypasses Render free tier SMTP port block)
 */
async function sendViaResend(mailOptions) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;

  const payload = {
    from: mailOptions.from || 'RUET Feedback <onboarding@resend.dev>',
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html,
  };

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachments = mailOptions.attachments.map(att => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Resend HTTPS delivery failed');
  }
  return { accepted: payload.to, rejected: [], messageId: data.id };
}

/**
 * Helper to execute sendMail with clear, actionable diagnostics
 */
async function safeSendMail(mailOptions) {
  // 1. If BREVO_API_KEY is configured, prioritize Brevo HTTPS API (sends to any recipient on free tier)
  if (process.env.BREVO_API_KEY) {
    try {
      const brevoResult = await sendViaBrevo(mailOptions);
      if (brevoResult) return brevoResult;
    } catch (brevoErr) {
      console.warn('[Email] Brevo HTTPS failed, falling back:', brevoErr.message);
    }
  }

  // 2. If RESEND_API_KEY is configured, use Resend HTTPS API (works on Render Free Tier)
  if (process.env.RESEND_API_KEY) {
    try {
      const resendResult = await sendViaResend(mailOptions);
      if (resendResult) return resendResult;
    } catch (resendErr) {
      console.warn('[Email] Resend HTTPS failed, falling back to SMTP:', resendErr.message);
    }
  }

  // 3. Otherwise use Nodemailer SMTP
  try {
    const transporter = getTransporter();
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Mail delivery error:', error.message);
    const msg = error.message || '';
    if (error.responseCode === 535 || msg.includes('535') || msg.includes('BadCredentials') || msg.includes('Username and Password not accepted')) {
      const authError = new Error(
        'Gmail authentication failed (535 Bad Credentials). Please ensure EMAIL_USER is your Gmail address and EMAIL_PASS is a 16-character Google App Password (without spaces).'
      );
      authError.code = 'GMAIL_AUTH_FAILED';
      throw authError;
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ESOCKETTIMEDOUT')) {
      const timeoutError = new Error(
        'SMTP Connection timeout. Note: Render Free Tier blocks outbound SMTP ports (25, 465, 587). To send emails from Render Free Tier, please add a free RESEND_API_KEY in Render Environment.'
      );
      timeoutError.code = 'SMTP_TIMEOUT_RENDER_BLOCK';
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Send a verification email with a 6-digit code
 */
async function sendVerificationEmail(toEmail, code) {
  const mailOptions = {
    from: `"RUET Feedback System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'RUET Teacher Registration — Verification Code',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0F1120; border-radius: 16px; overflow: hidden; border: 1px solid #2A2D40;">
        <div style="background: linear-gradient(135deg, #B91C3A 0%, #8B1229 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">RUET Feedback System</h1>
          <p style="color: #F9A8B8; margin: 8px 0 0; font-size: 13px;">Teacher Registration Verification</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #B8BECF; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
            Thank you for registering as a teacher on the RUET Feedback System. Please use the verification code below to complete your registration:
          </p>
          <div style="background: #1A1D2E; border: 2px solid #B91C3A; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; font-family: 'Courier New', monospace;">${code}</span>
          </div>
          <p style="color: #6B7280; font-size: 13px; margin: 0; line-height: 1.5;">
            This code will expire in <strong style="color: #C8922A;">10 minutes</strong>.<br/>
            If you did not request this, please ignore this email.
          </p>
        </div>
        <div style="background: #0A0C1A; padding: 16px 24px; text-align: center; border-top: 1px solid #1F2237;">
          <p style="color: #4B5563; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} RUET Teacher Feedback System — Rajshahi University of Engineering & Technology
          </p>
        </div>
      </div>
    `,
  };

  return safeSendMail(mailOptions);
}

/**
 * Send a password reset OTP email
 */
async function sendPasswordResetEmail(toEmail, code, role = 'User') {
  const mailOptions = {
    from: `"RUET Feedback System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `RUET Feedback System — Password Reset Code (${role})`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0F1120; border-radius: 16px; overflow: hidden; border: 1px solid #2A2D40;">
        <div style="background: linear-gradient(135deg, #B91C3A 0%, #8B1229 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">RUET Feedback System</h1>
          <p style="color: #F9A8B8; margin: 8px 0 0; font-size: 13px;">${role} Password Reset Verification</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #B8BECF; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
            We received a request to reset your password. Please use the 6-digit verification code below to verify your account identity:
          </p>
          <div style="background: #1A1D2E; border: 2px solid #C8922A; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; font-family: 'Courier New', monospace;">${code}</span>
          </div>
          <p style="color: #6B7280; font-size: 13px; margin: 0; line-height: 1.5;">
            This verification code will expire in <strong style="color: #C8922A;">10 minutes</strong>.<br/>
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #0A0C1A; padding: 16px 24px; text-align: center; border-top: 1px solid #1F2237;">
          <p style="color: #4B5563; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} RUET Teacher Feedback System — Rajshahi University of Engineering & Technology
          </p>
        </div>
      </div>
    `,
  };

  return safeSendMail(mailOptions);
}

/**
 * Send an automated feedback report (XLSX) to a teacher
 */
async function sendFeedbackReportEmail(toEmail, teacherName, courseName, xlsxBuffer, fileName) {
  const mailOptions = {
    from: `"RUET Feedback System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `RUET Course Feedback Report — ${courseName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #0F1120; border-radius: 16px; overflow: hidden; border: 1px solid #2A2D40;">
        <div style="background: linear-gradient(135deg, #0F7B5F 0%, #1A1D2E 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">RUET Feedback System</h1>
          <p style="color: #34D399; margin: 8px 0 0; font-size: 13px;">Official Course Evaluation Report</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #FFFFFF; font-size: 16px; font-weight: 600; margin: 0 0 12px;">
            Dear ${teacherName || 'Faculty Member'},
          </p>
          <p style="color: #B8BECF; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
            The student feedback evaluations for your course <strong>${courseName}</strong> have been finalized and approved by the department administration.
          </p>
          <p style="color: #B8BECF; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
            Attached to this email is the comprehensive Excel report (<code>.xlsx</code>) containing the full statistical breakdown, OBE / Course Outcome (CO) attainment analytics, and student comments.
          </p>
          <div style="background: #14182C; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin: 0 0 20px;">
            <p style="color: #94A3B8; font-size: 13px; margin: 0;">
              Attachment: <strong style="color: #E2E8F0;">${fileName || `${courseName}_Report.xlsx`}</strong>
            </p>
          </div>
        </div>
        <div style="background: #0A0C1A; padding: 16px 24px; text-align: center; border-top: 1px solid #1F2237;">
          <p style="color: #4B5563; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} RUET Teacher Feedback System — Rajshahi University of Engineering & Technology
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: fileName || `${courseName}_Feedback_Report.xlsx`,
        content: xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  };

  return safeSendMail(mailOptions);
}

module.exports = { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendFeedbackReportEmail 
};
