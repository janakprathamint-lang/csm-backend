import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { clientPayments } from "../schemas/clientPayment.schema";
import { clientProductPayments } from "../schemas/clientProductPayments.schema";
import { saleTypes } from "../schemas/saleType.schema";
import { beaconAccount } from "../schemas/beaconAccount.schema";
import { insurance } from "../schemas/insurance.schema";
import { airTicket } from "../schemas/airTicket.schema";
import { forexFees } from "../schemas/forexFees.schema";
import { newSell } from "../schemas/newSell.schema";
import { creditCard } from "../schemas/creditCard.schema";
import { ielts } from "../schemas/ielts.schema";
import { loan } from "../schemas/loan.schema";
import { visaExtension } from "../schemas/visaExtension.schema";
import { eq, and, gte, lte, sql, count, inArray, isNotNull } from "drizzle-orm";

/* ==============================
   TYPES
============================== */
export type DashboardFilter = "today" | "weekly" | "monthly" | "yearly" | "custom";

export interface DashboardStats {
  totalClients: {
    count: number;
    change: number;
    changeType: "increase" | "decrease" | "no-change";
  };
  totalRevenue: {
    totalCorePayment: string;  // From clientPayments table
    totalProductPayment: string; // From clientProductPayments table
    total: string;
    change: number;
    changeType: "increase" | "decrease" | "no-change";
  };
  pendingAmount: {
    pendingAmount: string;
    breakdown: {
      initial: string;
      beforeVisa: string;
      afterVisa: string;
      submittedVisa: string;
    };
    label: string;
  };
  newEnrollments: {
    count: number;
    label: string;
  };
  revenueOverview: Array<{
    month: string;
    revenue: string;
  }>;
}

interface DateRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

/* ==============================
   DATE RANGE HELPERS
============================== */
const getDateRange = (
  filter: DashboardFilter,
  beforeDate?: string,
  afterDate?: string
): DateRange => {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  let start: Date;
  let end: Date = now;

  switch (filter) {
    case "today": {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "weekly": {
      start = new Date(now);
      start.setDate(start.getDate() - 6); // Last 7 days (including today)
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "monthly": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "yearly": {
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "custom": {
      if (!afterDate || !beforeDate) {
        throw new Error("beforeDate and afterDate are required for custom filter");
      }
      start = new Date(afterDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(beforeDate);
      end.setHours(23, 59, 59, 999);
      break;
    }
    default:
      throw new Error("Invalid filter type");
  }

  // Calculate previous period for comparison
  const periodLength = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1); // One day before start
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - periodLength);
  previousStart.setHours(0, 0, 0, 0);

  return { start, end, previousStart, previousEnd };
};

/* ==============================
   TOTAL CLIENTS
============================== */
const getTotalClients = async (dateRange: DateRange): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(clientInformation)
    .where(
      and(
        eq(clientInformation.archived, false),
        gte(clientInformation.createdAt, dateRange.start),
        lte(clientInformation.createdAt, dateRange.end)
      )
    );

  return result?.count || 0;
};

const getTotalClientsPrevious = async (
  dateRange: DateRange
): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(clientInformation)
    .where(
      and(
        eq(clientInformation.archived, false),
        gte(clientInformation.createdAt, dateRange.previousStart),
        lte(clientInformation.createdAt, dateRange.previousEnd)
      )
    );

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
            amountColumn = creditCard.amount;
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
   TOTAL REVENUE
============================== */
const getTotalRevenue = async (dateRange: DateRange): Promise<{ totalCorePayment: string; totalProductPayment: string; total: string }> => {
  const startDateStr = dateRange.start.toISOString().split("T")[0];
  const endDateStr = dateRange.end.toISOString().split("T")[0];
  const startTimestamp = dateRange.start.toISOString();
  const endTimestamp = dateRange.end.toISOString();

  // 1. Sum of client payments (core products)
  // Count only INITIAL + BEFORE_VISA + AFTER_VISA stages (exclude SUBMITTED_VISA)
  // Filter by date range (paymentDate or createdAt)
  const [clientPaymentsResult] = await db
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
    );

  // 2. Sum of product payments with amount (master_only products)
  // Filter by date range (paymentDate or createdAt)
  const [productPaymentsWithAmount] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientProductPayments.amount}::numeric), 0)`,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NOT NULL
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
    );

  // 3. Get entity-based product payments (amount is NULL, stored in entity tables)
  // Filter by date range (paymentDate or createdAt)
  const productPaymentsWithEntity = await db
    .select({
      entityType: clientProductPayments.entityType,
      entityId: clientProductPayments.entityId,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NULL
        AND ${clientProductPayments.entityId} IS NOT NULL
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
    );

  // 4. Fetch amounts from entity tables
  let entityAmountsTotal = 0;
  if (productPaymentsWithEntity.length > 0) {
    // Group by entity type
    const entityGroups: Record<string, number[]> = {};
    productPaymentsWithEntity.forEach((pp) => {
      if (pp.entityId && pp.entityType) {
        if (!entityGroups[pp.entityType]) {
          entityGroups[pp.entityType] = [];
        }
        entityGroups[pp.entityType].push(pp.entityId);
      }
    });

    // Fetch amounts from each entity type
    for (const [entityType, entityIds] of Object.entries(entityGroups)) {
      const amount = await getEntityAmounts(entityType, entityIds);
      entityAmountsTotal += amount;
    }
  }

  const clientPaymentsTotal = parseFloat(clientPaymentsResult?.total || "0");
  const productPaymentsTotal = parseFloat(productPaymentsWithAmount?.total || "0");
  const productPaymentsWithEntityTotal = entityAmountsTotal;
  const totalProductPayment = productPaymentsTotal + productPaymentsWithEntityTotal;
  const total = clientPaymentsTotal + totalProductPayment;

  return {
    totalCorePayment: clientPaymentsTotal.toFixed(2),
    totalProductPayment: totalProductPayment.toFixed(2),
    total: total.toFixed(2),
  };
};

const getTotalRevenuePrevious = async (
  dateRange: DateRange
): Promise<{ totalCorePayment: string; totalProductPayment: string; total: string }> => {
  const prevStartDateStr = dateRange.previousStart.toISOString().split("T")[0];
  const prevEndDateStr = dateRange.previousEnd.toISOString().split("T")[0];
  const prevStartTimestamp = dateRange.previousStart.toISOString();
  const prevEndTimestamp = dateRange.previousEnd.toISOString();

  // 1. Client payments - previous period
  // Count only INITIAL + BEFORE_VISA + AFTER_VISA stages (exclude SUBMITTED_VISA)
  // Filter by previous period date range
  const [clientPaymentsResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientPayments.amount}::numeric), 0)`,
    })
    .from(clientPayments)
    .where(
      sql`(
        ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
        AND (
          (${clientPayments.paymentDate} IS NOT NULL
            AND ${clientPayments.paymentDate} >= ${prevStartDateStr}
            AND ${clientPayments.paymentDate} <= ${prevEndDateStr})
          OR
          (${clientPayments.paymentDate} IS NULL
            AND ${clientPayments.createdAt} >= ${prevStartTimestamp}
            AND ${clientPayments.createdAt} <= ${prevEndTimestamp})
        )
      )`
    );

  // 2. Product payments with amount - previous period
  // Filter by previous period date range
  const [productPaymentsWithAmount] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientProductPayments.amount}::numeric), 0)`,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NOT NULL
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${prevStartDateStr}
            AND ${clientProductPayments.paymentDate} <= ${prevEndDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${prevStartTimestamp}
            AND ${clientProductPayments.createdAt} <= ${prevEndTimestamp})
        )
      )`
    );

  // 3. Entity-based product payments - previous period
  // Filter by previous period date range
  const productPaymentsWithEntity = await db
    .select({
      entityType: clientProductPayments.entityType,
      entityId: clientProductPayments.entityId,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NULL
        AND ${clientProductPayments.entityId} IS NOT NULL
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL
            AND ${clientProductPayments.paymentDate} >= ${prevStartDateStr}
            AND ${clientProductPayments.paymentDate} <= ${prevEndDateStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL
            AND ${clientProductPayments.createdAt} >= ${prevStartTimestamp}
            AND ${clientProductPayments.createdAt} <= ${prevEndTimestamp})
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
  const productPaymentsWithEntityTotal = entityAmountsTotal;
  const totalProductPayment = productPaymentsTotal + productPaymentsWithEntityTotal;
  const total = clientPaymentsTotal + totalProductPayment;

  return {
    totalCorePayment: clientPaymentsTotal.toFixed(2),
    totalProductPayment: totalProductPayment.toFixed(2),
    total: total.toFixed(2),
  };
};

/* ==============================
   PENDING AMOUNT (OUTSTANDING)
============================== */
const getPendingAmount = async (dateRange: DateRange): Promise<{ pendingAmount: string; breakdown: { initial: string; beforeVisa: string; afterVisa: string; submittedVisa: string } }> => {
  // Get ALL non-archived clients (not filtered by date range)
  // Pending amount should show for all clients regardless of creation date
  const clients = await db
    .select({
      clientId: clientInformation.clientId,
      saleTypeId: clientInformation.saleTypeId,
    })
    .from(clientInformation)
    .where(eq(clientInformation.archived, false));

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

  // Also add clients that don't have any payments yet (use saleTypes.amount if available, otherwise 0)
  const clientsWithoutPayments = clients.filter((c) => !clientExpectedMap.has(c.clientId));
  if (clientsWithoutPayments.length > 0) {
    const saleTypeIds = [...new Set(clientsWithoutPayments.map((c) => c.saleTypeId))];
    const saleTypesData = saleTypeIds.length > 0 ? await db
      .select({
        saleTypeId: saleTypes.saleTypeId,
        amount: saleTypes.amount,
      })
      .from(saleTypes)
      .where(inArray(saleTypes.saleTypeId, saleTypeIds))
      : [];

    const saleTypeMap = new Map(
      saleTypesData.map((st) => {
        const amount = st.amount ? parseFloat(st.amount) : 0;
        return [st.saleTypeId, amount];
      })
    );

    clientsWithoutPayments.forEach((client) => {
      const expected = saleTypeMap.get(client.saleTypeId) || 0;
      totalExpected += expected;
    });
  }

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
  console.log("=== PENDING AMOUNT CALCULATION DEBUG ===");
  console.log("Total Clients:", clients.length);
  console.log("Clients with payments:", clientExpectedMap.size);
  console.log("Clients without payments:", clientsWithoutPayments.length);
  console.log("Total Expected (from clientPayments.totalPayment):", totalExpected);
  console.log("Total Paid (INITIAL + BEFORE_VISA + AFTER_VISA):", totalPaid);
  console.log("Breakdown:", breakdown);
  console.log("Calculated Pending Amount:", totalExpected - totalPaid);
  console.log("========================================");

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
  dateRange: DateRange
): Promise<{ count: number; label: string }> => {
  const [result] = await db
    .select({ count: count() })
    .from(clientInformation)
    .where(
      and(
        eq(clientInformation.archived, false),
        gte(clientInformation.createdAt, dateRange.start),
        lte(clientInformation.createdAt, dateRange.end)
      )
    );

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
    case "custom":
      label = "new clients in period";
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
  // 1. Client payments for this month
  const [clientPaymentsResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientPayments.amount}::numeric), 0)`,
    })
    .from(clientPayments)
    .where(
      sql`(
        ${clientPayments.stage} IN ('INITIAL', 'BEFORE_VISA', 'AFTER_VISA')
        AND (
          (${clientPayments.paymentDate} IS NOT NULL AND ${clientPayments.paymentDate} >= ${monthStartStr} AND ${clientPayments.paymentDate} <= ${monthEndStr})
          OR
          (${clientPayments.paymentDate} IS NULL AND ${clientPayments.createdAt} >= ${monthStartTimestamp} AND ${clientPayments.createdAt} <= ${monthEndTimestamp})
        )
      )`
    );

  // 2. Product payments with amount for this month
  const [productPaymentsWithAmount] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${clientProductPayments.amount}::numeric), 0)`,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NOT NULL
        AND (
          (${clientProductPayments.paymentDate} IS NOT NULL AND ${clientProductPayments.paymentDate} >= ${monthStartStr} AND ${clientProductPayments.paymentDate} <= ${monthEndStr})
          OR
          (${clientProductPayments.paymentDate} IS NULL AND ${clientProductPayments.createdAt} >= ${monthStartTimestamp} AND ${clientProductPayments.createdAt} <= ${monthEndTimestamp})
        )
      )`
    );

  // 3. Entity-based product payments for this month
  const productPaymentsWithEntity = await db
    .select({
      entityType: clientProductPayments.entityType,
      entityId: clientProductPayments.entityId,
    })
    .from(clientProductPayments)
    .where(
      sql`(
        ${clientProductPayments.amount} IS NULL
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

  // For custom filter, show all 12 months of the year that contains the date range
  if (filter === "custom" && dateRange) {
    const endDate = new Date(dateRange.end);
    const targetYear = endDate.getFullYear();

    // Show all 12 months of the target year
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(targetYear, month, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(targetYear, month + 1, 0);
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
  } else {
    // For other filters, show last 12 months from current date
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
   MAIN DASHBOARD STATS FUNCTION
============================== */
export const getDashboardStats = async (
  filter: DashboardFilter,
  beforeDate?: string,
  afterDate?: string
): Promise<DashboardStats> => {
  // Get date ranges
  const dateRange = getDateRange(filter, beforeDate, afterDate);

  // Calculate all metrics in parallel
  const [
    totalClients,
    totalClientsPrevious,
    totalRevenue,
    totalRevenuePrevious,
    pendingAmount,
    newEnrollments,
    revenueOverview,
  ] = await Promise.all([
    getTotalClients(dateRange),
    getTotalClientsPrevious(dateRange),
    getTotalRevenue(dateRange),
    getTotalRevenuePrevious(dateRange),
    getPendingAmount(dateRange),
    getNewEnrollments(filter, dateRange),
    getRevenueOverview(filter, dateRange),
  ]);

  // Calculate percentage changes
  const clientsChange = calculatePercentageChange(
    totalClients,
    totalClientsPrevious
  );
  const revenueChange = calculatePercentageChange(
    parseFloat(totalRevenue.total),
    parseFloat(totalRevenuePrevious.total)
  );

  return {
    totalClients: {
      count: totalClients,
      change: clientsChange.change,
      changeType: clientsChange.changeType,
    },
    totalRevenue: {
      totalCorePayment: totalRevenue.totalCorePayment,
      totalProductPayment: totalRevenue.totalProductPayment,
      total: totalRevenue.total,
      change: revenueChange.change,
      changeType: revenueChange.changeType,
    },
    pendingAmount: {
      pendingAmount: pendingAmount.pendingAmount,
      breakdown: pendingAmount.breakdown,
      label: "total outstanding",
    },
    newEnrollments,
    revenueOverview,
  };
};
