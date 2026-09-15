// k6 load test for Axiom API
// Run: k6 run tests/load/api-load.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

const llmLatency = new Trend('llm_response_latency_ms')
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { scenario: 'baseline' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      startTime: '1m30s',
      tags: { scenario: 'stress' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      startTime: '3m30s',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // 95% of requests under 5s (LLM calls are slow)
    errors: ['rate<0.05'],  // <5% error rate
  },
}

const DEMO_EMAIL = 'admin@axiom.mx'
const DEMO_PASSWORD = 'axiom12345'

// Login once per VU and reuse session
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(loginRes, {
    'login successful': (r) => r.status === 200 && JSON.parse(r.body).ok === true,
  })

  // Extract cookies from response
  const cookies = loginRes.cookies
  return { cookies }
}

export default function (data) {
  const cookieStr = Object.entries(data.cookies || {})
    .map(([name, c]) => `${name}=${c.value}`)
    .join('; ')

  const headers = {
    'Content-Type': 'application/json',
    Cookie: cookieStr,
  }

  // Test 1: Get profile (cheap)
  const profileRes = http.get(`${BASE_URL}/api/profile`, { headers })
  check(profileRes, {
    'profile status 200': (r) => r.status === 200,
  })

  // Test 2: Get progress (cheap)
  const progressRes = http.get(`${BASE_URL}/api/progress?days=7`, { headers })
  check(progressRes, {
    'progress status 200': (r) => r.status === 200,
  })

  // Test 3: List sessions (cheap)
  const sessionsRes = http.get(`${BASE_URL}/api/modules?limit=5`, { headers })
  check(sessionsRes, {
    'sessions status 200': (r) => r.status === 200,
  })

  // Test 4: Start a conversation session (LLM call — slow)
  // Only do this in baseline scenario to avoid burning through LLM quota
  if (__ENV.SCENARIO === 'baseline' || __ITER < 5) {
    const start = Date.now()
    const startRes = http.post(
      `${BASE_URL}/api/modules`,
      JSON.stringify({
        module: 'conversation',
        mode: 'casual',
        message: 'Hello, I want to practice English',
      }),
      { headers, timeout: '60s' }
    )

    llmLatency.add(Date.now() - start)

    check(startRes, {
      'session started': (r) => r.status === 200,
    })

    if (startRes.status !== 200) {
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  }

  sleep(1)
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results.json': JSON.stringify(data, null, 2),
  }
}

function textSummary(data, opts) {
  return JSON.stringify({
    scenarios: data.scenarios,
    thresholds: data.thresholds,
    metrics: Object.fromEntries(
      Object.entries(data.metrics).filter(([k]) =>
        ['http_req_duration', 'http_reqs', 'errors', 'llm_response_latency_ms'].includes(k)
      )
    ),
  }, null, 2)
}
