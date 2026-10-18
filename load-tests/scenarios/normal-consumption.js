import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 10 },  // Ramp up
    { duration: '10s', target: 20 }, // Steady state
    { duration: '5s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete under 300ms
    http_req_failed: ['rate<0.01'],   // Error rate below 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'qf_live_demo_acme_production_key_2026';
const USER_ID = __ENV.USER_ID || 'user_demo_bob'; // Bob has 5000 units monthly

export default function () {
  const requestId = `k6-norm-${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    userId: USER_ID,
    units: 5,
    requestId: requestId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  const res = http.post(`${BASE_URL}/api/v1/consume`, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'decision is evaluated': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && typeof body.data.accepted === 'boolean';
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
