import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "./logger.js";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    throw new Error("GMAIL_USER or GMAIL_PASS is not set.");
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 3,
    });
    logger.info(`[mailer] Transporter initialized — user: ${user}`);
  }

  return _transporter;
}

export async function verifyMailer(): Promise<boolean> {
  try {
    const t = getTransporter();
    await t.verify();
    logger.info("[mailer] SMTP connection verified ✅");
    return true;
  } catch (err) {
    logger.error(`[mailer] SMTP verification failed: ${(err as Error).message}`);
    _transporter = null;
    return false;
  }
}

const FOOTER = `
<br/><br/>
<hr style="border:none;border-top:1px solid #1e2a3a;margin:20px 0"/>
<p style="color:#64748b;font-size:12px;margin:0">
  Layanan aduan dan balasan silahkan chat:
  <a href="https://t.me/akamodebaik" style="color:#3b82f6">t.me/akamodebaik</a>
</p>
`;

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f1623;
  color: #e2e8f0;
  padding: 32px;
  border-radius: 12px;
  max-width: 600px;
  margin: 0 auto;
`;

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Kode OTP Login Admin — Kaai Code Snippet",
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#3b82f6;margin-top:0">Kode OTP Login</h2>
        <p>Gunakan kode berikut untuk login ke panel admin:</p>
        <div style="background:#1e2a3a;border:1px solid #2d3f55;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#3b82f6;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:14px">Kode ini berlaku selama <strong>5 menit</strong>. Jangan bagikan ke siapapun.</p>
        ${FOOTER}
      </div>
    `,
  });
}

export async function sendApprovalEmail(
  to: string,
  snippetTitle: string,
  snippetId: string,
): Promise<void> {
  const t = getTransporter();
  const url = `${process.env.APP_URL ?? "https://kaai.vercel.app"}/snippet/${snippetId}`;
  await t.sendMail({
    from: `"Kaai Code Snippet" <${process.env.GMAIL_USER}>`,
    to,
    subject: `✅ Snippet kamu disetujui: ${snippetTitle}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#22c55e;margin-top:0">Snippet Disetujui!</h2>
        <p>Snippet <strong>${snippetTitle}</strong> sudah disetujui dan bisa dilihat publik.</p>
        <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Lihat Snippet</a>
        ${FOOTER}
      </div>
    `,
  });
}

export async function sendRejectionEmail(
  to: string,
  snippetTitle: string,
  reason?: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Code Snippet" <${process.env.GMAIL_USER}>`,
    to,
    subject: `❌ Snippet kamu ditolak: ${snippetTitle}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#ef4444;margin-top:0">Snippet Ditolak</h2>
        <p>Snippet <strong>${snippetTitle}</strong> ditolak oleh admin.</p>
        ${reason ? `<p style="color:#94a3b8">Alasan: ${reason}</p>` : ""}
        <p style="color:#94a3b8;font-size:14px">Kamu bisa upload ulang setelah diperbaiki.</p>
        ${FOOTER}
      </div>
    `,
  });
}

export async function sendBroadcastEmail(
  to: string | string[],
  subject: string,
  message: string,
): Promise<void> {
  const t = getTransporter();
  const recipients = Array.isArray(to) ? to : [to];
  await Promise.all(
    recipients.map((recipient) =>
      t.sendMail({
        from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
        to: recipient,
        subject,
        html: `
          <div style="${BASE_STYLE}">
            <h2 style="color:#3b82f6;margin-top:0">${subject}</h2>
            <div style="white-space:pre-wrap;color:#e2e8f0">${message}</div>
            ${FOOTER}
          </div>
        `,
      })
    )
  );
}

export async function sendDisableLockOtpEmail(
  to: string,
  snippetTitle: string,
  otp: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Code Snippet" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Kode OTP Matikan Kunci — ${snippetTitle}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#f59e0b;margin-top:0">🔓 Matikan Kunci Snippet</h2>
        <p>Kamu meminta untuk menonaktifkan kunci pada snippet:</p>
        <p style="background:#1e2a3a;border:1px solid #2d3f55;border-radius:8px;padding:12px;font-weight:bold;color:#e2e8f0">${snippetTitle}</p>
        <p>Masukkan kode OTP berikut untuk mengonfirmasi:</p>
        <div style="background:#1e2a3a;border:2px solid #f59e0b;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:48px;font-weight:bold;letter-spacing:12px;color:#f59e0b;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#ef4444;font-size:13px;font-weight:bold">⚠️ Peringatan: Tindakan ini bersifat permanen dan tidak bisa dibatalkan!</p>
        <p style="color:#94a3b8;font-size:13px">Kode ini berlaku selama <strong>3 menit</strong> dan hanya bisa digunakan sekali. Jangan bagikan ke siapapun.</p>
        <p style="color:#94a3b8;font-size:13px">Jika kamu tidak meminta ini, abaikan email ini.</p>
        ${FOOTER}
      </div>
    `,
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"Kaai Admin" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Test Email — Kaai Code Snippet",
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="color:#3b82f6;margin-top:0">Test Email</h2>
        <p>Email SMTP berfungsi dengan baik ✅</p>
        ${FOOTER}
      </div>
    `,
  });
}
