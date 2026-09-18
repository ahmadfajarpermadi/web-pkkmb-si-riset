const express = require('express');
const { getRecentIpAnomalies } = require('../middleware/rate-limit-log');

function createAnomalyRouter(database) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    const anomalies = getRecentIpAnomalies(database);
    return response.render('anomaly-dashboard', { anomalies });
  });

  return router;
}

module.exports = { createAnomalyRouter };
