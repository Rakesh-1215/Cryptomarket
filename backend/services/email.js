const nodemailer = require("nodemailer");

async function getFetch() {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch;
  }
  const { default: nodeFetch } = await import("node-fetch");
  return nodeFetch;
}

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
  return (
    process.env.RESEND_FROM ||
    process.env.BREVO_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "Cryptomarket <onboarding@resend.dev>"
  );
}

/**
 * Send email via Resend HTTP REST API (Over HTTPS port 443 - 100% works on Render)
 */
async function sendViaResend({ to, subject, html, text, from }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;

  const fetchClient = await getFetch();
  
  // Default to onboarding@resend.dev if custom sender is not set or unverified
  let sender = from || process.env.RESEND_FROM || "Cryptomarket <onboarding@resend.dev>";
  
  async function executeResendCall(fromAddress) {
    const response = await fetchClient("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  let result = await executeResendCall(sender);

  // If custom sender failed due to domain verification, retry with default onboarding@resend.dev
  if (!result.ok && sender !== "Cryptomarket <onboarding@resend.dev>") {
    console.warn(`[Resend] Custom sender "${sender}" failed (${result.data.message}). Retrying with "Cryptomarket <onboarding@resend.dev>"...`);
    sender = "Cryptomarket <onboarding@resend.dev>";
    result = await executeResendCall(sender);
  }

  if (!result.ok) {
    const errorMsg = result.data.message || result.data.error?.message || `Resend HTTP ${result.status}`;
    console.error(`[Resend Error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`[Resend Success] Email sent to ${to} (ID: ${result.data.id})`);
  return { sent: true, provider: "resend", id: result.data.id };
}

/**
 * Send email via Brevo (Sendinblue) HTTP REST API (Over HTTPS port 443 - works on Render without domain lock)
 */
async function sendViaBrevo({ to, subject, html, text, from }) {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) return null;

  const fetchClient = await getFetch();
  const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || "cryptomarket.auth@gmail.com";
  const senderName = process.env.BREVO_FROM_NAME || "Cryptomarket";

  const response = await fetchClient("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `Brevo HTTP ${response.status}`;
    console.error(`[Brevo Error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`[Brevo Success] Email delivered to ${to} (Message ID: ${data.messageId})`);
  return { sent: true, provider: "brevo", id: data.messageId };
}

/**
 * Send email via standard SMTP (Nodemailer)
 */
async function sendViaSmtp({ to, subject, html, text, from }) {
  const transporter = createTransporter();
  if (!transporter) return null;

  const fromAddress = from || getFromAddress();
  if (!fromAddress) {
    throw new Error("SMTP_FROM or SMTP_USER is missing for SMTP transport.");
  }

  const info = await transporter.sendMail({
    from: fromAddress.includes("<") ? fromAddress : `Cryptomarket <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    provider: "smtp",
    messageId: info.messageId,
  };
}

/**
 * Unified email dispatcher:
 * 1. Brevo HTTP API (HTTPS - Send to ANY email address)
 * 2. Resend HTTP API (HTTPS)
 * 3. SMTP (TCP port 587/465)
 */
async function sendMailUnified({ to, subject, html, text, from }) {
  // Provider 1: Brevo HTTP API (Best for sending to ANY user without custom domain requirement)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await sendViaBrevo({ to, subject, html, text, from });
      if (res && res.sent) return res;
    } catch (err) {
      console.error("[Email] Brevo API attempt failed:", err.message);
    }
  }

  // Provider 2: Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await sendViaResend({ to, subject, html, text, from });
      if (res && res.sent) return res;
    } catch (err) {
      console.error("[Email] Resend API attempt failed:", err.message);
    }
  }

  // Provider 3: SMTP
  if (getSmtpConfig()) {
    try {
      const res = await sendViaSmtp({ to, subject, html, text, from });
      if (res && res.sent) return res;
    } catch (err) {
      console.error("[Email] SMTP attempt failed (often blocked on cloud hosts like Render):", err.message);
    }
  }

  return {
    sent: false,
    skipped: !process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY && !getSmtpConfig(),
    error: "No working email provider configured or connection failed.",
  };
}

async function sendWelcomeEmail({ username, email }) {
  try {
    const text = [
      `Hi ${username},`,
      "",
      "Your Cryptomarket account is ready.",
      "You can now sign in and use the crypto dashboard.",
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;">
        <h2>Welcome to Cryptomarket</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your Cryptomarket account is ready.</p>
        <p>You can now sign in and explore real-time crypto prices, ML predictions, and AI portfolio optimizations.</p>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">If you did not create this account, you can ignore this email.</p>
      </div>
    `;

    return await sendMailUnified({
      to: email,
      subject: "Welcome to Cryptomarket",
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error.message);
    return { sent: false, error: error.message };
  }
}

async function sendVerificationOtpEmail({ username, email, otp }) {
  console.log("==========================================");
  console.log(`🔐 [VERIFICATION OTP] Email: ${email} | Code: ${otp}`);
  console.log("==========================================");

  try {
    const text = `Hi ${username},\n\nYour verification OTP is:\n\n${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not create this account, please ignore this email.`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:24px;color:#1e293b;max-width:500px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#2563eb;margin-top:0;">Welcome to Cryptomarket</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your email verification OTP code is:</p>
        <div style="background:#f1f5f9;padding:14px;border-radius:6px;text-align:center;margin:20px 0;">
          <h1 style="letter-spacing:6px;color:#2563eb;margin:0;font-size:32px;">${otp}</h1>
        </div>
        <p style="color:#475569;font-size:14px;">This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;">
          If you did not request this, simply ignore this email.
        </p>
      </div>
    `;

    const result = await sendMailUnified({
      to: email,
      subject: "Verify your Cryptomarket Email",
      text,
      html,
    });

    if (result.sent) {
      console.log(`Verification OTP email delivered to ${email} via ${result.provider || "email provider"}`);
    }

    return result;
  } catch (error) {
    console.error("EMAIL SENDING FAILED:", error.message);
    return {
      sent: false,
      error: error.message,
    };
  }
}

async function sendLoginOtpEmail({ username, email, otp }) {
  console.log("==========================================");
  console.log(`🔐 [LOGIN OTP] Email: ${email} | Code: ${otp}`);
  console.log("==========================================");

  try {
    const text = `Hi ${username},\n\nYour login OTP is:\n\n${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this login, please ignore this email.`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:24px;color:#1e293b;max-width:500px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#2563eb;margin-top:0;">🔐 Cryptomarket Login OTP</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your login OTP code is:</p>
        <div style="background:#f1f5f9;padding:14px;border-radius:6px;text-align:center;margin:20px 0;">
          <h1 style="letter-spacing:6px;color:#2563eb;margin:0;font-size:32px;">${otp}</h1>
        </div>
        <p style="color:#475569;font-size:14px;">This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;">
          If you did not attempt to log in, please secure your account immediately.
        </p>
      </div>
    `;

    const result = await sendMailUnified({
      to: email,
      subject: "🔐 Login OTP for Cryptomarket",
      text,
      html,
    });

    if (result.sent) {
      console.log(`Login OTP email delivered to ${email} via ${result.provider || "email provider"}`);
    }

    return result;
  } catch (error) {
    console.error("LOGIN OTP EMAIL SENDING FAILED:", error.message);
    return {
      sent: false,
      error: error.message,
    };
  }
}

async function sendTestEmail({ to, subject, text, html }) {
  return await sendMailUnified({
    to,
    subject: subject || "Cryptomarket test email",
    text: text || "This is a test email from Cryptomarket.",
    html: html || "<p>This is a test email from Cryptomarket.</p>",
  });
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationOtpEmail,
  sendLoginOtpEmail,
  sendTestEmail,
  createTransporter,
  getFromAddress,
};
