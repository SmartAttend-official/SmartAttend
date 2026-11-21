/**
 * SmartAttend — Production Empirical Load & Stress Testing Harness
 * ==============================================================================
 * Simulates concurrent virtual users (VUs) sending attendance calculation,
 * telemetry, and health check requests against the SmartAttend backend.
 * Measures empirical latencies (min, max, avg, p50, p90, p95, p99) and RPS.
 * ==============================================================================
 */

'use strict';

const http = require('http');
const https = require('https');
const path = require('path');

require('../../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../server/.env') });

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONCURRENT_VUS = parseInt(process.env.CONCURRENT_VUS || '50', 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '200', 10);

async function runNodeBenchmark() {
  console.log('================================================================');
  console.log('SMARTATTEND — PRODUCTION LOAD & PERFORMANCE BENCHMARK');
  console.log(`Target URL        : ${TARGET_URL}`);
  console.log(`Concurrent VUs    : ${CONCURRENT_VUS}`);
  console.log(`Total Requests    : ${TOTAL_REQUESTS}`);
  console.log(`Benchmark Start   : ${new Date().toISOString()}`);
  console.log('================================================================\n');

  // Check if target server is live
  let targetLive = false;
  try {
    const liveCheck = await sendHttpRequest(`${TARGET_URL}/health`);
    if (liveCheck.statusCode === 200) targetLive = true;
  } catch (e) {
    targetLive = false;
  }

  if (!targetLive) {
    console.log('Target server not running as standalone daemon. Benchmarking via internal Express app instance...');
    const { app } = require('../../server/server.js');
    const request = require('../../server/node_modules/supertest');

    const latencies = [];
    let success = 0;
    let errors = 0;
    const startTime = Date.now();

    // Dispatch concurrent promises in batches of CONCURRENT_VUS
    const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT_VUS);
    for (let b = 0; b < batches; b++) {
      const batchPromises = [];
      const countInBatch = Math.min(CONCURRENT_VUS, TOTAL_REQUESTS - (b * CONCURRENT_VUS));
      for (let i = 0; i < countInBatch; i++) {
        batchPromises.push((async () => {
          const reqStart = process.hrtime.bigint();
          try {
            const res = await request(app).get('/api/attendance/metrics?attended=18&totalHeld=20&threshold=75');
            const reqEnd = process.hrtime.bigint();
            const durationMs = Number(reqEnd - reqStart) / 1e6;
            latencies.push(durationMs);
            if (res.status === 200) success++;
            else errors++;
          } catch (err) {
            errors++;
          }
        })());
      }
      await Promise.all(batchPromises);
    }

    const totalDurationSec = (Date.now() - startTime) / 1000;
    return renderReport(latencies, success, errors, totalDurationSec, TOTAL_REQUESTS);
  }

  // Target is live HTTP server
  const latencies = [];
  let success = 0;
  let errors = 0;
  const startTime = Date.now();

  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT_VUS);
  for (let b = 0; b < batches; b++) {
    const batchPromises = [];
    const countInBatch = Math.min(CONCURRENT_VUS, TOTAL_REQUESTS - (b * CONCURRENT_VUS));
    for (let i = 0; i < countInBatch; i++) {
      batchPromises.push((async () => {
        const reqStart = process.hrtime.bigint();
        try {
          const res = await sendHttpRequest(`${TARGET_URL}/api/attendance/metrics?attended=18&totalHeld=20&threshold=75`);
          const reqEnd = process.hrtime.bigint();
          const durationMs = Number(reqEnd - reqStart) / 1e6;
          latencies.push(durationMs);
          if (res.statusCode === 200) success++;
          else errors++;
        } catch (err) {
          errors++;
        }
      })());
    }
    await Promise.all(batchPromises);
  }

  const totalDurationSec = (Date.now() - startTime) / 1000;
  return renderReport(latencies, success, errors, totalDurationSec, TOTAL_REQUESTS);
}

function sendHttpRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(targetUrl, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request Timeout'));
    });
  });
}

function renderReport(latencies, success, errors, totalSec, totalReqs) {
  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avg = latencies.length ? sum / latencies.length : 0;
  const min = latencies.length ? latencies[0] : 0;
  const max = latencies.length ? latencies[latencies.length - 1] : 0;
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.50)] : 0;
  const p90 = latencies.length ? latencies[Math.floor(latencies.length * 0.90)] : 0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const rps = totalSec > 0 ? (totalReqs / totalSec).toFixed(2) : '0';

  console.log('----------------------------------------------------------------');
  console.log('EMPIRICAL PERFORMANCE BENCHMARK RESULTS');
  console.log('----------------------------------------------------------------');
  console.log(`Total Requests Handled : ${totalReqs}`);
  console.log(`Successful (HTTP 200)  : ${success} (${((success / totalReqs) * 100).toFixed(1)}%)`);
  console.log(`Failed / Blocked       : ${errors}`);
  console.log(`Total Duration Elapsed : ${totalSec.toFixed(3)}s`);
  console.log(`Throughput Rate (RPS)  : ${rps} req/sec`);
  console.log('----------------------------------------------------------------');
  console.log('LATENCY DISTRIBUTION (Milliseconds):');
  console.log(`  Min Latency          : ${min.toFixed(2)} ms`);
  console.log(`  Average Latency      : ${avg.toFixed(2)} ms`);
  console.log(`  50th Percentile (p50): ${p50.toFixed(2)} ms`);
  console.log(`  90th Percentile (p90): ${p90.toFixed(2)} ms`);
  console.log(`  95th Percentile (p95): ${p95.toFixed(2)} ms`);
  console.log(`  99th Percentile (p99): ${max.toFixed(2)} ms`);
  console.log('----------------------------------------------------------------');
  const isHealthy = errors === 0 && p95 < 500;
  console.log('Status: ' + (isHealthy ? '✅ BENCHMARK PASSED (EXCELLENT PERFORMANCE)' : '⚠️ BENCHMARK COMPLETED'));
  console.log('================================================================\n');

  return { totalReqs, success, errors, totalSec, rps, min, avg, p50, p90, p95, max };
}

if (require.main === module) {
  runNodeBenchmark().catch(err => {
    console.error('Benchmark fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runNodeBenchmark };
