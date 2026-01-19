import { NextRequest, NextResponse } from "next/server";

export type UserRole = "user" | "admin" | "security_admin";

export interface RolePermissions {
  [role: string]: {
    canViewDashboard: boolean;
    canViewSecurityDashboard: boolean;
    canBlockIps: boolean;
    canManageUsers: boolean;
    canViewAuditLogs: boolean;
    canConfigureRules: boolean;
    canManageAlerts: boolean;
  };
}

export const ROLE_PERMISSIONS: RolePermissions = {
  user: {
    canViewDashboard: true,
    canViewSecurityDashboard: false,
    canBlockIps: false,
    canManageUsers: false,
    canViewAuditLogs: false,
    canConfigureRules: false,
    canManageAlerts: false,
  },
  admin: {
    canViewDashboard: true,
    canViewSecurityDashboard: true,
    canBlockIps: true,
    canManageUsers: true,
    canViewAuditLogs: true,
    canConfigureRules: true,
    canManageAlerts: true,
  },
  security_admin: {
    canViewDashboard: false,
    canViewSecurityDashboard: true,
    canBlockIps: true,
    canManageUsers: false,
    canViewAuditLogs: true,
    canConfigureRules: true,
    canManageAlerts: true,
  },
};

/**
 * Check if user role has permission
 */
export function hasPermission(role: UserRole, permission: keyof Omit<ReturnType<() => typeof ROLE_PERMISSIONS.admin>, never>): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions[permission] ?? false;
}

/**
 * Check if user has any of the required roles
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Require specific role for API endpoint
 */
export function requireRole(...roles: UserRole[]) {
  return (userRole: UserRole | undefined): boolean => {
    if (!userRole) return false;
    return roles.includes(userRole);
  };
}

/**
 * Require specific permission for API endpoint
 */
export function requirePermission(permission: keyof Omit<ReturnType<() => typeof ROLE_PERMISSIONS.admin>, never>) {
  return (userRole: UserRole | undefined): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, permission);
  };
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(reason: string = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(reason: string = "Insufficient permissions"): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

/**
 * Middleware to check role in request
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
}

export function extractRoleFromRequest(req: NextRequest): UserRole | undefined {
  // Would typically extract from JWT token
  // This is a placeholder
  return undefined;
}
