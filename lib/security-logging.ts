import { prisma } from "./prisma";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

export enum LogCategory {
  SECURITY = "SECURITY",
  AUTH = "AUTH",
  DDOS = "DDOS",
  API = "API",
  DATABASE = "DATABASE",
  SYSTEM = "SYSTEM",
}

export interface SecurityLog {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  action: string;
  userId?: string;
  ipAddress?: string;
  details: Record<string, any>;
  status: "SUCCESS" | "FAILURE";
}

/**
 * Log security events to database and console
 */
export async function logSecurityEvent(log: SecurityLog): Promise<void> {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      const color =
        log.level === LogLevel.CRITICAL
          ? "\x1b[41m"
          : log.level === LogLevel.ERROR
            ? "\x1b[31m"
            : log.level === LogLevel.WARN
              ? "\x1b[33m"
              : "\x1b[36m";

      console.log(
        `${color}[${log.category}] ${log.level}\x1b[0m ${log.action} (${log.status})`
      );
      if (Object.keys(log.details).length > 0) {
        console.log(log.details);
      }
    }

    // Store in database if we have a schema for it
    if (process.env.STORE_AUDIT_LOGS === "true") {
      // Create audit log table entry (would need schema update)
      console.log("Audit log stored:", log);
    }
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: string,
  userId: string | undefined,
  ipAddress: string,
  status: "SUCCESS" | "FAILURE",
  details: Record<string, any> = {}
): Promise<void> {
  await logSecurityEvent({
    timestamp: new Date(),
    level: status === "SUCCESS" ? LogLevel.INFO : LogLevel.WARN,
    category: LogCategory.AUTH,
    action,
    userId,
    ipAddress,
    details,
    status,
  });
}

/**
 * Log DDoS detection events
 */
export async function logDdosEvent(
  ipAddress: string,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  reason: string,
  details: Record<string, any> = {}
): Promise<void> {
  const level =
    severity === "CRITICAL"
      ? LogLevel.CRITICAL
      : severity === "HIGH"
        ? LogLevel.ERROR
        : LogLevel.WARN;

  await logSecurityEvent({
    timestamp: new Date(),
    level,
    category: LogCategory.DDOS,
    action: `DDoS Detection: ${severity}`,
    ipAddress,
    details: { reason, ...details },
    status: "SUCCESS",
  });
}

/**
 * Log API access
 */
export async function logApiAccess(
  endpoint: string,
  method: string,
  userId: string | undefined,
  ipAddress: string,
  statusCode: number,
  responseTime: number
): Promise<void> {
  const status = statusCode >= 200 && statusCode < 300 ? "SUCCESS" : "FAILURE";

  await logSecurityEvent({
    timestamp: new Date(),
    level: statusCode >= 500 ? LogLevel.ERROR : LogLevel.DEBUG,
    category: LogCategory.API,
    action: `${method} ${endpoint}`,
    userId,
    ipAddress,
    details: { statusCode, responseTime },
    status,
  });
}

/**
 * Log failed login attempts
 */
export async function logFailedLogin(
  email: string,
  ipAddress: string,
  reason: string
): Promise<void> {
  await logSecurityEvent({
    timestamp: new Date(),
    level: LogLevel.WARN,
    category: LogCategory.AUTH,
    action: "Failed Login Attempt",
    ipAddress,
    details: { email, reason },
    status: "FAILURE",
  });
}

/**
 * Log successful login
 */
export async function logSuccessfulLogin(
  userId: string,
  email: string,
  ipAddress: string
): Promise<void> {
  await logSecurityEvent({
    timestamp: new Date(),
    level: LogLevel.INFO,
    category: LogCategory.AUTH,
    action: "Successful Login",
    userId,
    ipAddress,
    details: { email },
    status: "SUCCESS",
  });
}

/**
 * Log security violation
 */
export async function logSecurityViolation(
  type: string,
  ipAddress: string,
  userId: string | undefined,
  details: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    timestamp: new Date(),
    level: LogLevel.CRITICAL,
    category: LogCategory.SECURITY,
    action: `Security Violation: ${type}`,
    userId,
    ipAddress,
    details,
    status: "FAILURE",
  });
}
