import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookieHeader } from "cookie";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export const API_KEY_COOKIE_NAME = "sb_api_key";

/**
 * Create a mock admin user for API Key auth (Railway deployment)
 */
function createAdminUser(): User {
  return {
    id: 1,
    openId: "admin",
    name: "Admin",
    email: "admin@storyboard.local",
    loginMethod: "api-key",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

/**
 * Parse a specific cookie from the raw Cookie header
 */
function getCookieValue(req: CreateExpressContextOptions["req"], name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[name] || undefined;
}

/**
 * Check if request has a valid API key in Authorization header or cookie
 */
function authenticateByApiKey(req: CreateExpressContextOptions["req"]): User | null {
  // 1. Check Authorization header (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token && ENV.adminApiKey && token === ENV.adminApiKey) {
      return createAdminUser();
    }
  }

  // 2. Check cookie (for browser access on Railway)
  const cookieToken = getCookieValue(req, API_KEY_COOKIE_NAME);
  if (cookieToken && ENV.adminApiKey && cookieToken === ENV.adminApiKey) {
    return createAdminUser();
  }

  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Dev bypass: allow unauthenticated access with X-Dev-Bypass header (non-production only)
  if (process.env.NODE_ENV !== 'production' && opts.req.headers['x-dev-bypass'] === 'true') {
    user = createAdminUser();
  }

  // First try API Key auth (for Railway deployment)
  if (!user) {
    user = authenticateByApiKey(opts.req);
  }

  // If no API key match, try Manus OAuth
  if (!user) {
    try {
      const { sdk } = await import("./sdk");
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
