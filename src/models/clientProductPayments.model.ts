import { db } from "../config/databaseConnection";
import {
  clientProductPayments,
  productTypeEnum,
  entityTypeEnum,
} from "../schemas/clientProductPayments.schema";
import { clientInformation } from "../schemas/clientInformation.schema";
import { simCard } from "../schemas/simCard.schema";
import { airTicket } from "../schemas/airTicket.schema";
import { ielts } from "../schemas/ielts.schema";
import { loan } from "../schemas/loan.schema";
import { forexCard } from "../schemas/forexCard.schema";
import { forexFees } from "../schemas/forexFees.schema";
import { tutionFees } from "../schemas/tutionFees.schema";
import { insurance } from "../schemas/insurance.schema";
import { beaconAccount } from "../schemas/beaconAccount.schema";
import { creditCard } from "../schemas/creditCard.schema";
import { newSell } from "../schemas/newSell.schema";
import { visaExtension } from "../schemas/visaExtension.schema";
import { eq, inArray, and, ne } from "drizzle-orm";

// Helper function to safely fetch entities with error handling
const fetchEntities = async <T extends { id: number }>(
  table: any,
  ids: number[],
  entityType: string
): Promise<Map<number, T>> => {
  if (!ids || ids.length === 0) {
    return new Map();
  }

  try {
    const records = await db
      .select()
      .from(table)
      .where(
        ids.length === 1
          ? eq(table.id, ids[0])
          : inArray(table.id, ids)
      );

    const map = new Map(records.map((r: T) => {
      const key = Number(r.id);
      return [key, r];
    }));

    return map;
  } catch (error) {
    if (entityType === "newSell_id") {
      console.error(`[DEBUG] fetchEntities error for newSell:`, error);
    }
    return new Map();
  }
};

// Product type enum values
export type ProductType =
  | "ALL_FINANCE_EMPLOYEMENT"
  | "INDIAN_SIDE_EMPLOYEMENT"
  | "NOC_LEVEL_JOB_ARRANGEMENT"
  | "LAWYER_REFUSAL_CHARGE"
  | "ONSHORE_PART_TIME_EMPLOYEMENT"
  | "TRV_WORK_PERMIT_EXT_STUDY_PERMIT_EXTENSION"
  | "MARRIAGE_PHOTO_FOR_COURT_MARRIAGE"
  | "MARRIAGE_PHOTO_CERTIFICATE"
  | "RECENTE_MARRIAGE_RELATIONSHIP_AFFIDAVIT"
  | "JUDICAL_REVIEW_CHARGE"
  | "SIM_CARD_ACTIVATION"
  | "INSURANCE"
  | "BEACON_ACCOUNT"
  | "AIR_TICKET"
  | "OTHER_NEW_SELL"
  | "SPONSOR_CHARGES"
  | "FINANCE_EMPLOYEMENT"
  | "IELTS_ENROLLMENT"
  | "LOAN_DETAILS"
  | "FOREX_CARD"
  | "FOREX_FEES"
  | "TUTION_FEES"
  | "CREDIT_CARD"
  | "VISA_EXTENSION";

// Entity type enum values
export type EntityType =
  | "visaextension_id"
  | "simCard_id"
  | "airTicket_id"
  | "newSell_id"
  | "ielts_id"
  | "loan_id"
  | "forexCard_id"
  | "forexFees_id"
  | "tutionFees_id"
  | "insurance_id"
  | "beaconAccount_id"
  | "creditCard_id"
  | "master_only";

// Map product name to entity type
const productToEntityTypeMap: Record<ProductType, EntityType> = {
  SIM_CARD_ACTIVATION: "simCard_id",
  AIR_TICKET: "airTicket_id",
  IELTS_ENROLLMENT: "ielts_id",
  LOAN_DETAILS: "loan_id",
  FOREX_CARD: "forexCard_id",
  FOREX_FEES: "forexFees_id",
  TUTION_FEES: "tutionFees_id",
  INSURANCE: "insurance_id",
  BEACON_ACCOUNT: "beaconAccount_id",
  CREDIT_CARD: "creditCard_id",
  OTHER_NEW_SELL: "newSell_id",
  VISA_EXTENSION: "visaextension_id",
  // Products without specific tables use newSell
  // ✅ MASTER-ONLY PRODUCTS
  ALL_FINANCE_EMPLOYEMENT: "master_only",
  INDIAN_SIDE_EMPLOYEMENT: "master_only",
  NOC_LEVEL_JOB_ARRANGEMENT: "master_only",
  LAWYER_REFUSAL_CHARGE: "master_only",
  ONSHORE_PART_TIME_EMPLOYEMENT: "master_only",
  TRV_WORK_PERMIT_EXT_STUDY_PERMIT_EXTENSION: "master_only",
  MARRIAGE_PHOTO_FOR_COURT_MARRIAGE: "master_only",
  MARRIAGE_PHOTO_CERTIFICATE: "master_only",
  RECENTE_MARRIAGE_RELATIONSHIP_AFFIDAVIT: "master_only",
  JUDICAL_REVIEW_CHARGE: "master_only",
  SPONSOR_CHARGES: "master_only",
  FINANCE_EMPLOYEMENT: "master_only",
};

// Map entity type to table for validation
const entityTypeToTable: Record<EntityType, any> = {
  simCard_id: simCard,
  airTicket_id: airTicket,
  ielts_id: ielts,
  loan_id: loan,
  forexCard_id: forexCard,
  forexFees_id: forexFees,
  tutionFees_id: tutionFees,
  insurance_id: insurance,
  beaconAccount_id: beaconAccount,
  creditCard_id: creditCard,
  newSell_id: newSell,
  visaextension_id: visaExtension,
  master_only:null
};

// Entity data interfaces
interface SimCardData {
  activatedStatus?: boolean;
  simcardPlan?: string;
  simCardGivingDate?: string;
  simActivationDate?: string;
  remarks?: string;
}

interface AirTicketData {
  isTicketBooked?: boolean;
  amount?: number | string;
  airTicketNumber?: string;
  ticketDate?: string;
  remarks?: string;
}

interface IeltsData {
  enrolledStatus?: boolean;
  amount: number | string;
  enrollmentDate?: string;
  remarks?: string;
}

interface LoanData {
  amount: number | string;
  disbursmentDate?: string;
  remarks?: string;
}

interface ForexCardData {
  forexCardStatus?: string;
  cardDate?: string;
  remarks?: string;
}

interface ForexFeesData {
  side: "PI" | "TP";
  amount: number | string;
  feeDate?: string;
  remarks?: string;
}

interface TutionFeesData {
  tutionFeesStatus: "paid" | "pending";
  feeDate?: string;
  remarks?: string;
}

interface InsuranceData {
  amount: number | string;
  policyNumber?: string;
  insuranceDate?: string;
  remarks?: string;
}

interface BeaconAccountData {
  amount?: number | string;
  fundingAmount?: number | string; // Frontend sends this field
  accountDate?: string;
  fundingDate?: string; // Frontend sends this field
  openingDate?: string; // Frontend sends this field
  remarks?: string;
}

interface CreditCardData {
  amount: number | string;
  cardDate?: string;
  remarks?: string;
}

interface VisaExtensionData {
  type: string;
  amount: number | string;
  extensionDate?: string;
  invoiceNo?: string;
  remarks?: string;
}

interface NewSellData {
  serviceName: string;
  serviceInformation?: string;
  amount: number | string;
  sellDate?: string;
  invoiceNo?: string;
  remarks?: string;
}

interface SaveClientProductPaymentInput {
  productPaymentId?: number;
  clientId: number;
  productName: ProductType;
  invoiceNo?: string;
  amount: number | string;
  paymentDate?: string;
  remarks?: string;
  entityId?: number;
  // Entity data based on product type
  entityData?:
    | SimCardData
    | AirTicketData
    | IeltsData
    | LoanData
    | ForexCardData
    | ForexFeesData
    | TutionFeesData
    | InsuranceData
    | BeaconAccountData
    | CreditCardData
    | VisaExtensionData
    | NewSellData;
}

// Helper function to create entity record
const createEntityRecord = async (
  entityType: EntityType,
  entityData: any,
  productAmount: number | string = 0,
  remarks?: string
): Promise<number> => {
  const amountValue =
    typeof productAmount === "string"
      ? parseFloat(productAmount)
      : productAmount;

  switch (entityType) {
    case "simCard_id": {
      const data = entityData as SimCardData;
      const [record] = await db
        .insert(simCard)
        .values({
          activatedStatus: data.activatedStatus ?? false,
          simcardPlan: data.simcardPlan ?? null,
          simCardGivingDate: data.simCardGivingDate ?? null,
          simActivationDate: data.simActivationDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "airTicket_id": {
      const data = entityData as AirTicketData;

      // Provide default for NOT NULL field if not provided
      const finalAirTicketNumber = data.airTicketNumber || `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const finalTicketDate = data.ticketDate || new Date().toISOString().split('T')[0];

      // Check if airTicketNumber already exists before creating
      const duplicateCheck = await db
        .select({ id: airTicket.id })
        .from(airTicket)
        .where(eq(airTicket.airTicketNumber, finalAirTicketNumber))
        .limit(1);

      if (duplicateCheck.length > 0) {
        throw new Error(`Air ticket number "${finalAirTicketNumber}" already exists. Please use a different ticket number.`);
      }

      const [record] = await db
        .insert(airTicket)
        .values({
          isTicketBooked: data.isTicketBooked ?? false,
          amount: data.amount ? data.amount.toString() : amountValue.toString(),
          airTicketNumber: finalAirTicketNumber,
          ticketDate: finalTicketDate,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "ielts_id": {
      const data = entityData as IeltsData;
      const [record] = await db
        .insert(ielts)
        .values({
          enrolledStatus: data.enrolledStatus ?? false,
          amount: data.amount.toString(),
          enrollmentDate: data.enrollmentDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "loan_id": {
      const data = entityData as LoanData;
      // Provide default for NOT NULL field if not provided
      const finalDisbursmentDate = data.disbursmentDate || new Date().toISOString().split('T')[0];
      const [record] = await db
        .insert(loan)
        .values({
          amount: data.amount.toString(),
          disbursmentDate: finalDisbursmentDate,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "forexCard_id": {
      const data = entityData as ForexCardData;
      const [record] = await db
        .insert(forexCard)
        .values({
          forexCardStatus: data.forexCardStatus ?? null,
          cardDate: data.cardDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "forexFees_id": {
      const data = entityData as ForexFeesData;
      if (!data.side || !["PI", "TP"].includes(data.side)) {
        throw new Error("side is required and must be 'PI' or 'TP'");
      }
      const [record] = await db
        .insert(forexFees)
        .values({
          side: data.side as any,
          amount: data.amount.toString(),
          feeDate: data.feeDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "tutionFees_id": {
      const data = entityData as TutionFeesData;
      if (
        !data.tutionFeesStatus ||
        !["paid", "pending"].includes(data.tutionFeesStatus)
      ) {
        throw new Error(
          "tutionFeesStatus is required and must be 'paid' or 'pending'"
        );
      }
      const [record] = await db
        .insert(tutionFees)
        .values({
          tutionFeesStatus: data.tutionFeesStatus as any,
          feeDate: data.feeDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "insurance_id": {
      const data = entityData as InsuranceData;
      // Provide default for NOT NULL field if not provided
      const finalInsuranceDate = data.insuranceDate || new Date().toISOString().split('T')[0];
      const [record] = await db
        .insert(insurance)
        .values({
          amount: data.amount.toString(),
          policyNumber: data.policyNumber ?? null,
          insuranceDate: finalInsuranceDate,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "beaconAccount_id": {
      const data = entityData as BeaconAccountData;
      // Use amount if provided, otherwise fallback to fundingAmount
      const amountValue = data.amount ?? data.fundingAmount;
      if (amountValue === undefined || amountValue === null) {
        throw new Error("amount or fundingAmount is required for beacon account");
      }
      // Use accountDate if provided, otherwise fallback to fundingDate or openingDate
      const accountDateValue = data.accountDate ?? data.fundingDate ?? data.openingDate;
      const [record] = await db
        .insert(beaconAccount)
        .values({
          amount: amountValue.toString(),
          openingDate: data.openingDate ?? null,
          fundingDate: data.fundingDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "creditCard_id": {
      const data = entityData as CreditCardData;
      const [record] = await db
        .insert(creditCard)
        .values({
          amount: data.amount.toString(),
          cardDate: data.cardDate ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "visaextension_id": {
      const data = entityData as VisaExtensionData;
      if (!data.type) {
        throw new Error("type is required for visa extension");
      }
      // Provide default for NOT NULL field if not provided
      const finalExtensionDate = data.extensionDate || new Date().toISOString().split('T')[0];
      const [record] = await db
        .insert(visaExtension)
        .values({
          type: data.type,
          amount: data.amount.toString(),
          extensionDate: finalExtensionDate,
          invoiceNo: data.invoiceNo ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    case "newSell_id": {
      const data = entityData as NewSellData;
      if (!data.serviceName) {
        throw new Error("serviceName is required for new sell");
      }
      // Provide default for NOT NULL field if not provided
      const finalSellDate = data.sellDate || new Date().toISOString().split('T')[0];
      const [record] = await db
        .insert(newSell)
        .values({
          serviceName: data.serviceName,
          serviceInformation: data.serviceInformation ?? null,
          amount: data.amount.toString(),
          sellDate: finalSellDate,
          invoiceNo: data.invoiceNo ?? null,
          remarks: data.remarks ?? null,
        })
        .returning();
      return record.id;
    }

    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }
};


export const saveClientProductPayment = async (
  data: SaveClientProductPaymentInput
) => {
  // Normalize IDs - convert strings to numbers if needed
  const productPaymentId = data.productPaymentId ? Number(data.productPaymentId) : undefined;
  const clientId = Number(data.clientId);
  const {
    productName,
    amount,
    paymentDate,
    remarks,
    invoiceNo,
    entityData,
  } = data;

  if (!clientId || !Number.isFinite(clientId) || clientId <= 0) {
    throw new Error("Valid clientId is required");
  }

  if (!productName) {
    throw new Error("productName is required");
  }

  const entityType = productToEntityTypeMap[productName];
  if (!entityType) throw new Error("Invalid productName");

  // ---------------------------
  // AMOUNT VALIDATION (STRICT)
  // ---------------------------
  let amountValue: number | null = null;

  if (entityType === "master_only") {
    if (amount === undefined || amount === null) {
      throw new Error("amount is required for master_only products");
    }

    amountValue = typeof amount === "string" ? parseFloat(amount) : amount;

    if (!isFinite(amountValue) || amountValue <= 0) {
      throw new Error("Invalid amount");
    }
  }

  // ---------------------------
  // UPDATE
  // ---------------------------
  if (productPaymentId && Number.isFinite(productPaymentId) && productPaymentId > 0) {
    const [existing] = await db
      .select()
      .from(clientProductPayments)
      .where(eq(clientProductPayments.productPaymentId, productPaymentId));

    if (!existing) {
      throw new Error("Product payment record not found");
    }

    // update entity table only if exists
    if (entityData && entityType !== "master_only") {
      const table = entityTypeToTable[entityType];

      // Filter out non-entity fields (id, productPaymentId, productName, etc.)
      // These fields don't belong in the entity table update
      const {
        id,
        productPaymentId,
        productName,
        paymentDate,
        clientId,
        entityId,
        entityType: _entityType,
        ...cleanEntityData
      } = entityData as any;

      // Check for duplicate airTicketNumber if updating air ticket
      if (entityType === "airTicket_id" && cleanEntityData.airTicketNumber) {
        // Get current air ticket record
        const [currentAirTicket] = await db
          .select({ id: airTicket.id, airTicketNumber: airTicket.airTicketNumber })
          .from(airTicket)
          .where(eq(airTicket.id, existing.entityId!))
          .limit(1);

        if (currentAirTicket && cleanEntityData.airTicketNumber !== currentAirTicket.airTicketNumber) {
          // Check if new airTicketNumber already exists (excluding current record)
          const duplicateCheck = await db
            .select({ id: airTicket.id })
            .from(airTicket)
            .where(and(
              eq(airTicket.airTicketNumber, cleanEntityData.airTicketNumber),
              ne(airTicket.id, existing.entityId!)
            ))
            .limit(1);

          if (duplicateCheck.length > 0) {
            throw new Error(`Air ticket number "${cleanEntityData.airTicketNumber}" already exists. Please use a different ticket number.`);
          }
        }
      }

      await db
        .update(table)
        .set(cleanEntityData)
        .where(eq(table.id, existing.entityId));
    }

    const [updated] = await db
      .update(clientProductPayments)
      .set({
        // For entity-based products: data is stored in entity table, so set to NULL here
        // For master_only products: data is stored in this table
        amount:
          entityType === "master_only"
            ? amountValue!.toString()
            : null,
        paymentDate:
          entityType === "master_only"
            ? paymentDate ?? existing.paymentDate
            : null,
        invoiceNo:
          entityType === "master_only"
            ? invoiceNo ?? existing.invoiceNo
            : null,
        remarks:
          entityType === "master_only"
            ? remarks ?? existing.remarks
            : null,
      })
      .where(eq(clientProductPayments.productPaymentId, productPaymentId))
      .returning();

    return { action: "UPDATED", record: updated };
  }

  // ---------------------------
  // CREATE
  // ---------------------------
  let entityId: number | null = null;

  if (entityType !== "master_only") {
    if (!entityData) {
      throw new Error("entityData required");
    }

    entityId = await createEntityRecord(entityType, entityData);
  }

  const [record] = await db
    .insert(clientProductPayments)
    .values({
      clientId,
      productName: productName as any,
      entityType: entityType as any,
      entityId,
      // For entity-based products: data is stored in entity table, so set to NULL here
      // For master_only products: data is stored in this table
      amount:
        entityType === "master_only"
          ? amountValue!.toString()
          : null,
      paymentDate:
        entityType === "master_only"
          ? paymentDate ?? null
          : null,
      invoiceNo:
        entityType === "master_only"
          ? invoiceNo ?? null
          : null,
      remarks:
        entityType === "master_only"
          ? remarks ?? null
          : null,
    })
    .returning();

  return { action: "CREATED", record };
};


export const getProductPaymentsByClientId = async (clientId: number) => {

  const payments = await db
    .select()
    .from(clientProductPayments)
    .where(eq(clientProductPayments.clientId, clientId));

  if (payments.length === 0) return [];

  // Group payments by entity type to fetch data efficiently
  const entityGroups = payments.reduce((groups, payment) => {
    if (payment.entityId && payment.entityType !== "master_only") {
      if (!groups[payment.entityType]) {
        groups[payment.entityType] = [];
      }
      groups[payment.entityType].push(payment.entityId);
    }
    return groups;
  }, {} as Record<string, number[]>);

  // Fetch entity data for each type
  const entityMaps: Record<string, Map<number, any>> = {};

  // ---- SIM CARD ----
  if (entityGroups.simCard_id) {
    entityMaps.simCard_id = await fetchEntities(simCard, entityGroups.simCard_id, "simCard_id");
  }

  // ---- AIR TICKET ----
  if (entityGroups.airTicket_id) {
    entityMaps.airTicket_id = await fetchEntities(airTicket, entityGroups.airTicket_id, "airTicket_id");
  }

  // ---- IELTS ----
  if (entityGroups.ielts_id) {
    entityMaps.ielts_id = await fetchEntities(ielts, entityGroups.ielts_id, "ielts_id");
  }

  // ---- LOAN ----
  if (entityGroups.loan_id) {
    entityMaps.loan_id = await fetchEntities(loan, entityGroups.loan_id, "loan_id");
  }

  // ---- FOREX CARD ----
  if (entityGroups.forexCard_id) {
    entityMaps.forexCard_id = await fetchEntities(forexCard, entityGroups.forexCard_id, "forexCard_id");
  }

  // ---- FOREX FEES ----
  if (entityGroups.forexFees_id) {
    entityMaps.forexFees_id = await fetchEntities(forexFees, entityGroups.forexFees_id, "forexFees_id");
  }

  // ---- TUITION FEES ----
  if (entityGroups.tutionFees_id) {
    entityMaps.tutionFees_id = await fetchEntities(tutionFees, entityGroups.tutionFees_id, "tutionFees_id");
  }

  // ---- INSURANCE ----
  if (entityGroups.insurance_id) {
    entityMaps.insurance_id = await fetchEntities(insurance, entityGroups.insurance_id, "insurance_id");
  }

  // ---- BEACON ACCOUNT ----
  if (entityGroups.beaconAccount_id) {
    entityMaps.beaconAccount_id = await fetchEntities(beaconAccount, entityGroups.beaconAccount_id, "beaconAccount_id");
  }

  // ---- CREDIT CARD ----
  if (entityGroups.creditCard_id) {
    entityMaps.creditCard_id = await fetchEntities(creditCard, entityGroups.creditCard_id, "creditCard_id");
  }

  // ---- NEW SELL ----
  if (entityGroups.newSell_id) {
    entityMaps.newSell_id = await fetchEntities(newSell, entityGroups.newSell_id, "newSell_id");
  }

  // ---- VISA EXTENSION ----
  if (entityGroups.visaextension_id) {
    entityMaps.visaextension_id = await fetchEntities(visaExtension, entityGroups.visaextension_id, "visaextension_id");
  }

  // ---- MERGE ----
  return payments.map(p => {
    if (p.entityType === "master_only") {
      return {
        ...p,
        entity: null, // master_only products don't have entity data
      };
    }

    if (p.entityId) {
      // Ensure entity map exists (initialize if missing)
      if (!entityMaps[p.entityType]) {
        entityMaps[p.entityType] = new Map();
      }

      // Ensure both key and lookup use Number for type consistency
      const entityIdNum = Number(p.entityId);
      const entityIdStr = String(p.entityId);

      // Try both number and string lookups
      let entity = entityMaps[p.entityType].get(entityIdNum);
      if (!entity && entityMaps[p.entityType].has(Number(entityIdStr))) {
        entity = entityMaps[p.entityType].get(Number(entityIdStr));
      }

      const result = {
        ...p,
        entity: entity || null,
      };

      return result;
    }

    return {
      ...p,
      entity: null,
    };
  });
};
