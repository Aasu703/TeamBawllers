#!/usr/bin/env node

/**
 * DDoS Integration Setup Guide
 * 
 * Run this to verify all components are in place and working
 */

const fs = require("fs");
const path = require("path");

const checks = [
  {
    name: "✅ Prisma Schema Updated",
    check: () => {
      const schema = fs.readFileSync(
        path.join(__dirname, "../prisma/schema.prisma"),
        "utf8"
      );
      return (
        schema.includes("model IpLog") &&
        schema.includes("model SecurityAlert") &&
        schema.includes("model RateLimitRule")
      );
    },
  },
  {
    name: "✅ DDoS Utilities Created",
    check: () =>
      fs.existsSync(path.join(__dirname, "../lib/ddos-detection.ts")),
  },
  {
    name: "✅ DDoS Middleware Created",
    check: () => fs.existsSync(path.join(__dirname, "../lib/ddos-middleware.ts")),
  },
  {
    name: "✅ Security APIs Created",
    check: () =>
      fs.existsSync(path.join(__dirname, "../app/api/security/stats/route.ts")) &&
      fs.existsSync(
        path.join(__dirname, "../app/api/security/alerts/route.ts")
      ) &&
      fs.existsSync(path.join(__dirname, "../app/api/security/block/route.ts")),
  },
  {
    name: "✅ Security Dashboard Created",
    check: () =>
      fs.existsSync(path.join(__dirname, "../app/dashboard/security/page.tsx")),
  },
  {
    name: "✅ Load Test Script Created",
    check: () => fs.existsSync(path.join(__dirname, "./load-test.js")),
  },
];

console.log("\n🛡️  DDoS Detection System - Integration Check\n");
console.log("=".repeat(50) + "\n");

let allPassed = true;
checks.forEach((check) => {
  const passed = check.check();
  console.log(passed ? check.name : check.name.replace("✅", "❌"));
  if (!passed) allPassed = false;
});

console.log("\n" + "=".repeat(50) + "\n");

if (allPassed) {
  console.log("✨ All components installed successfully!\n");
  console.log("📋 Next Steps:\n");
  console.log("1. Run database migration:");
  console.log("   npm run prisma:migrate\n");
  console.log("2. Update your middleware.ts with DDoS detection\n");
  console.log("3. Start your server:");
  console.log("   npm run dev\n");
  console.log("4. Visit security dashboard:");
  console.log("   http://localhost:3000/dashboard/security\n");
  console.log("5. Test DDoS detection:");
  console.log("   node scripts/load-test.js --requests 500 --concurrent 50\n");
} else {
  console.log("❌ Some components are missing!\n");
  console.log("Please check the files were created correctly.\n");
}

console.log("=".repeat(50) + "\n");
