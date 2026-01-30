import { Request, Response } from "express";
import {
  saveClientPayment,
  getPaymentsByClientId,
} from "../models/clientPayment.model";
import { getClientFullDetailsById, getClientsByCounsellor, getAllClientsForAdmin } from "../models/client.model";
import { emitToCounsellor, emitToAdmin, emitDashboardUpdate } from "../config/socket";
import { getDashboardStats } from "../models/dashboard.model";
import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { clientPayments } from "../schemas/clientPayment.schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../services/activityLog.service";

/**
 * Create client payment
 */
export const saveClientPaymentController = async (
  req: Request,
  res: Response
) => {
  try {
    // Fetch old value if updating
    let oldValue = null;
    if (req.body.paymentId) {
      try {
        const [oldPayment] = await db
          .select()
          .from(clientPayments)
          .where(eq(clientPayments.paymentId, req.body.paymentId));
        if (oldPayment) {
          oldValue = oldPayment;
        }
      } catch (error) {
        console.error("Error fetching old payment value:", error);
      }
    }

    console.log("req.body client payment", req.body);
    const result = await saveClientPayment(req.body);
    const clientId = result.payment.clientId;

    // Get counsellorId from clientId
    const [client] = await db
      .select({ counsellorId: clientInformation.counsellorId })
      .from(clientInformation)
      .where(eq(clientInformation.clientId, clientId));

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const counsellorId = client.counsellorId;

    // Log activity ONLY when a real insert or real update happens (rowCount > 0 or action is CREATED)
    // Skip logging if action is NO_CHANGE (data was identical, no actual update occurred)
    if (result.action !== "NO_CHANGE") {
      try {
        if (req.user?.id) {
          const action = result.action === "CREATED" ? "PAYMENT_ADDED" : "PAYMENT_UPDATED";
          await logActivity(req, {
            entityType: "client_payment",
            entityId: result.payment.paymentId,
            clientId: clientId,
            action: action,
            oldValue: oldValue,
            newValue: result.payment,
            description: result.action === "CREATED"
              ? `Payment added: ${result.payment.stage} - $${result.payment.amount}`
              : `Payment updated: ${result.payment.stage} - $${result.payment.amount}`,
            metadata: {
              stage: result.payment.stage,
              amount: result.payment.amount,
              totalPayment: result.payment.totalPayment,
            },
            performedBy: req.user.id,
          });
        }
      } catch (activityError) {
        // Don't fail the request if activity log fails
        console.error("Activity log error in saveClientPaymentController:", activityError);
      }
    }

    // Get full client details with updated payments
    const clientDetails = await getClientFullDetailsById(clientId);

    // Get updated client lists
    const counsellorClients = await getClientsByCounsellor(counsellorId);
    const adminClients = await getAllClientsForAdmin();

    // Emit WebSocket event for real-time updates
    try {
      const eventName = result.action === "CREATED" ? "payment:created" : "payment:updated";

      // Emit to counsellor's room
      emitToCounsellor(counsellorId, eventName, {
        action: result.action,
        payment: result.payment,
        clientId: clientId,
        client: clientDetails,
        clients: counsellorClients,
      });

      // Emit to admin room
      // emitToAdmin(eventName, {
      //   action: result.action,
      //   payment: result.payment,
      //   clientId: clientId,
      //   client: clientDetails,
      //   clients: adminClients,
      // });

      // Emit to admin room
      emitToAdmin(eventName, {
        action: result.action,
        payment: result.payment,
        clientId: clientId,
        client: clientDetails,
        clients: counsellorClients,  // Counsellor's list (for counsellor room)
        allClients: adminClients,     // ✅ ADD THIS - Full admin list
      });

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
    } catch (wsError) {
      // Don't fail the request if WebSocket fails
      console.error("WebSocket emit error in saveClientPaymentController:", wsError);
    }

    res.status(200).json({
      success: true,
      action: result.action,
      data: result.payment,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get payments by client id
 */
export const getClientPaymentsController = async (
  req: Request,
  res: Response
) => {
  try {
    const clientId = Number(req.params.clientId);

    if (Number.isNaN(clientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clientId",
      });
    }

    const payments = await getPaymentsByClientId(clientId);

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

