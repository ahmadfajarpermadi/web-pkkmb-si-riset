-- Schema Database — Sistem Presensi PKKMB
-- Aktifkan WAL mode di level koneksi aplikasi, bukan di file ini:
--   PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS mahasiswa (
    npm             TEXT PRIMARY KEY,
    nama            TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    prodi           TEXT NOT NULL,
    link_twibbon    TEXT,
    status_verifikasi TEXT NOT NULL DEFAULT 'belum_submit'
                    CHECK (status_verifikasi IN ('belum_submit', 'pending', 'verified', 'rejected')),
    diverifikasi_oleh TEXT,
    diverifikasi_pada DATETIME,
    dibuat_pada     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diverifikasi_oleh) REFERENCES panitia(id)
);

CREATE TABLE IF NOT EXISTS panitia (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    nama            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'verifikator'
                    CHECK (role IN ('verifikator', 'superadmin')),
    dibuat_pada     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_event      TEXT NOT NULL,
    latitude_venue  REAL NOT NULL,
    longitude_venue REAL NOT NULL,
    radius_meter    INTEGER NOT NULL DEFAULT 100,
    waktu_mulai     DATETIME NOT NULL,
    waktu_selesai   DATETIME NOT NULL,
    status_aktif    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS presensi (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    npm             TEXT NOT NULL,
    event_id        INTEGER NOT NULL,
    waktu_scan      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('berhasil', 'ditolak')),
    alasan_tolak    TEXT,
    FOREIGN KEY (npm) REFERENCES mahasiswa(npm),
    FOREIGN KEY (event_id) REFERENCES event(id),
    UNIQUE (npm, event_id)  -- one-time lock: satu NPM cuma bisa presensi sekali per event
);

CREATE TABLE IF NOT EXISTS log_percobaan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    npm             TEXT,
    event_id        INTEGER,
    ip_address      TEXT NOT NULL,
    user_agent      TEXT,
    hasil           TEXT NOT NULL CHECK (hasil IN ('berhasil', 'token_invalid', 'token_expired', 'di_luar_radius', 'sudah_presensi', 'lainnya')),
    waktu           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presensi_event ON presensi(event_id);
CREATE INDEX IF NOT EXISTS idx_log_percobaan_ip_waktu ON log_percobaan(ip_address, waktu);
CREATE INDEX IF NOT EXISTS idx_mahasiswa_status ON mahasiswa(status_verifikasi);
