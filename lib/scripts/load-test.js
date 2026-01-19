#!/usr/bin/env node

/**
 * DDoS Load Testing Utility
 * 
 * Use this to test your DDoS detection system locally.
 * DO NOT use against external servers without permission.
 * 
 * Usage: node scripts/load-test.js [options]
 * 
 * Options:
 *   --url <url>           Target URL (default: http://localhost:3000)
 *   --requests <num>      Total requests to send (default: 500)
 *   --concurrent <num>    Concurrent requests (default: 50)
 *   --delay <ms>          Delay between requests in ms (default: 0)
 *   --spike               Simulate traffic spike instead of steady load
 *   --verbose             Verbose output
 */

const http = require("http");
const https = require("https");
const url = require("url");

// Parse arguments
const args = process.argv.slice(2);
const options = {
  url: "http://localhost:3000",
  requests: 500,
  concurrent: 50,
  delay: 0,
  spike: false,
  verbose: false,
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace("--", "");
  const value = args[i + 1];

  if (key === "url") options.url = value;
  if (key === "requests") options.requests = parseInt(value);
  if (key === "concurrent") options.concurrent = parseInt(value);
  if (key === "delay") options.delay = parseInt(value);
  if (key === "spike") options.spike = true;
  if (key === "verbose") options.verbose = true;
}

console.log("🔥 DDoS Load Test Utility");
console.log("=======================");
console.log(`Target: ${options.url}`);
console.log(`Total Requests: ${options.requests}`);
console.log(`Concurrent: ${options.concurrent}`);
console.log(`Delay: ${options.delay}ms`);
console.log(`Mode: ${options.spike ? "SPIKE" : "STEADY"}`);
console.log("=======================\n");

let successCount = 0;
let errorCount = 0;
let blockCount = 0;
let totalTime = 0;
const startTime = Date.now();

function makeRequest() {
  return new Promise((resolve) => {
    const reqTime = Date.now();
    const urlObj = new URL(options.url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.get(options.url, { timeout: 5000 }, (res) => {
      const status = res.statusCode;

      if (status === 429) {
        blockCount++;
        if (options.verbose)
          console.log(
            `⛔ BLOCKED (429): ${status} - ${res.statusMessage}`
          );
      } else if (status >= 200 && status < 400) {
        successCount++;
        if (options.verbose) console.log(`✅ Success (${status})`);
      } else {
        errorCount++;
        if (options.verbose)
          console.log(`❌ Error (${status}): ${res.statusMessage}`);
      }

      totalTime += Date.now() - reqTime;
      res.resume();
      resolve();
    });

    req.on("error", (err) => {
      errorCount++;
      if (options.verbose) console.log(`❌ Error: ${err.message}`);
      resolve();
    });

    req.on("timeout", () => {
      req.destroy();
      errorCount++;
      if (options.verbose) console.log("⏱️ Timeout");
      resolve();
    });
  });
}

async function runLoadTest() {
  let completed = 0;

  for (let batch = 0; batch < options.requests; batch += options.concurrent) {
    const batchSize = Math.min(options.concurrent, options.requests - batch);
    const promises = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          if (options.delay > 0) {
            await new Promise((r) => setTimeout(r, options.delay));
          }
          await makeRequest();
          completed++;

          const progress = Math.round((completed / options.requests) * 100);
          process.stdout.write(
            `\rProgress: ${completed}/${options.requests} (${progress}%) | ✅ ${successCount} | ❌ ${errorCount} | ⛔ ${blockCount}`
          );
        })()
      );
    }

    await Promise.all(promises);
  }

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const requestsPerSecond = options.requests / elapsedSeconds;
  const avgResponseTime = totalTime / options.requests;

  console.log("\n\n📊 Load Test Results");
  console.log("====================");
  console.log(`Total Requests: ${options.requests}`);
  console.log(`Successful: ${successCount} (${((successCount / options.requests) * 100).toFixed(1)}%)`);
  console.log(`Blocked: ${blockCount} (${((blockCount / options.requests) * 100).toFixed(1)}%)`);
  console.log(`Errors: ${errorCount} (${((errorCount / options.requests) * 100).toFixed(1)}%)`);
  console.log(`\nTotal Time: ${elapsedSeconds.toFixed(2)}s`);
  console.log(`Requests/Second: ${requestsPerSecond.toFixed(2)}`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log("====================\n");

  if (blockCount > 0) {
    console.log(
      "🎯 DDoS Detection Triggered! Rate limiting is working correctly."
    );
  } else {
    console.log(
      "⚠️  No blocks detected. You may need to increase concurrent requests."
    );
  }
}

runLoadTest().catch(console.error);
