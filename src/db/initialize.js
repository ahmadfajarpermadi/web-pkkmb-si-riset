const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.resolve(__dirname, '..', '..');
const databasePath = path.resolve(projectRoot, process.env.DB_PATH || './data/presensi.db');
const schemaPath = path.join(projectRoot, 'schema.sql');

function openDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  return database;
}

function initializeDatabase() {
  const database = openDatabase();
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);
  return database;
}

if (require.main === module) {
  const database = initializeDatabase();
  const journalMode = database.pragma('journal_mode', { simple: true });
  database.close();

  if (journalMode.toLowerCase() !== 'wal') {
    throw new Error(`WAL gagal diaktifkan. Mode database saat ini: ${journalMode}`);
  }

  console.log('Database berhasil diinisialisasi dengan WAL aktif.');
}

module.exports = { initializeDatabase };
