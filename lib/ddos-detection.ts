import { prisma } from "./prisma";

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const REQUESTS_PER_WINDOW = 100;
const ANOMALY_THRESHOLD = 10; // 10x normal traffic
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const SPIKE_DETECTION_WINDOW = 5 * 60 * 1000; // 5 minutes

export interface DDoSAnalysis {
  isAttack: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  shouldBlock: boolean;
  requestsPerSecond?: number;
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Check if IP is currently blocked
 */
export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const ipLog = await prisma.ipLog.findUnique({
    where: { ipAddress },
  });

  if (!ipLog?.isBlocked) return false;

  // Check if block duration has expired
  if (ipLog.blockedUntil && new Date() > ipLog.blockedUntil) {
    await prisma.ipLog.update({
      where: { ipAddress },
      data: { isBlocked: false, blockedUntil: null },
    });
    return false;
  }

  return true;
}

/**
 * Track IP request and detect DDoS patterns
 */
export async function analyzeRequest(ipAddress: string): Promise<DDoSAnalysis> {
  // Check if already blocked
  if (await isIpBlocked(ipAddress)) {
    return {
      isAttack: true,
      severity: "CRITICAL",
      reason: "IP is currently blocked",
      shouldBlock: true,
    };
  }

  try {
    // Get or create IP log
    let ipLog = await prisma.ipLog.findUnique({
      where: { ipAddress },
    });

    if (!ipLog) {
      ipLog = await prisma.ipLog.create({
        data: { ipAddress },
      });
    }

    // Calculate requests in current window
    const timeSinceLastRequest = Date.now() - ipLog.lastRequest.getTime();
    const isNewWindow = timeSinceLastRequest > RATE_LIMIT_WINDOW;

    let requestCount = isNewWindow ? 1 : ipLog.requestCount + 1;

    // Update IP log
    await prisma.ipLog.update({
      where: { ipAddress },
      data: {
        requestCount,
        lastRequest: new Date(),
      },
    });

    // Analyze request pattern
    const analysis = await detectAnomalies(ipAddress, requestCount, timeSinceLastRequest);

    // If attack detected, log alert and potentially block
    if (analysis.isAttack) {
      await prisma.securityAlert.create({
        data: {
          alertType: analysis.severity === "CRITICAL" ? "DDOS" : "RATE_LIMIT",
          ipAddress,
          severity: analysis.severity,
          description: analysis.reason,
          requestCount,
        },
      });

      if (analysis.shouldBlock) {
        await blockIp(ipAddress, analysis.reason);
      }
    }

    return analysis;
  } catch (error) {
    console.error("DDoS Analysis Error:", error);
    return {
      isAttack: false,
      severity: "LOW",
      reason: "Analysis error",
      shouldBlock: false,
    };
  }
}

/**
 * Detect anomalies in request patterns
 */
async function detectAnomalies(
  ipAddress: string,
  requestCount: number,
  timeSinceLastRequest: number
): Promise<DDoSAnalysis> {
  // Simple rate limiting
  if (requestCount > REQUESTS_PER_WINDOW) {
    return {
      isAttack: true,
      severity: "HIGH",
      reason: `Exceeded rate limit: ${requestCount}/${REQUESTS_PER_WINDOW} requests`,
      shouldBlock: true,
      requestsPerSecond: requestCount / (RATE_LIMIT_WINDOW / 1000),
    };
  }

  // Spike detection - if request rate suddenly increases
  const recentAlerts = await prisma.securityAlert.findMany({
    where: {
      ipAddress,
      createdAt: {
        gte: new Date(Date.now() - SPIKE_DETECTION_WINDOW),
      },
    },
  });

  if (recentAlerts.length > ANOMALY_THRESHOLD) {
    return {
      isAttack: true,
      severity: "CRITICAL",
      reason: `Traffic spike detected: ${recentAlerts.length} alerts in last 5 minutes`,
      shouldBlock: true,
      requestsPerSecond: recentAlerts.length / (SPIKE_DETECTION_WINDOW / 1000),
    };
  }

  // Repeated failed attempts pattern
  const failedAttempts = recentAlerts.filter(
    (a) => a.alertType === "RATE_LIMIT"
  ).length;
  if (failedAttempts >= 5) {
    return {
      isAttack: true,
      severity: "MEDIUM",
      reason: `Repeated rate limit violations: ${failedAttempts} attempts`,
      shouldBlock: true,
    };
  }

  return {
    isAttack: false,
    severity: "LOW",
    reason: "Normal traffic",
    shouldBlock: false,
  };
}

/**
 * Block an IP address
 */
export async function blockIp(ipAddress: string, reason: string): Promise<void> {
  const blockedUntil = new Date(Date.now() + BLOCK_DURATION);

  await prisma.ipLog.update(
    {
      where: { ipAddress },
      data: {
        isBlocked: true,
        blockReason: reason,
        blockedUntil,
      },
    } as any
  );

  console.log(`[SECURITY] IP blocked: ${ipAddress} - ${reason}`);
}

/**
 * Unblock an IP (admin action)
 */
export async function unblockIp(ipAddress: string): Promise<void> {
  await prisma.ipLog.update(
    {
      where: { ipAddress },
      data: {
        isBlocked: false,
        blockReason: null,
        blockedUntil: null,
      },
    } as any
  );

  console.log(`[SECURITY] IP unblocked: ${ipAddress}`);
}

/**
 * Get security dashboard statistics
 */
export async function getSecurityStats() {
  const [
    totalAlerts,
    criticalAlerts,
    blockedIps,
    recentAlerts,
    topAttackerIps,
  ] = await Promise.all([
    prisma.securityAlert.count(),
    prisma.securityAlert.count({
      where: { severity: "CRITICAL" },
    }),
    prisma.ipLog.count({
      where: { isBlocked: true },
    }),
    prisma.securityAlert.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.ipLog.findMany({
      where: { isBlocked: true },
      orderBy: { requestCount: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalAlerts,
    criticalAlerts,
    blockedIps,
    recentAlerts,
    topAttackerIps,
    timestamp: new Date(),
  };
}

/**
 * Get alerts for a specific IP
 */
export async function getIpAlerts(ipAddress: string) {
  return prisma.securityAlert.findMany({
    where: { ipAddress },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/**
 * Resolve a security alert (admin action)
 */
export async function resolveAlert(alertId: string): Promise<void> {
  await prisma.securityAlert.update(
    {
      where: { id: alertId },
      data: { isResolved: true },
    } as any
  );
}
