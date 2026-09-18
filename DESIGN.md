# DESIGN.md — Design System PKKMB HIROSI 2026

Referensi visual untuk seluruh halaman sistem presensi. Ditujukan sebagai acuan implementasi (untuk AI coding agent maupun developer manusia) — bukan cuma mood board.

## 1. Sumber Identitas

Palet dan gaya diturunkan langsung dari logo resmi **PKKMB HIROSI 2026** dan foto dokumentasi kegiatan tahun sebelumnya (bukan warna generik) — supaya sistem terasa seperti bagian dari identitas acara, bukan template presensi umum.

## 2. Palet Warna

| Token | Hex | Pemakaian |
|---|---|---|
| `--maroon-900` | `#4A1214` | Scrim/overlay gelap di atas foto background, teks di atas cream |
| `--maroon-700` | `#7C2328` | Warna brand utama — header, tombol primary, border aksen |
| `--cream-100` | `#F3E9D8` | Background card/form, teks di atas maroon |
| `--gold-500` | `#D9A441` | Aksen signature (bracket QR, status "pending", highlight interaktif) |
| `--ink-900` | `#231A16` | Teks utama di atas cream |
| `--status-verified` | `#3F7D4F` | Khusus status "terverifikasi" — hijau dipakai sebagai pengecualian sengaja, karena butuh sinyal universal "berhasil/go" yang tidak tertukar dengan warna brand |
| `--status-rejected` | `#B23A3A` | Status "ditolak" |

## 3. Tipografi

| Peran | Font | Alasan |
|---|---|---|
| Display (judul besar, header halaman) | **Anton** (Google Fonts) | Karakter blocky-bold-nya senada dengan huruf "PKKMB" di logo — bukan sans generik |
| Aksen/tagline (dipakai sangat terbatas) | **Caveat** (Google Fonts) | Merefleksikan gaya script "Hirosi" di logo — HANYA untuk satu-dua baris tagline, jangan dipakai di UI fungsional (form, tombol, tabel) |
| UI/body (form, tombol, tabel, teks dashboard) | **Plus Jakarta Sans** | Netral, sangat legible di layar kecil — prioritas utama karena dashboard peserta wajib rapi di HP |

## 4. Elemen Signature: Bracket Sudut ala Viewfinder QR

Elemen visual berulang yang jadi ciri khas sistem ini: **empat bracket sudut siku (⌐ ⌐ / ⌐ ⌐)** di warna `--gold-500`, meniru bingkai viewfinder saat scan QR — elemen ini muncul di:
- Empat sudut kartu login
- Sudut kartu status verifikasi di dashboard peserta
- Sudut header setiap section di dashboard panitia

Ini bukan dekorasi acak — langsung merujuk ke aksi inti produk (scan QR), jadi konsisten dipakai di seluruh halaman sebagai penanda visual sistem ini, bukan cuma di halaman scan QR-nya saja.

Jangan tambahkan animasi berlebihan di elemen ini — cukup transisi halus (fade/scale ringan) saat halaman dimuat, tidak perlu efek berkelanjutan (pulsing, dsb) yang mengalihkan perhatian dari konten.

## 5. Layout — Halaman Login

```
┌──────────────────────────────────────────┐
│  [foto dokumentasi PKKMB, b/w, full-bleed]│
│  [scrim gradient maroon-900, dari bawah   │
│   transparan ke atas gelap, untuk kontras]│
│                                            │
│              [logo PKKMB HIROSI 2026]     │
│                                            │
│         ⌐──────────────────⌐              │
│         │  Masuk Peserta    │              │
│         │  NPM  [________]  │              │
│         │  Sandi [_______]  │              │
│         │  [   Masuk    ]   │              │
│         │  Belum punya akun?│              │
│         ⌐──────────────────⌐              │
│                                            │
└──────────────────────────────────────────┘
```

Foto background: gunakan foto dokumentasi kegiatan (bukan foto acara lain/generik) dengan filter b/w yang sudah ada, ditambah scrim gradient supaya form tetap terbaca kontras.

## 6. Layout — Dashboard Peserta (mobile-first, prioritas utama)

Wajib nyaman dibuka di layar HP — didesain mobile-first, baru diperluas untuk desktop, bukan sebaliknya.

```
┌─────────────────────┐
│ [logo kecil]  NPM ▾  │  ← top bar ringkas
├─────────────────────┤
│ ⌐ Template Twibbon⌐  │  ← link ke folder Google Drive
│  [Buka Google Drive] │    (foto + contoh caption)
├─────────────────────┤
│ ⌐ Status Twibbon  ⌐  │
│  ● Pending Review    │  ← pill warna sesuai status
│  Link: instagram...  │
├─────────────────────┤
│  [ Scan QR Presensi ]│  ← CTA besar, disabled +
│   (terkunci sampai   │    penjelasan singkat kalau
│    twibbon verified) │    status belum verified
├─────────────────────┤
│  Riwayat Presensi    │
│  ✓ PKKMB Hari 1       │
│  – PKKMB Hari 2 (blm) │
└─────────────────────┘
```

Prinsip: satu CTA utama per layar (scan QR), status selalu terlihat tanpa perlu scroll, tidak ada elemen dekoratif yang memperlambat load di koneksi seluler venue yang padat.

## 7. Layout — Dashboard Panitia

Lebih data-dense dibanding dashboard peserta (dipakai di laptop/device panitia, bukan prioritas mobile), tapi tetap pakai bracket signature di header tiap section supaya konsisten dengan identitas sistem.

```
⌐ Antrian Verifikasi Twibbon ⌐
┌────────────────────────────────┐
│ NPM | Nama | Link | [✓][✗]      │
│ ... daftar mahasiswa pending    │
└────────────────────────────────┘

⌐ Tampilan QR Venue ⌐        ⌐ Rekap Presensi ⌐
[preview QR + tombol         [jumlah hadir real-
 buka layar penuh]            time, export CSV]
```

## 8. Path Aset (untuk implementasi)

Mockup pratinjau (`login.html`, dsb) memakai gambar asli yang diunggah sebagai pratinjau visual. Untuk implementasi sungguhan, taruh aset di:
- `/public/assets/logo-pkkmb-hirosi-2026.png`
- `/public/assets/bg-pkkmb-dokumentasi.jpg`

## 9. Aksesibilitas & Kualitas Dasar

- Kontras teks di atas foto background wajib dicek (scrim gradient sudah dirancang untuk ini — jangan dihapus demi "foto lebih terlihat")
- Focus state keyboard harus terlihat jelas di semua input & tombol (outline gold, jangan dihilangkan)
- Semua status (pending/verified/rejected) dibedakan lewat warna **DAN** teks/ikon — jangan andalkan warna saja (buta warna)
