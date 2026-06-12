const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

  return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
