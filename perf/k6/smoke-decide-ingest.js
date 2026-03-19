import http from 'k6/http';
import { check, sleep } from 'k6';
import { setupExperiment } from './common.js';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<60', 'p(99)<120'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export function setup() {
  return setupExperiment(BASE_URL);
}

export default function (data) {
  const subjectId = `smoke-${__VU}-${__ITER}`;

  const decide = http.post(
    `${BASE_URL}/decide`,
    JSON.stringify({
      subjectId,
      attributes: { country: 'RU', platform: 'ios' },
      flagKeys: [data.flagKey],
    }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' },
  );

  check(decide, {
    'decide status 200': (r) => r.status === 200,
    'decide has one decision': (r) => {
      const body = r.json();
      return Array.isArray(body.decisions) && body.decisions.length === 1;
    },
  });

  if (decide.status !== 200) {
    sleep(0.2);
    return;
  }

  const decideBody = decide.json();
  if (!Array.isArray(decideBody?.decisions) || decideBody.decisions.length === 0) {
    sleep(0.2);
    return;
  }

  const decisionId = decideBody.decisions[0].decisionId;

  const ingest = http.post(
    `${BASE_URL}/events/ingest`,
    JSON.stringify({
      events: [
        {
          eventId: `evt-smoke-${subjectId}`,
          eventTypeKey: data.eventTypeKey,
          decisionId,
          subjectId,
          payload: { source: 'k6-smoke' },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' },
  );

  check(ingest, {
    'ingest status 200': (r) => r.status === 200,
    'ingest has accepted >= 1': (r) => {
      const body = r.json();
      return typeof body.accepted === 'number' && body.accepted >= 1;
    },
  });

  sleep(0.1);
}
