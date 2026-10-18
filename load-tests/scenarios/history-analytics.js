import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 15 },
    { duration: '10s', target: 15 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'qf_live_demo_acme_production_key_2026';

export default function () {
  const params = {
    headers: {
      'X-API-Key': API_KEY,
    },
  };

  // 1. History query
  const resHistory = http.get(`${BASE_URL}/api/v1/history?page=1&limit=20`, params);
  check(resHistory, {
    'history status 200': (r) => r.status === 200,
  });

  // 2. Analytics query
  const resAnalytics = http.get(`${BASE_URL}/api/v1/analytics`, params);
  check(resAnalytics, {
    'analytics status 200': (r) => r.status === 200,
  });

  sleep(0.2);
}
