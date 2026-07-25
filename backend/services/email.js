const nodemailer = require("nodemailer");

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user,
      pass,
    },
  };
}

function createTransporter() {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  return nodemailer.createTransport(config);
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || null;
}

async function sendWelcomeEmail({ username, email }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(
      "SMTP is not configured. Skipping welcome email for newly registered users.",
    );
    return { sent: false, skipped: true };
  }

  const fromAddress = getFromAddress();
  if (!fromAddress) {
    console.warn("SMTP_FROM is missing. Skipping welcome email.");
    return { sent: false, skipped: true };
  }

  try {
    await transporter.sendMail({
      from: `Cryptomarket <${fromAddress}>`,
      to: email,
      subject: "Welcome to Cryptomarket",
      text: [
        `Hi ${username},`,
        "",
        "Your Cryptomarket account is ready.",
        "You can now sign in and use the crypto dashboard.",
        "",
        "If you did not create this account, you can ignore this email.",
      ].join("\n"),
      html: `
        <p>Hi ${username},</p>
        <p>Your Cryptomarket account is ready.</p>
        <p>You can now sign in and use the crypto dashboard.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      `,
    });

    return { sent: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error.message);
    return { sent: false, error: error.message };
  }
}

async function sendVerificationOtpEmail({ username, email, otp }) {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("SMTP is not configured.");
    return { sent: false, skipped: true };
  }

  const fromAddress = getFromAddress();

  if (!fromAddress) {
    console.warn("SMTP_FROM is missing.");
    return { sent: false, skipped: true };
  }

  try {
    console.log("==================================");
    console.log("Starting verification email...");
    console.log("To:", email);
    console.log("From:", fromAddress);
    console.log("OTP:", otp);

    await transporter.verify();
    console.log("SMTP connection verified.");

    const info = await transporter.sendMail({
      from: `Cryptomarket <${fromAddress}>`,
      to: email,
      subject: "Verify your Cryptomarket Email",
      text: `
Hi ${username},

Your verification OTP is:

${otp}

This OTP will expire in 10 minutes.

If you did not create this account, please ignore this email.
      `,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2>Welcome to Cryptomarket</h2>

          <p>Hi <strong>${username}</strong>,</p>

          <p>Your verification OTP is:</p>

          <h1 style="letter-spacing:5px;color:#2563eb">${otp}</h1>

          <p>This OTP will expire in <strong>10 minutes</strong>.</p>

          <p>If you did not create this account, simply ignore this email.</p>
        </div>
      `,
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    console.log("Response:", info.response);
    console.log("==================================");

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("==================================");
    console.error("EMAIL SENDING FAILED");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error(error);
    console.error("==================================");

    return {
      sent: false,
      error: error.message,
    };
  }
}

// ✅ NEW FUNCTION FOR LOGIN OTP
async function sendLoginOtpEmail({ username, email, otp }) {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("SMTP is not configured.");
    return { sent: false, skipped: true };
  }

  const fromAddress = getFromAddress();

  if (!fromAddress) {
    console.warn("SMTP_FROM is missing.");
    return { sent: false, skipped: true };
  }

  try {
    console.log("==================================");
    console.log("Starting LOGIN OTP email...");
    console.log("To:", email);
    console.log("From:", fromAddress);
    console.log("OTP:", otp);

    await transporter.verify();
    console.log("SMTP connection verified.");

    const info = await transporter.sendMail({
      from: `Cryptomarket <${fromAddress}>`,
      to: email,
      subject: "🔐 Login OTP for Cryptomarket",
      text: `
Hi ${username},

Your login OTP is:

${otp}

This OTP will expire in 10 minutes.

If you did not request this login, please ignore this email.
      `,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2>🔐 Cryptomarket Login OTP</h2>

          <p>Hi <strong>${username}</strong>,</p>

          <p>Your login OTP is:</p>

          <h1 style="letter-spacing:5px;color:#2563eb">${otp}</h1>

          <p>This OTP will expire in <strong>10 minutes</strong>.</p>

          <p>If you did not request this login, please ignore this email.</p>
        </div>
      `,
    });

    console.log("Login OTP email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    console.log("Response:", info.response);
    console.log("==================================");

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("==================================");
    console.error("LOGIN OTP EMAIL SENDING FAILED");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Command:", error.command);
    console.error("==================================");

    return {
      sent: false,
      error: error.message,
    };
  }
}

async function sendTestEmail({ to, subject, text, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, skipped: true };
  }

  const fromAddress = getFromAddress();
  if (!fromAddress) {
    return { sent: false, skipped: true };
  }

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `Cryptomarket <${fromAddress}>`,
      to,
      subject: subject || "Cryptomarket test email",
      text: text || "This is a test email from Cryptomarket.",
      html: html || "<p>This is a test email from Cryptomarket.</p>",
    });

    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

// ✅ UPDATED EXPORTS
module.exports = {
  sendWelcomeEmail,
  sendVerificationOtpEmail,
  sendLoginOtpEmail,  // ← ADDED THIS
  sendTestEmail,
};