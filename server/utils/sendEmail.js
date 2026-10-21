const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Helper to execute sendMail with clear, actionable diagnostics
 */
async function safeSendMail(mailOptions) {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Mail delivery error:', error.message);
    const msg = error.message || '';
    if (error.responseCode === 535 || msg.includes('535') || msg.includes('BadCredentials') || msg.includes('Username and Password not accepted')) {
      const authError = new Error(
        'Gmail authentication failed (535 Bad Credentials). Google requires a 16-character App Password when using Gmail SMTP. Please generate an App Password in your Google Account (Security > 2-Step Verification > App Passwords) and set EMAIL_PASS in server/.env.'
      );
      authError.code = 'GMAIL_AUTH_FAILED';
      throw authError;
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
