export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "storyboard-platform-secret-key",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Yunwu API (for Railway independent deployment)
  yunwuApiKey: process.env.YUNWU_API_KEY ?? "",
  yunwuApiUrl: process.env.YUNWU_API_URL ?? "https://yunwu.ai",
  // Admin API key for simple auth (Railway deployment)
  adminApiKey: process.env.ADMIN_API_KEY ?? "storyboard-admin-2024",
};
