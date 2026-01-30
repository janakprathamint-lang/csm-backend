import { Request, Response } from "express";
import { saveClient, getClientFullDetailsById,getClientsByCounsellor, getAllCounsellorIds, getAllClientsForAdmin, getAllClientsForManager, getArchivedClientsByCounsellor, getAllArchivedClientsForAdmin, getAllArchivedClientsForManager, updateClientArchiveStatus, getAllClients, updateClientCounsellor } from "../models/client.model";
import { getProductPaymentsByClientId } from "../models/clientProductPayments.model";
import { emitToCounsellor, emitToAdmin, emitDashboardUpdate, emitToCounsellors } from "../config/socket";
import { getDashboardStats } from "../models/dashboard.model";
import { getLeaderboard, getMonthlyEnrollmentGoal } from "../models/leaderboard.model";
import { logActivity } from "../services/activityLog.service";
import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { users } from "../schemas/users.schema";
import { eq } from "drizzle-orm";
import { getCounsellorById } from "../models/user.model";

/* ==============================
   CREATE CLIENT
============================== */
// export const createClientController = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const client = await createClient(req.body);

//     res.status(201).json({
//       success: true,
//       data: client,
//     });
//   } catch (error: any) {
//     res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
export const saveClientController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Fetch old value if updating
    let oldValue = null;
    if (req.body.clientId) {
      try {
        const [oldClient] = await db
          .select()
          .from(clientInformation)
          .where(eq(clientInformation.clientId, req.body.clientId));
        if (oldClient) {
          oldValue = {
            clientId: oldClient.clientId,
            fullName: oldClient.fullName,
            enrollmentDate: oldClient.enrollmentDate,
            passportDetails: oldClient.passportDetails,
            leadTypeId: oldClient.leadTypeId,
            counsellorId: oldClient.counsellorId,
          };
        }
      } catch (error) {
        // Continue even if fetching old value fails
        console.error("Error fetching old client value:", error);
      }
    }

    console.log("req.body client", req.body);
    const client = await saveClient(req.body, req.user.id);

    // Log activity ONLY when a real insert or real update happens (rowCount > 0 or action is CREATED)
    // Skip logging if action is NO_CHANGE (data was identical, no actual update occurred)
    if (client.action !== "NO_CHANGE") {
      try {
        const action = client.action === "CREATED" ? "CREATE" : "UPDATE";
        await logActivity(req, {
          entityType: "client",
          entityId: client.client.clientId,
          clientId: client.client.clientId,
          action: action,
          oldValue: oldValue,
          newValue: client.client,
          description: client.action === "CREATED"
            ? `Client created: ${client.client.fullName}`
            : `Client updated: ${client.client.fullName}`,
          performedBy: req.user.id,
        });
      } catch (activityError) {
        // Don't fail the request if activity log fails
        console.error("Activity log error in saveClientController:", activityError);
      }
    }

    // Emit WebSocket event for real-time updates
    try {
      const counsellorId = req.user.id;
      const eventName = client.action === "CREATED" ? "client:created" : "client:updated";

      // Get counsellor's client list
      const counsellorClients = await getClientsByCounsellor(counsellorId);

      // Get all clients for admin
      const adminClients = await getAllClientsForAdmin();

      // Prepare event data for counsellor
      const counsellorEventData = {
        action: client.action,
        client: client.client,
        clients: counsellorClients, // Counsellor's list
      };

      // Prepare event data for admin
      const adminEventData = {
        action: client.action,
        client: client.client,
        clients: adminClients, // Full admin list
      };

      // Log the structure being sent (for debugging)
      console.log(`📤 Emitting ${eventName} to counsellor ${counsellorId}:`, {
        action: counsellorEventData.action,
        clientId: counsellorEventData.client?.clientId,
        clientsStructure: {
          type: typeof counsellorEventData.clients,
          isArray: Array.isArray(counsellorEventData.clients),
          keys: typeof counsellorEventData.clients === 'object' ? Object.keys(counsellorEventData.clients) : null,
          sampleYear: typeof counsellorEventData.clients === 'object' && !Array.isArray(counsellorEventData.clients)
            ? Object.keys(counsellorEventData.clients)[0]
            : null,
        },
      });

      // Emit to counsellor's room
      emitToCounsellor(counsellorId, eventName, counsellorEventData);

      // Emit to admin room
      emitToAdmin(eventName, adminEventData);

      // Emit dashboard update for "today" filter
      try {
        const dashboardStats = await getDashboardStats("today");
        emitDashboardUpdate("dashboard:updated", {
          filter: "today",
          data: dashboardStats,
        });
      } catch (dashboardError) {
        console.error("Dashboard update emit error:", dashboardError);
      }

      // Emit leaderboard and enrollment goal updates for current month
      try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Get updated leaderboard data
        const leaderboardData = await getLeaderboard(currentMonth, currentYear);

        // Emit leaderboard update to all counselors (for Image 1)
        emitToCounsellors("leaderboard:updated", {
          month: currentMonth,
          year: currentYear,
          leaderboard: leaderboardData,
        });

        // Emit enrollment goal update for the counselor who created/updated the client
        const enrollmentGoalData = await getMonthlyEnrollmentGoal(
          counsellorId,
          currentMonth,
          currentYear
        );
        emitToCounsellor(counsellorId, "enrollment-goal:updated", {
          month: currentMonth,
          year: currentYear,
          data: enrollmentGoalData,
        });

        // Also emit to admin and manager rooms for enrollment goal updates
        // Admin and managers can view any counselor's enrollment goal
        emitToAdmin("enrollment-goal:updated", {
          month: currentMonth,
          year: currentYear,
          counsellorId: counsellorId,
          data: enrollmentGoalData,
        });
      } catch (leaderboardError) {
        console.error("Leaderboard/enrollment goal update emit error:", leaderboardError);
      }
    } catch (wsError) {
      // Don't fail the request if WebSocket fails
      console.error("WebSocket emit error:", wsError);
    }

    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getClientFullDetailsController = async (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const data = await getClientFullDetailsById(clientId);

    if (!data) {
      return res.status(404).json({ message: "Client not found" });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// get all clients (for counsellor / admin) - excludes archived clients
export const getAllClientsController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;
    let clients;

    // Step 1: Check if user is admin
    if (userRole === "admin") {
      // Admin gets all clients from all counsellors
      clients = await getAllClientsForAdmin();

      // Emit WebSocket event to admin room
      try {
        emitToAdmin("clients:fetched", {
          clients,
          timestamp: new Date().toISOString(),
        });
      } catch (wsError) {
        console.error("WebSocket emit error in getAllClientsController (admin):", wsError);
      }
    }
    // Step 2: Check if user is manager
    else if (userRole === "manager") {
      // Fetch manager's isSupervisor status from database
      const [manager] = await db
        .select({
          id: users.id,
          isSupervisor: users.isSupervisor,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!manager) {
        return res.status(404).json({
          success: false,
          message: "Manager not found",
        });
      }

      // Step 3: If supervisor, get all clients (like admin)
      if (manager.isSupervisor) {
        clients = await getAllClientsForAdmin();

        // Emit WebSocket event to admin room (supervisor sees all)
        try {
          emitToAdmin("clients:fetched", {
            clients,
            timestamp: new Date().toISOString(),
          });
        } catch (wsError) {
          console.error("WebSocket emit error in getAllClientsController (supervisor manager):", wsError);
        }
      }
      // Step 4: If not supervisor, get clients from their assigned counsellors
      else {
        clients = await getAllClientsForManager(userId);

        // Emit WebSocket event to manager's room
        try {
          emitToCounsellor(userId, "clients:fetched", {
            counsellorId: userId,
            clients,
            timestamp: new Date().toISOString(),
          });
        } catch (wsError) {
          console.error("WebSocket emit error in getAllClientsController (regular manager):", wsError);
        }
      }
    }
    // Step 5: Counsellor gets their own clients
    else {
      // Counsellor gets their own clients
      clients = await getClientsByCounsellor(userId);

      // Emit WebSocket event to counsellor's room
      try {
        emitToCounsellor(userId, "clients:fetched", {
          counsellorId: userId,
          clients,
          timestamp: new Date().toISOString(),
        });
      } catch (wsError) {
        console.error("WebSocket emit error in getAllClientsController (counsellor):", wsError);
      }
    }

    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// get all clients by counsellor
export const getAllClientsByCounsellorController = async (req: Request, res: Response) => {
  try {
    const counsellorId = Number(req.params.counsellorId);

    if (isNaN(counsellorId) || counsellorId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid counsellor ID",
      });
    }

    const clients = await getClientsByCounsellor(counsellorId);

    // Emit WebSocket event to notify all clients in this counsellor's room
    try {
      emitToCounsellor(counsellorId, "clients:fetched", {
        counsellorId,
        clients,
        timestamp: new Date().toISOString(),
      });
    } catch (wsError) {
      // Don't fail the request if WebSocket fails
      console.error("WebSocket emit error in getAllClientsByCounsellorController:", wsError);
    }

    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// get all clients by counsellor (admin)
export const getClientsByCounsellorAdminController = async (
  req: Request,
  res: Response
) => {
  const counsellorId = Number(req.params.counsellorId);

  if (Number.isNaN(counsellorId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid counsellorId"
    });
  }

  const clients = await getClientsByCounsellor(counsellorId);

  res.status(200).json({
    success: true,
    data: clients
  });
};

// get client complete details (client info + payments + product payments with entity data)
export const getClientCompleteDetailsController = async (req: Request, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid clientId is required",
      });
    }

    // Get client full details using existing function
    // This already includes productPayments with entity data
    const clientData = await getClientFullDetailsById(clientId);

    if (!clientData) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Use productPayments from clientData (already includes entity data)

    const completeDetails = {
      client: clientData.client,
      leadType: clientData.leadType,
      payments: clientData.payments,
      productPayments: clientData.productPayments, // Already enhanced with entity data
    };

    res.status(200).json({
      success: true,
      data: completeDetails,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch client details",
    });
  }
};

/* ==============================
   GET ARCHIVED CLIENTS
============================== */
export const getArchivedClientsController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;
    let clients;

    // Step 1: Check if user is admin
    if (userRole === "admin") {
      // Admin gets all archived clients from all counsellors
      clients = await getAllArchivedClientsForAdmin();

      // Emit WebSocket event to admin room
      try {
        emitToAdmin("archived-clients:fetched", {
          clients,
          timestamp: new Date().toISOString(),
        });
      } catch (wsError) {
        console.error("WebSocket emit error in getArchivedClientsController (admin):", wsError);
      }
    }
    // Step 2: Check if user is manager
    else if (userRole === "manager") {
      // Fetch manager's isSupervisor status from database
      const [manager] = await db
        .select({
          id: users.id,
          isSupervisor: users.isSupervisor,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!manager) {
        return res.status(404).json({
          success: false,
          message: "Manager not found",
        });
      }

      // Step 3: If supervisor, get all archived clients (like admin)
      if (manager.isSupervisor) {
        clients = await getAllArchivedClientsForAdmin();

        // Emit WebSocket event to admin room (supervisor sees all)
        try {
          emitToAdmin("archived-clients:fetched", {
            clients,
            timestamp: new Date().toISOString(),
          });
        } catch (wsError) {
          console.error("WebSocket emit error in getArchivedClientsController (supervisor manager):", wsError);
        }
      }
      // Step 4: If not supervisor, get archived clients from their assigned counsellors
      else {
        clients = await getAllArchivedClientsForManager(userId);

        // Emit WebSocket event to manager's room
        try {
          emitToCounsellor(userId, "archived-clients:fetched", {
            counsellorId: userId,
            clients,
            timestamp: new Date().toISOString(),
          });
        } catch (wsError) {
          console.error("WebSocket emit error in getArchivedClientsController (regular manager):", wsError);
        }
      }
    }
    // Step 5: Counsellor gets their own archived clients
    else {
      // Counsellor gets their own archived clients
      clients = await getArchivedClientsByCounsellor(userId);

      // Emit WebSocket event to counsellor's room
      try {
        emitToCounsellor(userId, "archived-clients:fetched", {
          counsellorId: userId,
          clients,
          timestamp: new Date().toISOString(),
        });
      } catch (wsError) {
        console.error("WebSocket emit error in getArchivedClientsController (counsellor):", wsError);
      }
    }

    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* ==============================
   ARCHIVE/UNARCHIVE CLIENT
============================== */
export const archiveClientController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const clientId = Number(req.params.clientId);
    const { archived } = req.body;

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid clientId is required",
      });
    }

    if (typeof archived !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "archived field must be a boolean (true or false)",
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    // Get client to check ownership/permissions
    const [client] = await db
      .select({
        clientId: clientInformation.clientId,
        counsellorId: clientInformation.counsellorId,
        fullName: clientInformation.fullName,
        archived: clientInformation.archived,
      })
      .from(clientInformation)
      .where(eq(clientInformation.clientId, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Check permissions based on role
    let hasPermission = false;

    if (userRole === "admin") {
      // Admin can archive/unarchive any client
      hasPermission = true;
    } else if (userRole === "manager") {
      // Fetch manager's isSupervisor status
      const [manager] = await db
        .select({
          id: users.id,
          isSupervisor: users.isSupervisor,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!manager) {
        return res.status(404).json({
          success: false,
          message: "Manager not found",
        });
      }

      if (manager.isSupervisor) {
        // Supervisor manager can archive/unarchive any client
        hasPermission = true;
      } else {
        // Regular manager can only archive/unarchive clients from their counsellors
        const [counsellor] = await db
          .select({
            id: users.id,
            managerId: users.managerId,
          })
          .from(users)
          .where(eq(users.id, client.counsellorId))
          .limit(1);

        if (counsellor && counsellor.managerId === userId) {
          hasPermission = true;
        }
      }
    } else if (userRole === "counsellor") {
      // Counsellor can only archive/unarchive their own clients
      if (client.counsellorId === userId) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to archive/unarchive this client",
      });
    }

    // Update archive status
    const result = await updateClientArchiveStatus(clientId, archived);

    // Log activity
    try {
      await logActivity(req, {
        entityType: "client",
        entityId: clientId,
        clientId: clientId,
        action: archived ? "ARCHIVE" : "UNARCHIVE",
        oldValue: result.oldValue,
        newValue: result.newValue,
        description: archived
          ? `Client archived: ${client.fullName}`
          : `Client unarchived: ${client.fullName}`,
        performedBy: userId,
      });
    } catch (activityError) {
      // Don't fail the request if activity log fails
      console.error("Activity log error in archiveClientController:", activityError);
    }

    // Emit WebSocket events for real-time updates
    try {
      const eventName = archived ? "client:archived" : "client:unarchived";

      // Get updated client lists
      const counsellorClients = await getClientsByCounsellor(client.counsellorId);
      const adminClients = await getAllClientsForAdmin();

      // Prepare event data for counsellor
      const counsellorEventData = {
        action: result.action,
        client: result.client,
        clients: counsellorClients,
      };

      // Prepare event data for admin
      const adminEventData = {
        action: result.action,
        client: result.client,
        clients: adminClients,
      };

      // Emit to counsellor's room
      emitToCounsellor(client.counsellorId, eventName, counsellorEventData);

      // Emit to admin room
      emitToAdmin(eventName, adminEventData);

      // Also emit to archived clients endpoint update
      try {
        const archivedClients = await getAllArchivedClientsForAdmin();
        emitToAdmin("archived-clients:updated", {
          clients: archivedClients,
          timestamp: new Date().toISOString(),
        });
      } catch (archivedError) {
        console.error("Archived clients emit error:", archivedError);
      }
    } catch (wsError) {
      // Don't fail the request if WebSocket fails
      console.error("WebSocket emit error:", wsError);
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// All clients for admin
export const getAllClientsForAdminController = async (req: Request, res: Response) => {
  try {
    const clients = await getAllClients();
    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Client Transfer to another counsellor
export const transferClientController = async (req: Request, res: Response) => {
  try {
    const { clientId, counsellorId } = req.body;
    const client = await getClientFullDetailsById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    const counsellor = await getCounsellorById(counsellorId);
    if (!counsellor) {
      return res.status(404).json({
        success: false,
        message: "Counsellor not found",
      });
    }
    const result = await updateClientCounsellor(clientId, counsellor.id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};