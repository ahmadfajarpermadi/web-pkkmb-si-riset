# PRD — Sistem Presensi PKKMB (QR Dinamis + Verifikasi Twibbon)

**Status**: Final — siap diimplementasikan
**Target**: PKKMB Prodi Sistem Informasi, UNP Kediri

---

## 1. Ringkasan

Website presensi kehadiran PKKMB yang mensyaratkan dua tahap sebelum mahasiswa bisa presensi di hari-H:

1. Mahasiswa mengunggah bukti postingan twibbon Instagram, diverifikasi panitia
2. Setelah terverifikasi, mahasiswa baru bisa presensi dengan scan QR dinamis yang ditampilkan di venue

Sistem dirancang untuk meminimalkan kecurangan (titip absen, screenshot QR disebar) tanpa bergantung pada API pihak ketiga yang butuh proses approval lama.

## 2. Tujuan

- Mencegah presensi tanpa kehadiran fisik di venue
- Mencegah satu QR/screenshot dipakai berulang oleh banyak orang
- Memverifikasi partisipasi twibbon sebagai syarat presensi
- Berjalan stabil di infrastruktur self-hosted (STB) milik panitia, diakses publik lewat Cloudflare Tunnel

## 3. Non-Tujuan (Out of Scope)

- Verifikasi otomatis penuh terhadap caption/akun Instagram (diblokir oleh kebijakan Meta App Review — lihat bagian 7)
- Mencegah titip absen individual (teman hadir, scan pakai device sendiri atas nama NPM yang tidak hadir) — ini limitasi yang diterima, dimitigasi dengan spot-check visual panitia, bukan tanggung jawab sistem
- Manajemen data akademik di luar presensi PKKMB

## 4. Aktor

| Aktor | Akses |
|---|---|
| Mahasiswa | Login pakai NPM, submit twibbon, scan QR presensi |
| Panitia | Login terpisah, verifikasi twibbon, tampilkan QR venue, lihat rekap presensi |

Akun mahasiswa dan panitia **terpisah total** — tabel database, session, dan halaman login berbeda. Tidak ada kolom `role` tunggal yang menyatukan keduanya.

## 5. Alur Pengguna

### 5.1 Registrasi & Login Mahasiswa
1. Mahasiswa daftar dengan NPM sebagai username + set password
2. Login dengan NPM + password

### 5.2 Submit & Verifikasi Twibbon
1. Setelah login, mahasiswa submit **link URL postingan** Instagram (bukan username, bukan screenshot)
2. Sistem validasi format URL otomatis (regex `instagram.com/p/...` atau `/reel/...`) — menyaring input asal-asalan
3. Submission masuk antrian dengan status `pending`
4. Panitia buka dashboard, lihat daftar antrian, klik link untuk cek manual (cocok nama di caption, mention, hashtag wajib), lalu set status `verified` atau `rejected`
5. Mahasiswa dengan status `rejected` bisa submit ulang

**Format caption wajib** (dicek manual oleh panitia):
- Nama mahasiswa sesuai template caption
- 6 hashtag: `#HelloWorld` `#Satria` `#PKKMB2026` `#HIROSI2026` `#SistemInformasiUNPKediri` `#SIZENIX`
- 7 mention: `@unp.kediri` `@digjayanusantara2026` `@bemunpkediri` `@bemftunpkdr` `@dpm.unpkediri` `@hirosi_unpgrikediri` `@sisteminformasikediri`

### 5.3 Presensi Hari-H
1. Panitia login, buka halaman tampilan QR dinamis (untuk proyektor venue)
2. QR di-generate ulang setiap 25-30 detik oleh server, halaman auto-update via polling (tanpa reload penuh)
3. Mahasiswa (status twibbon = verified) scan QR dari device sendiri
4. Sistem minta izin geolocation (**wajib** — submit ditolak kalau lokasi di luar radius venue atau izin ditolak)
5. Sistem validasi berurutan: signature token valid → timestamp dalam window toleransi → NPM belum pernah presensi di event ini (one-time lock) → jarak ke venue dalam radius
6. Kalau lolos semua → presensi tercatat, tampilkan konfirmasi ke mahasiswa

## 6. Skema Anti-Kecurangan (Detail Teknis)

### 6.1 QR Rotating (HMAC-signed)
- Payload: `{event_id, timestamp, nonce_random}`
- Ditandatangani HMAC-SHA256 dengan secret key yang **hanya ada di server** (env var, tidak pernah dikirim ke client)
- Interval rotasi: **25-30 detik**
- Window toleransi validasi di server: timestamp ±35 detik dari waktu generate (buffer di atas interval rotasi)

### 6.2 Geolocation Wajib
- `navigator.geolocation.getCurrentPosition({enableHighAccuracy: true})`
- Threshold validasi: `jarak_ke_venue <= radius_venue + accuracy_reported` (bukan radius tetap — akomodasi ketidakpastian GPS)
- Izin ditolak / gagal fetch → submit diblokir, tampilkan pesan jelas ke mahasiswa

### 6.3 One-Time Lock per NPM
- Transaksi database atomik: cek status belum presensi + insert record presensi dalam satu transaksi, mencegah race condition kalau ada request bersamaan

### 6.4 Rate-Limit & Anomaly Logging
- Log semua percobaan presensi (berhasil maupun gagal): IP, user-agent, NPM, status hasil
- Flag untuk review manual: satu IP mencoba >3 NPM berbeda dalam 5 menit (indikasi satu device dipakai gantian scan untuk banyak orang)
- Tidak auto-block otomatis (hindari salah blokir WiFi kampus yang IP-nya shared/NAT)

## 7. Kenapa Verifikasi Twibbon Semi-Manual (Bukan Full-Otomatis)

Endpoint resmi Meta untuk baca caption post (`graph.facebook.com/instagram_oembed`) mensyaratkan **App Review** dari Meta — proses ini memakan waktu berminggu-minggu dan tidak cocok untuk timeline persiapan PKKMB. Ini sudah dites langsung dan dikonfirmasi lewat error resmi dari API (`code: 10`, fitur "Meta oEmbed Read" butuh review). Selain itu, field `author_name` sudah dihapus dari API sejak April 2025, jadi bahkan setelah lolos review pun, verifikasi kepemilikan akun tidak bisa sepenuhnya otomatis.

**Keputusan**: verifikasi twibbon dilakukan manual oleh panitia lewat dashboard antrian (lihat 5.2). Opsional untuk masa depan: ajukan App Review sekarang secara paralel supaya PKKMB tahun berikutnya bisa pakai jalur semi-otomatis.

## 8. Deployment & Infrastruktur

- **Host**: STB HG680P milik panitia (Armbian, Docker-based), sudah menjalankan service lain (n8n, AdGuard Home, cloudflared, Tailscale) — perlu dikurangi/dipastikan tidak mengganggu resource untuk sistem ini
- **Exposure**: Cloudflare Tunnel (pola yang sama seperti proyek repo-jayadev sebelumnya), domain subdomain dari `jayadevdigital.my.id`
- **Stabilitas listrik**: STB harus di sumber listrik stabil (idealnya UPS) selama masa presensi hari-H — riwayat Error 1033 cloudflared pernah terjadi setelah power cycle
- **Load testing wajib** sebelum hari-H: simulasi puluhan-ratusan request presensi bersamaan (`k6` / `autocannon`) sambil service lain tetap jalan, untuk memastikan tidak ada bottleneck
- **Rencana cadangan**: panitia tetap siapkan presensi manual sebagai fallback kalau sistem/tunnel down mendadak saat acara berlangsung

## 9. Struktur Data (ringkasan — detail di `schema.sql`)

- `mahasiswa`: NPM, nama, password_hash, prodi, link_twibbon, status_verifikasi
- `panitia`: id, username, password_hash, nama, role
- `event`: id, nama_event, latitude_venue, longitude_venue, radius_meter, waktu_mulai, waktu_selesai
- `presensi`: id, npm (FK), event_id (FK), waktu_scan, latitude, longitude, status, alasan_tolak
- `log_percobaan`: untuk anomaly logging (lihat 6.4)

## 10. Keamanan — Checklist

- [ ] HMAC secret key untuk QR token disimpan di env var, tidak pernah di-hardcode atau terekspos ke frontend
- [ ] Password mahasiswa & panitia di-hash (bcrypt/argon2), tidak pernah disimpan plain text
- [ ] Session mahasiswa dan panitia pakai cookie/token namespace berbeda
- [ ] SQLite (kalau dipakai) diaktifkan mode WAL untuk toleransi concurrent write
- [ ] Endpoint presensi dan endpoint admin dipisah middleware auth-nya secara eksplisit, bukan implisit lewat cek role di dalam handler
