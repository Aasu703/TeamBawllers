import { prisma } from "./prisma";

export interface GeoIpData {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface IpWhitelistEntry {
  id?: string;
  ipAddress: string;
  reason: string;
  expiresAt?: Date;
  createdAt?: Date;
}

export interface CountryBlockRule {
  id?: string;
  countryCode: string;
  reason: string;
  createdAt?: Date;
}

/**
 * In-memory store for whitelisted IPs (would use database in production)
 */
const whitelist = new Map<string, IpWhitelistEntry>();

/**
 * In-memory store for blocked countries (would use database in production)
 */
const blockedCountries = new Set<string>();

/**
 * Initialize with environment blocklist
 */
export function initializeGeoBlocking(): void {
  const blockedCountriesEnv = process.env.BLOCKED_COUNTRIES || "";
  if (blockedCountriesEnv) {
    blockedCountriesEnv.split(",").forEach((country) => {
      blockedCountries.add(country.trim().toUpperCase());
    });
  }
}

/**
 * Get GeoIP data from IP address (using free API)
 */
export async function getGeoIpData(ipAddress: string): Promise<GeoIpData | null> {
  if (ipAddress === "localhost" || ipAddress === "127.0.0.1" || ipAddress === "unknown") {
    return {
      country: "LOCAL",
      region: "LOCAL",
      city: "LOCAL",
      latitude: 0,
      longitude: 0,
    };
  }

  try {
    // Using free IP geolocation API
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      country: data.country_name || "UNKNOWN",
      region: data.region || "UNKNOWN",
      city: data.city || "UNKNOWN",
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
    };
  } catch (error) {
    console.error("Failed to get GeoIP data:", error);
    return null;
  }
}

/**
 * Check if IP is whitelisted
 */
export async function isIpWhitelisted(ipAddress: string): Promise<boolean> {
  // Check in-memory store
  const entry = whitelist.get(ipAddress);
  if (entry) {
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      whitelist.delete(ipAddress);
      return false;
    }
    return true;
  }

  // Check database if available
  try {
    if (prisma) {
      // Would need IpWhitelist table in schema
      // const dbEntry = await prisma.ipWhitelist.findUnique({
      //   where: { ipAddress }
      // });
      // return !!dbEntry;
    }
  } catch {
    // Fallback to in-memory
  }

  return false;
}

/**
 * Check if country is blocked
 */
export async function isCountryBlocked(country: string): Promise<boolean> {
  return blockedCountries.has(country.toUpperCase());
}

/**
 * Add IP to whitelist
 */
export async function whitelistIp(
  ipAddress: string,
  reason: string,
  expiresAt?: Date
): Promise<void> {
  whitelist.set(ipAddress, {
    ipAddress,
    reason,
    expiresAt,
    createdAt: new Date(),
  });

  console.log(`IP whitelisted: ${ipAddress} (${reason})`);
}

/**
 * Remove IP from whitelist
 */
export async function removeFromWhitelist(ipAddress: string): Promise<void> {
  whitelist.delete(ipAddress);
  console.log(`IP removed from whitelist: ${ipAddress}`);
}

/**
 * Block country
 */
export async function blockCountry(countryCode: string, reason: string): Promise<void> {
  blockedCountries.add(countryCode.toUpperCase());
  console.log(`Country blocked: ${countryCode} (${reason})`);
}

/**
 * Unblock country
 */
export async function unblockCountry(countryCode: string): Promise<void> {
  blockedCountries.delete(countryCode.toUpperCase());
  console.log(`Country unblocked: ${countryCode}`);
}

/**
 * Get all blocked countries
 */
export function getBlockedCountries(): string[] {
  return Array.from(blockedCountries);
}

/**
 * Check if IP should be blocked based on geography
 */
export async function checkGeoRestrictions(ipAddress: string): Promise<{
  blocked: boolean;
  reason?: string;
}> {
  // Check whitelist first
  if (await isIpWhitelisted(ipAddress)) {
    return { blocked: false };
  }

  // Get GeoIP data
  const geoData = await getGeoIpData(ipAddress);
  if (!geoData) {
    return { blocked: false };
  }

  // Check if country is blocked
  if (await isCountryBlocked(geoData.country)) {
    return {
      blocked: true,
      reason: `Country ${geoData.country} is blocked`,
    };
  }

  return { blocked: false };
}

/**
 * Get all whitelisted IPs
 */
export function getWhitelistedIps(): IpWhitelistEntry[] {
  return Array.from(whitelist.values());
}

/**
 * Clear expired whitelist entries
 */
export function cleanupExpiredWhitelist(): void {
  const now = new Date();
  const expired: string[] = [];

  for (const [ip, entry] of whitelist.entries()) {
    if (entry.expiresAt && now > entry.expiresAt) {
      expired.push(ip);
    }
  }

  expired.forEach((ip) => whitelist.delete(ip));

  if (expired.length > 0) {
    console.log(`Cleaned up ${expired.length} expired whitelist entries`);
  }
}
