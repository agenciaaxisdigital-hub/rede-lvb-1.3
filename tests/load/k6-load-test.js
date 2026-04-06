/*
 * k6 Load Test Script — Rede Política (600 concurrent users)
 *
 * Usage:
 *   k6 run --vus 600 --duration 5m tests/load/k6-load-test.js
 *
 * Environment variables:
 *   K6_SUPABASE_URL       — Supabase project URL
 *   K6_SUPABASE_ANON_KEY  — Supabase anon/publishable key
 *   K6_TEST_EMAIL         — Test user email for login
 *   K6_TEST_PASSWORD      — Test user password
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──
const loginDuration = new Trend('login_duration', true);
const queryDuration = new Trend('query_duration', true);
const errorRate = new Rate('errors');

// ── Options ──
export const options = {
  stages: [
    { duration: '30s', target: 100 },  // ramp up
    { duration: '1m',  target: 300 },  // increase
    { duration: '2m',  target: 600 },  // peak — 600 concurrent
    { duration: '1m',  target: 600 },  // sustain
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95th percentile < 3s
    errors: ['rate<0.05'],              // error rate < 5%
    login_duration: ['p(95)<5000'],     // login p95 < 5s
    query_duration: ['p(95)<2000'],     // query p95 < 2s
  },
};

const BASE_URL = __ENV.K6_SUPABASE_URL || 'https://yvdfdmyusdhgtzfguxbj.supabase.co';
const ANON_KEY = __ENV.K6_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZGZkbXl1c2RoZ3R6Zmd1eGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg4MzksImV4cCI6MjA4OTA3NDgzOX0.-xSNbj5kLibkhJoXmOXjfmYPKBB-gqasQgy322Kk-n4';

const headers = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

export default function () {
  let accessToken = null;

  // ── 1. Login ──
  group('Login', () => {
    const email = __ENV.K6_TEST_EMAIL || 'admin.teste@rede.sarelli.com';
    const password = __ENV.K6_TEST_PASSWORD || '123456';

    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/v1/token?grant_type=password`, JSON.stringify({
      email,
      password,
    }), { headers });

    loginDuration.add(Date.now() - start);

    const ok = check(res, {
      'login status 200': (r) => r.status === 200,
      'login has access_token': (r) => {
        try { return !!JSON.parse(r.body).access_token; } catch { return false; }
      },
    });

    if (!ok) {
      errorRate.add(1);
      return;
    }

    accessToken = JSON.parse(res.body).access_token;
  });

  if (!accessToken) {
    sleep(1);
    return;
  }

  const authHeaders = {
    ...headers,
    'Authorization': `Bearer ${accessToken}`,
  };

  // ── 2. Query municipios ──
  group('Query municipios', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/rest/v1/municipios?select=id,nome&limit=50`, { headers: authHeaders });
    queryDuration.add(Date.now() - start);

    check(res, { 'municipios 200': (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1);
  });

  // ── 3. Query liderancas (paginated) ──
  group('Query liderancas', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/rest/v1/liderancas?select=id,pessoa_id,status&limit=50&offset=0`, { headers: authHeaders });
    queryDuration.add(Date.now() - start);

    check(res, { 'liderancas 200': (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1);
  });

  // ── 4. Query possiveis_eleitores (paginated) ──
  group('Query eleitores', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/rest/v1/possiveis_eleitores?select=id,pessoa_id,compromisso_voto&limit=50&offset=0`, { headers: authHeaders });
    queryDuration.add(Date.now() - start);

    check(res, { 'eleitores 200': (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1);
  });

  // ── 5. Query hierarquia_usuarios (user info) ──
  group('Query hierarquia', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&limit=10`, { headers: authHeaders });
    queryDuration.add(Date.now() - start);

    check(res, { 'hierarquia 200': (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1);
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in summary — this function is for fallback
  return JSON.stringify(data, null, 2);
}
