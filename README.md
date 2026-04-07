# Kaai Code Snippet

**Platform berbagi kode berkualitas untuk developer Indonesia.**

Dibangun di atas stack modern: React + Vite (frontend), Express v5 (backend), Drizzle ORM + PostgreSQL, dengan sistem moderasi admin, notifikasi email otomatis, auto-sync ke Supabase & GitHub, dan keamanan berlapis.

- **URL Produksi:** `https://codes-snippet.kaai.my.id`
- **Stack:** Node.js v22, TypeScript ESM, Vite, Express v5, Drizzle ORM, PostgreSQL (Supabase pooler)
- **Deploy:** Vercel (serverless function — semua request `/api/*` diarahkan ke satu fungsi `api/index.js`)

---

## Daftar Isi

- [Ringkasan Kategori Endpoint](#ringkasan-kategori-endpoint)
- [Mekanisme Keamanan Global](#mekanisme-keamanan-global)
- [Endpoint Publik](#endpoint-publik)
  - [Health](#health)
  - [Statistik](#statistik)
  - [Snippets (Publik)](#snippets-publik)
- [Endpoint Semi-Private](#endpoint-semi-private)
  - [Webhook Telegram](#webhook-telegram)
- [Endpoint Private / Admin](#endpoint-private--admin)
  - [Autentikasi Admin](#autentikasi-admin)
  - [Manajemen Snippet (Admin)](#manajemen-snippet-admin)
  - [Manajemen Keamanan (Admin)](#manajemen-keamanan-admin)
  - [Broadcast Email (Admin)](#broadcast-email-admin)
  - [API Keys (Admin)](#api-keys-admin)
  - [IP Whitelist (Admin)](#ip-whitelist-admin)
  - [Request Logs (Admin)](#request-logs-admin)
- [Alur Integrasi Antar Endpoint](#alur-integrasi-antar-endpoint)
- [Catatan Keamanan](#catatan-keamanan)
- [Catatan Deployment (Vercel)](#catatan-deployment-vercel)
- [Skema Database](#skema-database)
- [Sistem Background (Cron / Sync)](#sistem-background-cron--sync)

---

## Ringkasan Kategori Endpoint

| Kategori | Jumlah Endpoint | Akses |
|---|---|---|
| Health | 4 | Publik |
| Statistik | 3 | Publik |
| Snippets | 7 | Publik |
| Webhook Telegram | 2 | Semi-private (X-Webhook-Secret) |
| Autentikasi Admin | 4 utama + 5 legacy alias | Admin |
| Manajemen Snippet Admin | 7 | Admin (session) |
| Manajemen Keamanan Admin | 4 | Admin (session) |
| Broadcast Email | 4 | Admin (session) |
| Utilitas Admin | 1 | Admin (session) |
| API Keys | 4 | Admin (session) |
| IP Whitelist | 4 | Admin (session) |
| Request Logs | 1 | Admin (session) |

**Base path semua endpoint:** `/api`

---

## Mekanisme Keamanan Global

Semua request ke `/api/*` melewati lapisan middleware berikut sebelum sampai ke route handler:

### 1. Security Headers (seluruh response)
Diterapkan oleh middleware `securityHeaders`:
- `X-Powered-By` dan `Server` dihapus
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` ketat: `default-src 'self'`, tanpa inline script eksternal

### 2. Global Rate Limit
- **10 request/detik per IP** untuk semua endpoint
- IP diambil dari `X-Forwarded-For` (header pertama) atau `req.socket.remoteAddress`
- Response 429: `{ error: "RATE_LIMITED", message: "Too many requests. Please slow down." }`

### 3. IP Ban Check (login admin)
Untuk endpoint `/api/admin/login` dan `/api/admin/verify`: IP diperiksa terhadap tabel `ip_bans`. IP yang aktif diblokir mendapat response 403.

### 4. Request Logger
Setiap request ke `/api/*` dicatat ke tabel `request_logs` secara asinkron (best-effort, gagal diabaikan). Dicatat: IP, method, path, status code, API key prefix, apakah diblokir, response time, user agent.

### 5. CORS
- `origin: true` (semua origin diizinkan)
- `credentials: true`
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Allowed headers: `Content-Type`, `Authorization`, `X-Webhook-Secret`, `X-API-Key`

---

## Endpoint Publik

Tidak membutuhkan autentikasi apapun.

---

### Health

#### `GET /api/healthz`

**Tujuan:** Cek apakah server berjalan.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{ "status": "ok" }
```

**Catatan:** Tidak menyentuh database. Cocok untuk uptime monitoring.

---

#### `GET /api/healthz/db`

**Tujuan:** Cek koneksi ke database utama (Supabase 2 pooler). Mengembalikan daftar tabel publik dan latency koneksi.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "status": "ok",
  "latencyMs": 45,
  "tables": ["admin_otps", "admin_sessions", "admin_users", "..."],
  "nodeEnv": "production",
  "primaryDb": "postgresql://***@aws-1-ap-northeast-2.pooler.supabase.com:...",
  "supabase1Connected": true,
  "supabase2Connected": true
}
```

**Response error (500):** Jika koneksi gagal, status `"error"` dan pesan error.

**Catatan:**
- `primaryDb` menampilkan URL yang sudah dimasking (credential diganti `***`)
- `supabase1Connected` dan `supabase2Connected` menunjukkan apakah pool koneksi ke masing-masing Supabase berhasil diinisialisasi
- URL primary diambil dari env `DATABASE_SUPABASE_POLLER_URL_2` → fallback `DATABASE_URL`

---

#### `GET /api/healthz/db/supabase1`

**Tujuan:** Ping koneksi langsung ke Supabase 1 pooler (`SELECT 1`).

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{ "status": "ok", "latencyMs": 38 }
```

**Response disabled (503):** Jika env `DATABASE_SUPABASE_POLLER_URL_1` dan `DATABASE_URL_SUPABASE_1` tidak di-set.

**Response error (500):** Jika koneksi gagal.

---

#### `GET /api/healthz/db/supabase2`

**Tujuan:** Ping koneksi langsung ke Supabase 2 pooler (`SELECT 1`).

**Akses:** Publik

**Parameter:** Tidak ada

**Response:** Identik dengan `/healthz/db/supabase1` di atas.

---

### Statistik

#### `GET /api/stats`

**Tujuan:** Statistik agregat platform: jumlah total snippet per status, jumlah author unik, dan jumlah bahasa yang digunakan.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "totalSnippets": 120,
  "pendingSnippets": 5,
  "approvedSnippets": 110,
  "rejectedSnippets": 5,
  "totalAuthors": 48,
  "totalLanguages": 12
}
```

**Response error (500):** `{ "error": "DB_ERROR", "message": "Gagal mengambil statistik" }`

**Keterkaitan:** Digunakan oleh halaman utama frontend untuk menampilkan ringkasan platform.

---

#### `GET /api/stats/languages`

**Tujuan:** Distribusi bahasa pemrograman dari seluruh snippet yang sudah disetujui (approved), diurutkan dari yang terbanyak.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
[
  { "language": "TypeScript", "count": 45 },
  { "language": "Python", "count": 32 }
]
```

**Catatan:** Hanya snippet berstatus `approved` yang dihitung.

---

#### `GET /api/stats/recent`

**Tujuan:** Daftar snippet terbaru yang sudah disetujui.

**Akses:** Publik

**Query params:**
| Param | Tipe | Default | Validasi |
|---|---|---|---|
| `limit` | number | 5 | Max 20 |

**Response sukses (200):** Array snippet (tanpa field `authorEmail`).

**Catatan:** Nilai `limit` di atas 20 akan di-clamp ke 20.

---

### Snippets (Publik)

#### `GET /api/snippets`

**Tujuan:** Daftar snippet yang sudah disetujui, dengan dukungan paginasi, pencarian teks, filter bahasa, filter tag, dan pengurutan.

**Akses:** Publik

**Query params:**
| Param | Tipe | Default | Validasi |
|---|---|---|---|
| `page` | number | 1 | min 1 |
| `limit` | number | 12 | min 1, max 50 |
| `q` | string | — | Pencarian di `title`, `code`, `description` (case-insensitive, ILIKE) |
| `language` | string | — | Filter exact match bahasa |
| `tag` | string | — | Filter tag (PostgreSQL array contains) |
| `sort` | enum | `newest` | `newest`, `oldest`, `popular` (viewCount), `copies` (copyCount) |

**Response sukses (200):**
```json
{
  "data": [ ...snippet objects tanpa authorEmail... ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 110,
    "totalPages": 10
  }
}
```

**Response error (400):** `{ "error": "VALIDATION_ERROR", "message": "Invalid query params" }`

**Catatan:** Field `authorEmail` selalu dihapus dari response publik.

---

#### `POST /api/snippets`

**Tujuan:** Kirim snippet baru untuk dimoderasi. Snippet langsung berstatus `pending`.

**Akses:** Publik

**Body (JSON):**
| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `title` | string | Ya | min 1, max 100 karakter |
| `description` | string | Tidak | max 500 karakter (default `""`) |
| `language` | string | Ya | min 1, max 50 karakter |
| `tags` | string[] | Tidak | max 10 tag (default `[]`) |
| `code` | string | Ya | min 1, max 50.000 karakter |
| `authorName` | string | Ya | min 1, max 100 karakter |
| `authorEmail` | string | Ya | format email valid, max 200 karakter |

**Response sukses (201):** Objek snippet yang baru dibuat (tanpa `authorEmail`).

**Response error (400):** `{ "error": "VALIDATION_ERROR", "issues": [...zod issues...] }`

**Efek samping:**
- Setelah insert berhasil, sistem mengirim notifikasi ke **Telegram bot** via `VITE_BOT_WEBHOOK_URL` secara asinkron (best-effort). Payload yang dikirim: `id`, `nama`, `email`, `namacode`, `tagcode`, `code`.

**ID Generator:** 10 karakter — 5 digit acak + 5 huruf kapital acak (contoh: `48271ABCDE`).

---

#### `GET /api/snippets/popular`

**Tujuan:** Snippet paling banyak dilihat dan paling banyak disalin.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "mostViewed": [ ...6 snippet... ],
  "mostCopied": [ ...6 snippet... ]
}
```

**Catatan:** Masing-masing list berisi maksimal 6 snippet berstatus `approved`.

---

#### `GET /api/snippets/tags`

**Tujuan:** 10 tag terpopuler beserta jumlah penggunaannya dari seluruh snippet approved.

**Akses:** Publik

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "data": [
    { "tag": "react", "count": 24 },
    { "tag": "typescript", "count": 18 }
  ]
}
```

---

#### `GET /api/snippets/:id`

**Tujuan:** Ambil satu snippet berdasarkan ID.

**Akses:** Publik

**Path params:**
| Param | Deskripsi |
|---|---|
| `id` | ID snippet (10 karakter: 5 digit + 5 huruf) |

**Response sukses (200):** Objek snippet (tanpa `authorEmail`).

**Response error (404):** `{ "error": "NOT_FOUND", "message": "Snippet not found" }`

**Catatan:** Hanya snippet berstatus `approved` yang bisa diambil. Snippet `pending` atau `rejected` akan menghasilkan 404.

---

#### `POST /api/snippets/:id/view`

**Tujuan:** Tambah 1 ke `viewCount` snippet. Dipanggil setiap kali halaman detail snippet dibuka.

**Akses:** Publik

**Path params:** `id` — ID snippet

**Body:** Tidak ada

**Response (200):** `{ "success": true }`

**Catatan:** Hanya menghitung snippet berstatus `approved`. Jika ID tidak ada atau status bukan approved, operasi diabaikan (response tetap `{ "success": true }` atau `{ "success": false }` tergantung DB error).

---

#### `POST /api/snippets/:id/copy`

**Tujuan:** Tambah 1 ke `copyCount` snippet. Dipanggil setiap kali tombol salin kode diklik.

**Akses:** Publik

**Path params:** `id` — ID snippet

**Body:** Tidak ada

**Response (200):** `{ "success": true }`

**Catatan:** Perilaku identik dengan `/view` di atas.

---

## Endpoint Semi-Private

Menggunakan shared secret (bukan session cookie dan bukan API key).

---

### Webhook Telegram

Kedua endpoint ini digunakan oleh **bot Telegram** untuk memoderasi snippet secara langsung dari chat Telegram. Bot menerima notifikasi snippet baru, lalu admin bisa approve/reject via perintah bot.

**Mekanisme keamanan:** Header `X-Webhook-Secret` harus cocok dengan nilai env `VITE_WEBHOOK_SECRET`. Jika env tidak di-set, semua request diterima tanpa verifikasi (hanya untuk development).

---

#### `POST /api/snippets/:id/approve`

**Tujuan:** Setujui snippet (ubah status ke `approved`) via webhook bot Telegram.

**Akses:** Semi-private — `X-Webhook-Secret`

**Headers:**
| Header | Deskripsi |
|---|---|
| `X-Webhook-Secret` | Harus cocok dengan env `VITE_WEBHOOK_SECRET` |

**Path params:** `id` — ID snippet

**Body:** Tidak diperlukan

**Response sukses (200):** Objek snippet yang sudah diupdate (tanpa `authorEmail`).

**Response error:**
- `401` — `{ "error": "UNAUTHORIZED" }` jika secret tidak cocok
- `404` — `{ "error": "NOT_FOUND" }` jika snippet tidak ditemukan

**Perbedaan dari endpoint admin:** Endpoint ini **tidak mengirim email notifikasi** ke author. Endpoint admin (`/api/admin/snippets/:id/approve`) yang mengirim email approval.

---

#### `POST /api/snippets/:id/reject`

**Tujuan:** Tolak snippet (ubah status ke `rejected`) via webhook bot Telegram.

**Akses:** Semi-private — `X-Webhook-Secret`

**Headers:**
| Header | Deskripsi |
|---|---|
| `X-Webhook-Secret` | Harus cocok dengan env `VITE_WEBHOOK_SECRET` |

**Path params:** `id` — ID snippet

**Body (JSON, opsional):**
| Field | Tipe | Deskripsi |
|---|---|---|
| `reason` | string | Alasan penolakan (disimpan di field `rejectReason`) |

**Response sukses (200):** Objek snippet yang sudah diupdate.

**Response error:** Sama dengan `/approve` di atas.

---

## Endpoint Private / Admin

Semua endpoint berikut memerlukan **session admin yang valid** (cookie `admin_session` berisi UUID session yang aktif di tabel `admin_sessions`).

Jika tidak terautentikasi, response:
```json
HTTP 401
{ "error": "UNAUTHORIZED", "message": "Not authenticated" }
```

Cookie `admin_session` juga akan dihapus (clearCookie).

---

### Autentikasi Admin

Alur login admin menggunakan **OTP via email** (passwordless):
1. Admin kirim email ke `/api/admin/login` → OTP 5 digit dikirim ke email
2. Admin verifikasi OTP di `/api/admin/verify` → session cookie dibuat
3. Session berlaku **24 jam**

**Admin email yang diizinkan** (hardcoded di kode, tidak bisa diubah via API):
- `akaanakbaik17@proton.me`
- `yaudahpakeaja6@gmail.com`
- `kelvdra46@gmail.com`
- `clpmadang@gmail.com`

---

#### `GET /api/admin/session`

**Tujuan:** Cek apakah session admin saat ini masih valid. Digunakan oleh frontend untuk menentukan apakah perlu redirect ke halaman login.

**Akses:** Dibaca dari cookie — tidak memerlukan autentikasi untuk dipanggil

**Parameter:** Tidak ada (session dibaca dari cookie `admin_session`)

**Response jika terautentikasi (200):**
```json
{
  "authenticated": true,
  "email": "admin@example.com",
  "expiresAt": "2026-04-08T12:00:00.000Z"
}
```

**Response jika tidak terautentikasi (401):**
```json
{ "authenticated": false }
```

---

#### `POST /api/admin/login`

**Tujuan:** Minta OTP dikirim ke email admin.

**Akses:** Publik (tapi dengan rate limit ketat)

**Rate limit:** 5 request/menit per IP (terpisah dari global rate limit 10 req/detik)

**Body (JSON):**
| Field | Tipe | Wajib |
|---|---|---|
| `email` | string | Ya |

**Validasi yang diterapkan:**
1. Email disanitasi: lowercase, trim, karakter non-standar dihapus
2. IP diperiksa terhadap ban list
3. Email diperiksa terhadap ban list
4. Email harus ada di `ALLOWED_ADMIN_EMAILS` — jika tidak, mencatat `login_attempt` dan bisa memicu IP ban

**Proses:**
1. OTP lama untuk email ini dihapus
2. OTP baru (5 digit, format `10000–99999`) dibuat dan disimpan ke `admin_otps` dengan TTL 5 menit
3. Email OTP dikirim via mailer
4. Jika email gagal terkirim, OTP di-rollback (dihapus dari DB)

**Response sukses (200):**
```json
{ "success": true, "message": "OTP dikirim ke email kamu." }
```

**Response error:**
| Status | Error code | Penyebab |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body tidak ada atau email kosong |
| 403 | `IP_BANNED` | IP sedang dalam masa ban |
| 403 | `EMAIL_BANNED` | Email sedang dalam masa ban |
| 403 | `FORBIDDEN` | Email tidak ada dalam daftar admin |
| 500 | `DB_ERROR` | Gagal menyimpan OTP ke database |
| 500 | `MAIL_ERROR` | Gagal mengirim email OTP |

**Legacy alias:** `POST /api/admin/auth/request-otp` (perilaku identik)

---

#### `POST /api/admin/verify`

**Tujuan:** Verifikasi OTP yang telah dikirim ke email. Jika valid, membuat session admin.

**Akses:** Publik (tapi dengan rate limit ketat)

**Rate limit:** 5 request/menit per IP

**Body (JSON):**
| Field | Tipe | Wajib |
|---|---|---|
| `email` | string | Ya |
| `otp` | string | Ya |

**Validasi yang diterapkan:**
1. OTP input dibersihkan: karakter non-digit dihapus, lalu dicocokkan
2. IP diperiksa terhadap ban list
3. Email harus ada di `ALLOWED_ADMIN_EMAILS`
4. OTP terbaru untuk email dicari di DB:
   - Tidak ada OTP → error `INVALID_OTP` + catat failed attempt
   - OTP sudah pernah dipakai (`used = true`) → error `OTP_USED` + catat failed attempt
   - OTP kadaluarsa (`expiresAt <= now`) → error `OTP_EXPIRED` + catat failed attempt
   - OTP tidak cocok → error `INVALID_OTP` + catat failed attempt

**Jika valid:**
1. OTP ditandai `used = true`
2. Failed attempt direset (ban IP/email dibersihkan)
3. Session UUID dibuat, disimpan ke `admin_sessions` dengan expiry 24 jam
4. Cookie `admin_session` di-set: HttpOnly, Secure, SameSite=Lax, expires 24 jam

**Response sukses (200):**
```json
{ "success": true, "email": "admin@example.com" }
```

**Response error:**
| Status | Error code | Penyebab |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Email atau OTP tidak ada di body |
| 403 | `IP_BANNED` | IP sedang dalam masa ban |
| 403 | `FORBIDDEN` | Email tidak terdaftar sebagai admin |
| 401 | `INVALID_OTP` | OTP tidak ditemukan atau tidak cocok |
| 401 | `OTP_USED` | OTP sudah pernah digunakan |
| 401 | `OTP_EXPIRED` | OTP sudah melewati 5 menit |
| 500 | `SERVER_ERROR` | Error DB saat membuat session |

**Sistem ban otomatis:** Setelah **5 kali gagal** dari IP yang sama, IP otomatis diblokir selama 24 jam. Email yang bersangkutan diblokir selama 10 menit.

**Legacy alias:** `POST /api/admin/auth/verify-otp` (perilaku identik)

---

#### `POST /api/admin/logout`

**Tujuan:** Hapus session admin dari database dan hapus cookie.

**Akses:** Tidak perlu session aktif (bisa dipanggil meski sudah logout)

**Body:** Tidak ada

**Proses:** Session ID diambil dari cookie, lalu dihapus dari tabel `admin_sessions`. Cookie `admin_session` dihapus.

**Response (200):** `{ "success": true }`

**Legacy alias:** `POST /api/admin/auth/logout` (perilaku identik)

---

#### `GET /api/admin/auth/me` *(Legacy)*

**Tujuan:** Cek session — versi lama sebelum `/api/admin/session`. Masih tersedia untuk kompatibilitas.

**Akses:** Session cookie

**Response terautentikasi (200):** `{ "email": "...", "expiresAt": "..." }`

**Response tidak terautentikasi (401):** `{ "error": "UNAUTHORIZED" }`

---

### Manajemen Snippet (Admin)

#### `GET /api/admin/pending`

**Tujuan:** Ambil semua snippet berstatus `pending`, diurutkan dari yang terbaru. Digunakan di tab "Pending Review" admin panel.

**Akses:** Admin (session)

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "data": [
    {
      "id": "...", "title": "...", "code": "...", "authorName": "...",
      "authorEmail": "...", "status": "pending", "tags": [], "language": "...",
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

**Catatan:** `authorEmail` **ditampilkan** untuk admin (tidak dihapus). Limit bawaan 100 snippet.

---

#### `GET /api/admin/all-snippets`

**Tujuan:** Ambil semua snippet (semua status) dengan paginasi dan filter status. Digunakan di tab "All Snippets" admin panel.

**Akses:** Admin (session)

**Query params:**
| Param | Tipe | Default | Keterangan |
|---|---|---|---|
| `status` | string | — | Filter: `pending`, `approved`, atau `rejected`. Jika kosong, semua status |
| `limit` | number | 50 | Max 200 |
| `page` | number | 1 | Halaman (min 1) |

**Response sukses (200):**
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 }
}
```

**Legacy alias:** `GET /api/admin/snippets` (perilaku identik)

---

#### `POST /api/admin/snippets/:id/approve`

**Tujuan:** Setujui snippet dari admin panel. Mengubah status ke `approved` dan mengirim **email notifikasi** ke author.

**Akses:** Admin (session)

**Path params:** `id` — ID snippet

**Body:** Tidak ada

**Proses:**
1. Snippet dicari — jika tidak ada, 404
2. Status diubah ke `approved`, `rejectReason` dibersihkan (`null`)
3. Email approval dikirim ke `authorEmail` secara asinkron (best-effort)

**Response sukses (200):** Objek snippet yang sudah diupdate.

**Perbedaan dari webhook Telegram:** Endpoint ini mengirim email notifikasi ke author; webhook Telegram tidak.

---

#### `POST /api/admin/snippets/:id/reject`

**Tujuan:** Tolak snippet dari admin panel. Mengubah status ke `rejected` dan mengirim **email notifikasi** ke author.

**Akses:** Admin (session)

**Path params:** `id` — ID snippet

**Body (JSON):**
| Field | Tipe | Keterangan |
|---|---|---|
| `reason` | string | Alasan penolakan (opsional, disimpan di `rejectReason`) |

**Proses:** Identik dengan `/approve` tapi status jadi `rejected` dan `rejectReason` diisi.

**Response sukses (200):** Objek snippet yang sudah diupdate.

---

#### `PATCH /api/admin/snippets/:id`

**Tujuan:** Update status snippet secara generik (bisa ke `approved`, `rejected`, atau kembali ke `pending`).

**Akses:** Admin (session)

**Path params:** `id` — ID snippet

**Body (JSON):**
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `status` | string | Ya | Harus salah satu: `approved`, `rejected`, `pending` |
| `rejectReason` | string | Tidak | Hanya relevan jika status `rejected` |

**Validasi:** Status selain ketiga nilai di atas mendapat 400.

**Efek samping:** Jika status diubah ke `approved` → email approval dikirim. Jika ke `rejected` → email rejection dikirim. Jika ke `pending` → tidak ada email.

**Response sukses (200):** Objek snippet yang sudah diupdate.

---

#### `DELETE /api/admin/snippets/:id`

**Tujuan:** Hapus permanen snippet dari database.

**Akses:** Admin (session)

**Path params:** `id` — ID snippet

**Body:** Tidak ada

**Response sukses (200):** `{ "success": true }`

**Catatan:** Penghapusan bersifat permanen dan tidak dapat dibatalkan. Tidak ada email notifikasi.

---

### Manajemen Keamanan (Admin)

#### `POST /api/admin/ban-email`

**Tujuan:** Blokir email tertentu agar tidak bisa login sebagai admin selama durasi tertentu.

**Akses:** Admin (session)

**Body (JSON):**
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `email` | string | Ya | Email yang akan diblokir |
| `reason` | string | Tidak | Alasan ban (default: `"Diblokir oleh admin"`) |
| `durationMs` | number | Tidak | Durasi ban dalam milidetik (default: 1 tahun = `365 * 24 * 60 * 60 * 1000`) |

**Proses:** Jika email sudah ada di `email_bans`, data diperbarui (upsert). Email disanitasi sebelum disimpan.

**Response sukses (200):**
```json
{ "success": true, "message": "Email admin@example.com telah diblokir." }
```

---

#### `GET /api/admin/security/bans`

**Tujuan:** Ambil semua IP ban dan email ban yang aktif (termasuk yang sudah expired, belum ada filter aktif).

**Akses:** Admin (session)

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "ipBans": [
    { "id": "...", "ipAddress": "1.2.3.4", "bannedUntil": "...", "reason": "...", "createdAt": "..." }
  ],
  "emailBans": [
    { "id": "...", "email": "...", "bannedUntil": "...", "reason": "...", "createdAt": "..." }
  ]
}
```

---

#### `DELETE /api/admin/security/bans/ip/:id`

**Tujuan:** Hapus IP ban berdasarkan ID record.

**Akses:** Admin (session)

**Path params:** `id` — UUID record di tabel `ip_bans`

**Response (200):** `{ "success": true }`

---

#### `DELETE /api/admin/security/bans/email/:id`

**Tujuan:** Hapus email ban berdasarkan ID record.

**Akses:** Admin (session)

**Path params:** `id` — UUID record di tabel `email_bans`

**Response (200):** `{ "success": true }`

---

### Broadcast Email (Admin)

#### `POST /api/admin/broadcast/all`

**Tujuan:** Kirim email broadcast ke **semua email author** yang pernah submit snippet (distinct `authorEmail` dari seluruh tabel `snippets`, semua status).

**Akses:** Admin (session)

**Body (JSON):**
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `subject` | string | Ya | Subject email |
| `message` | string | Ya | Isi pesan |
| `adminInitial` | string | Tidak | Initial admin pengirim (untuk log) |

**Proses:**
1. Semua distinct `authorEmail` diambil dari DB
2. Email dikirim secara paralel (`Promise.allSettled`)
3. Broadcast dicatat ke tabel `broadcast_logs`

**Response sukses (200):**
```json
{ "success": true, "sent": 45, "failed": 2, "recipientCount": 45 }
```

**Response error (400):** Jika tidak ada penerima ditemukan: `{ "error": "NO_RECIPIENTS", "message": "Tidak ada penerima." }`

---

#### `POST /api/admin/broadcast/one`

**Tujuan:** Kirim email broadcast ke **satu email spesifik**.

**Akses:** Admin (session)

**Body (JSON):**
| Field | Tipe | Wajib |
|---|---|---|
| `targetEmail` | string | Ya |
| `subject` | string | Ya |
| `message` | string | Ya |
| `adminInitial` | string | Tidak |

**Response sukses (200):** `{ "success": true, "sent": 1, "failed": 0, "recipientCount": 1 }`

---

#### `POST /api/admin/broadcast` *(Legacy)*

**Tujuan:** Alias lama yang menggabungkan kedua mode: jika `targetEmail` ada di body → kirim ke satu email; jika tidak ada → kirim ke semua.

**Akses:** Admin (session)

**Catatan:** Tersedia untuk kompatibilitas mundur. Gunakan `/broadcast/all` atau `/broadcast/one` untuk yang baru.

---

#### `GET /api/admin/broadcast-logs`

**Tujuan:** Riwayat semua broadcast email yang pernah dikirim.

**Akses:** Admin (session)

**Query params:**
| Param | Tipe | Default | Max |
|---|---|---|---|
| `limit` | number | 50 | 200 |

**Response sukses (200):**
```json
{
  "data": [
    {
      "id": "...", "adminEmail": "...", "adminInitial": "A",
      "targetEmail": null, "subject": "...", "message": "...",
      "recipientCount": 45, "createdAt": "..."
    }
  ]
}
```

---

#### `POST /api/admin/test-email`

**Tujuan:** Kirim email test ke email admin yang sedang login. Berguna untuk memverifikasi konfigurasi mailer.

**Akses:** Admin (session)

**Body:** Tidak ada

**Proses:** Email test dikirim ke `adminEmail` yang diambil dari session aktif.

**Response sukses (200):** `{ "success": true }`

**Response error (500):** `{ "error": "MAIL_ERROR", "message": "..." }`

---

### API Keys (Admin)

API Key digunakan untuk memberikan akses terprogram ke API (misalnya integrasi eksternal). Key disimpan sebagai SHA-256 hash, sehingga plaintext tidak pernah ada di database. Key hanya ditampilkan sekali saat dibuat.

Format key: `kaai_` + 32 karakter base64url (contoh: `kaai_abc123...`).

Middleware `requireApiKey` di `server/middleware/api-key.ts` memvalidasi header `X-API-Key` (untuk endpoint yang memerlukan API key). Saat ini belum ada endpoint publik yang menggunakan middleware ini — API key dikelola tapi enforcement-nya bisa ditambah di masa depan.

---

#### `GET /api/admin/api-keys`

**Tujuan:** Daftar semua API key yang ada (hash key tidak ditampilkan, hanya prefix).

**Akses:** Admin (session)

**Parameter:** Tidak ada

**Response sukses (200):**
```json
{
  "data": [
    {
      "id": "...", "keyPrefix": "kaai_abc12", "name": "...", "ownerEmail": "...",
      "isActive": true, "rateLimitPerSecond": 10, "rateLimitPerDay": 1000,
      "rateLimitPerMonth": 10000, "totalRequests": 42,
      "lastUsedAt": "...", "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

---

#### `POST /api/admin/api-keys`

**Tujuan:** Buat API key baru. Plaintext key ditampilkan **hanya sekali** dalam response.

**Akses:** Admin (session)

**Body (JSON):**
| Field | Tipe | Wajib | Default |
|---|---|---|---|
| `name` | string | Ya | — |
| `ownerEmail` | string | Ya | — |
| `rateLimitPerSecond` | number | Tidak | 10 |
| `rateLimitPerDay` | number | Tidak | 1000 |
| `rateLimitPerMonth` | number | Tidak | 10000 |

**Response sukses (201):**
```json
{
  "id": "...", "key": "kaai_PLAINTEXT...", "keyPrefix": "kaai_abc12",
  "name": "...", "ownerEmail": "...", "isActive": true,
  "rateLimitPerSecond": 10, "rateLimitPerDay": 1000, "rateLimitPerMonth": 10000,
  "createdAt": "...", "message": "⚠️ Save this key now — it will NOT be shown again."
}
```

---

#### `PATCH /api/admin/api-keys/:id`

**Tujuan:** Update nama, status aktif, atau rate limit API key yang ada.

**Akses:** Admin (session)

**Path params:** `id` — UUID API key

**Body (JSON, semua opsional):**
| Field | Tipe |
|---|---|
| `name` | string |
| `isActive` | boolean |
| `rateLimitPerSecond` | number |
| `rateLimitPerDay` | number |
| `rateLimitPerMonth` | number |

**Response sukses (200):** `{ "id": "...", "name": "...", "isActive": true, "updatedAt": "..." }`

**Response error (404):** Jika ID tidak ditemukan.

---

#### `DELETE /api/admin/api-keys/:id`

**Tujuan:** Hapus API key beserta seluruh data usage-nya.

**Akses:** Admin (session)

**Path params:** `id` — UUID API key

**Proses:** Hapus semua record di `api_key_usage` terlebih dahulu, kemudian hapus key dari `api_keys`.

**Response (200):** `{ "success": true }`

---

### IP Whitelist (Admin)

Tabel `admin_ip_whitelist` menyimpan IP yang sudah diverifikasi milik admin tertentu. Saat ini tabel ini bersifat informatif — enforcement di middleware belum diimplementasikan.

---

#### `GET /api/admin/ip-whitelist`

**Tujuan:** Daftar semua entri IP whitelist.

**Akses:** Admin (session)

**Response sukses (200):** `{ "data": [ { "id", "email", "ipAddress", "label", "isActive", "createdAt" } ] }`

---

#### `POST /api/admin/ip-whitelist`

**Tujuan:** Tambah IP ke whitelist.

**Akses:** Admin (session)

**Body (JSON):**
| Field | Tipe | Wajib |
|---|---|---|
| `ipAddress` | string | Ya |
| `email` | string | Ya |
| `label` | string | Tidak |

**Response sukses (201):** Objek entri yang baru dibuat.

---

#### `PATCH /api/admin/ip-whitelist/:id`

**Tujuan:** Update label atau status aktif entri IP whitelist.

**Akses:** Admin (session)

**Body (JSON, opsional):**
| Field | Tipe |
|---|---|
| `label` | string |
| `isActive` | boolean |

**Response sukses (200):** Objek entri yang sudah diupdate.

---

#### `DELETE /api/admin/ip-whitelist/:id`

**Tujuan:** Hapus entri IP dari whitelist.

**Akses:** Admin (session)

**Response (200):** `{ "success": true }`

---

### Request Logs (Admin)

#### `GET /api/admin/request-logs`

**Tujuan:** Ambil log request API yang dicatat secara otomatis oleh middleware `requestLogger`.

**Akses:** Admin (session)

**Query params:**
| Param | Tipe | Default | Max |
|---|---|---|---|
| `limit` | number | 100 | 500 |
| `blocked` | boolean | — | Jika `"true"`, hanya tampilkan request yang diblokir (status 403 atau 429) |

**Response sukses (200):**
```json
{
  "data": [
    {
      "id": "...", "ipAddress": "...", "method": "POST", "path": "/api/snippets",
      "statusCode": 201, "apiKeyId": null, "apiKeyPrefix": null,
      "blocked": false, "blockReason": null, "responseTimeMs": 45,
      "userAgent": "...", "createdAt": "..."
    }
  ],
  "total": 87
}
```

---

## Alur Integrasi Antar Endpoint

### Alur Submit & Moderasi Snippet

```
[User] POST /api/snippets
    → Snippet disimpan (status: pending)
    → Bot Telegram diberitahu via VITE_BOT_WEBHOOK_URL

[Bot Telegram] — mengirim notifikasi ke grup/channel Telegram admin
    → Admin klik "Approve" di Telegram
    → Bot memanggil POST /api/snippets/:id/approve
       (menggunakan X-Webhook-Secret)
    → Status diubah ke approved (tanpa email ke author)

— ATAU —

[Admin Panel] GET /api/admin/pending
    → Admin klik Approve
    → POST /api/admin/snippets/:id/approve
    → Status diubah ke approved + email dikirim ke author
```

### Alur Login Admin

```
[Admin] POST /api/admin/login { email }
    → OTP 5 digit dikirim ke email
    → OTP disimpan di admin_otps (TTL: 5 menit)

[Admin] POST /api/admin/verify { email, otp }
    → OTP divalidasi (4 kondisi: not found, used, expired, mismatch)
    → Jika valid: session dibuat, cookie admin_session di-set
    → Frontend menyimpan state login dari cookie

[Frontend] GET /api/admin/session
    → Mengecek cookie di setiap load halaman admin
    → Jika 401, redirect ke /admin/login

[Admin] POST /api/admin/logout
    → Session dihapus dari DB, cookie dihapus
```

### Alur Sync Otomatis (Background)

Tidak ada HTTP endpoint — ini adalah proses background internal yang berjalan di server:

| Proses | Interval | Tujuan |
|---|---|---|
| Ping Supabase | Setiap 4 menit | Mencegah koneksi pool timeout (free tier Supabase) |
| Sync ke Supabase 1 & 2 | Setiap 30 menit | Replikasi snippet approved ke kedua instance |
| Backup ke GitHub | Setiap 2 jam | Simpan seluruh snippet sebagai file JSON di repo GitHub |

Sync menggunakan **direct PostgreSQL** terlebih dahulu, fallback ke **Supabase REST API** jika koneksi direct gagal.

---

## Catatan Keamanan

### Session & Cookie

- Cookie `admin_session` berisi UUID session (plain, bukan signed)
- Flag: `HttpOnly`, `Secure`, `SameSite=Lax`, `expires` 24 jam, `path=/`
- `SameSite=Lax` dipilih agar link dari email (misalnya notifikasi) tetap membawa cookie saat navigasi
- Session disimpan di tabel `admin_sessions` dan divalidasi setiap request
- Tidak ada JWT atau token berbasis client-side state

### OTP

- 5 digit numerik (`10000`–`99999`), selalu 5 digit
- Single-use: setelah digunakan sekali, flag `used = true`
- TTL: 5 menit dari waktu pembuatan
- OTP lama dihapus sebelum OTP baru dibuat (tidak bisa akumulasi)
- Jika email gagal terkirim, OTP di-rollback (dihapus dari DB)

### Brute-force Protection

- Rate limit login: **5 request/menit per IP** (terpisah dari global rate limit)
- Setelah **5 kali gagal** dari IP yang sama: IP diblokir **24 jam**
- Email yang dicoba juga diblokir **10 menit**
- Admin bisa hapus ban manual via `/api/admin/security/bans`

### Content Security Policy

CSP ketat diterapkan: `default-src 'self'`, tidak ada CDN eksternal, tidak ada inline script dari sumber luar.

### API Key Hashing

API key tidak pernah disimpan sebagai plaintext. Disimpan sebagai SHA-256 hash. Plaintext hanya tersedia satu kali saat pembuatan.

---

## Catatan Deployment (Vercel)

### Arsitektur

- Semua request ke `/api/*` diarahkan ke satu serverless function: `api/index.js`
- SPA routing: semua request non-`/api` diarahkan ke `index.html`
- Function timeout: 30 detik (konfigurasi `vercel.json`)
- `app.set("trust proxy", 1)` aktif — IP diambil dari `X-Forwarded-For`

### Build Strategy

- `buildCommand: "npm run build"` — build frontend + server
- File server hasil build: `_server/app.cjs` (CommonJS bundle)
- `includeFiles: "_server/**"` — memastikan file server tersedia di runtime Vercel

### Variabel Lingkungan yang Diperlukan

| Env Var | Fungsi |
|---|---|
| `DATABASE_SUPABASE_POLLER_URL_2` | URL PostgreSQL primary (Supabase 2 pooler, ap-northeast-2) |
| `DATABASE_URL` | Fallback URL PostgreSQL |
| `DATABASE_SUPABASE_POLLER_URL_1` | URL PostgreSQL Supabase 1 pooler (opsional) |
| `DATABASE_URL_SUPABASE_1` | Fallback Supabase 1 (opsional) |
| `DATABASE_URL_SUPABASE_2` | Fallback Supabase 2 (opsional) |
| `VITE_BOT_WEBHOOK_URL` | URL endpoint bot Telegram untuk notifikasi snippet baru |
| `VITE_WEBHOOK_SECRET` | Secret shared antara server dan bot Telegram |
| `VITE_SUPABASE_URL_1` | URL REST API Supabase 1 (untuk sync fallback) |
| `VITE_SUPABASE_KEY_1` | Anon/service key Supabase 1 |
| `VITE_SUPABASE_URL_2` | URL REST API Supabase 2 (untuk sync fallback) |
| `VITE_SUPABASE_KEY_2` | Anon/service key Supabase 2 |
| `VITE_GITHUB_TOKEN` | GitHub personal access token untuk backup |
| `VITE_GITHUB_REPO` | Repository GitHub target backup (format: `user/repo`) |
| `SESSION_SECRET` | Secret untuk cookie-parser (opsional — ada fallback, tapi ganti di produksi) |
| `NODE_ENV` | Set ke `production` di Vercel |

### Background Cron di Serverless

Vercel adalah serverless — tidak ada proses background yang berjalan terus-menerus. Cron (`startSyncCron()`) hanya aktif selama function instance hidup. Interval ping, sync, dan backup berjalan selama ada request yang mempertahankan instance aktif, dan akan berhenti jika instance di-cold-start ulang.

---

## Skema Database

Tabel yang dibuat otomatis saat startup (idempotent via `CREATE TABLE IF NOT EXISTS`):

| Tabel | Fungsi |
|---|---|
| `snippets` | Data utama snippet |
| `admin_users` | Daftar email admin yang diizinkan |
| `admin_sessions` | Session login aktif admin |
| `admin_otps` | OTP sementara untuk login admin |
| `ip_bans` | IP yang sedang diblokir |
| `email_bans` | Email yang sedang diblokir |
| `login_attempts` | Counter percobaan login gagal per IP |
| `broadcast_logs` | Riwayat email broadcast yang dikirim |
| `api_keys` | API key (disimpan sebagai hash SHA-256) |
| `api_key_usage` | Counter penggunaan harian/bulanan per API key |
| `request_logs` | Log setiap request ke `/api/*` |
| `admin_ip_whitelist` | Daftar IP yang sudah diverifikasi milik admin |

---

## Sistem Background (Cron / Sync)

Diimplementasikan di `server/lib/sync.ts`, dipanggil via `startSyncCron()` saat server startup.

### Ping Supabase (setiap 4 menit)
Melakukan REST ping ke Supabase 1 dan Supabase 2 untuk mencegah koneksi idle timeout pada free tier.

### Sync Snippet ke Supabase (setiap 30 menit)
- Mengambil semua snippet berstatus `approved` dari DB utama
- Sync ke **Supabase 1**: hanya field publik (tanpa `authorEmail`, tanpa `status`)
- Sync ke **Supabase 2**: semua field termasuk `authorEmail` dan `status`
- Strategi: direct PostgreSQL (`pg` pool) lebih diutamakan, fallback ke REST API Supabase jika gagal
- Batch size: 50 snippet per query

### Backup ke GitHub (setiap 2 jam)
- Mengambil **seluruh** snippet (semua status) dari DB utama
- Serialisasi ke JSON dan di-push ke repository GitHub via GitHub Contents API
- Nama file: `backups/backup-YYYY-MM-DD.json`
- Jika file tanggal yang sama sudah ada, operasi akan gagal (GitHub API menolak PUT tanpa SHA lama) — ini adalah perilaku expected untuk backup harian

### DB Index Otomatis (saat startup)
Membuat index berikut jika belum ada:
- `idx_snippets_status` pada kolom `status`
- `idx_snippets_view_count` pada `view_count DESC`
- `idx_snippets_created_at` pada `created_at DESC`
- `idx_snippets_status_created` pada `(status, created_at DESC)`
