import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { getDashboardStatsController } from "../controllers/dashboard.controller";

const router = Router();

/**
 * GET /api/dashboard/stats
 * Query params:
 * - filter: "today" | "weekly" | "monthly" | "yearly" | "custom" (default: "today")
 * - beforeDate: YYYY-MM-DD (required for custom filter)
 * - afterDate: YYYY-MM-DD (required for custom filter)
 *
 * Access: admin, counsellor, manager
 */
router.get(
  "/stats",
  requireAuth,
  requireRole("admin"),
  getDashboardStatsController
);

export default router;
