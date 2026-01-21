import { db } from "../config/databaseConnection";
import { clientPayments } from "../schemas/clientPayment.schema";
import { eq, and, ne } from "drizzle-orm";

export type PaymentStage =
  | "INITIAL"
  | "BEFORE_VISA"
  | "AFTER_VISA"
  | "SUBMITTED_VISA";

interface SaveClientPaymentInput {
  paymentId?: number; // 👈 optional
  clientId: number;
  totalPayment: string;
  stage: PaymentStage;
  amount: string;
  paymentDate?: string;
  invoiceNo?: string;
  remarks?: string;
}

export const saveClientPayment = async (
  data: SaveClientPaymentInput
) => {
  // Normalize IDs - convert strings to numbers if needed
  const paymentId = data.paymentId ? Number(data.paymentId) : undefined;
  const clientId = Number(data.clientId);
  const {
    totalPayment,
    stage,
    amount,
    paymentDate,
    invoiceNo,
    remarks,
  } = data;

  if (!clientId || !Number.isFinite(clientId) || clientId <= 0) {
    throw new Error("Valid clientId is required");
  }

  if (!stage || !amount || !totalPayment) {
    throw new Error("Required payment fields missing: stage, amount, totalPayment");
  }

  // Provide defaults for NOT NULL fields if not provided
  // paymentDate and invoiceNo are NOT NULL in the schema
  const finalPaymentDate = paymentDate || new Date().toISOString().split('T')[0];
  const finalInvoiceNo = invoiceNo || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /* =========================
     UPDATE PAYMENT
  ========================= */
  if (paymentId && Number.isFinite(paymentId) && paymentId > 0) {
    const existingPayment = await db
      .select({ id: clientPayments.paymentId, invoiceNo: clientPayments.invoiceNo })
      .from(clientPayments)
      .where(eq(clientPayments.paymentId, paymentId));

    if (!existingPayment.length) {
      throw new Error("Payment not found");
    }

    // Check if invoiceNo is being changed and if the new invoiceNo already exists (excluding current payment)
    if (finalInvoiceNo !== existingPayment[0].invoiceNo) {
      const duplicateCheck = await db
        .select({ id: clientPayments.paymentId })
        .from(clientPayments)
        .where(and(
          eq(clientPayments.invoiceNo, finalInvoiceNo),
          ne(clientPayments.paymentId, paymentId)
        ))
        .limit(1);

      if (duplicateCheck.length > 0) {
        throw new Error(`Invoice number "${finalInvoiceNo}" already exists. Please use a different invoice number.`);
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[UPDATE PAYMENT] Updating payment ${paymentId} with:`, {
        clientId,
        totalPayment,
        stage,
        amount,
        paymentDate: finalPaymentDate,
        invoiceNo: finalInvoiceNo,
      });
    }

    const [updatedPayment] = await db
      .update(clientPayments)
      .set({
        clientId,
        totalPayment: String(totalPayment),
        stage,
        amount: String(amount),
        paymentDate: finalPaymentDate,
        invoiceNo: finalInvoiceNo,
        remarks: remarks ? String(remarks).trim() : null,
      })
      .where(eq(clientPayments.paymentId, paymentId))
      .returning();

    if (!updatedPayment) {
      throw new Error("Failed to update payment");
    }

    return {
      action: "UPDATED",
      payment: updatedPayment,
    };
  }

  /* =========================
     CREATE PAYMENT
  ========================= */
  // Check if invoiceNo already exists before creating
  const duplicateCheck = await db
    .select({ id: clientPayments.paymentId })
    .from(clientPayments)
    .where(eq(clientPayments.invoiceNo, finalInvoiceNo))
    .limit(1);

  if (duplicateCheck.length > 0) {
    throw new Error(`Invoice number "${finalInvoiceNo}" already exists. Please use a different invoice number.`);
  }

  const [newPayment] = await db
    .insert(clientPayments)
    .values({
      clientId,
      totalPayment: String(totalPayment),
      stage,
      amount: String(amount),
      paymentDate: finalPaymentDate,
      invoiceNo: finalInvoiceNo,
      remarks: remarks ? String(remarks).trim() : null,
    })
    .returning();

  return {
    action: "CREATED",
    payment: newPayment,
  };
};


export const getPaymentsByClientId = async (clientId: number) => {
  return db
    .select()
    .from(clientPayments)
    .where(eq(clientPayments.clientId, clientId));
};
