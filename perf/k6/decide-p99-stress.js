import http from 'k6/http';
import { check, sleep } from 'k6';
import { setupExperiment } from './common.js';

const DECIDE_P99_MS = Number.parseInt(__ENV.DECIDE_P99_MS || '120', 10);
const DECIDE_P95_MS = Number.parseInt(__ENV.DECIDE_P95_MS || '60', 10);
const ERROR_RATE_MAX = Number.parseFloat(__ENV.ERROR_RATE_MAX || '0.02');
const SKIP_DECISION_CONTENT_CHECK = (__ENV.SKIP_DECISION_CONTENT_CHECK || '0') === '1';

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 140 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_failed{endpoint:decide}': [`rate<${ERROR_RATE_MAX}`],
    'http_req_duration{endpoint:decide}': [`p(95)<${DECIDE_P95_MS}`, `p(99)<${DECIDE_P99_MS}`],
    'http_req_duration{endpoint:decide,expected_response:true}': [
      `p(95)<${DECIDE_P95_MS}`,
      `p(99)<${DECIDE_P99_MS}`,
    ],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';
const SKIP_SETUP = (__ENV.SKIP_SETUP || '0') === '1';
const FALLBACK_FLAG_KEY = __ENV.FLAG_KEY || 'unknown_perf_flag';

export function setup() {
  if (SKIP_SETUP) {
    return { flagKey: FALLBACK_FLAG_KEY };
  }
  return setupExperiment(BASE_URL);
}

export default function (data) {
  const subjectId = `decide-p99-${__VU}-${__ITER}`;

  const decide = http.post(
    `${BASE_URL}/decide`,
    JSON.stringify({
      subjectId,
      attributes: {
        country: __ITER % 2 === 0 ? 'RU' : 'KZ',
        platform: __ITER % 3 === 0 ? 'android' : 'ios',
        appVersion: '1.7.0',
      },
      flagKeys: [data.flagKey],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
      tags: { endpoint: 'decide' },
    },
  );

  check(decide, {
    'decide status < 500': (r) => r.status < 500,
    'decide response has decisions': (r) => {
      if (SKIP_DECISION_CONTENT_CHECK) return true;
      if (r.status !== 200) return false;
      const body = r.json();
      return Array.isArray(body?.decisions) && body.decisions.length > 0;
    },
  });

  sleep(0.01);
}
