import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

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
 * Check if request has a valid API key in Authorization header
 */
function authenticateByApiKey(req: CreateExpressContextOptions["req"]): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // Check against admin API key
  if (ENV.adminApiKey && token === ENV.adminApiKey) {
    return createAdminUser();
  }

  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // First try API Key auth (for Railway deployment)
  user = authenticateByApiKey(opts.req);

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
