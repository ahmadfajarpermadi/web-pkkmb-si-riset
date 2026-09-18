function logPresensiAttempt(database, request, { npm, eventId = null, hasil }) {
  database.prepare(`
    INSERT INTO log_percobaan (npm, event_id, ip_address, user_agent, hasil)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    npm || null,
    eventId || null,
    request.ip || request.socket.remoteAddress || 'unknown',
    request.get('user-agent') || null,
    hasil,
  );
}

function getRecentIpAnomalies(database) {
  return database.prepare(`
    WITH ip_terflag AS (
      SELECT ip_address, COUNT(DISTINCT npm) AS jumlah_npm, COUNT(*) AS jumlah_percobaan
      FROM log_percobaan
      WHERE waktu >= datetime('now', '-5 minutes') AND npm IS NOT NULL
      GROUP BY ip_address
      HAVING COUNT(DISTINCT npm) > 3
    )
    SELECT log.ip_address, log.npm, log.hasil, log.waktu,
           flag.jumlah_npm, flag.jumlah_percobaan
    FROM log_percobaan AS log
    INNER JOIN ip_terflag AS flag ON flag.ip_address = log.ip_address
    WHERE log.waktu >= datetime('now', '-5 minutes')
    ORDER BY flag.jumlah_npm DESC, log.waktu DESC
  `).all();
}

module.exports = { getRecentIpAnomalies, logPresensiAttempt };
