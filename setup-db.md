# Setup Database & Environment — Kaai Code Snippet

Panduan lengkap untuk menjalankan Kaai Code Snippet dari awal di environment baru.

---

## Prasyarat

- Node.js >= 18
- pnpm >= 9
- PostgreSQL (atau gunakan Replit DB)
- Akun Supabase (1 & 2)
- Akun GitHub (untuk backup)
- Gmail dengan App Password aktif

---

## 1. Clone & Install

```bash
git clone https://github.com/akaanakbaik/kaai-code-snipcets.git
cd kaai-code-snipcets
pnpm install
```

---

## 2. Environment Variables

Buat file `.env` di root (atau set via Replit Secrets / Vercel Environment). **Jangan commit `.env` ke git.**

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret acak panjang untuk session cookie |
| `VITE_SUPABASE_URL_1` | URL project Supabase 1 |
| `VITE_SUPABASE_KEY_1` | **Service Role** key Supabase 1 |
| `VITE_SUPABASE_URL_2` | URL project Supabase 2 |
| `VITE_SUPABASE_KEY_2` | **Service Role** key Supabase 2 |
| `VITE_GITHUB_TOKEN` | GitHub Personal Access Token (repo scope) |
| `VITE_GITHUB_REPO` | Format: `owner/repo` (cth: `aka-second/code-snipset`) |
| `VITE_BOT_WEBHOOK_URL` | URL webhook bot Telegram (opsional) |
| `VITE_WEBHOOK_SECRET` | Secret untuk validasi webhook (opsional) |

### Contoh `.env`

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=ganti_dengan_string_acak_panjang_min64char
VITE_SUPABASE_URL_1=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_KEY_1=eyJ...service_role_key_supabase_1
VITE_SUPABASE_URL_2=https://yyyyyyyyyyyy.supabase.co
VITE_SUPABASE_KEY_2=eyJ...service_role_key_supabase_2
VITE_GITHUB_TOKEN=ghp_...
VITE_GITHUB_REPO=owner/repo-name
```

> **Penting**: Selalu gunakan **service role key** Supabase (bukan anon key) agar sync dapat bypass RLS.

---

## 3. Setup Database

```bash
# Push schema Drizzle ke PostgreSQL
pnpm run db:push

# Atau jika perlu force (schema changed)
pnpm run db:push --force
```

Schema yang dibuat:
- `snippets` — tabel utama snippet
- `ip_bans` — blacklist IP
- `email_bans` — blacklist email

---

## 4. Setup Supabase 1

Supabase 1 menggunakan tabel `snippet_metadata` yang sudah ada. Pastikan:

1. Buka **SQL Editor** di dashboard Supabase 1
2. Jalankan SQL berikut untuk membuat user sistem:

```sql
-- User sistem untuk sync (jika belum ada)
INSERT INTO public.users (email, name, is_admin)
VALUES ('system@kaai.code', 'Kaai System', false)
ON CONFLICT (email) DO NOTHING;
```

---

## 5. Setup Supabase 2

Supabase 2 memerlukan tabel baru. Jalankan SQL ini di **SQL Editor** Supabase 2:

```sql
-- Tabel snippets
CREATE TABLE IF NOT EXISTS public.snippets (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  language    TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  code        TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'approved',
  reject_reason TEXT,
  view_count  INTEGER DEFAULT 0,
  copy_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snippets_status     ON public.snippets(status);
CREATE INDEX IF NOT EXISTS idx_snippets_language   ON public.snippets(language);
CREATE INDEX IF NOT EXISTS idx_snippets_view_count ON public.snippets(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON public.snippets(created_at DESC);

-- RLS
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"    ON public.snippets FOR SELECT USING (true);
CREATE POLICY "service_insert" ON public.snippets FOR INSERT WITH CHECK (true);
CREATE POLICY "service_update" ON public.snippets FOR UPDATE USING (true);
```

---

## 6. Setup Gmail (Nodemailer)

1. Aktifkan **2-Step Verification** di akun Gmail pengirim
2. Buat **App Password** di: Google Account → Security → App Passwords
3. Update `artifacts/api-server/src/lib/mailer.ts` dengan email dan app password

---

## 7. Jalankan

```bash
# Development (semua service)
pnpm run dev

# Atau per service:
pnpm --filter @workspace/api-server run dev      # API server
pnpm --filter @workspace/kaai-code-snippet run dev  # Frontend
```

---

## 8. Deploy ke Vercel (Frontend Only)

```bash
cd artifacts/kaai-code-snippet
pnpm build
# Upload dist/ ke Vercel atau gunakan Vercel CLI
```

Pastikan `vercel.json` sudah ada di direktori `artifacts/kaai-code-snippet/`.

---

## Auto-Sync Schedule

| Task | Interval |
|---|---|
| Supabase keep-alive ping | Setiap 4 menit |
| Sync data ke Supabase 1 & 2 | Setiap 30 menit |
| Backup JSON ke GitHub | Setiap 2 jam |

---

## Troubleshooting

**Supabase sync 401**: Pastikan menggunakan **service role key**, bukan anon key.

**Supabase sync "violates row-level security"**: Gunakan service role key (bypass RLS otomatis).

**Email tidak terkirim**: Pastikan App Password Gmail sudah benar dan 2FA aktif.

**GitHub backup gagal**: Pastikan token punya scope `repo` dan format `VITE_GITHUB_REPO` adalah `owner/repo`.
