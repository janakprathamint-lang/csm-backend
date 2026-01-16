import { db } from "../config/databaseConnection";
import { activityLog } from "../schemas/activityLog.schema";
import { users } from "../schemas/users.schema";
import { clientInformation } from "../schemas/clientInformation.schema";
import { eq, and, or, desc, sql, gte, lte, isNotNull } from "drizzle-orm";
import { Role } from "../types/role";

interface GetActivityLogsFilters {
  userId?: number;
  userRole?: Role;
  clientId?: number;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get activity logs with role-based filtering
 */
export const getActivityLogs = async (filters: GetActivityLogsFilters) => {
  const {
    userId,
    userRole,
    clientId,
    action,
    entityType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filters;

  let query = db
    .select({
      logId: activityLog.logId,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      clientId: activityLog.clientId,
      action: activityLog.action,
      oldValue: activityLog.oldValue,
      newValue: activityLog.newValue,
      description: activityLog.description,
      metadata: activityLog.metadata,
      performedBy: activityLog.performedBy,
      ipAddress: activityLog.ipAddress,
      userAgent: activityLog.userAgent,
      createdAt: activityLog.createdAt,
      // Performer info
      performerName: users.fullName,
      performerEmail: users.email,
      performerRole: users.role,
      // Client info (if applicable)
      clientName: clientInformation.fullName,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.performedBy, users.id))
    .leftJoin(
      clientInformation,
      eq(activityLog.clientId, clientInformation.clientId)
    );

  const conditions: any[] = [];

  // Role-based filtering
  if (userRole === "admin") {
    // Admin sees all logs - no filter needed
  } else if (userRole === "manager") {
    // Manager sees only counsellor activities
    conditions.push(eq(users.role, "counsellor"));
  } else if (userRole === "counsellor" && userId) {
    // Counsellor sees:
    // 1. Their own activities
    // 2. Manager activities on their clients
    conditions.push(
      or(
        eq(activityLog.performedBy, userId),
        and(
          isNotNull(activityLog.clientId),
          eq(clientInformation.counsellorId, userId),
          eq(users.role, "manager")
        )
      )
    );
  }

  // Additional filters
  if (clientId) {
    conditions.push(eq(activityLog.clientId, clientId));
  }

  if (action) {
    conditions.push(eq(activityLog.action, action as any));
  }

  if (entityType) {
    conditions.push(eq(activityLog.entityType, entityType));
  }

  if (startDate) {
    conditions.push(gte(activityLog.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(activityLog.createdAt, endDate));
  }

  // Apply all conditions
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Order by newest first
  query = query.orderBy(desc(activityLog.createdAt)) as any;

  // Pagination
  query = query.limit(limit).offset(offset) as any;

  return await query;
};

/**
 * Get total count of activity logs (for pagination)
 */
export const getActivityLogsCount = async (filters: GetActivityLogsFilters) => {
  const { userId, userRole, clientId, action, entityType, startDate, endDate } =
    filters;

  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.performedBy, users.id))
    .leftJoin(
      clientInformation,
      eq(activityLog.clientId, clientInformation.clientId)
    );

  const conditions: any[] = [];

  // Role-based filtering (same as getActivityLogs)
  if (userRole === "admin") {
    // Admin sees all logs
  } else if (userRole === "manager") {
    conditions.push(eq(users.role, "counsellor"));
  } else if (userRole === "counsellor" && userId) {
    conditions.push(
      or(
        eq(activityLog.performedBy, userId),
        and(
          isNotNull(activityLog.clientId),
          eq(clientInformation.counsellorId, userId),
          eq(users.role, "manager")
        )
      )
    );
  }

  // Additional filters
  if (clientId) {
    conditions.push(eq(activityLog.clientId, clientId));
  }

  if (action) {
    conditions.push(eq(activityLog.action, action as any));
  }

  if (entityType) {
    conditions.push(eq(activityLog.entityType, entityType));
  }

  if (startDate) {
    conditions.push(gte(activityLog.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(activityLog.createdAt, endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const result = await query;
  return result[0]?.count || 0;
};
