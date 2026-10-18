import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    contention: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 100,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<400'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'qf_live_demo_acme_production_key_2026';
const USER_ID = __ENV.USER_ID || 'user_demo_alice'; // Alice has 1000 allowance, max 20 per req

export default function () {
  const requestId = `k6-exhaust-${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    userId: USER_ID,
    units: 15,
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
    'consistent decision returned': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && (body.data.accepted === true || body.data.accepted === false);
      } catch {
        return false;
      }
    },
  });
}
