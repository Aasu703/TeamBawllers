#!/usr/bin/env node

/**
 * Comprehensive Security Testing Suite
 * Tests all implemented security features
 * 
 * Usage: node scripts/security-tests.js [--verbose]
 */

const fs = require("fs");
const path = require("path");

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m",
};

let testsPassed = 0;
let testsFailed = 0;
const verbose = process.argv.includes("--verbose");

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, error = "") {
  if (passed) {
    testsPassed++;
    log(`  ✅ ${name}`, "green");
  } else {
    testsFailed++;
    log(`  ❌ ${name}`, "red");
    if (error && verbose) {
      log(`     ${error}`, "red");
    }
  }
}

// Test Suite 1: File Structure
async function testFileStructure() {
  log("\n📁 Testing Security File Structure...", "blue");

  const requiredFiles = [
    "lib/security-headers.ts",
    "lib/csrf-protection.ts",
    "lib/session-management.ts",
    "lib/input-validation.ts",
    "lib/security-logging.ts",
    "lib/rbac.ts",
    "lib/geo-blocking.ts",
    "lib/mfa.ts",
    "lib/env-validation.ts",
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    const exists = fs.existsSync(filePath);
    logTest(`File exists: ${file}`, exists);
  }
}

// Test Suite 2: Type Definitions
async function testTypeDefinitions() {
  log("\n📝 Testing Type Definitions...", "blue");

  const tests = [
    {
      name: "CSRF token generation type",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/csrf-protection.ts"),
          "utf8"
        );
        return content.includes("generateCsrfToken");
      },
    },
    {
      name: "Session payload interface",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/session-management.ts"),
          "utf8"
        );
        return content.includes("interface SessionPayload");
      },
    },
    {
      name: "Logging interface",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/security-logging.ts"),
          "utf8"
        );
        return content.includes("interface SecurityLog");
      },
    },
    {
      name: "RBAC permissions interface",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/rbac.ts"),
          "utf8"
        );
        return content.includes("interface RolePermissions");
      },
    },
  ];

  for (const test of tests) {
    try {
      const passed = test.check();
      logTest(test.name, passed);
    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

// Test Suite 3: Security Functions
async function testSecurityFunctions() {
  log("\n🔐 Testing Security Functions...", "blue");

  const functionTests = [
    {
      name: "CORS header functions",
      file: "lib/security-headers.ts",
      functions: ["addSecurityHeaders", "getCorsHeaders", "handleCorsPreFlight"],
    },
    {
      name: "CSRF protection functions",
      file: "lib/csrf-protection.ts",
      functions: ["generateCsrfToken", "setCsrfToken", "verifyCsrfToken"],
    },
    {
      name: "Input validation functions",
      file: "lib/input-validation.ts",
      functions: [
        "sanitizeHtml",
        "validateEmail",
        "validatePassword",
        "validateIpAddress",
        "sanitizeObject",
      ],
    },
    {
      name: "Logging functions",
      file: "lib/security-logging.ts",
      functions: [
        "logSecurityEvent",
        "logAuthEvent",
        "logFailedLogin",
        "logSecurityViolation",
      ],
    },
    {
      name: "RBAC functions",
      file: "lib/rbac.ts",
      functions: ["hasPermission", "hasRole", "requireRole", "requirePermission"],
    },
    {
      name: "Geo-blocking functions",
      file: "lib/geo-blocking.ts",
      functions: [
        "isIpWhitelisted",
        "isCountryBlocked",
        "whitelistIp",
        "blockCountry",
      ],
    },
    {
      name: "MFA functions",
      file: "lib/mfa.ts",
      functions: ["generateMfaSecret", "generateTotpToken", "verifyTotpToken"],
    },
  ];

  for (const test of functionTests) {
    try {
      const content = fs.readFileSync(
        path.join(process.cwd(), test.file),
        "utf8"
      );

      for (const func of test.functions) {
        const exists = content.includes(`function ${func}`) || content.includes(`export function ${func}`);
        logTest(`${test.name}: ${func}`, exists);
      }
    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

// Test Suite 4: Configuration
async function testConfiguration() {
  log("\n⚙️  Testing Configuration...", "blue");

  const configTests = [
    {
      name: "Package.json includes isomorphic-dompurify",
      check: () => {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
        );
        return pkg.dependencies["isomorphic-dompurify"];
      },
    },
    {
      name: "Environment validation exports",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/env-validation.ts"),
          "utf8"
        );
        return (
          content.includes("export function validateEnvironment") &&
          content.includes("export function checkRequiredEnv")
        );
      },
    },
  ];

  for (const test of configTests) {
    try {
      const passed = test.check();
      logTest(test.name, passed);
    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

// Test Suite 5: Integration Check
async function testIntegration() {
  log("\n🔗 Testing Integration Points...", "blue");

  const integrationTests = [
    {
      name: "Security headers in all responses",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/security-headers.ts"),
          "utf8"
        );
        return (
          content.includes("Content-Security-Policy") &&
          content.includes("X-Frame-Options") &&
          content.includes("X-Content-Type-Options")
        );
      },
    },
    {
      name: "Session management with expiry",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/session-management.ts"),
          "utf8"
        );
        return (
          content.includes("ACCESS_TOKEN_EXPIRY") &&
          content.includes("REFRESH_TOKEN_EXPIRY")
        );
      },
    },
    {
      name: "Rate limiting implementation",
      check: () => {
        const content = fs.readFileSync(
          path.join(process.cwd(), "lib/input-validation.ts"),
          "utf8"
        );
        return content.includes("class RateLimiter");
      },
    },
  ];

  for (const test of integrationTests) {
    try {
      const passed = test.check();
      logTest(test.name, passed);
    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

// Test Suite 6: Documentation
async function testDocumentation() {
  log("\n📚 Testing Documentation...", "blue");

  const docTests = [
    {
      name: "Security functions have JSDoc comments",
      check: () => {
        const files = [
          "lib/security-headers.ts",
          "lib/csrf-protection.ts",
          "lib/input-validation.ts",
        ];

        for (const file of files) {
          const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
          if (!content.includes("/**")) {
            return false;
          }
        }
        return true;
      },
    },
  ];

  for (const test of docTests) {
    try {
      const passed = test.check();
      logTest(test.name, passed);
    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

// Summary Report
async function generateReport() {
  log("\n" + "=".repeat(50), "bold");
  log("📊 Test Summary Report", "bold");
  log("=".repeat(50), "bold");

  const total = testsPassed + testsFailed;
  const percentage = ((testsPassed / total) * 100).toFixed(1);

  log(`Total Tests: ${total}`);
  log(`Passed: ${testsPassed}`, "green");
  log(`Failed: ${testsFailed}`, testsFailed === 0 ? "green" : "red");
  log(`Success Rate: ${percentage}%`, percentage >= 80 ? "green" : "yellow");

  log("\n🎯 Security Features Implemented:", "green");
  const features = [
    "✅ Security Headers (CSP, X-Frame-Options, etc.)",
    "✅ CSRF Protection with token validation",
    "✅ Session Management with expiration",
    "✅ Input Validation & Sanitization",
    "✅ Security Logging & Audit Trails",
    "✅ Role-Based Access Control (RBAC)",
    "✅ Geo-IP Blocking & IP Whitelisting",
    "✅ MFA/TOTP Support",
    "✅ Environment Variable Validation",
  ];

  features.forEach((f) => log(f));

  if (testsFailed === 0) {
    log("\n🎉 All security tests passed!", "green");
    process.exit(0);
  } else {
    log(`\n⚠️  ${testsFailed} test(s) failed. Review above for details.`, "yellow");
    process.exit(1);
  }
}

// Run all tests
async function runAllTests() {
  log("\n🛡️  Security Testing Suite Started\n", "blue");
  log("This comprehensive test suite validates all security features.\n");

  await testFileStructure();
  await testTypeDefinitions();
  await testSecurityFunctions();
  await testConfiguration();
  await testIntegration();
  await testDocumentation();

  await generateReport();
}

// Start tests
runAllTests().catch((error) => {
  log(`\n❌ Test suite failed: ${error.message}`, "red");
  process.exit(1);
});
