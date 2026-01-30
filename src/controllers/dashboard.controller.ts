import { Request, Response } from "express";
import { getDashboardStats, DashboardFilter } from "../models/dashboard.model";

/**
 * GET /api/dashboard/stats
 * Query params:
 * - filter: "today" | "weekly" | "monthly" | "yearly" (default: "today")
 *   This determines both the metrics date range and the chart aggregation:
 *   - "today" → weekly chart data (7 days)
 *   - "weekly" → weekly chart data (7 days)
 *   - "monthly" → monthly chart data (30 days)
 *   - "yearly" → yearly chart data (12 months)
 */
export const getDashboardStatsController = async (
  req: Request,
  res: Response
) => {
  try {
    // Get filter from query params (this is the main filter for metrics)
    const filterParam = (req.query.filter as string) || "today";

    // Validate filter
    const validFilters: DashboardFilter[] = ["today", "weekly", "monthly", "yearly"];
    if (!validFilters.includes(filterParam as DashboardFilter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter. Must be one of: ${validFilters.join(", ")}`,
      });
    }

    const filter = filterParam as DashboardFilter;

    // Automatically map filter to chart range
    // This determines how the chart data is aggregated
    const filterToRangeMap: Record<DashboardFilter, "today" | "week" | "month" | "year"> = {
      today: "week",       // Weekly aggregation for today filter
      weekly: "week",       // Weekly aggregation
      monthly: "month",    // Monthly aggregation
      yearly: "year",      // Yearly aggregation
    };
    const range = filterToRangeMap[filter];

    // Get user info from request (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;
    const userRole = user?.role;

    // Get dashboard stats with role-based filtering
    // The range is automatically determined from the filter for chart aggregation
    const stats = await getDashboardStats(
      filter,
      undefined, // beforeDate not used (custom filter removed)
      undefined, // afterDate not used (custom filter removed)
      userId,
      userRole,
      range // Chart range automatically mapped from filter
    );

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
