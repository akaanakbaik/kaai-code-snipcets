# Kaai Code Snippet

**Platform berbagi kode berkualitas untuk developer Indonesia.**

Dibangun di atas stack modern: React + Vite (frontend), Express + PostgreSQL (backend), dengan sistem moderasi admin, notifikasi email, auto-sync ke Supabase & GitHub, dan keamanan berlapis.

---

## Fitur Utama

- **Library Snippet** — browsable, searchable, filterable by language & tag
- **Sort filter** — Terpopuler / Terbaru / A–Z
- **Syntax Highlighting** — vscDarkPlus via `react-syntax-highlighter`
- **Raw View** — `/raw/:id` tampilkan kode mentah di halaman hitam polos
- **Upload Snippet** — form kirim kode + moderasi admin sebelum publish
- **Admin Panel** — OTP auth via email, audio notification, approve/reject snippet
- **Stats Real-time** — 4-column grid, language bars, auto-refresh 30 detik
- **Keamanan** — Rate limiting, IP ban, brute-force protection, CSP, HSTS
- **Auto-sync** — Supabase 1 & 2 (tiap 30 menit), GitHub backup JSON (tiap 2 jam)
- **Custom Snippet ID** — Format 5 digit + 5 huruf (cth: `12345ABCDE`)
- **Notifikasi Email** — Nodemailer Gmail untuk approve/reject snippet

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, Wouter |
| Backend | Express.js, Drizzle ORM, Zod |
| Database | PostgreSQL (Replit DB) + Supabase (1 & 2) |
| Email | Nodemailer (Gmail SMTP) |
| Backup | GitHub REST API |
| Deploy | Replit (dev) + Vercel (frontend prod) |

---

## Struktur Project

```
/
├── artifacts/
│   ├── api-server/          # Express API backend
│   │   ├── src/
│   │   │   ├── routes/      # API routes (snippets, admin, stats, webhook)
│   │   │   ├── middlewares/ # Rate limit, IP ban, security headers
│   │   │   └── lib/         # mailer.ts, sync.ts, logger.ts
│   └── kaai-code-snippet/   # React + Vite frontend
│       └── src/
│           ├── pages/       # home, upload, snippet-detail, admin, stats, raw, terms, privacy
│           └── components/  # layout, ui/*
├── lib/
│   ├── api-client-react/    # Auto-generated TanStack Query hooks
│   └── db/                  # Drizzle schema + client
└── scripts/                 # DB push, migration helpers
```

---

## Setup Lokal

Lihat [setup-db.md](./setup-db.md) untuk panduan lengkap setup database dan environment.

```bash
# Install dependencies
pnpm install

# Setup database
pnpm run db:push

# Jalankan semua service
pnpm run dev
```

---

## Environment Variables

Semua secret dikelola via Replit Secrets (jangan di-hardcode). Lihat `setup-db.md` untuk daftar lengkap.

---

## Keamanan

- Global rate limit: 10 req/detik per IP
- Admin login rate limit: 5 percobaan/menit
- IP ban otomatis: 24 jam setelah brute-force terdeteksi
- Email ban: 5 menit setelah login admin gagal berulang
- Security headers: `X-Frame-Options`, `CSP`, `HSTS`, `X-Content-Type-Options`
- ORM (Drizzle) → mencegah SQL injection
- Stack trace tidak pernah dikembalikan ke client di production

---

## Kontak & Aduan

- Telegram: [t.me/akamodebaik](https://t.me/akamodebaik)
- Website: [akadev.me](https://akadev.me)

---

## Lisensi

MIT License — lihat [LICENSE](./LICENSE)

> made by **aka** — akadev.me
