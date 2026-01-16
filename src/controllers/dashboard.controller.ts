import { Request, Response } from "express";
import { getDashboardStats, DashboardFilter } from "../models/dashboard.model";

/**
 * GET /api/dashboard/stats
 * Query params:
 * - filter: "today" | "weekly" | "monthly" | "yearly" | "custom" (default: "today")
 * - beforeDate: YYYY-MM-DD (required for custom filter)
 * - afterDate: YYYY-MM-DD (required for custom filter)
 */
export const getDashboardStatsController = async (
  req: Request,
  res: Response
) => {
  try {
    // Get filter from query params
    const filter = (req.query.filter as DashboardFilter) || "today";

    // Validate filter
    const validFilters: DashboardFilter[] = [
      "today",
      "weekly",
      "monthly",
      "yearly",
      "custom",
    ];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter. Must be one of: ${validFilters.join(", ")}`,
      });
    }

    // For custom filter, validate date params
    let beforeDate: string | undefined;
    let afterDate: string | undefined;

    if (filter === "custom") {
      beforeDate = req.query.beforeDate as string;
      afterDate = req.query.afterDate as string;

      if (!beforeDate || !afterDate) {
        return res.status(400).json({
          success: false,
          message: "beforeDate and afterDate are required for custom filter",
        });
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(beforeDate) || !dateRegex.test(afterDate)) {
        return res.status(400).json({
          success: false,
          message: "Date format must be YYYY-MM-DD",
        });
      }

      // Validate that beforeDate is after afterDate
      const before = new Date(beforeDate);
      const after = new Date(afterDate);
      if (before < after) {
        return res.status(400).json({
          success: false,
          message: "beforeDate must be greater than or equal to afterDate",
        });
      }
    }

    // Get dashboard stats
    const stats = await getDashboardStats(filter, beforeDate, afterDate);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard stats",
    });
  }
};
