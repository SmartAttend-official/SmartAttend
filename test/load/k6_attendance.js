/**
 * SmartAttend — k6 Production Load Scenario
 * Usage: k6 run test/load/k6_attendance.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    campus_rush_attendance: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 25 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 }
      ],
      gracefulRampDown: '5s'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05']
  }
};

export default function () {
  const baseUrl = __ENV.TARGET_URL || 'https://smartattend-o2te.onrender.com';
  const res = http.get(`${baseUrl}/api/attendance/metrics?attended=18&totalHeld=20&threshold=75`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has metrics': (r) => r.body.includes('"attendancePercentage"')
  });
  sleep(0.1);
}
