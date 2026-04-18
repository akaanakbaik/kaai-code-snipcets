# 🗂 Kaai Code Snippet

> **Platform berbagi code snippet untuk developer Indonesia dan mancanegara.**  
> Temukan, salin, dan bagikan kode JavaScript, TypeScript, Python, Go, PHP, dan lainnya secara gratis.

**🌐 Live:** [codes-snippet.kaai.my.id](https://codes-snippet.kaai.my.id)  
**📦 Deploy:** Vercel (serverless) — auto-deploy dari GitHub  
**💾 Database:** Supabase PostgreSQL (primary + backup)  
**🔒 Backup:** GitHub per-file (`aka-second/code-snipset/backup/snippets/`)

---

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, Vite 7, TailwindCSS 4, Wouter, Framer Motion |
| Backend | Express v5, Drizzle ORM, PostgreSQL |
| Auth | Session-based admin auth + OTP email |
| SEO | Schema.org JSON-LD, Open Graph, Twitter Card, Dynamic Sitemap |
| Deploy | Vercel Serverless Functions |
| Logging | Pino HTTP logger |

---

## 🚀 Fitur Utama

- ✅ **Upload & Share Snippet** — Form dengan validasi, preview slug real-time, deteksi duplikat
- ✅ **Slug Bersih** — URL based on title (`/snippet/download-youtube` bukan `/snippet/abc123`)
- ✅ **Lock Snippet** — Password atau PIN untuk snippets eksklusif
- ✅ **ShareModal** — Share via URL slug utama atau ID unik permanen
- ✅ **Statistik Platform** — Timeline, trending, most-viewed/copied, tag cloud
- ✅ **Admin Dashboard** — Approve/reject snippet, lock, broadcast email
- ✅ **SEO Optimal** — Meta tags dinamis per halaman, Schema.org, sitemap dinamis
- ✅ **Lazy Loading** — Bundle split untuk performa optimal
- ✅ **Backup Otomatis** — Sync ke GitHub setiap 2 jam, keep-alive Supabase tiap 3 menit

---

## 📁 Struktur Project

```
kaai-code-snippets/
├── src/
│   ├── pages/
│   │   ├── home.tsx          # Halaman utama + search + filter
│   │   ├── upload.tsx        # Form upload snippet
│   │   ├── snippet-detail.tsx# Detail + copy + download + share
│   │   ├── stats.tsx         # Statistik platform
│   │   ├── admin.tsx         # Dashboard admin
│   │   └── ...
│   ├── hooks/
│   │   ├── use-seo.ts        # Dynamic SEO meta tags per halaman
│   │   └── use-debounce.ts
│   └── App.tsx               # Router + lazy loading
├── server/
│   ├── app.ts                # Express app + sitemap dinamis
│   ├── routes/
│   │   ├── snippets.ts       # CRUD snippet + slug system
│   │   ├── stats.ts          # Stats + timeline + trending
│   │   └── ...
│   └── lib/
│       ├── slug.ts           # Pure title-based slug generation
│       ├── sync.ts           # GitHub backup + Supabase keep-alive
│       └── db.ts             # Drizzle ORM + PostgreSQL
├── public/
│   ├── robots.txt            # SEO crawl config
│   ├── sitemap.xml           # Static fallback sitemap
│   └── site.webmanifest      # PWA manifest
├── scripts/
│   ├── push-to-vercel.mjs    # Deploy ke GitHub (Vercel auto-deploy)
│   └── build-server.mjs      # Build Express untuk Vercel serverless
├── vercel.json               # Vercel deployment config
├── googlesearch.md           # Panduan SEO & Google Search Console
└── vite.config.ts            # Vite build config + lazy loading
```

---

## 🌐 Endpoint API

Base path: `/api`

### Publik

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/stats` | Statistik ringkas (total, language, views) |
| GET | `/stats/timeline` | Aktivitas bulanan 12 bulan terakhir |
| GET | `/stats/engagement` | Avg views/copies, engagement rate |
| GET | `/stats/trending` | Snippet trending (weighted score) |
| GET | `/snippets` | List snippet dengan filter + pagination |
| GET | `/snippets/:id` | Detail snippet by ID atau slug |
| GET | `/snippets/check-title` | Cek duplikat judul + preview slug |
| GET | `/snippets/tags` | Daftar tag populer |
| POST | `/snippets` | Upload snippet baru |
| POST | `/snippets/:id/view` | Track view count |
| POST | `/snippets/:id/copy` | Track copy count |
| GET | `/sitemap.xml` | Dynamic sitemap XML (semua snippet) |

### Admin (Autentikasi Required)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/admin/auth/login` | Login admin dengan OTP email |
| GET | `/admin/snippets` | List semua snippet (pending, approved, rejected) |
| PATCH | `/admin/snippets/:id` | Update status/lock snippet |
| DELETE | `/admin/snippets/:id` | Hapus snippet |
| POST | `/admin/broadcast` | Kirim email broadcast ke semua author |

---

## ⚙️ Setup & Development

### Prerequisites
- Node.js 22+
- PostgreSQL (atau Supabase)

### Instalasi

```bash
git clone https://github.com/akaanakbaik/kaai-code-snipcets.git
cd kaai-code-snippets
npm install
```

### Environment Variables

Buat file `.env`:
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Session
SESSION_SECRET=your_super_secret_key_32_chars_min

# GitHub Backup (opsional)
GITHUB_TOKEN=ghp_xxxxx
GITHUB_BACKUP_REPO=username/repo-backup

# Email / SMTP (opsional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app_password
```

### Jalankan di Local

```bash
# Terminal 1 — API Server (port 3000)
API_PORT=3000 node --import tsx/esm server/index.ts

# Terminal 2 — Frontend (port 5173)
PORT=5173 API_PORT=3000 npm run dev:web
```

### Build & Deploy

```bash
# Build frontend
npm run build:web

# Push ke GitHub (Vercel auto-deploy)
VERCEL_GITHUB_TOKEN=ghp_xxxxx node scripts/push-to-vercel.mjs
```

---

## 🔍 SEO & Search Engine

Website dioptimalkan untuk muncul di Google, Bing, DuckDuckGo, dan mesin pencari lainnya.

### Yang Sudah Diterapkan:
- ✅ Meta tags dinamis per halaman (title, description, keywords, canonical)
- ✅ Open Graph + Twitter Card (preview indah saat share ke WA, Telegram, dll)
- ✅ Schema.org JSON-LD (`SoftwareSourceCode`, `WebSite`, `Organization`)
- ✅ Sitemap dinamis real-time (`/sitemap.xml`) dengan semua snippet approved
- ✅ robots.txt dengan crawl policy optimal
- ✅ Web App Manifest untuk PWA
- ✅ URL slug bersih berbasis judul
- ✅ Core Web Vitals optimal (lazy loading, cached assets, skeleton loaders)

### Cara Submit ke Search Console:
Lihat **[googlesearch.md](./googlesearch.md)** untuk panduan lengkap mendaftarkan website ke Google Search Console, Bing, IndexNow, dan strategi keyword.

---

## 🔐 Sistem Slug

Setiap snippet mendapat slug unik berbasis judul:

```
"Download YouTube" → /snippet/download-youtube
"Download YouTube" (duplikat) → /snippet/download-youtube-2
"Hello World" → /snippet/hello-world
```

Slug dihasilkan saat upload dan tidak berubah meskipun judul diedit. URL permanen tetap tersedia via ID unik (`/snippet/{random-id}`).

---

## 💾 Backup Sistem

- **Supabase keep-alive:** Ping setiap 3 menit ke dua instance Supabase
- **GitHub per-file backup:** Setiap snippet disimpan sebagai file `.js` di `backup/snippets/`
- **GitHub latest.json:** Snapshot semua snippet terbaru
- **Jadwal sync:** Backup penuh setiap 2 jam, incremental setiap 30 menit

---

## 📜 Lisensi

MIT — bebas digunakan untuk project apapun.

---

*Dibuat dengan ❤️ untuk komunitas developer Indonesia*
