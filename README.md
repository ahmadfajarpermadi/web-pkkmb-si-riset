# Sistem Presensi PKKMB HIROSI 2026

## Menjalankan secara lokal

1. Instal dependensi: `npm install`.
2. Salin `.env.example` menjadi `.env`, lalu ganti ketiga secret dengan nilai acak panjang. Jangan gunakan placeholder.
   Isi juga `TWIBBON_TEMPLATE_URL` dengan link folder Google Drive yang berisi template twibbon dan contoh caption.
3. Inisialisasi database: `npm run init-db`.
4. Buat akun panitia lokal:

   ```bash
   npm run create-panitia -- --username admin --nama "Admin PKKMB" --password "password-panjang-minimal-12" --role superadmin
   ```

5. Buat event aktif dengan koordinat dan jadwal sebenarnya:

   ```bash
   npm run create-event -- --nama "PKKMB Hari 1" --latitude -7.801 --longitude 112.01 --radius 100 --mulai "2026-09-01T07:00:00+07:00" --selesai "2026-09-01T16:00:00+07:00"
   ```

6. (Opsional) Buat akun peserta langsung tanpa lewat `data.csv` — berguna untuk akun testing, karena pendaftaran normal mewajibkan NPM ada di daftar peserta:

   ```bash
   npm run create-mahasiswa -- --npm 9999999999 --nama "Peserta Testing" --password "sandi-panjang-test-123"
   ```

   Opsi tambahan: `--prodi "Sistem Informasi"` (default) dan `--status verified` untuk langsung mengaktifkan menu Scan QR Presensi tanpa perlu submit twibbon dan menunggu verifikasi panitia.

7. Jalankan aplikasi: `npm start`, lalu buka `http://localhost:3000`.

Kamera dan geolocation di browser diizinkan pada `localhost`. Jika menguji dari ponsel lewat alamat IP LAN, browser modern biasanya memerlukan HTTPS; gunakan tunnel HTTPS atau sertifikat lokal untuk pengujian tersebut.

## Checklist uji keseluruhan lokal

1. Daftarkan satu NPM dari `data.csv`, login, lalu pastikan dashboard peserta terbuka.
2. Login panitia pada `/panitia/login`, buka antrean twibbon, dan verifikasi submission mahasiswa.
3. Pada akun mahasiswa yang sudah verified, buka `Scan QR Presensi`; pada akun panitia buka `Tampilkan QR venue`.
4. Uji skenario gagal: QR lewat masa berlaku, lokasi di luar radius, twibbon belum verified, dan scan kedua untuk event sama.
5. Buka `/panitia/anomali` setelah beberapa percobaan untuk memastikan data review muncul.

## Load test terisolasi

Perintah berikut tidak menggunakan database `data/presensi.db`. Script membuat database sementara, event aktif, serta peserta verified, menjalankan beban serentak, lalu menghapus semuanya.

```bash
npm run load-test
```

Default menjalankan 30 peserta serentak. Untuk simulasi yang lebih besar:

```bash
# PowerShell
$env:LOAD_TEST_PARTICIPANTS=100; npm run load-test
```

Jalankan bertahap (30, 50, 100) sambil memantau CPU, memori, dan stabilitas service lain pada STB. Hasil dianggap lulus bila `Presensi sukses` sama dengan jumlah peserta dan tidak ada request error.
