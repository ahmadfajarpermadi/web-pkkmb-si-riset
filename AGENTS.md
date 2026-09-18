# AGENTS.md — Panduan untuk AI Coding Agent

Proyek: Sistem Presensi PKKMB (QR dinamis + verifikasi twibbon)
Baca `PRD.md` dulu untuk konteks lengkap sebelum membaca file ini.

## Tech Stack (Rekomendasi)

- **Backend**: Node.js + Express
- **Database**: SQLite (mode **WAL wajib diaktifkan** — `PRAGMA journal_mode=WAL;` saat inisialisasi koneksi), via `better-sqlite3` atau `sequelize`/`prisma` kalau agent lebih familiar dengan ORM
- **Frontend**: server-rendered (EJS/Handlebars) atau SPA ringan — pilih yang paling cepat untuk diimplementasikan dan dijalankan di STB (hindari framework berat yang butuh build step kompleks)
- **QR generation**: library `qrcode` (Node.js) untuk generate, `html5-qrcode` untuk scan di browser
- **Auth**: `bcrypt` untuk hashing password, `express-session` atau JWT — pilih salah satu, konsisten di seluruh app
- **Deployment**: Docker (Dockerfile + docker-compose.yml), diekspos lewat Cloudflare Tunnel yang sudah ada di STB

Alasan pemilihan stack ini: proyek sebelumnya (sistem presensi HIMA) sudah pakai Node.js/Express/SQLite, jadi konsisten dengan environment yang sudah dikenal di STB.

## Struktur Folder yang Disarankan

```
/src
  /routes
    auth-mahasiswa.js
    auth-panitia.js
    twibbon.js
    presensi.js
    qr.js
  /middleware
    require-auth-mahasiswa.js
    require-auth-panitia.js
    rate-limit-log.js
  /services
    hmac-token.js        # generate & verify QR token
    geolocation.js        # hitung jarak Haversine, threshold accuracy
  /db
    schema.sql
    migrations/
  /views
    (halaman EJS/Handlebars)
.env.example
docker-compose.yml
Dockerfile
```

## Aturan Wajib (Non-Negotiable)

1. **Secret HMAC untuk QR token HARUS di env var**, dibaca via `process.env.QR_HMAC_SECRET`. JANGAN PERNAH hardcode di source code atau kirim ke response/frontend dalam bentuk apapun.
2. **Password wajib di-hash** dengan bcrypt (cost factor minimal 10) sebelum disimpan. Jangan pernah log atau kembalikan password (hash sekalipun) di response API manapun.
3. **Validasi geolocation di server, bukan cuma di client.** Client boleh kasih early feedback ("kamu di luar radius"), tapi keputusan final HARUS dicek ulang di server — jangan percaya data lokasi dari client tanpa verifikasi.
4. **One-time lock presensi harus pakai transaksi database atomik** (cek status + insert dalam satu transaction), bukan dua query terpisah (rawan race condition kalau dua request submit bersamaan).
5. **Session mahasiswa dan panitia harus pakai cookie/session key yang berbeda** — jangan satu session store dengan flag role, karena kalau ada bug di middleware, risiko privilege escalation-nya besar.
6. **Endpoint admin (verifikasi twibbon, tampilan QR, rekap) wajib di-guard middleware auth panitia secara eksplisit** di setiap route, jangan asumsikan "sudah aman karena dipanggil dari dashboard".

## Environment Variables yang Dibutuhkan

```
QR_HMAC_SECRET=          # random string panjang, generate sekali, jangan pernah diubah selama event berlangsung
SESSION_SECRET_MAHASISWA=
SESSION_SECRET_PANITIA=
DB_PATH=./data/presensi.db
QR_ROTATION_INTERVAL_SECONDS=25
QR_TOKEN_TOLERANCE_SECONDS=35
```

## Urutan Implementasi yang Disarankan

1. Setup project + schema database (jalankan `schema.sql`, pastikan WAL mode aktif)
2. Auth mahasiswa (registrasi, login) — test dulu sebelum lanjut
3. Auth panitia (login, terpisah dari mahasiswa)
4. Submit twibbon + dashboard verifikasi panitia
5. Generate QR dinamis (endpoint + halaman tampilan)
6. Endpoint presensi (scan + validasi token + geolocation + one-time lock)
7. Rate-limit logging & dashboard anomali
8. Load testing (lihat PRD bagian 8) sebelum deploy ke STB

## Definition of Done per Fitur

Sebelum menandai satu fitur selesai, pastikan:
- [ ] Ada validasi input di server (bukan cuma di frontend)
- [ ] Error case ditangani dengan pesan yang jelas ke user (bukan generic "terjadi kesalahan")
- [ ] Tidak ada secret/credential yang ter-log ke console atau file log
- [ ] Sudah dites manual dengan skenario gagal (token expired, di luar radius, NPM sudah presensi, dst) — bukan cuma happy path

## Hal yang Sengaja TIDAK Diimplementasikan (Jangan Ditambahkan)

- Verifikasi otomatis caption Instagram via API — sudah diputuskan tidak feasible (lihat PRD bagian 7), jangan tambahkan integrasi Meta Graph API tanpa instruksi eksplisit
- Auto-block IP pada anomaly detection — cukup flag untuk review manual
