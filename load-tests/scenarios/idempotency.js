import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  iterations: 50,
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || 'qf_live_demo_acme_production_key_2026';
const USER_ID = __ENV.USER_ID || 'user_demo_bob';

export default function () {
  // Re-use an idempotent request ID 3 times per iteration
  const fixedRequestId = `k6-idemp-slot-${__ITER % 5}`;

  const payload = JSON.stringify({
    userId: USER_ID,
    units: 5,
    requestId: fixedRequestId,
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
    'idempotency preserved': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.requestId === fixedRequestId;
      } catch {
        return false;
      }
    },
  });
}
