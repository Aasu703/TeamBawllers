import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp, analyzeRequest } from "@/lib/ddos-detection";

/**
 * DDoS Detection Middleware
 * Analyzes incoming requests for attack patterns and blocks suspicious traffic
 */
export async function ddosDetectionMiddleware(req: NextRequest) {
  const clientIp = getClientIp(req.headers);

  // Skip analysis for static assets
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  try {
    // Analyze the request for DDoS patterns
    const analysis = await analyzeRequest(clientIp);

    // If attack detected and blocking is required
    if (analysis.shouldBlock) {
      console.warn(`[DDoS] Blocking request from ${clientIp}: ${analysis.reason}`);

      return NextResponse.json(
        {
          error: "Access Denied",
          message: analysis.severity === "CRITICAL" 
            ? "Your IP has been temporarily blocked due to suspicious activity"
            : "Too many requests. Please try again later.",
          severity: analysis.severity,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // Add security headers to response
    const response = NextResponse.next();
    response.headers.set("X-Client-IP", clientIp);
    response.headers.set("X-DDoS-Check", analysis.isAttack ? "SUSPICIOUS" : "CLEAN");

    return response;
  } catch (error) {
    console.error("DDoS Middleware Error:", error);
    // Don't block on middleware errors, just log
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
