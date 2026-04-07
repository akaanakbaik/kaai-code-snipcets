# Kaai Code Snippet

Platform berbagi kode untuk developer Indonesia. Dibangun dengan React + Vite (frontend), Express v5 + Drizzle ORM + PostgreSQL (backend).

- **URL:** `https://codes-snippet.kaai.my.id`
- **Deploy:** Vercel (serverless) — semua request `/api/*` → satu function

---

## Ringkasan Endpoint

| Kategori | Akses |
|---|---|
| Health (4) | Publik |
| Statistik (3) | Publik |
| Snippets (7) | Publik |
| Webhook Telegram (2) | Semi-private |
| Autentikasi Admin (4) | Admin |
| Manajemen Snippet Admin (7) | Admin |
| Keamanan / Ban (4) | Admin |
| Broadcast Email (4) | Admin |
| API Keys (4) | Admin |
| IP Whitelist (4) | Admin |
| Request Logs (1) | Admin |

Base path semua endpoint: `/api`

---

## Middleware Global

Berlaku untuk semua endpoint:

- **Security headers** — X-Frame-Options, CSP, HSTS, dll.
- **Rate limit global** — 10 req/detik per IP
- **CORS** — semua origin, credentials: true
- **Request logger** — setiap request `/api/*` dicatat ke DB secara async

---

## Endpoint Publik

### Health

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/healthz` | Cek server aktif (`{ "status": "ok" }`) |
| GET | `/api/healthz/db` | Cek koneksi DB utama + daftar tabel + latency |
| GET | `/api/healthz/db/supabase1` | Ping koneksi Supabase 1 pooler |
| GET | `/api/healthz/db/supabase2` | Ping koneksi Supabase 2 pooler |

`/healthz/db` mengembalikan URL DB dalam bentuk termasking (credential diganti `***`).

---

### Statistik

#### `GET /api/stats`
Total snippet per status, jumlah author unik, jumlah bahasa yang digunakan.

#### `GET /api/stats/languages`
Distribusi bahasa pemrograman dari snippet approved, diurutkan terbanyak.

#### `GET /api/stats/recent`
Snippet terbaru yang approved. Query param: `limit` (default 5, max 20).

---

### Snippets

#### `GET /api/snippets`
Daftar snippet approved dengan paginasi, pencarian, dan filter.

| Query Param | Default | Keterangan |
|---|---|---|
| `page` | 1 | Halaman |
| `limit` | 12 | Max 50 |
| `q` | — | Cari di title, code, description (ILIKE) |
| `language` | — | Filter bahasa |
| `tag` | — | Filter tag |
| `sort` | `newest` | `newest`, `oldest`, `popular`, `copies` |

Response: `{ data: [...], pagination: { page, limit, total, totalPages } }`. Field `authorEmail` selalu dihapus dari response publik.

---

#### `POST /api/snippets`
Submit snippet baru. Status otomatis `pending` menunggu moderasi.

| Field | Tipe | Wajib | Batas |
|---|---|---|---|
| `title` | string | Ya | max 100 |
| `description` | string | Tidak | max 500 |
| `language` | string | Ya | max 50 |
| `tags` | string[] | Tidak | max 10 tag |
| `code` | string | Ya | max 50.000 karakter |
| `authorName` | string | Ya | max 100 |
| `authorEmail` | string | Ya | format email valid |

Setelah insert berhasil, notifikasi dikirim ke bot Telegram secara async (best-effort).

---

#### `GET /api/snippets/popular`
Top 6 snippet berdasarkan viewCount dan top 6 berdasarkan copyCount.

#### `GET /api/snippets/tags`
10 tag terpopuler beserta jumlah penggunaannya.

#### `GET /api/snippets/:id`
Ambil satu snippet approved berdasarkan ID. Snippet pending/rejected → 404.

#### `POST /api/snippets/:id/view`
Tambah 1 ke viewCount. Dipanggil saat halaman detail dibuka.

#### `POST /api/snippets/:id/copy`
Tambah 1 ke copyCount. Dipanggil saat tombol salin diklik.

---

## Endpoint Semi-Private

### Webhook Telegram

Digunakan oleh bot Telegram untuk moderasi langsung dari chat.

**Keamanan:** Header `X-Webhook-Secret` harus cocok dengan secret yang dikonfigurasi di server. Tanpa secret yang benar → 401.

#### `POST /api/snippets/:id/approve`
Ubah status snippet ke `approved`. Tidak mengirim email ke author.

#### `POST /api/snippets/:id/reject`
Ubah status snippet ke `rejected`. Body opsional: `{ "reason": "..." }`.

---

## Endpoint Private / Admin

Semua endpoint admin memerlukan session aktif (cookie `admin_session` yang valid).

Tanpa session → `HTTP 401 { "error": "UNAUTHORIZED", "message": "Not authenticated" }`

### Autentikasi

Login admin menggunakan OTP via email (passwordless). Akses dibatasi untuk email yang sudah terdaftar di konfigurasi server.

#### `GET /api/admin/session`
Cek status session. Response: `{ authenticated: bool, email?, expiresAt? }`.

#### `POST /api/admin/login`
Minta OTP dikirim ke email admin.

- **Rate limit:** 5 req/menit per IP
- Validasi: IP ban, email ban, email harus terdaftar
- OTP: 5 digit, berlaku 5 menit, single-use
- Jika email gagal terkirim, OTP di-rollback dari DB

Body: `{ "email": "..." }`

Error yang mungkin: `IP_BANNED`, `EMAIL_BANNED`, `FORBIDDEN`, `DB_ERROR`, `MAIL_ERROR`

#### `POST /api/admin/verify`
Verifikasi OTP untuk membuat session.

- **Rate limit:** 5 req/menit per IP
- Setelah 5 kali gagal: IP diblokir 24 jam, email diblokir 10 menit

Body: `{ "email": "...", "otp": "12345" }`

Error spesifik: `INVALID_OTP` (tidak ada/tidak cocok), `OTP_USED`, `OTP_EXPIRED`

Jika valid: cookie `admin_session` di-set (HttpOnly, Secure, SameSite=Lax, 24 jam).

#### `POST /api/admin/logout`
Hapus session dari DB dan cookie. Bisa dipanggil meski sudah logout.

---

### Manajemen Snippet

#### `GET /api/admin/pending`
Semua snippet berstatus `pending`, diurutkan terbaru. Limit bawaan 100. `authorEmail` ditampilkan untuk admin.

#### `GET /api/admin/all-snippets`
Semua snippet dengan paginasi. Query params: `status` (opsional), `limit` (max 200), `page`.

#### `POST /api/admin/snippets/:id/approve`
Setujui snippet → status `approved` + email notifikasi ke author.

#### `POST /api/admin/snippets/:id/reject`
Tolak snippet → status `rejected` + email notifikasi ke author. Body: `{ "reason": "..." }`.

#### `PATCH /api/admin/snippets/:id`
Update status secara generik. Body: `{ "status": "approved"|"rejected"|"pending", "rejectReason": "..." }`. Mengirim email jika status approved/rejected.

#### `DELETE /api/admin/snippets/:id`
Hapus permanen snippet. Tidak dapat dibatalkan, tidak ada email notifikasi.

---

### Keamanan / Ban

#### `POST /api/admin/ban-email`
Blokir email. Body: `{ "email", "reason"?, "durationMs"? }` (default durasi: 1 tahun).

#### `GET /api/admin/security/bans`
Daftar semua IP ban dan email ban beserta durasi dan alasannya.

#### `DELETE /api/admin/security/bans/ip/:id`
Hapus IP ban berdasarkan ID record.

#### `DELETE /api/admin/security/bans/email/:id`
Hapus email ban berdasarkan ID record.

---

### Broadcast Email

#### `POST /api/admin/broadcast/all`
Kirim email ke semua author yang pernah submit snippet. Body: `{ "subject", "message", "adminInitial"? }`.

#### `POST /api/admin/broadcast/one`
Kirim email ke satu alamat. Body: `{ "targetEmail", "subject", "message" }`.

#### `GET /api/admin/broadcast-logs`
Riwayat broadcast. Query param: `limit` (default 50, max 200).

#### `POST /api/admin/test-email`
Kirim email test ke email admin yang sedang login.

---

### API Keys

Key disimpan sebagai SHA-256 hash — plaintext hanya tampil **sekali** saat pembuatan.

#### `GET /api/admin/api-keys`
Daftar semua key (hanya prefix yang ditampilkan, bukan hash).

#### `POST /api/admin/api-keys`
Buat key baru. Body: `{ "name", "ownerEmail", "rateLimitPerSecond"?, "rateLimitPerDay"?, "rateLimitPerMonth"? }`.

#### `PATCH /api/admin/api-keys/:id`
Update nama, status aktif, atau rate limit. Semua field opsional.

#### `DELETE /api/admin/api-keys/:id`
Hapus key beserta seluruh data usage-nya.

---

### IP Whitelist

#### `GET /api/admin/ip-whitelist`
Daftar IP yang sudah dicatat.

#### `POST /api/admin/ip-whitelist`
Tambah IP. Body: `{ "ipAddress", "email", "label"? }`.

#### `PATCH /api/admin/ip-whitelist/:id`
Update label atau status aktif.

#### `DELETE /api/admin/ip-whitelist/:id`
Hapus entri dari whitelist.

---

### Request Logs

#### `GET /api/admin/request-logs`
Log semua request ke `/api/*`. Query params: `limit` (default 100, max 500), `blocked=true` untuk filter request yang diblokir saja.

---

## Catatan Keamanan

- **Session:** Cookie `admin_session` berisi UUID plain, bukan JWT. Divalidasi ke DB setiap request.
- **OTP:** 5 digit, single-use, TTL 5 menit. OTP lama dihapus sebelum OTP baru dibuat.
- **Brute-force:** 5 kali gagal → IP ban 24 jam + email ban 10 menit.
- **API Key:** Tidak pernah disimpan plaintext. SHA-256 hash saja yang ada di DB.

---

## Catatan Deployment (Vercel)

- Semua `/api/*` → satu serverless function, timeout 30 detik
- `trust proxy: 1` aktif — IP dari `X-Forwarded-For`
- Background cron (ping Supabase, sync, backup GitHub) hanya aktif selama function instance hidup — tidak ada proses persisten di serverless
- Static assets di-cache 1 tahun (`Cache-Control: public, max-age=31536000, immutable`)

---

## Sistem Background (Internal)

Tidak ada endpoint HTTP — berjalan otomatis di server.

| Proses | Interval | Tujuan |
|---|---|---|
| Ping Supabase | 4 menit | Cegah koneksi pool timeout |
| Sync snippet | 30 menit | Replikasi snippet approved ke Supabase 1 & 2 |
| Backup GitHub | 2 jam | Simpan semua snippet sebagai JSON ke repo GitHub |

Sync menggunakan direct PostgreSQL terlebih dahulu, fallback ke Supabase REST API jika gagal. Batch size: 50 snippet per query.
