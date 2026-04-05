import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_PASS = process.env.GMAIL_PASS ?? "";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

const FOOTER = `
<br/><br/>
<hr style="border:none;border-top:1px solid #1e2a3a;margin:20px 0"/>
<p style="color:#64748b;font-size:12px;margin:0">
  Layanan aduan dan balasan silahkan chat: 
  <a href="https://t.me/akamodebaik" style="color:#3b82f6">t.me/akamodebaik</a>
</p>
<p style="color:#64748b;font-size:12px;margin:4px 0">
  &copy; ${new Date().getFullYear()} Kaai Code Snippet &mdash; by 
  <a href="https://akadev.me" style="color:#3b82f6">aka</a>
</p>
`;

function html(content: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
    </head>
    <body style="background:#0a0f1a;font-family:system-ui,sans-serif;margin:0;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#0d1526;border:1px solid #1e2a3a;border-radius:16px;padding:32px">
        <div style="text-align:center;margin-bottom:24px">
          <img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logo%20bulat%20latar%20hitam.png" 
               alt="Kaai" width="48" height="48" style="border-radius:50%;margin-bottom:8px"/>
          <h2 style="color:#e2e8f0;margin:0;font-size:20px;font-weight:700">Kaai Code Snippet</h2>
        </div>
        ${content}
        ${FOOTER}
      </div>
    </body>
    </html>
  `;
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const content = `
    <h3 style="color:#e2e8f0;margin:0 0 16px">Kode OTP Admin Login</h3>
    <p style="color:#94a3b8;margin:0 0 24px">Kode OTP berikut berlaku <strong style="color:#e2e8f0">5 menit</strong> dan hanya dapat digunakan <strong style="color:#e2e8f0">1 kali</strong>.</p>
    <div style="background:#0a0f1a;border:1px solid #1e3a5f;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#3b82f6;font-family:monospace">${otp}</span>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Jika kamu tidak meminta kode ini, abaikan email ini.</p>
  `;
  await transporter.sendMail({
    from: `"Kaai Code Snippet" <${GMAIL_USER}>`,
    to,
    subject: "Kode OTP Admin Login - Kaai Code Snippet",
    html: html(content),
  });
}

export async function sendApprovalEmail(opts: {
  to: string;
  authorName: string;
  snippetTitle: string;
  totalUploaded: number;
  totalViews: number;
  rank: number;
}): Promise<void> {
  const content = `
    <h3 style="color:#22c55e;margin:0 0 16px">Kode Anda Disetujui!</h3>
    <p style="color:#94a3b8;margin:0 0 20px">Hai <strong style="color:#e2e8f0">${opts.authorName}</strong>,</p>
    <p style="color:#94a3b8;margin:0 0 20px">
      Kode <strong style="color:#e2e8f0">"${opts.snippetTitle}"</strong> yang kamu upload telah 
      <span style="color:#22c55e;font-weight:600">disetujui admin</span> dan kini tersedia di library publik.
    </p>
    <div style="background:#0a0f1a;border:1px solid #1e2a3a;border-radius:12px;padding:20px;margin:20px 0">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2a3a">
        <span style="color:#64748b">Total code di-upload</span>
        <span style="color:#e2e8f0;font-weight:600">${opts.totalUploaded}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2a3a">
        <span style="color:#64748b">Jumlah viewer total</span>
        <span style="color:#e2e8f0;font-weight:600">${opts.totalViews}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span style="color:#64748b">Peringkat kamu</span>
        <span style="color:#3b82f6;font-weight:600">#${opts.rank}</span>
      </div>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Terima kasih sudah berkontribusi di Kaai Code Snippet!</p>
  `;
  await transporter.sendMail({
    from: `"Kaai Code Snippet" <${GMAIL_USER}>`,
    to: opts.to,
    subject: `Kode "${opts.snippetTitle}" Anda Disetujui - Kaai Code Snippet`,
    html: html(content),
  });
}

export async function sendRejectionEmail(opts: {
  to: string;
  authorName: string;
  snippetTitle: string;
  reason?: string;
}): Promise<void> {
  const content = `
    <h3 style="color:#ef4444;margin:0 0 16px">Kode Anda Tidak Disetujui</h3>
    <p style="color:#94a3b8;margin:0 0 20px">Hai <strong style="color:#e2e8f0">${opts.authorName}</strong>,</p>
    <p style="color:#94a3b8;margin:0 0 20px">
      Maaf, kode <strong style="color:#e2e8f0">"${opts.snippetTitle}"</strong> yang kamu upload 
      <span style="color:#ef4444;font-weight:600">tidak disetujui</span> oleh admin.
    </p>
    ${opts.reason ? `
    <div style="background:#1a0a0a;border:1px solid #3a1e1e;border-radius:12px;padding:20px;margin:20px 0">
      <p style="color:#94a3b8;margin:0 0 8px;font-size:13px">Alasan penolakan:</p>
      <p style="color:#fca5a5;margin:0;font-style:italic">"${opts.reason}"</p>
    </div>
    ` : ''}
    <p style="color:#64748b;font-size:13px;margin:0">Kamu bisa memperbaiki dan mengupload ulang kodenya. Semangat!</p>
  `;
  await transporter.sendMail({
    from: `"Kaai Code Snippet" <${GMAIL_USER}>`,
    to: opts.to,
    subject: `Kode "${opts.snippetTitle}" Tidak Disetujui - Kaai Code Snippet`,
    html: html(content),
  });
}

export async function sendBroadcastEmail(opts: {
  to: string | string[];
  subject: string;
  message: string;
  adminInitial?: string;
}): Promise<void> {
  const initial = opts.adminInitial || "Admin";
  const content = `
    <h3 style="color:#e2e8f0;margin:0 0 16px">${opts.subject}</h3>
    <div style="background:#0a0f1a;border:1px solid #1e2a3a;border-radius:12px;padding:20px;margin:20px 0">
      <p style="color:#94a3b8;white-space:pre-wrap;margin:0">${opts.message}</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">Salam,<br/><strong style="color:#94a3b8">${initial}</strong> &mdash; Tim Kaai Code Snippet</p>
  `;
  await transporter.sendMail({
    from: `"Kaai Code Snippet" <${GMAIL_USER}>`,
    to: typeof opts.to === "string" ? opts.to : opts.to.join(","),
    subject: opts.subject,
    html: html(content),
  });
}
