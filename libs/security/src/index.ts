/**
 * @syntherium/security
 * 
 * Security utilities including RBAC guards for NestJS
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// ============================================
// ROLE DEFINITIONS
// ============================================

export enum Role {
  ADMIN = 'admin',
  OPS = 'ops',
  VENDOR = 'vendor',
  CUSTOMER = 'customer',
  SERVICE = 'service', // Internal service-to-service
}

// ============================================
// DECORATORS
// ============================================

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint.
 * 
 * @example
 * @Roles(Role.ADMIN, Role.OPS)
 * @Get('sensitive-data')
 * getSensitiveData() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark an endpoint as public (no auth required).
 * 
 * @example
 * @Public()
 * @Get('health')
 * getHealth() { ... }
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

// ============================================
// USER CONTEXT
// ============================================

export interface UserContext {
  id: string;
  email?: string;
  roles: Role[];
  metadata?: Record<string, unknown>;
}

/**
 * Extracts user context from request.
 * 
 * Supports multiple auth methods:
 * 1. x-role header (development/testing)
 * 2. Authorization Bearer JWT (production)
 * 3. X-API-Key (service-to-service)
 */
export function extractUserContext(request: any): UserContext | null {
  // Method 1: x-role header (for development/testing)
  const roleHeader = request.headers['x-role'];
  if (roleHeader) {
    const roles = roleHeader.split(',').map((r: string) => r.trim().toLowerCase());
    return {
      id: 'dev-user',
      roles: roles.filter((r: string) => Object.values(Role).includes(r as Role)) as Role[],
    };
  }

  // Method 2: Authorization Bearer JWT
  const authHeader = request.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // TODO: Implement JWT verification
    // For now, return a stub
    return decodeJwtStub(token);
  }

  // Method 3: X-API-Key for service-to-service
  const apiKey = request.headers['x-api-key'];
  if (apiKey) {
    // TODO: Validate API key against database/config
    return {
      id: 'service-account',
      roles: [Role.SERVICE],
    };
  }

  return null;
}

/**
 * Stub JWT decoder - replace with real implementation.
 */
function decodeJwtStub(token: string): UserContext | null {
  // TODO: Implement proper JWT verification with jose or similar
  // This is a stub that should be replaced
  try {
    // Fake decode for structure
    return {
      id: 'jwt-user',
      roles: [Role.CUSTOMER],
      metadata: { token: token.substring(0, 10) },
    };
  } catch {
    return null;
  }
}

// ============================================
// RBAC GUARD
// ============================================

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if endpoint is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get required roles
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, require authentication only
    const request = context.switchToHttp().getRequest();
    const user = extractUserContext(request);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Attach user to request for use in controllers
    request.user = user;

    // If no specific roles required, authenticated user is sufficient
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Required roles: ${requiredRoles.join(', ')}. User has: ${user.roles.join(', ')}`
      );
    }

    return true;
  }
}

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Verifies Flutterwave webhook signature.
 * 
 * TODO: Implement actual verification
 */
export function verifyFlutterwaveSignature(
  payload: string,
  signature: string,
  secretHash: string
): boolean {
  // TODO: Implement proper signature verification
  // See: https://developer.flutterwave.com/docs/webhooks
  
  // Stub: always return true in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('STUB: Flutterwave signature verification skipped in development');
    return true;
  }

  // In production, this should verify the signature
  // using HMAC-SHA256 with the secret hash
  return false;
}

/**
 * Verifies Paystack webhook signature.
 * 
 * TODO: Implement actual verification
 */
export function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey: string
): boolean {
  // TODO: Implement proper signature verification
  // See: https://paystack.com/docs/payments/webhooks/
  
  if (process.env.NODE_ENV === 'development') {
    console.warn('STUB: Paystack signature verification skipped in development');
    return true;
  }

  return false;
}

// ============================================
// EXPORTS
// ============================================

export { RolesGuard as default };
