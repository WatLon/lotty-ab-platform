import http from 'k6/http';
import { check, sleep } from 'k6';

function asJson(response, context) {
  check(response, {
    [`${context} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  return response.json();
}

function authHeaders(token, extraHeaders) {
  return {
    Authorization: `Bearer ${token}`,
    ...(extraHeaders || {}),
  };
}

function postJson(baseUrl, path, payload, headers) {
  return http.post(`${baseUrl}${path}`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    timeout: '10s',
  });
}

function loginBootstrapAdmin(baseUrl) {
  const email = __ENV.PERF_ADMIN_EMAIL || __ENV.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.com';
  const password = __ENV.PERF_ADMIN_PASSWORD || __ENV.BOOTSTRAP_ADMIN_PASSWORD || 'SecurePass123';
  const configuredToken = __ENV.PERF_BEARER_TOKEN || '';

  if (configuredToken) {
    return configuredToken;
  }

  const auth = asJson(
    postJson(baseUrl, '/auth/login', {
      email,
      password,
    }),
    'bootstrap admin login',
  );

  check(auth, {
    'bootstrap admin login returns accessToken': (body) =>
      typeof body?.accessToken === 'string' && body.accessToken.length > 0,
  });

  return auth.accessToken;
}

function waitForDecideReady(baseUrl, flagKey) {
  const maxAttempts = Number.parseInt(__ENV.PERF_DECIDE_READY_ATTEMPTS || '30', 10);
  const sleepMs = Number.parseInt(__ENV.PERF_DECIDE_READY_SLEEP_MS || '250', 10);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const subjectId = `perf-setup-${Date.now()}-${attempt}`;
    const decide = http.post(
      `${baseUrl}/decide`,
      JSON.stringify({
        subjectId,
        attributes: { country: 'RU', platform: 'ios' },
        flagKeys: [flagKey],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      },
    );

    const statusOk = decide.status === 200;
    if (statusOk) {
      const body = decide.json();
      if (Array.isArray(body?.decisions) && body.decisions.length > 0) {
        check(decide, {
          'setup decide ready status is 200': (r) => r.status === 200,
          'setup decide ready has decision': (r) => {
            const parsed = r.json();
            return Array.isArray(parsed?.decisions) && parsed.decisions.length > 0;
          },
        });
        return true;
      }
    }

    sleep(sleepMs / 1000);
  }

  check(null, {
    'setup decide became ready': () => false,
  });
  return false;
}

export function setupExperiment(baseUrl) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const adminToken = loginBootstrapAdmin(baseUrl);
  const flagKey = `perf_flag_${suffix}`;
  const eventTypeKey = `event.${suffix}.conversion`;

  const flag = asJson(
    postJson(
      baseUrl,
      '/flags',
      {
        key: flagKey,
        valueType: 'STRING',
        defaultValue: 'A',
        description: 'k6 perf flag',
      },
      authHeaders(adminToken),
    ),
    'create flag',
  );

  const experiment = asJson(
    postJson(
      baseUrl,
      '/experiments',
      {
        name: `Perf experiment ${suffix}`,
        description: 'k6 performance harness',
        flagId: flag.id,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
      },
      authHeaders(adminToken),
    ),
    'create experiment',
  );

  check(postJson(baseUrl, `/experiments/${experiment.id}/submit`, {}, authHeaders(adminToken)), {
    'submit experiment status is 200': (r) => r.status === 200,
  });

  check(
    postJson(
      baseUrl,
      `/experiments/${experiment.id}/approve`,
      { comment: 'approved for perf' },
      authHeaders(adminToken),
    ),
    {
      'approve experiment status is 200': (r) => r.status === 200,
    },
  );

  check(postJson(baseUrl, `/experiments/${experiment.id}/start`, {}, authHeaders(adminToken)), {
    'start experiment status is 200': (r) => r.status === 200,
  });

  asJson(
    postJson(
      baseUrl,
      '/event-types',
      {
        key: eventTypeKey,
        name: 'Perf Conversion',
        requiresExposure: false,
      },
      authHeaders(adminToken),
    ),
    'create event type',
  );

  waitForDecideReady(baseUrl, flagKey);

  return {
    flagKey,
    eventTypeKey,
  };
}
