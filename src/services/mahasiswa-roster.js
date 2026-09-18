const fs = require('fs');
const path = require('path');

const rosterPath = path.resolve(__dirname, '..', '..', 'data.csv');

function getMahasiswaTerdaftar(npm) {
  const rows = fs.readFileSync(rosterPath, 'utf8').trim().split(/\r?\n/).slice(1);
  for (const row of rows) {
    const separator = row.indexOf(',');
    if (separator === -1) continue;
    const nim = row.slice(0, separator).trim();
    const nama = row.slice(separator + 1).trim();
    if (nim === npm) return { npm: nim, nama };
  }
  return null;
}

module.exports = { getMahasiswaTerdaftar };
