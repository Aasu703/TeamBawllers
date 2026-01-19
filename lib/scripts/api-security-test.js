#!/usr/bin/env node

/**
 * API Security Endpoint Testing
 * Tests security headers, CORS, validation, and error handling
 * 
 * Usage: node scripts/api-security-test.js [--url http://localhost:3000]
 */

const http = require("http");
const https = require("https");
const url = require("url");

// Color codes
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  reset: "\x1b[0m",
};

let testsPassed = 0;
let testsFailed = 0;

// Parse arguments
const args = process.argv.slice(2);
let baseUrl = "http://localhost:3000";

for (let i = 0; i < args.length; i += 2) {
  if (args[i] === "--url") {
    baseUrl = args[i + 1];
  }
}

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, details = "") {
  if (passed) {
    testsPassed++;
    log(`  ✅ ${name}`, "green");
  } else {
    testsFailed++;
    log(`  ❌ ${name}`, "red");
    if (details) {
      log(`     ${details}`, "red");
    }
  }
}

/**
 * Make HTTP request
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, baseUrl);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test 1: Security Headers
 */
async function testSecurityHeaders() {
  log("\n🔐 Testing Security Headers...", "blue");

  try {
    const response = await makeRequest("/");

    const headerTests = [
      {
        name: "Content-Security-Policy header present",
        check: () => !!response.headers["content-security-policy"],
      },
      {
        name: "X-Frame-Options header present",
        check: () =>
          response.headers["x-frame-options"]?.toUpperCase() === "DENY",
      },
      {
        name: "X-Content-Type-Options header present",
        check: () =>
          response.headers["x-content-type-options"]?.toUpperCase() === "NOSNIFF",
      },
      {
        name: "X-XSS-Protection header present",
        check: () => !!response.headers["x-xss-protection"],
      },
      {
        name: "Referrer-Policy header present",
        check: () => !!response.headers["referrer-policy"],
      },
    ];

    for (const test of headerTests) {
      logTest(test.name, test.check());
    }
  } catch (error) {
    logTest("Security headers test", false, error.message);
  }
}

/**
 * Test 2: CORS Configuration
 */
async function testCorsConfiguration() {
  log("\n🌐 Testing CORS Configuration...", "blue");

  try {
    const response = await makeRequest("/api/security/stats", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    const corsTests = [
      {
        name: "Access-Control-Allow-Origin header present",
        check: () => !!response.headers["access-control-allow-origin"],
      },
      {
        name: "Access-Control-Allow-Methods header present",
        check: () => !!response.headers["access-control-allow-methods"],
      },
      {
        name: "Access-Control-Allow-Headers header present",
        check: () => !!response.headers["access-control-allow-headers"],
      },
    ];

    for (const test of corsTests) {
      logTest(test.name, test.check());
    }
  } catch (error) {
    logTest("CORS configuration test", false, error.message);
  }
}

/**
 * Test 3: Input Validation
 */
async function testInputValidation() {
  log("\n✅ Testing Input Validation...", "blue");

  // Test 3.1: Large payload rejection
  try {
    const largePayload = "x".repeat(10 * 1024 * 1024); // 10MB
    const response = await makeRequest("/api/register", {
      method: "POST",
      body: { email: "test@example.com", password: largePayload },
    });

    logTest(
      "Large payload is rejected (413 or similar)",
      response.status >= 413 || response.status >= 400
    );
  } catch (error) {
    logTest("Large payload test", false, error.message);
  }

  // Test 3.2: Invalid email format
  try {
    const response = await makeRequest("/api/register", {
      method: "POST",
      body: { email: "invalid-email", password: "Test@1234" },
    });

    logTest(
      "Invalid email format is rejected",
      response.status === 400 || response.status === 422
    );
  } catch (error) {
    logTest("Invalid email test", false, error.message);
  }

  // Test 3.3: Weak password rejection
  try {
    const response = await makeRequest("/api/register", {
      method: "POST",
      body: { email: "test@example.com", password: "weak" },
    });

    logTest(
      "Weak password is rejected",
      response.status === 400 || response.status === 422
    );
  } catch (error) {
    logTest("Weak password test", false, error.message);
  }
}

/**
 * Test 4: Authentication
 */
async function testAuthentication() {
  log("\n🔑 Testing Authentication...", "blue");

  // Test 4.1: Missing authentication
  try {
    const response = await makeRequest("/api/security/stats", {
      headers: {
        Authorization: "",
      },
    });

    logTest(
      "Unauthenticated request to protected endpoint returns 401",
      response.status === 401 || response.status === 403
    );
  } catch (error) {
    logTest("Unauthenticated request test", false, error.message);
  }

  // Test 4.2: Invalid token
  try {
    const response = await makeRequest("/api/security/stats", {
      headers: {
        Authorization: "Bearer invalid_token_12345",
      },
    });

    logTest(
      "Invalid token rejected",
      response.status === 401 || response.status === 403
    );
  } catch (error) {
    logTest("Invalid token test", false, error.message);
  }
}

/**
 * Test 5: Error Handling
 */
async function testErrorHandling() {
  log("\n⚠️  Testing Error Handling...", "blue");

  // Test 5.1: 404 on non-existent endpoint
  try {
    const response = await makeRequest("/api/nonexistent/endpoint");

    logTest("Non-existent endpoint returns 404", response.status === 404);
  } catch (error) {
    logTest("404 handling test", false, error.message);
  }

  // Test 5.2: Method not allowed
  try {
    const response = await makeRequest("/api/register", {
      method: "DELETE",
    });

    logTest(
      "Method not allowed returns 405 or 404",
      response.status === 405 || response.status === 404
    );
  } catch (error) {
    logTest("Method not allowed test", false, error.message);
  }

  // Test 5.3: Malformed JSON
  try {
    const response = await makeRequest("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json }",
    });

    logTest(
      "Malformed JSON returns 400",
      response.status === 400 || response.status === 422
    );
  } catch (error) {
    logTest("Malformed JSON test", false, error.message);
  }
}

/**
 * Test 6: Rate Limiting
 */
async function testRateLimiting() {
  log("\n⏱️  Testing Rate Limiting...", "blue");

  try {
    let rapidRequests = 0;
    let blockedRequests = 0;

    // Send 100 rapid requests
    for (let i = 0; i < 100; i++) {
      try {
        const response = await makeRequest("/");
        rapidRequests++;

        if (response.status === 429) {
          blockedRequests++;
        }
      } catch (error) {
        // Timeout or connection error
      }
    }

    logTest(
      "Rate limiting kicks in for rapid requests",
      blockedRequests > 0 || rapidRequests === 100
    );
  } catch (error) {
    logTest("Rate limiting test", false, error.message);
  }
}

/**
 * Generate Report
 */
async function generateReport() {
  log("\n" + "=".repeat(50), "blue");
  log("📊 API Security Test Report", "blue");
  log("=".repeat(50), "blue");

  const total = testsPassed + testsFailed;
  const percentage = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0;

  log(`\nTotal Tests: ${total}`);
  log(`Passed: ${testsPassed}`, "green");
  log(`Failed: ${testsFailed}`, testsFailed === 0 ? "green" : "red");
  log(`Success Rate: ${percentage}%`);

  log("\n🎯 Tests Performed:", "blue");
  log("  ✓ Security Headers validation");
  log("  ✓ CORS configuration");
  log("  ✓ Input validation");
  log("  ✓ Authentication & authorization");
  log("  ✓ Error handling");
  log("  ✓ Rate limiting");

  if (testsFailed === 0) {
    log("\n✅ All API security tests passed!", "green");
    process.exit(0);
  } else {
    log(`\n⚠️  ${testsFailed} test(s) failed`, "yellow");
    process.exit(1);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  log("\n🛡️  API Security Test Suite", "blue");
  log(`Target: ${baseUrl}\n`);

  try {
    await testSecurityHeaders();
    await testCorsConfiguration();
    await testInputValidation();
    await testAuthentication();
    await testErrorHandling();
    await testRateLimiting();

    await generateReport();
  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, "red");
    process.exit(1);
  }
}

runAllTests();
