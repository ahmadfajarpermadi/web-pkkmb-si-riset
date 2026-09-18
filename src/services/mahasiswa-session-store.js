const session = require('express-session');

class SqliteSessionStore extends session.Store {
  constructor(database, tableName) {
    super();
    this.database = database;
    this.tableName = tableName;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        sid TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        kadaluarsa INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${tableName}_kadaluarsa
        ON ${tableName}(kadaluarsa);
    `);
  }

  get(sid, callback) {
    try {
      const row = this.database.prepare(
        `SELECT data FROM ${this.tableName} WHERE sid = ? AND kadaluarsa > ?`,
      ).get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, value, callback) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + (value.cookie?.maxAge || 1000 * 60 * 60 * 8);
      this.database.prepare(`
        INSERT INTO ${this.tableName} (sid, data, kadaluarsa) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, kadaluarsa = excluded.kadaluarsa
      `).run(sid, JSON.stringify(value), expiresAt);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.database.prepare(`DELETE FROM ${this.tableName} WHERE sid = ?`).run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, value, callback) {
    this.set(sid, value, callback);
  }
}

function createMahasiswaSessionStore(database) {
  return new SqliteSessionStore(database, 'sesi_mahasiswa');
}

function createPanitiaSessionStore(database) {
  return new SqliteSessionStore(database, 'sesi_panitia');
}

module.exports = { createMahasiswaSessionStore, createPanitiaSessionStore };
