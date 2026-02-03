import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { clientPayments } from "../schemas/clientPayment.schema";
import { clientProductPayments } from "../schemas/clientProductPayments.schema";
import { beaconAccount } from "../schemas/beaconAccount.schema";
import { insurance } from "../schemas/insurance.schema";
import { airTicket } from "../schemas/airTicket.schema";
import { forexFees } from "../schemas/forexFees.schema";
import { newSell } from "../schemas/newSell.schema";
import { creditCard } from "../schemas/creditCard.schema";
import { ielts } from "../schemas/ielts.schema";
import { loan } from "../schemas/loan.schema";
import { visaExtension } from "../schemas/visaExtension.schema";
import { allFinance } from "../schemas/allFinance.schema";
import { getLeaderboard } from "./leaderboard.model";
import { eq, and, gte, lte, sql, count, inArray, isNotNull } from "drizzle-orm";

/* ==============================
   TYPES
============================== */
export type DashboardFilter = "today" | "weekly" | "monthly" | "yearly";
export type UserRole = "admin" | "manager" | "counsellor";

// Product classification constants
const CORE_PRODUCT = "ALL_FINANCE_EMPLOYEMENT";
const COUNT_ONLY_PRODUCTS = [
  "LOAN_DETAILS", // count only product not contribute to revenue
  "FOREX_CARD", // count only product not contribute to revenue
  "TUTION_FEES", // count only product not contribute to revenue
  "CREDIT_CARD", // count only product not contribute to revenue
  "SIM_CARD_ACTIVATION", // count only product not contribute to revenue
  "INSURANCE", // count only product not contribute to revenue
  "BEACON_ACCOUNT", // count only product not contribute to revenue
  "AIR_TICKET", // count only product not contribute to revenue
] as const;

// Count-only entity types (these don't contribute to revenue)
const COUNT_ONLY_ENTITY_TYPES = [
  "loan_id",
  "forexCard_id",
  "tutionFees_id",
  "creditCard_id",
  "simCard_id",
  "insurance_id",
  "beaconAccount_id",
  "airTicket_id",
] as const;

// Admin/Manager Dashboard Stats
export interface AdminManagerDashboardStats {
  newEnrollment: {
    count: number;
  };
  coreSale: {
    number: number; // Count
    amount: string; // Sum
  };
  coreProduct: {
    number: number; // Count
    amount: string; // Sum
  };
  otherProduct: {
    number: number; // Count
    amount: string; // Sum
  };
  totalPendingAmount: {
    amount: string;
  };
  revenue: {
    amount: string; // Core Sale Amount + Core Product Amount + Other Product Amount
  };
  leaderboard: Array<{
    counsellorId: number;
    fullName: string;
    email: string;
    empId: string | null;
    managerId: number | null;
    designation: string | null;
    enrollments: number;
    revenue: number;
    target: number;
    achievedTarget: number;
    targetId: number | null;
    rank: number;
  }>;
  chartData: {
    data: Array<{
      label: string;
      coreSale: { count: number; amount: number };
      coreProduct: { count: number; amount: number };
      otherProduct: { count: number; amount: number };
      revenue: number;
    }>;
    summary: {
      total: number;
    };
  };
}

// Counsellor Dashboard Stats
export interface CounsellorDashboardStats {
  coreSale: {
    number: number; // Count only, no amount
  };
  coreProduct: {
    number: number; // Count only, no amount
  };
  otherProduct: {
    number: number; // Count only, no amount
  };
  totalPendingAmount: {
    amount: string;
  };
  totalClients: {
    count: number;
  };
  newEnrollment: {
    count: number;
  };
  leaderboard: Array<{
    counsellorId: number;
    fullName: string;
    email: string;
    empId: string | null;
    managerId: number | null;
    designation: string | null;
    enrollments: number;
    revenue: number;
    target: number;
    achievedTarget: number;
    targetId: number | null;
    rank: number;
  }>;
  individualPerformance: {
    current: number;
    previous: number;
    change: number;
    changeType: "increase" | "decrease" | "no-change";
    periodLabel: string;
  };
  chartData: {
    data: Array<{
      label: string;
      coreSale: { count: number };
      coreProduct: { count: number };
      otherProduct: { count: number };
    }>;
    summary: {
      total: number;
    };
  };
}

// Union type for dashboard stats
export type DashboardStats = AdminManagerDashboardStats | CounsellorDashboardStats;

interface DateRange {
  start: Date;
  end: Date;
  previousStart?: Date; // Optional - not used in rolling window analytics
  previousEnd?: Date; // Optional - not used in rolling window analytics
}

interface RoleBasedFilter {
  userId?: number;
  userRole: UserRole;
  counsellorId?: number; // For counsellor role
}

/* ==============================
   HELPER: Check if product is count-only
============================== */
const isCountOnlyEntityType = (entityType: string): boolean => {
  return COUNT_ONLY_ENTITY_TYPES.includes(entityType as any);
};

/* ==============================
   HELPER: Build counsellor filter condition
============================== */
const buildCounsellorFilter = (
  filter: RoleBasedFilter,
  clientTable: any
): any => {
  if (filter.userRole === "counsellor" && filter.counsellorId) {
    return eq(clientTable.counsellorId, filter.counsellorId);
  }
  return undefined; // No filter for admin/manager
};

/* ==============================
   DATE RANGE HELPERS
============================== */
const getDateRange = (
  filter: DashboardFilter,
  beforeDate?: string,
  afterDate?: string
): DateRange => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  let start: Date;
  let end: Date = endOfToday;

  switch (filter) {
    case "today": {
      // Today filter: Use 7 days for chart data (same as weekly)
      // Rolling 7 days: 7 days back to today
      const daysToSubtract = 7;
      start = new Date(now);
      start.setDate(now.getDate() - daysToSubtract);
      start.setHours(0, 0, 0, 0);
      end = new Date(endOfToday);
      break;
    }
    case "weekly": {
      // Rolling 7 days: Same weekday last week to today
      // Get current weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const currentDayOfWeek = now.getDay();
      // Calculate days to subtract to get to same weekday last week
      const daysToSubtract = 7;
      start = new Date(now);
      start.setDate(now.getDate() - daysToSubtract);
      start.setHours(0, 0, 0, 0);
      end = new Date(endOfToday);
      break;
    }
    case "monthly": {
      // Rolling ~30 days: Same date of previous month to today
      const currentDate = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Go back one month
      let targetMonth = currentMonth - 1;
      let targetYear = currentYear;

      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear = currentYear - 1;
      }

      // Get last day of target month
      const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

      // Use same date, or last day of month if date doesn't exist
      const targetDate = Math.min(currentDate, lastDayOfTargetMonth);

      start = new Date(targetYear, targetMonth, targetDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endOfToday);
      break;
    }
    case "yearly": {
      // Rolling 12 months: Same month of previous year to today
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const targetYear = currentYear - 1;

      // Start from same month of previous year, day 1
      start = new Date(targetYear, currentMonth, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(endOfToday);
      break;
    }
    default:
      throw new Error("Invalid filter type");
  }

  // No previous period calculation for rolling window analytics
  return { start, end };
};

/**
 * Returns date range for "today only" (current calendar day 00:00:00 to 23:59:59).
 * Used for: coreSale, coreProduct, revenue.
 */
const getTodayOnlyDateRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Returns "all time" date range (from year 2000 to end of today).
 * Used for: newEnrollment (total client count), totalPendingAmount (all clients' pending).
 */
const getAllTimeDateRange = (): DateRange => {
  const now = new Date();
  const start = new Date(2000, 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/* ==============================
   TOTAL CLIENTS
============================== */
const getTotalClients = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<number> => {
  const conditions: any[] = [
    eq(clientInformation.archived, false),
    gte(clientInformation.enrollmentDate, dateRange.start.toISOString().split("T")[0]),
    lte(clientInformation.enrollmentDate, dateRange.end.toISOString().split("T")[0]),
  ];

  const counsellorFilter = filter ? buildCounsellorFilter(filter, clientInformation) : undefined;
  if (counsellorFilter) {
    conditions.push(counsellorFilter);
  }

  const [result] = await db
    .select({ count: count() })
    .from(clientInformation)
    .where(and(...conditions));

  return result?.count || 0;
};


/* ==============================
   CORE SERVICE COUNT (Core Sale)
============================== */
const getCoreServiceCount = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<number> => {
  const startDateStr = dateRange.start.toISOString().split("T")[0];
  const endDateStr = dateRange.end.toISOString().split("T")[0];
  const startTimestamp = dateRange.start.toISOString();
  const endTimestamp = dateRange.end.toISOString();

  // Count by payment date when set (so "today" = payments with paymentDate today, not createdAt)
  // Count DISTINCT clientId (unique clients) who have any payment (INITIAL, BEFORE_VISA, or AFTER_VISA)
  let query = db
    .select({ count: sql<number>`COUNT(DISTINCT ${clientPayments.clientId})` })
    .from(clientPayments);

  // Add counsellor filter if needed
  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    query = query
      .innerJoin(
        clientInformation,
        eq(clientPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
          AND (
            (${clientPayments.paymentDate} IS NOT NULL
              AND ${clientPayments.paymentDate} >= ${startDateStr}
              AND ${clientPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientPayments.paymentDate} IS NULL
              AND ${clientPayments.createdAt} >= ${startTimestamp}
              AND ${clientPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    query = query
      .innerJoin(
        clientInformation,
        eq(clientPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
          AND (
            (${clientPayments.paymentDate} IS NOT NULL
              AND ${clientPayments.paymentDate} >= ${startDateStr}
              AND ${clientPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientPayments.paymentDate} IS NULL
              AND ${clientPayments.createdAt} >= ${startTimestamp}
              AND ${clientPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [result] = await query;
  return result?.count || 0;
};


/* ==============================
   HELPER: Get Entity Amounts
============================== */
const getEntityAmounts = async (
  entityType: string,
  entityIds: number[]
): Promise<number> => {
  if (entityIds.length === 0) return 0;

  try {
    let table: any;
    let amountColumn: any;

        switch (entityType) {
          case "beaconAccount_id":
            table = beaconAccount;
            amountColumn = beaconAccount.amount;
            break;
          case "insurance_id":
            table = insurance;
            amountColumn = insurance.amount;
            break;
          case "airTicket_id":
            table = airTicket;
            amountColumn = airTicket.amount;
            break;
          case "tutionFees_id":
            // TutionFees doesn't have an amount column, skip it
            return 0;
          case "forexFees_id":
            table = forexFees;
            amountColumn = forexFees.amount;
            break;
          case "newSell_id":
            table = newSell;
            amountColumn = newSell.amount;
            break;
          case "creditCard_id":
            table = creditCard;
            // amountColumn = creditCard.amount;
            break;
          case "ielts_id":
            table = ielts;
            amountColumn = ielts.amount;
            break;
          case "loan_id":
            table = loan;
            amountColumn = loan.amount;
            break;
          case "visaextension_id":
            table = visaExtension;
            amountColumn = visaExtension.amount;
            break;
          case "allFinance_id":
            table = allFinance;
            amountColumn = allFinance.amount;
            break;
          default:
            return 0;
        }

    if (table && amountColumn) {
      const [result] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${amountColumn}::numeric), 0)`,
        })
        .from(table)
        .where(inArray(table.id, entityIds));

      return parseFloat(result?.total || "0");
    }
  } catch (error) {
    console.error(`Error fetching ${entityType} amounts:`, error);
  }

  return 0;
};

/* ==============================
   PENDING AMOUNT (OUTSTANDING)
============================== */
const getPendingAmount = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<{ pendingAmount: string; breakdown: { initial: string; beforeVisa: string; afterVisa: string; submittedVisa: string } }> => {
  // Get clients filtered by date range (enrollment date within the period)
  const startStr = dateRange.start.toISOString().split("T")[0];
  const endStr = dateRange.end.toISOString().split("T")[0];
  const conditions: any[] = [
    eq(clientInformation.archived, false),
    gte(clientInformation.enrollmentDate, startStr),
    lte(clientInformation.enrollmentDate, endStr),
  ];

  const counsellorFilter = filter ? buildCounsellorFilter(filter, clientInformation) : undefined;
  if (counsellorFilter) {
    conditions.push(counsellorFilter);
  }

  const clients = await db
    .select({
      clientId: clientInformation.clientId,
    })
    .from(clientInformation)
    .where(and(...conditions));

  if (clients.length === 0) {
    return {
      pendingAmount: "0.00",
      breakdown: {
        initial: "0.00",
        beforeVisa: "0.00",
        afterVisa: "0.00",
        submittedVisa: "0.00",
      },
    };
  }

  // Get ALL client payments grouped by stage (for all clients)
  const clientIds = clients.map((c) => c.clientId);

  // Calculate total expected from clientPayments.totalPayment
  // Each client payment has a totalPayment field which represents the expected total for that client
  // We need to get the unique totalPayment per client (since multiple payments can have the same totalPayment)
  const clientPaymentsForExpected = clientIds.length > 0 ? await db
    .select({
      clientId: clientPayments.clientId,
      totalPayment: clientPayments.totalPayment,
    })
    .from(clientPayments)
    .where(inArray(clientPayments.clientId, clientIds))
    : [];

  // Group by clientId and get the unique totalPayment per client
  // (All payments for a client should have the same totalPayment, so we take the first one)
  const clientExpectedMap = new Map<number, number>();
  clientPaymentsForExpected.forEach((payment) => {
    if (!clientExpectedMap.has(payment.clientId)) {
      const totalPayment = payment.totalPayment ? parseFloat(payment.totalPayment) : 0;
      clientExpectedMap.set(payment.clientId, totalPayment);
    }
  });

  // Calculate total expected: sum of unique totalPayment for each client
  let totalExpected = 0;
  clientExpectedMap.forEach((expected) => {
    totalExpected += expected;
  });

  // Clients without payments have expected amount of 0
  // (Previously used saleTypes.amount, but saleType is no longer part of client)

  // Get client payments grouped by stage using amount (individual payment amount, not totalPayment)
  // This sums all individual payment amounts for each stage across all clients
  const clientPaymentsByStage = clientIds.length > 0 ? await db
    .select({
      stage: clientPayments.stage,
      total: sql<string>`COALESCE(SUM(${clientPayments.amount}::numeric), 0)`,
    })
    .from(clientPayments)
    .where(inArray(clientPayments.clientId, clientIds))
    .groupBy(clientPayments.stage)
    : [];

  // Initialize breakdown
  const breakdown = {
    initial: "0.00",
    beforeVisa: "0.00",
    afterVisa: "0.00",
    submittedVisa: "0.00",
  };

  let totalPaid = 0; // Only INITIAL + BEFORE_VISA + AFTER_VISA
  clientPaymentsByStage.forEach((payment) => {
    const amount = parseFloat(payment.total || "0");

    switch (payment.stage) {
      case "INITIAL":
        breakdown.initial = amount.toFixed(2);
        totalPaid += amount; // Include in pending calculation
        break;
      case "BEFORE_VISA":
        breakdown.beforeVisa = amount.toFixed(2);
        totalPaid += amount; // Include in pending calculation
        break;
      case "AFTER_VISA":
        breakdown.afterVisa = amount.toFixed(2);
        totalPaid += amount; // Include in pending calculation
        break;
      case "SUBMITTED_VISA":
        breakdown.submittedVisa = amount.toFixed(2);
        // Don't add to totalPaid - SUBMITTED_VISA is not counted for pending
        break;
    }
  });

  // Debug logging to trace the calculation
  // console.log("=== PENDING AMOUNT CALCULATION DEBUG ===");
  // console.log("Total Clients:", clients.length);
  // console.log("Clients with payments:", clientExpectedMap.size);
  // console.log("Clients without payments:", clientsWithoutPayments.length);
  // console.log("Total Expected (from clientPayments.totalPayment):", totalExpected);
  // console.log("Total Paid (INITIAL + BEFORE_VISA + AFTER_VISA):", totalPaid);
  // console.log("Breakdown:", breakdown);
  // console.log("Calculated Pending Amount:", totalExpected - totalPaid);
  // console.log("========================================");

  // Calculate pending amount: totalExpected - (initial + beforeVisa + afterVisa)
  const pendingAmount = totalExpected - totalPaid;

  return {
    pendingAmount: Math.max(0, pendingAmount).toFixed(2), // Don't return negative
    breakdown,
  };
};

/* ==============================
   NEW ENROLLMENTS
============================== */
const getNewEnrollments = async (
  filter: DashboardFilter,
  dateRange: DateRange,
  roleFilter?: RoleBasedFilter
): Promise<{ count: number; label: string }> => {
  const startStr = dateRange.start.toISOString().split("T")[0];
  const endStr = dateRange.end.toISOString().split("T")[0];
  const conditions: any[] = [
    eq(clientInformation.archived, false),
    gte(clientInformation.enrollmentDate, startStr),
    lte(clientInformation.enrollmentDate, endStr),
  ];

  const counsellorFilter = roleFilter ? buildCounsellorFilter(roleFilter, clientInformation) : undefined;
  if (counsellorFilter) {
    conditions.push(counsellorFilter);
  }

  const [result] = await db
    .select({ count: count() })
    .from(clientInformation)
    .where(and(...conditions));

  let label = "new clients";
  switch (filter) {
    case "today":
      label = "new clients today";
      break;
    case "weekly":
      label = "new clients this week";
      break;
    case "monthly":
      label = "new clients this month";
      break;
    case "yearly":
      label = "new clients this year";
      break;
  }

  return {
    count: result?.count || 0,
    label,
  };
};

/* ==============================
   HELPER: Calculate Monthly Revenue
============================== */
const calculateMonthlyRevenue = async (
  monthStartStr: string,
  monthEndStr: string,
  monthStartTimestamp: string,
  monthEndTimestamp: string
): Promise<number> => {
  // 1. Client payments for this month (exclude archived clients)
  const [clientPaymentsResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientPayments.amount}::numeric), 0)`,
    })
    .from(clientPayments)
    .innerJoin(
      clientInformation,
      eq(clientPayments.clientId, clientInformation.clientId)
    )
    .where(
      sql`(
        ${clientInformation.archived} = false
        AND ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
        AND (
          (${clientPayments.paymentDate} IS NOT NULL AND ${clientPayments.paymentDate} >= ${monthStartStr} AND ${clientPayments.paymentDate} <= ${monthEndStr})
          OR
          (${clientPayments.paymentDate} IS NULL AND ${clientPayments.createdAt} >= ${monthStartTimestamp} AND ${clientPayments.createdAt} <= ${monthEndTimestamp})
        )
      )`
    );

  // 2. Product payments with amount for this month (exclude archived clients)
  const [productPaymentsWithAmount] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientProductPayments.amount}::numeric), 0)`,
    })
    .from(clientProductPayments)
    .innerJoin(
      clientInformation,
      eq(clientProductPayments.clientId, clientInformation.clientId)
    )
    .where(
      sql`(
        ${clientInformation.archived} = false
        AND ${clientProductPayments.amount} IS NOT NULL
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL AND ${clientProductPayments.paymentDate} >= ${monthStartStr} AND ${clientProductPayments.paymentDate} <= ${monthEndStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL AND ${clientProductPayments.createdAt} >= ${monthStartTimestamp} AND ${clientProductPayments.createdAt} <= ${monthEndTimestamp})
        )
      )`
    );

  // 3. Entity-based product payments for this month (exclude archived clients)
  const productPaymentsWithEntity = await db
    .select({
      entityType: clientProductPayments.entityType,
      entityId: clientProductPayments.entityId,
    })
    .from(clientProductPayments)
    .innerJoin(
      clientInformation,
      eq(clientProductPayments.clientId, clientInformation.clientId)
    )
    .where(
      sql`(
        ${clientInformation.archived} = false
        AND ${clientProductPayments.amount} IS NULL
        AND ${clientProductPayments.entityId} IS NOT NULL
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL AND ${clientProductPayments.paymentDate} >= ${monthStartStr} AND ${clientProductPayments.paymentDate} <= ${monthEndStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL AND ${clientProductPayments.createdAt} >= ${monthStartTimestamp} AND ${clientProductPayments.createdAt} <= ${monthEndTimestamp})
        )
      )`
    );

  // 4. Fetch amounts from entity tables
  let entityAmountsTotal = 0;
  if (productPaymentsWithEntity.length > 0) {
    const entityGroups: Record<string, number[]> = {};
    productPaymentsWithEntity.forEach((pp) => {
      if (pp.entityId && pp.entityType) {
        if (!entityGroups[pp.entityType]) {
          entityGroups[pp.entityType] = [];
        }
        entityGroups[pp.entityType].push(pp.entityId);
      }
    });

    for (const [entityType, entityIds] of Object.entries(entityGroups)) {
      const amount = await getEntityAmounts(entityType, entityIds);
      entityAmountsTotal += amount;
    }
  }

  const clientPaymentsTotal = parseFloat(clientPaymentsResult?.total || "0");
  const productPaymentsTotal = parseFloat(productPaymentsWithAmount?.total || "0");
  return clientPaymentsTotal + productPaymentsTotal + entityAmountsTotal;
};

/* ==============================
   REVENUE OVERVIEW (CHART DATA)
============================== */
const getRevenueOverview = async (filter?: DashboardFilter, dateRange?: DateRange): Promise<
  Array<{ month: string; revenue: string }>
> => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const months: Array<{ month: string; revenue: string }> = [];

  // Show last 12 months from current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(currentYear, currentMonth - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthStartStr = monthStart.toISOString().split("T")[0];
    const monthEndStr = monthEnd.toISOString().split("T")[0];
    const monthStartTimestamp = monthStart.toISOString();
    const monthEndTimestamp = monthEnd.toISOString();

    // Calculate revenue for this month
    const revenue = await calculateMonthlyRevenue(monthStartStr, monthEndStr, monthStartTimestamp, monthEndTimestamp);

    months.push({
      month: monthNames[month],
      revenue: revenue.toFixed(2),
    });
  }

  return months;
};

/* ==============================
   PERCENTAGE CHANGE CALCULATION
============================== */
const calculatePercentageChange = (
  current: number,
  previous: number
): { change: number; changeType: "increase" | "decrease" | "no-change" } => {
  if (previous === 0) {
    if (current === 0) {
      return { change: 0, changeType: "no-change" };
    }
    return { change: 100, changeType: "increase" };
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 100) / 100; // Round to 2 decimal places

  if (rounded > 0) {
    return { change: rounded, changeType: "increase" };
  } else if (rounded < 0) {
    return { change: Math.abs(rounded), changeType: "decrease" };
  } else {
    return { change: 0, changeType: "no-change" };
  }
};

/* ==============================
   NEW HELPER: Get Entity Amounts (Excluding Count-Only)
============================== */
const getEntityAmountsExcludingCountOnly = async (
  entityType: string,
  entityIds: number[]
): Promise<number> => {
  // Skip count-only entity types
  if (isCountOnlyEntityType(entityType)) {
    return 0;
  }
  return getEntityAmounts(entityType, entityIds);
};

/* ==============================
   NEW: Get Core Product Metrics (Count + Amount)
============================== */
const getCoreProductMetrics = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<{ count: number; amount: number }> => {
  const startDateStr = dateRange.start.toISOString().split("T")[0];
  const endDateStr = dateRange.end.toISOString().split("T")[0];
  const startTimestamp = dateRange.start.toISOString();
  const endTimestamp = dateRange.end.toISOString();

  // Build base query
  let countQuery = db
    .select({ count: count() })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.productName} = ${CORE_PRODUCT}
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${startDateStr}
            AND ${clientProductPayments.paymentDate} <= ${endDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${startTimestamp}
            AND ${clientProductPayments.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  // Add counsellor filter or exclude archived (admin/manager)
  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    countQuery = countQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} = ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    countQuery = countQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} = ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [countResult] = await countQuery;

  // Get amount - Core Product uses allFinance table
  let amountQuery = db
    .select({
      total: sql<string>`COALESCE(SUM(${allFinance.amount}::numeric), 0)`,
    })
    .from(allFinance)
    .innerJoin(
      clientProductPayments,
      sql`${clientProductPayments.entityId} = ${allFinance.financeId} AND ${clientProductPayments.entityType} = 'allFinance_id'`
    )
    .where(
      sql`(
        ${clientProductPayments.productName} = ${CORE_PRODUCT}
        AND (
          (${allFinance.paymentDate} IS NOT NULL
            AND ${allFinance.paymentDate} >= ${startDateStr}
            AND ${allFinance.paymentDate} <= ${endDateStr})
          OR
          (${allFinance.paymentDate} IS NULL
            AND ${allFinance.createdAt} >= ${startTimestamp}
            AND ${allFinance.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    amountQuery = amountQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} = ${CORE_PRODUCT}
          AND (
            (${allFinance.paymentDate} IS NOT NULL
              AND ${allFinance.paymentDate} >= ${startDateStr}
              AND ${allFinance.paymentDate} <= ${endDateStr})
            OR
            (${allFinance.paymentDate} IS NULL
              AND ${allFinance.createdAt} >= ${startTimestamp}
              AND ${allFinance.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    amountQuery = amountQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} = ${CORE_PRODUCT}
          AND (
            (${allFinance.paymentDate} IS NOT NULL
              AND ${allFinance.paymentDate} >= ${startDateStr}
              AND ${allFinance.paymentDate} <= ${endDateStr})
            OR
            (${allFinance.paymentDate} IS NULL
              AND ${allFinance.createdAt} >= ${startTimestamp}
              AND ${allFinance.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [amountResult] = await amountQuery;

  return {
    count: countResult?.count || 0,
    amount: parseFloat(amountResult?.total || "0"),
  };
};

/* ==============================
   NEW: Get Other Product Metrics (Count + Amount)
============================== */
const getOtherProductMetrics = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<{ count: number; amount: number }> => {
  const startDateStr = dateRange.start.toISOString().split("T")[0];
  const endDateStr = dateRange.end.toISOString().split("T")[0];
  const startTimestamp = dateRange.start.toISOString();
  const endTimestamp = dateRange.end.toISOString();

  // Build count query - all products except CORE_PRODUCT
  let countQuery = db
    .select({ count: count() })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.productName} != ${CORE_PRODUCT}
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${startDateStr}
            AND ${clientProductPayments.paymentDate} <= ${endDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${startTimestamp}
            AND ${clientProductPayments.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  // Add counsellor filter or exclude archived (admin/manager)
  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    countQuery = countQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    countQuery = countQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [countResult] = await countQuery;

  // Get amount - exclude count-only products
  // 1. Products with amount (master_only) - exclude count-only
  // Build NOT IN clause manually
  const countOnlyProductsList = COUNT_ONLY_PRODUCTS.map((p) => `'${p}'`).join(", ");

  let amountQuery = db
    .select({
      total: sql<string>`COALESCE(SUM(${clientProductPayments.amount}::numeric), 0)`,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NOT NULL
        AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
        AND ${clientProductPayments.productName} NOT IN (${sql.raw(countOnlyProductsList)})
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${startDateStr}
            AND ${clientProductPayments.paymentDate} <= ${endDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${startTimestamp}
            AND ${clientProductPayments.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    amountQuery = amountQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientProductPayments.amount} IS NOT NULL
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND ${clientProductPayments.productName} NOT IN (${sql.raw(countOnlyProductsList)})
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    amountQuery = amountQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientProductPayments.amount} IS NOT NULL
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND ${clientProductPayments.productName} NOT IN (${sql.raw(countOnlyProductsList)})
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [amountResult1] = await amountQuery;

  // 2. Entity-based products - exclude count-only entity types
  let entityQuery = db
    .select({
      entityType: clientProductPayments.entityType,
      entityId: clientProductPayments.entityId,
      productName: clientProductPayments.productName,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NULL
        AND ${clientProductPayments.entityId} IS NOT NULL
        AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${startDateStr}
            AND ${clientProductPayments.paymentDate} <= ${endDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${startTimestamp}
            AND ${clientProductPayments.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  // Add counsellor filter or exclude archived (admin/manager)
  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    entityQuery = entityQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientProductPayments.amount} IS NULL
          AND ${clientProductPayments.entityId} IS NOT NULL
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    entityQuery = entityQuery
      .innerJoin(
        clientInformation,
        eq(clientProductPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientProductPayments.amount} IS NULL
          AND ${clientProductPayments.entityId} IS NOT NULL
          AND ${clientProductPayments.productName} != ${CORE_PRODUCT}
          AND (
            (${clientProductPayments.paymentDate} IS NOT NULL
              AND ${clientProductPayments.paymentDate} >= ${startDateStr}
              AND ${clientProductPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientProductPayments.paymentDate} IS NULL
              AND ${clientProductPayments.createdAt} >= ${startTimestamp}
              AND ${clientProductPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const filteredEntityPayments = await entityQuery;

  // Group by entity type and fetch amounts (excluding count-only)
  let entityAmountsTotal = 0;
  if (filteredEntityPayments.length > 0) {
    const entityGroups: Record<string, number[]> = {};
    filteredEntityPayments.forEach((pp: { entityType: string | null; entityId: number | null; productName: string }) => {
      if (pp.entityId && pp.entityType && !isCountOnlyEntityType(pp.entityType)) {
        if (!entityGroups[pp.entityType]) {
          entityGroups[pp.entityType] = [];
        }
        entityGroups[pp.entityType].push(pp.entityId);
      }
    });

    for (const [entityType, entityIds] of Object.entries(entityGroups)) {
      const amount = await getEntityAmountsExcludingCountOnly(entityType, entityIds);
      entityAmountsTotal += amount;
    }
  }

  return {
    count: countResult?.count || 0,
    amount: parseFloat(amountResult1?.total || "0") + entityAmountsTotal,
  };
};

/* ==============================
   NEW: Get Core Sale Amount
============================== */
const getCoreSaleAmount = async (
  dateRange: DateRange,
  filter?: RoleBasedFilter
): Promise<number> => {
  const startDateStr = dateRange.start.toISOString().split("T")[0];
  const endDateStr = dateRange.end.toISOString().split("T")[0];
  const startTimestamp = dateRange.start.toISOString();
  const endTimestamp = dateRange.end.toISOString();

  let query = db
    .select({
      total: sql<string>`COALESCE(SUM(${clientPayments.amount}::numeric), 0)`,
    })
    .from(clientPayments)
    .where(
      sql`(
        ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
        AND (
          (${clientPayments.paymentDate} IS NOT NULL
            AND ${clientPayments.paymentDate} >= ${startDateStr}
            AND ${clientPayments.paymentDate} <= ${endDateStr})
          OR
          (${clientPayments.paymentDate} IS NULL
            AND ${clientPayments.createdAt} >= ${startTimestamp}
            AND ${clientPayments.createdAt} <= ${endTimestamp})
        )
      )`
    ) as any;

  // Exclude archived clients: join client_information for both counsellor and admin/manager
  if (filter?.userRole === "counsellor" && filter.counsellorId) {
    query = query
      .innerJoin(
        clientInformation,
        eq(clientPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.counsellorId} = ${filter.counsellorId}
          AND ${clientInformation.archived} = false
          AND ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
          AND (
            (${clientPayments.paymentDate} IS NOT NULL
              AND ${clientPayments.paymentDate} >= ${startDateStr}
              AND ${clientPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientPayments.paymentDate} IS NULL
              AND ${clientPayments.createdAt} >= ${startTimestamp}
              AND ${clientPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  } else {
    // Admin/manager: exclude archived clients
    query = query
      .innerJoin(
        clientInformation,
        eq(clientPayments.clientId, clientInformation.clientId)
      )
      .where(
        sql`(
          ${clientInformation.archived} = false
          AND ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
          AND (
            (${clientPayments.paymentDate} IS NOT NULL
              AND ${clientPayments.paymentDate} >= ${startDateStr}
              AND ${clientPayments.paymentDate} <= ${endDateStr})
            OR
            (${clientPayments.paymentDate} IS NULL
              AND ${clientPayments.createdAt} >= ${startTimestamp}
              AND ${clientPayments.createdAt} <= ${endTimestamp})
          )
        )`
      ) as any;
  }

  const [result] = await query;
  return parseFloat(result?.total || "0");
};

/* ==============================
   NEW: Individual Counsellor Performance (Based on Selected Filter)
============================== */
const getIndividualCounsellorPerformance = async (
  counsellorId: number,
  filter: DashboardFilter,
  dateRange: DateRange
): Promise<{
  current: number;
  previous: number;
  change: number;
  changeType: "increase" | "decrease" | "no-change";
  periodLabel: string;
}> => {
  const roleFilter = { userRole: "counsellor" as UserRole, counsellorId };

  // Get current period count (Core Service enrollments)
  const currentCount = await getCoreServiceCount(dateRange, roleFilter);

  // Get previous period count based on filter
  let previousCount = 0;
  let periodLabel = "";

  switch (filter) {
    case "today": {
      // Today vs Yesterday
      const yesterdayStart = new Date(dateRange.start);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);
      yesterdayStart.setHours(0, 0, 0, 0);

      previousCount = await getCoreServiceCount(
        {
          start: yesterdayStart,
          end: yesterdayEnd,
          previousStart: new Date(yesterdayStart.getTime() - 86400000),
          previousEnd: new Date(yesterdayEnd.getTime() - 86400000),
        },
        roleFilter
      );
      periodLabel = "Today vs Yesterday";
      break;
    }
    case "weekly": {
      // This week vs Last week (7 days before)
      const lastWeekStart = new Date(dateRange.start);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(dateRange.end);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

      previousCount = await getCoreServiceCount(
        {
          start: lastWeekStart,
          end: lastWeekEnd,
          previousStart: new Date(lastWeekStart.getTime() - 7 * 86400000),
          previousEnd: new Date(lastWeekEnd.getTime() - 7 * 86400000),
        },
        roleFilter
      );
      periodLabel = "This Week vs Last Week";
      break;
    }
    case "monthly": {
      // This month vs Last month
      const lastMonthStart = new Date(dateRange.start);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      const lastMonthEnd = new Date(dateRange.end);
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() - 1);
      lastMonthEnd.setDate(new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate());

      previousCount = await getCoreServiceCount(
        {
          start: lastMonthStart,
          end: lastMonthEnd,
          previousStart: new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() - 1, 1),
          previousEnd: new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), 0, 23, 59, 59, 999),
        },
        roleFilter
      );
      periodLabel = "This Month vs Last Month";
      break;
    }
    case "yearly": {
      // This year vs Last year
      const lastYearStart = new Date(dateRange.start);
      lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
      const lastYearEnd = new Date(dateRange.end);
      lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

      previousCount = await getCoreServiceCount(
        {
          start: lastYearStart,
          end: lastYearEnd,
          previousStart: new Date(lastYearStart.getFullYear() - 1, 0, 1),
          previousEnd: new Date(lastYearStart.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
        },
        roleFilter
      );
      periodLabel = "This Year vs Last Year";
      break;
    }
  }

  const change = calculatePercentageChange(currentCount, previousCount);

  return {
    current: currentCount,
    previous: previousCount,
    change: change.change,
    changeType: change.changeType,
    periodLabel,
  };
};

/* ==============================
   CHART DATA AGGREGATION
============================== */
type ChartRange = "today" | "week" | "month" | "year";

interface ChartDataPoint {
  label: string;
  coreSale: { count: number; amount: number };
  coreProduct: { count: number; amount: number };
  otherProduct: { count: number; amount: number };
  revenue: number;
}

interface ChartDataPointCounsellor {
  label: string;
  coreSale: { count: number };
  coreProduct: { count: number };
  otherProduct: { count: number };
}

const getChartData = async (
  range: ChartRange,
  dateRange: DateRange,
  roleFilter?: RoleBasedFilter
): Promise<{
  data: ChartDataPoint[];
  summary: { total: number };
}> => {
  const data: ChartDataPoint[] = [];
  let labels: string[] = [];
  let periods: Array<{ start: Date; end: Date }> = [];

  const now = new Date();
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // Helper function to format day name (short)
  const getDayNameShort = (date: Date): string => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return dayNames[date.getDay()];
  };

  // Helper function to format month name
  const getMonthName = (date: Date): string => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames[date.getMonth()];
  };

  // Generate periods based on range using dateRange
  switch (range) {
    case "today": {
      // Weekly data (7 days) for today filter - daily breakdown
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Thu 22", "Fri 23", etc.
        const dayName = getDayNameShort(currentDate);
        const day = currentDate.getDate();
        labels.push(`${dayName} ${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "week": {
      // Weekly data (7 days) - daily breakdown
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Thu 22", "Fri 23", etc.
        const dayName = getDayNameShort(currentDate);
        const day = currentDate.getDate();
        labels.push(`${dayName} ${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "month": {
      // Monthly data (30 days) - daily breakdown
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Dec 30", "Dec 31", "Jan 1", etc.
        const monthName = getMonthName(currentDate);
        const day = currentDate.getDate();
        labels.push(`${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "year": {
      // Yearly data (12 months) - monthly breakdown
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      let currentYear = startYear;
      let currentMonth = startMonth;

      while (
        currentYear < endYear ||
        (currentYear === endYear && currentMonth <= endMonth)
      ) {
        const start = new Date(currentYear, currentMonth, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentYear, currentMonth + 1, 0);
        end.setHours(23, 59, 59, 999);

        // For the last month, use endDate instead of end of month
        if (currentYear === endYear && currentMonth === endMonth) {
          end.setTime(endDate.getTime());
        }

        periods.push({ start, end });

        // Format: "Feb 2025", "Mar 2025", etc.
        labels.push(`${monthNames[currentMonth]}`);

        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      break;
    }
  }

  // Calculate data for each period
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const periodDateRange: DateRange = {
      start: period.start,
      end: period.end,
    };

    const [coreSaleCount, coreSaleAmount, coreProductMetrics, otherProductMetrics] = await Promise.all([
      getCoreServiceCount(periodDateRange, roleFilter),
      getCoreSaleAmount(periodDateRange, roleFilter),
      getCoreProductMetrics(periodDateRange, roleFilter),
      getOtherProductMetrics(periodDateRange, roleFilter),
    ]);

    const revenue = coreSaleAmount + coreProductMetrics.amount + otherProductMetrics.amount;

    data.push({
      label: labels[i],
      coreSale: {
        count: coreSaleCount,
        amount: coreSaleAmount,
      },
      coreProduct: {
        count: coreProductMetrics.count,
        amount: coreProductMetrics.amount,
      },
      otherProduct: {
        count: otherProductMetrics.count,
        amount: otherProductMetrics.amount,
      },
      revenue,
    });
  }

  // Calculate summary (total for current period only)
  const total = data.reduce((sum, point) => sum + point.revenue, 0);

  return {
    data,
    summary: {
      total,
    },
  };
};

const getChartDataCounsellor = async (
  range: ChartRange,
  dateRange: DateRange,
  roleFilter: RoleBasedFilter
): Promise<{
  data: ChartDataPointCounsellor[];
  summary: { total: number };
}> => {
  const data: ChartDataPointCounsellor[] = [];
  let labels: string[] = [];
  let periods: Array<{ start: Date; end: Date }> = [];

  const now = new Date();
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // Helper function to format day name (short) - same as admin/manager
  const getDayNameShort = (date: Date): string => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return dayNames[date.getDay()];
  };

  // Helper function to format month name - same as admin/manager
  const getMonthName = (date: Date): string => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames[date.getMonth()];
  };

  // Generate periods based on range using dateRange (same label format as admin/manager)
  switch (range) {
    case "today": {
      // Weekly data (7 days) for today filter - daily breakdown (same as admin/manager)
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Thu 22", "Fri 23", etc. (same as admin/manager)
        const dayName = getDayNameShort(currentDate);
        const day = currentDate.getDate();
        labels.push(`${dayName} ${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "week": {
      // Weekly data (7 days) - daily breakdown (same as admin/manager)
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Thu 22", "Fri 23", etc. (same as admin/manager)
        const dayName = getDayNameShort(currentDate);
        const day = currentDate.getDate();
        labels.push(`${dayName} ${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "month": {
      // Monthly data (30 days) - daily breakdown (same as admin/manager)
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        periods.push({ start, end });

        // Format: "Dec 30", "Dec 31", "Jan 1", etc. (same as admin/manager)
        const monthName = getMonthName(currentDate);
        const day = currentDate.getDate();
        labels.push(`${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
    }
    case "year": {
      // Yearly data (12 months) - monthly breakdown (same as admin/manager)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      let currentYear = startYear;
      let currentMonth = startMonth;

      while (
        currentYear < endYear ||
        (currentYear === endYear && currentMonth <= endMonth)
      ) {
        const start = new Date(currentYear, currentMonth, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentYear, currentMonth + 1, 0);
        end.setHours(23, 59, 59, 999);

        // For the last month, use endDate instead of end of month
        if (currentYear === endYear && currentMonth === endMonth) {
          end.setTime(endDate.getTime());
        }

        periods.push({ start, end });

        // Format: "Feb 2025", "Mar 2025", etc. (same as admin/manager)
        labels.push(`${monthNames[currentMonth]}`);

        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      break;
    }
  }

  // Calculate data for each period (counts only for counsellor)
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const periodDateRange: DateRange = {
      start: period.start,
      end: period.end,
    };

    const [coreSaleCount, coreProductMetrics, otherProductMetrics] = await Promise.all([
      getCoreServiceCount(periodDateRange, roleFilter),
      getCoreProductMetrics(periodDateRange, roleFilter),
      getOtherProductMetrics(periodDateRange, roleFilter),
    ]);

    data.push({
      label: labels[i],
      coreSale: {
        count: coreSaleCount,
      },
      coreProduct: {
        count: coreProductMetrics.count,
      },
      otherProduct: {
        count: otherProductMetrics.count,
      },
    });
  }

  // Calculate summary (total counts for counsellor - current period only)
  const total = data.reduce((sum, point) => sum + point.coreSale.count + point.coreProduct.count + point.otherProduct.count, 0);

  return {
    data,
    summary: {
      total,
    },
  };
};

/* ==============================
   MAIN DASHBOARD STATS FUNCTION
============================== */
export const getDashboardStats = async (
  filter: DashboardFilter,
  beforeDate?: string,
  afterDate?: string,
  userId?: number,
  userRole?: UserRole,
  range?: ChartRange
): Promise<DashboardStats> => {
  // Get date ranges
  const dateRange = getDateRange(filter, beforeDate, afterDate);
  const todayOnlyDateRange = getTodayOnlyDateRange();
  const allTimeDateRange = getAllTimeDateRange();
  // Summary cards follow filter: today = today only; weekly/monthly/yearly = that period
  const summaryDateRange = filter === "today" ? todayOnlyDateRange : dateRange;

  // Determine role and build filter
  const roleFilter: RoleBasedFilter | undefined =
    userRole === "counsellor" && userId
      ? { userRole: "counsellor", userId, counsellorId: userId }
      : userRole === "admin" || userRole === "manager"
      ? { userRole }
      : undefined;

  // Handle Counsellor Dashboard
  // Summary cards use summaryDateRange (filter-based). totalPendingAmount = all clients always.
  if (userRole === "counsellor" && userId) {
    const [
      coreSaleCount,
      coreProductMetrics,
      otherProductMetrics,
      totalPendingAmount,
      totalClientsCount,
      newEnrollmentCount,
      leaderboardData,
      individualPerformance,
      chartData,
    ] = await Promise.all([
      getCoreServiceCount(summaryDateRange, roleFilter),
      getCoreProductMetrics(summaryDateRange, roleFilter),
      getOtherProductMetrics(summaryDateRange, roleFilter),
      getPendingAmount(allTimeDateRange, roleFilter),
      getTotalClients(allTimeDateRange, roleFilter),
      getNewEnrollments(filter, summaryDateRange, roleFilter),
      getLeaderboard(new Date().getMonth() + 1, new Date().getFullYear()),
      getIndividualCounsellorPerformance(userId, filter, dateRange),
      getChartDataCounsellor(range || "today", dateRange, roleFilter!),
    ]);

    const counsellorStats: CounsellorDashboardStats = {
      coreSale: {
        number: coreSaleCount,
      },
      coreProduct: {
        number: coreProductMetrics.count,
      },
      otherProduct: {
        number: otherProductMetrics.count,
      },
      totalPendingAmount: {
        amount: totalPendingAmount.pendingAmount,
      },
      totalClients: {
        count: totalClientsCount,
      },
      newEnrollment: {
        count: newEnrollmentCount.count,
      },
      leaderboard: leaderboardData, // Same full leaderboard array as admin/manager
      individualPerformance,
      chartData,
    };

    return counsellorStats;
  }

  // Handle Admin/Manager Dashboard
  // Summary cards use summaryDateRange (filter-based). totalPendingAmount = all clients. Revenue = last 7 days when filter is "today", else filter period.
  const [
    newEnrollmentCount,
    coreSaleCount,
    coreSaleAmount,
    coreProductMetrics,
    otherProductMetrics,
    totalPendingAmount,
    leaderboardData,
    chartData,
  ] = await Promise.all([
    getNewEnrollments(filter, summaryDateRange, roleFilter),
    getCoreServiceCount(summaryDateRange, roleFilter),
    getCoreSaleAmount(summaryDateRange, roleFilter),
    getCoreProductMetrics(summaryDateRange, roleFilter),
    getOtherProductMetrics(summaryDateRange, roleFilter),
    getPendingAmount(allTimeDateRange, roleFilter),
    getLeaderboard(new Date().getMonth() + 1, new Date().getFullYear()),
    getChartData(range || "today", dateRange, roleFilter),
  ]);

  // Revenue: when filter is "today" show last 7 days (weekly); otherwise use same period as cards
  let totalRevenue: number;
  if (filter === "today") {
    const weeklyRange = getDateRange("weekly");
    const [revenueSale, revenueCore, revenueOther] = await Promise.all([
      getCoreSaleAmount(weeklyRange, roleFilter),
      getCoreProductMetrics(weeklyRange, roleFilter),
      getOtherProductMetrics(weeklyRange, roleFilter),
    ]);
    totalRevenue = revenueSale + revenueCore.amount + revenueOther.amount;
  } else {
    totalRevenue =
      coreSaleAmount + coreProductMetrics.amount + otherProductMetrics.amount;
  }

  const adminManagerStats: AdminManagerDashboardStats = {
    newEnrollment: {
      count: newEnrollmentCount.count,
    },
    coreSale: {
      number: coreSaleCount,
      amount: coreSaleAmount.toFixed(2),
    },
    coreProduct: {
      number: coreProductMetrics.count,
      amount: coreProductMetrics.amount.toFixed(2),
    },
    otherProduct: {
      number: otherProductMetrics.count,
      amount: otherProductMetrics.amount.toFixed(2),
    },
    totalPendingAmount: {
      amount: totalPendingAmount.pendingAmount,
    },
    revenue: {
      amount: totalRevenue.toFixed(2),
    },
    leaderboard: leaderboardData,
    chartData,
  };

  return adminManagerStats;
};
