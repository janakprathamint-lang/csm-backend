import { Request, Response } from "express";
import {
  saveClientProductPayment,
  getProductPaymentsByClientId,
  ProductType,
} from "../models/clientProductPayments.model";
import { getClientFullDetailsById, getClientsByCounsellor, getAllClientsForAdmin } from "../models/client.model";
import { emitToCounsellor, emitToAdmin, emitDashboardUpdate } from "../config/socket";
import { getDashboardStats } from "../models/dashboard.model";
import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { clientProductPayments } from "../schemas/clientProductPayments.schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../services/activityLog.service";

// export const createClientProductPaymentController = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const body = req.body || {};

//     // Validate required fields
//     if (!body.clientId) {
//       return res.status(400).json({
//         success: false,
//         message: "clientId is required",
//       });
//     }

//     if (!body.productName) {
//       return res.status(400).json({
//         success: false,
//         message: "productName is required",
//       });
//     }

//     if (!body.amount) {
//       return res.status(400).json({
//         success: false,
//         message: "amount is required",
//       });
//     }

//     // Normalize and validate input
//     const payload = {
//       clientId: Number(body.clientId),
//       productName: body.productName as ProductType,
//       amount: body.amount,
//       paymentDate: body.paymentDate || body.payment_date,
//       remarks: body.remarks || body.remark,
//       entityData: body.entityData || body.entity_data,
//     };

//     // Validate clientId is a valid number
//     if (!Number.isFinite(payload.clientId) || payload.clientId <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "clientId must be a valid positive number",
//       });
//     }

//     const record = await createClientProductPayment(payload);

//     res.status(201).json({
//       success: true,
//       data: record,
//     });
//   } catch (error: any) {
//     res.status(400).json({
//       success: false,
//       message: error.message || "Failed to create product payment",
//     });
//   }
// };


export const saveClientProductPaymentController = async (
  req: Request,
  res: Response
) => {
  try {
    // Fetch old value if updating
    let oldValue = null;
    if (req.body.productPaymentId) {
      try {
        const [oldProductPayment] = await db
          .select()
          .from(clientProductPayments)
          .where(eq(clientProductPayments.productPaymentId, req.body.productPaymentId));
        if (oldProductPayment) {
          oldValue = oldProductPayment;
        }
      } catch (error) {
        console.error("Error fetching old product payment value:", error);
      }
    }

    const result = await saveClientProductPayment(req.body);
    const clientId = result.record.clientId;

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

    // Log activity
    try {
      if (req.user?.id) {
        const action = result.action === "CREATED" ? "PRODUCT_ADDED" : "PRODUCT_UPDATED";
        const entityType = result.record.entityType || "client_product_payment";
        await logActivity(req, {
          entityType: entityType,
          entityId: result.record.entityId || result.record.productPaymentId,
          clientId: clientId,
          action: action,
          oldValue: oldValue,
          newValue: result.record,
          description: result.action === "CREATED"
            ? `Product payment added: ${result.record.productName} - $${result.record.amount}`
            : `Product payment updated: ${result.record.productName} - $${result.record.amount}`,
          metadata: {
            productName: result.record.productName,
            productPaymentId: result.record.productPaymentId,
            entityType: result.record.entityType,
            entityId: result.record.entityId,
            amount: result.record.amount,
          },
          performedBy: req.user.id,
        });
      }
    } catch (activityError) {
      // Don't fail the request if activity log fails
      console.error("Activity log error in saveClientProductPaymentController:", activityError);
    }

    // Get full client details with updated product payments
    const clientDetails = await getClientFullDetailsById(clientId);

    // Get updated client lists
    const counsellorClients = await getClientsByCounsellor(counsellorId);
    const adminClients = await getAllClientsForAdmin();

    // Emit WebSocket event for real-time updates
    try {
      const eventName = result.action === "CREATED" ? "productPayment:created" : "productPayment:updated";

      // Emit to counsellor's room
      emitToCounsellor(counsellorId, eventName, {
        action: result.action,
        productPayment: result.record,
        clientId: clientId,
        client: clientDetails,
        clients: counsellorClients,
      });

      // Emit to admin room
      emitToAdmin(eventName, {
        action: result.action,
        productPayment: result.record,
        clientId: clientId,
        client: clientDetails,
        clients: adminClients,
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
      console.error("WebSocket emit error in saveClientProductPaymentController:", wsError);
    }

    res.status(200).json({
      success: true,
      action: result.action,
      data: result.record,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getClientProductPaymentsController = async (
  req: Request,
  res: Response
) => {
  try {
    const clientId = Number(req.params.clientId);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid clientId is required",
      });
    }

    const records = await getProductPaymentsByClientId(clientId);

    res.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch product payments",
    });
  }
};
