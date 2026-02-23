import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm/mysql-core";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Run database migrations
  migrate: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const migrations: string[] = [];
      
      // Migration 1: Add referenceGridUrl column to grids table
      try {
        await db.execute(sql`ALTER TABLE grids ADD COLUMN referenceGridUrl TEXT`);
        migrations.push("Added referenceGridUrl column to grids table");
      } catch (e: any) {
        if (e.message?.includes("Duplicate column")) {
          migrations.push("referenceGridUrl column already exists");
        } else {
          migrations.push(`referenceGridUrl migration failed: ${e.message}`);
        }
      }
      
      return { success: true, migrations };
    }),
});
