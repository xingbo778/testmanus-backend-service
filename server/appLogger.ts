/**
 * Unified application logger - records logs to database for product-level visibility.
 */
import { getDb } from "./db";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  details?: Record<string, any>;
  projectId?: number;
  panelIndex?: number;
  userId?: number;
}

/**
 * Write a log entry to the app_logs table.
 * Non-blocking: errors in logging itself are swallowed to avoid cascading failures.
 */
export async function appLog(entry: LogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { appLogs } = await import("../drizzle/schema");
    await db.insert(appLogs).values({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      details: entry.details ?? null,
      projectId: entry.projectId ?? null,
      panelIndex: entry.panelIndex ?? null,
      userId: entry.userId ?? null,
    });
  } catch (e) {
    // Swallow logging errors - don't let logging break the app
    console.error("[AppLogger] Failed to write log:", e);
  }
}

/** Convenience helpers */
export const logInfo = (source: string, message: string, opts?: Omit<LogEntry, "level" | "source" | "message">) =>
  appLog({ level: "info", source, message, ...opts });

export const logWarn = (source: string, message: string, opts?: Omit<LogEntry, "level" | "source" | "message">) =>
  appLog({ level: "warn", source, message, ...opts });

export const logError = (source: string, message: string, opts?: Omit<LogEntry, "level" | "source" | "message">) =>
  appLog({ level: "error", source, message, ...opts });

export const logDebug = (source: string, message: string, opts?: Omit<LogEntry, "level" | "source" | "message">) =>
  appLog({ level: "debug", source, message, ...opts });
