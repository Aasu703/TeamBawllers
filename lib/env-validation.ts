/**
 * Environment variable validation
 * Ensures all required security configurations are present
 */

export interface EnvironmentConfig {
  nodeEnv: "development" | "production" | "test";
  jwtSecret: string;
  databaseUrl: string;
  apiUrl: string;
  allowedOrigins: string[];
  blockedCountries: string[];
  enableMfa: boolean;
  enableGeoBlocking: boolean;
  logSecurityEvents: boolean;
  csrfEnabled: boolean;
}

/**
 * Validate and parse environment variables
 */
export function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = [];

  // NODE_ENV
  const nodeEnv = process.env.NODE_ENV as any;
  if (!["development", "production", "test"].includes(nodeEnv)) {
    errors.push("NODE_ENV must be 'development', 'production', or 'test'");
  }

  // JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push("JWT_SECRET is required");
  }
  if (jwtSecret === "dev-secret-change-me" && nodeEnv === "production") {
    errors.push("JWT_SECRET must be changed in production");
  }

  // DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push("DATABASE_URL is required");
  }

  // API_URL
  const apiUrl = process.env.API_URL || "http://localhost:3000";

  // ALLOWED_ORIGINS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
  if (allowedOrigins.length === 0) {
    errors.push("ALLOWED_ORIGINS must contain at least one origin");
  }

  // Feature flags
  const enableMfa = process.env.ENABLE_MFA === "true";
  const enableGeoBlocking = process.env.ENABLE_GEO_BLOCKING === "true";
  const logSecurityEvents = process.env.LOG_SECURITY_EVENTS !== "false";
  const csrfEnabled = process.env.CSRF_ENABLED !== "false";

  // BLOCKED_COUNTRIES (optional)
  const blockedCountries = (process.env.BLOCKED_COUNTRIES || "").split(",").filter(Boolean);

  if (errors.length > 0) {
    console.error("Environment validation failed:");
    errors.forEach((error) => console.error(`  ❌ ${error}`));

    if (nodeEnv === "production") {
      throw new Error("Environment validation failed in production");
    }
  }

  // Warnings
  if (nodeEnv === "development") {
    console.warn("⚠️  Running in development mode");
    if (!jwtSecret || jwtSecret === "dev-secret-change-me") {
      console.warn("⚠️  Using default JWT secret in development");
    }
  }

  return {
    nodeEnv,
    jwtSecret: jwtSecret || "dev-secret-change-me",
    databaseUrl: databaseUrl || "",
    apiUrl,
    allowedOrigins,
    blockedCountries,
    enableMfa,
    enableGeoBlocking,
    logSecurityEvents,
    csrfEnabled,
  };
}

/**
 * Check if required environment variables are set
 */
export function checkRequiredEnv(...vars: string[]): boolean {
  const missing: string[] = [];

  vars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(", ")}`);
    return false;
  }

  return true;
}

/**
 * Get boolean environment variable safely
 */
export function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Get string environment variable or throw
 */
export function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}

/**
 * Get string environment variable with default
 */
export function getEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

/**
 * Get numeric environment variable
 */
export function getEnvNumber(key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Print security configuration status
 */
export function printSecurityConfig(config: EnvironmentConfig): void {
  console.log("\n🔐 Security Configuration:");
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   JWT Secret: ${config.jwtSecret === "dev-secret-change-me" ? "❌ DEFAULT" : "✅ Set"}`);
  console.log(`   CSRF Protection: ${config.csrfEnabled ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`   MFA: ${config.enableMfa ? "✅ Enabled" : "⏳ Disabled"}`);
  console.log(`   Geo-blocking: ${config.enableGeoBlocking ? "✅ Enabled" : "⏳ Disabled"}`);
  console.log(`   Security Logging: ${config.logSecurityEvents ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`   Allowed Origins: ${config.allowedOrigins.join(", ")}`);
  if (config.blockedCountries.length > 0) {
    console.log(`   Blocked Countries: ${config.blockedCountries.join(", ")}`);
  }
  console.log();
}
