import { db } from "../config/databaseConnection";
import { clientInformation } from "../schemas/clientInformation.schema";
import { clientPayments } from "../schemas/clientPayment.schema";
import { clientProductPayments } from "../schemas/clientProductPayments.schema";
import { saleTypes } from "../schemas/saleType.schema";
import { users } from "../schemas/users.schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { Request, Response } from "express";
import { getPaymentsByClientId } from "./clientPayment.model";
import { getProductPaymentsByClientId } from "./clientProductPayments.model";
import { leadTypes } from "../schemas/leadType.schema";

/* ==============================
   TYPES
============================== */
interface SaveClientInput {
  clientId?: number; // 👈 optional → if present, update
  fullName: string;
  enrollmentDate: string;
  saleTypeId: number;
  leadTypeId: number;
}

/* ==============================
   CREATE CLIENT
============================== */
export const saveClient = async (
  data: SaveClientInput,
  counsellorId: number
) => {
  const { clientId, fullName, enrollmentDate, saleTypeId, leadTypeId } = data;

  if (!fullName || !enrollmentDate || !saleTypeId || !leadTypeId) {
    throw new Error("All fields are required");
  }

  // 🔍 validate counsellor
  const counsellor = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, counsellorId));

  if (!counsellor.length) {
    throw new Error("Invalid counsellor");
  }

  // 🔍 validate sale type
  const saleType = await db
    .select({ id: saleTypes.saleTypeId })
    .from(saleTypes)
    .where(eq(saleTypes.saleTypeId, saleTypeId));

  if (!saleType.length) {
    throw new Error("Invalid sale type");
  }

  /* ==========================
     UPDATE CLIENT
  ========================== */
  if (clientId) {
    // 🔐 check client belongs to counsellor
    const existingClient = await db
      .select({ id: clientInformation.clientId })
      .from(clientInformation)
      .where(eq(clientInformation.clientId, clientId));

    if (!existingClient.length) {
      throw new Error("Client not found");
    }

    const [updatedClient] = await db
      .update(clientInformation)
      .set({
        fullName,
        enrollmentDate,
        saleTypeId,
        leadTypeId,
      })
      .where(eq(clientInformation.clientId, clientId))
      .returning({
        clientId: clientInformation.clientId,
        counsellorId: clientInformation.counsellorId,
        fullName: clientInformation.fullName,
        enrollmentDate: clientInformation.enrollmentDate,
        saleTypeId: clientInformation.saleTypeId,
        leadTypeId: clientInformation.leadTypeId,
      });

    return {
      action: "UPDATED",
      client: updatedClient,
    };
  }

  /* ==========================
     CREATE CLIENT
  ========================== */
  const [newClient] = await db
    .insert(clientInformation)
    .values({
      counsellorId,
      fullName,
      enrollmentDate,
      saleTypeId,
      leadTypeId,
    })
    .returning({
      clientId: clientInformation.clientId,
      counsellorId: clientInformation.counsellorId,
      fullName: clientInformation.fullName,
      enrollmentDate: clientInformation.enrollmentDate,
      saleTypeId: clientInformation.saleTypeId,
      leadTypeId: clientInformation.leadTypeId,
    });

  return {
    action: "CREATED",
    client: newClient,
  };
};

/* ==============================
   UPDATE CLIENT ARCHIVE STATUS
============================== */
export const updateClientArchiveStatus = async (
  clientId: number,
  archived: boolean
) => {
  // Check if client exists
  const [existingClient] = await db
    .select({
      clientId: clientInformation.clientId,
      counsellorId: clientInformation.counsellorId,
      archived: clientInformation.archived,
    })
    .from(clientInformation)
    .where(eq(clientInformation.clientId, clientId))
    .limit(1);

  if (!existingClient) {
    throw new Error("Client not found");
  }

  // Update archived status
  const [updatedClient] = await db
    .update(clientInformation)
    .set({
      archived: archived,
    })
    .where(eq(clientInformation.clientId, clientId))
    .returning({
      clientId: clientInformation.clientId,
      counsellorId: clientInformation.counsellorId,
      fullName: clientInformation.fullName,
      enrollmentDate: clientInformation.enrollmentDate,
      saleTypeId: clientInformation.saleTypeId,
      leadTypeId: clientInformation.leadTypeId,
      archived: clientInformation.archived,
      createdAt: clientInformation.createdAt,
    });

  return {
    action: archived ? "ARCHIVED" : "UNARCHIVED",
    client: updatedClient,
    oldValue: {
      archived: existingClient.archived,
    },
    newValue: {
      archived: updatedClient.archived,
    },
  };
};

// get client full details by id
export const getClientFullDetailsById = async (clientId: number) => {
  // 1. Get client info
  const [client] = await db
    .select()
    .from(clientInformation)
    .where(eq(clientInformation.clientId, clientId));

  if (!client) return null;

  // 2. Get sale type to check isCoreProduct
  const [saleType] = await db
    .select()
    .from(saleTypes)
    .where(eq(saleTypes.saleTypeId, client.saleTypeId));

  const [leadType] = await db
    .select()
    .from(leadTypes)
    .where(eq(leadTypes.id, client.leadTypeId));

  if (!saleType || !leadType) return null;

  const isCoreProduct = saleType.isCoreProduct;

  // 3. Get enhanced product payments with entity data
  const productPayments = await getProductPaymentsByClientId(clientId);

  // 4. Client payments (only if isCoreProduct is true)
  let payments: any[] = [];
  if (isCoreProduct) {
    payments = await db
      .select()
      .from(clientPayments)
      .where(eq(clientPayments.clientId, clientId));
  }

  return {
    client,
    leadType: {
      id: leadType.id,
      leadType: leadType.leadType,
    },
    saleType: {
      saleTypeId: saleType.saleTypeId,
      saleType: saleType.saleType,
      amount: saleType.amount,
      isCoreProduct: saleType.isCoreProduct,
    },
    payments: isCoreProduct ? payments : null,
    productPayments: productPayments,
  };
};

// get all clients by counsellor (exclude archived)
export const getClientsByCounsellor = async (counsellorId: number) => {
  const clients = await db
    .select()
    .from(clientInformation)
    .where(and(eq(clientInformation.counsellorId, counsellorId), eq(clientInformation.archived, false)))
    .orderBy(desc(clientInformation.createdAt));

  // Get counsellor information (id, name, designation)
  const counsellorData = await db
    .select({
      id: users.id,
      name: users.fullName,
      designation: users.designation,
    })
    .from(users)
    .where(eq(users.id, counsellorId))
    .limit(1);

  const counsellor = counsellorData.length > 0 ? {
    id: counsellorData[0].id,
    name: counsellorData[0].name,
    designation: counsellorData[0].designation || null,
  } : null;

  // Get sale types for all clients - fetch all unique saleTypeIds
  const uniqueSaleTypeIds = [...new Set(clients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  // Get lead types for all clients - fetch all unique leadTypeIds
  const uniqueLeadTypeIds = [...new Set(clients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Fetch payments and product payments for each client
  const clientsWithDetails = await Promise.all(
    clients.map(async (client) => {
      try {
        const payments = await getPaymentsByClientId(client.clientId);
        const productPayments = await getProductPaymentsByClientId(client.clientId);

        // Get sale type for this client
        const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);

        // Get lead type for this client
        const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

        return {
          ...client,
          counsellor: counsellor,
          saleType: saleType ? {
            saleTypeId: saleType.saleTypeId,
            saleType: saleType.saleType,
            amount: saleType.amount,
            isCoreProduct: saleType.isCoreProduct,
          } : null,
          leadType: leadType ? {
            id: leadType.id,
            leadType: leadType.leadType,
          } : null,
          payments: saleType?.isCoreProduct ? payments : [],
          productPayments: productPayments || [],
        };
      } catch (error) {
        // Return client with empty arrays if there's an error
        const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
        const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
        return {
          ...client,
          counsellor: counsellor,
          saleType: saleType ? {
            saleTypeId: saleType.saleTypeId,
            saleType: saleType.saleType,
            amount: saleType.amount,
            isCoreProduct: saleType.isCoreProduct,
          } : null,
          leadType: leadType ? {
            id: leadType.id,
            leadType: leadType.leadType,
          } : null,
          payments: [],
          productPayments: [],
        };
      }
    })
  );

  // Group clients by year and month with counts
  const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

  clientsWithDetails.forEach(client => {
    if (!client.enrollmentDate) return;

    const enrollmentDate = new Date(client.enrollmentDate);
    const year = enrollmentDate.getFullYear().toString();
    const month = enrollmentDate.toLocaleString('default', { month: 'short' });

    if (!groupedClients[year]) {
      groupedClients[year] = {};
    }

    if (!groupedClients[year][month]) {
      groupedClients[year][month] = {
        clients: [],
        total: 0
      };
    }

    groupedClients[year][month].clients.push(client);
    groupedClients[year][month].total++;
  });

  // Sort years: descending (newest first: 2026 → 2025 → 2024)
  const currentYear = new Date().getFullYear().toString();
  const sortedYears = Object.keys(groupedClients).sort((a, b) => {
    return parseInt(b) - parseInt(a); // descending order (newest first)
  });

  // Sort months within each year: current month first, then chronological
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
  const currentMonthIndex = currentDate.getMonth(); // 0-11 (Jan=0, Feb=1, etc.)
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const result: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

  sortedYears.forEach(year => {
    result[year] = {};
    const months = Object.keys(groupedClients[year]);

    // Sort months: current month first, then chronological order
    months.sort((a, b) => {
      // For current year, put current month first
      if (year === currentYear) {
        const aIndex = monthOrder.indexOf(a);
        const bIndex = monthOrder.indexOf(b);

        // Current month comes first
        if (a === currentMonth) return -1;
        if (b === currentMonth) return 1;

        // Other months in chronological order from current month onwards
        const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
        const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

        return aFromCurrent - bFromCurrent;
      }

      // For other years, use normal chronological order
      return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });

    months.forEach(month => {
      result[year][month] = groupedClients[year][month];
    });
  });

  return result;
};


/* ==============================
   GET ALL COUNSELLOR IDs FROM ALL CLIENTS
============================== */
export const getAllCounsellorIds = async () => {
  // Get all counsellor IDs from all clients
  const clients = await db
    .select({ counsellorId: clientInformation.counsellorId })
    .from(clientInformation);

  // Extract unique counsellor IDs
  const uniqueCounsellorIds = [
    ...new Set(clients.map((client) => client.counsellorId)),
  ];

  return uniqueCounsellorIds;
};

/* ==============================
   GET ALL CLIENTS FOR MANAGER (FROM THEIR COUNSELLORS)
   Returns: { [counsellorId]: { counsellor: {...}, clients: { [year]: { [month]: {...} } } } }
============================== */
export const getAllClientsForManager = async (managerId: number) => {
  // Get all counsellors assigned to this manager
  const managerCounsellors = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.role, "counsellor"), eq(users.managerId, managerId)));

  if (managerCounsellors.length === 0) {
    return {};
  }

  const counsellorIds = managerCounsellors.map(c => c.id);

  // Get all clients from these counsellors (exclude archived)
  const allClients = await db
    .select()
    .from(clientInformation)
    .where(and(inArray(clientInformation.counsellorId, counsellorIds), eq(clientInformation.archived, false)))
    .orderBy(desc(clientInformation.createdAt));

  if (allClients.length === 0) {
    return {};
  }

  // Get all counsellors info
  const counsellorsData = await db
    .select({
      id: users.id,
      name: users.fullName,
      designation: users.designation,
    })
    .from(users)
    .where(inArray(users.id, counsellorIds));

  // Create counsellor map
  const counsellorMap = new Map(
    counsellorsData.map(c => [c.id, { id: c.id, name: c.name, designation: c.designation || null }])
  );

  // Get all unique saleTypeIds and leadTypeIds (for all clients)
  const uniqueSaleTypeIds = [...new Set(allClients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  const uniqueLeadTypeIds = [...new Set(allClients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Group clients by counsellor first
  const clientsByCounsellor = new Map<number, typeof allClients>();
  allClients.forEach(client => {
    if (!clientsByCounsellor.has(client.counsellorId)) {
      clientsByCounsellor.set(client.counsellorId, []);
    }
    clientsByCounsellor.get(client.counsellorId)!.push(client);
  });

  // Process each counsellor's clients
  const result: { [counsellorId: string]: { counsellor: any, clients: any } } = {};

  await Promise.all(
    Array.from(clientsByCounsellor.entries()).map(async ([counsellorId, counsellorClients]) => {
      // Get counsellor info
      const counsellor = counsellorMap.get(counsellorId) || null;

      // Fetch payments and product payments for each client in this counsellor's group
      const clientsWithDetails = await Promise.all(
        counsellorClients.map(async (client) => {
          try {
            const payments = await getPaymentsByClientId(client.clientId);
            const productPayments = await getProductPaymentsByClientId(client.clientId);

            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: saleType?.isCoreProduct ? payments : [],
              productPayments: productPayments || [],
            };
          } catch (error) {
            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: [],
              productPayments: [],
            };
          }
        })
      );

      // Group this counsellor's clients by year and month
      const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      clientsWithDetails.forEach(client => {
        if (!client.enrollmentDate) return;

        const enrollmentDate = new Date(client.enrollmentDate);
        const year = enrollmentDate.getFullYear().toString();
        const month = enrollmentDate.toLocaleString('default', { month: 'short' });

        if (!groupedClients[year]) {
          groupedClients[year] = {};
        }

        if (!groupedClients[year][month]) {
          groupedClients[year][month] = {
            clients: [],
            total: 0
          };
        }

        groupedClients[year][month].clients.push(client);
        groupedClients[year][month].total++;
      });

      // Sort years: descending (newest first: 2026 → 2025 → 2024)
      const currentYear = new Date().getFullYear().toString();
      const sortedYears = Object.keys(groupedClients).sort((a, b) => {
        return parseInt(b) - parseInt(a); // descending order (newest first)
      });

      // Sort months within each year
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
      const currentMonthIndex = currentDate.getMonth();
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const sortedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      sortedYears.forEach(year => {
        sortedClients[year] = {};
        const months = Object.keys(groupedClients[year]);

        months.sort((a, b) => {
          if (year === currentYear) {
            const aIndex = monthOrder.indexOf(a);
            const bIndex = monthOrder.indexOf(b);

            if (a === currentMonth) return -1;
            if (b === currentMonth) return 1;

            const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
            const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

            return aFromCurrent - bFromCurrent;
          }

          return monthOrder.indexOf(a) - monthOrder.indexOf(b);
        });

        months.forEach(month => {
          sortedClients[year][month] = groupedClients[year][month];
        });
      });

      // Store result for this counsellor
      result[counsellorId.toString()] = {
        counsellor: counsellor,
        clients: sortedClients,
      };
    })
  );

  return result;
};

/* ==============================
   GET ALL CLIENTS FOR ADMIN (ALL COUNSELLORS)
   Returns: { [counsellorId]: { counsellor: {...}, clients: { [year]: { [month]: {...} } } } }
============================== */
export const getAllClientsForAdmin = async () => {
  // Get all clients from all counsellors (exclude archived)
  const allClients = await db
    .select()
    .from(clientInformation)
    .where(eq(clientInformation.archived, false))
    .orderBy(desc(clientInformation.createdAt));

  if (allClients.length === 0) {
    return {};
  }

  // Get all unique counsellor IDs
  const uniqueCounsellorIds = [...new Set(allClients.map(client => client.counsellorId))];

  // Get all counsellors info
  const counsellorsData = uniqueCounsellorIds.length > 0 ? await db
    .select({
      id: users.id,
      name: users.fullName,
      isSupervisor: users.isSupervisor,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .where(inArray(users.id, uniqueCounsellorIds))
    : [];

  // Create counsellor map
  const counsellorMap = new Map(
    counsellorsData.map(c => [c.id, { id: c.id, name: c.name, designation: c.designation, isSupervisor: c.isSupervisor, role: c.role || null }])
  );

  // Get all unique saleTypeIds and leadTypeIds (for all clients)
  const uniqueSaleTypeIds = [...new Set(allClients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  const uniqueLeadTypeIds = [...new Set(allClients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Group clients by counsellor first
  const clientsByCounsellor = new Map<number, typeof allClients>();
  allClients.forEach(client => {
    if (!clientsByCounsellor.has(client.counsellorId)) {
      clientsByCounsellor.set(client.counsellorId, []);
    }
    clientsByCounsellor.get(client.counsellorId)!.push(client);
  });

  // Process each counsellor's clients
  const result: { [counsellorId: string]: { counsellor: any, clients: any } } = {};

  await Promise.all(
    Array.from(clientsByCounsellor.entries()).map(async ([counsellorId, counsellorClients]) => {
      // Get counsellor info
      const counsellor = counsellorMap.get(counsellorId) || null;

      // Fetch payments and product payments for each client in this counsellor's group
      const clientsWithDetails = await Promise.all(
        counsellorClients.map(async (client) => {
          try {
            const payments = await getPaymentsByClientId(client.clientId);
            const productPayments = await getProductPaymentsByClientId(client.clientId);

            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: saleType?.isCoreProduct ? payments : [],
              productPayments: productPayments || [],
            };
          } catch (error) {
            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: [],
              productPayments: [],
            };
          }
        })
      );

      // Group this counsellor's clients by year and month
      const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      clientsWithDetails.forEach(client => {
        if (!client.enrollmentDate) return;

        const enrollmentDate = new Date(client.enrollmentDate);
        const year = enrollmentDate.getFullYear().toString();
        const month = enrollmentDate.toLocaleString('default', { month: 'short' });

        if (!groupedClients[year]) {
          groupedClients[year] = {};
        }

        if (!groupedClients[year][month]) {
          groupedClients[year][month] = {
            clients: [],
            total: 0
          };
        }

        groupedClients[year][month].clients.push(client);
        groupedClients[year][month].total++;
      });

      // Sort years: descending (newest first: 2026 → 2025 → 2024)
      const currentYear = new Date().getFullYear().toString();
      const sortedYears = Object.keys(groupedClients).sort((a, b) => {
        return parseInt(b) - parseInt(a); // descending order (newest first)
      });

      // Sort months within each year
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
      const currentMonthIndex = currentDate.getMonth();
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const sortedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      sortedYears.forEach(year => {
        sortedClients[year] = {};
        const months = Object.keys(groupedClients[year]);

        months.sort((a, b) => {
          if (year === currentYear) {
            const aIndex = monthOrder.indexOf(a);
            const bIndex = monthOrder.indexOf(b);

            if (a === currentMonth) return -1;
            if (b === currentMonth) return 1;

            const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
            const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

            return aFromCurrent - bFromCurrent;
          }

          return monthOrder.indexOf(a) - monthOrder.indexOf(b);
        });

        months.forEach(month => {
          sortedClients[year][month] = groupedClients[year][month];
        });
      });

      // Store result for this counsellor
      result[counsellorId.toString()] = {
        counsellor: counsellor,
        clients: sortedClients,
      };
    })
  );

  return result;
};

/* ==============================
   GET ARCHIVED CLIENTS BY COUNSELLOR
   Returns: { [year]: { [month]: { clients: any[], total: number } } }
============================== */
export const getArchivedClientsByCounsellor = async (counsellorId: number) => {
  // Get only archived clients for this counsellor
  const clients = await db
    .select()
    .from(clientInformation)
    .where(and(eq(clientInformation.counsellorId, counsellorId), eq(clientInformation.archived, true)))
    .orderBy(desc(clientInformation.createdAt));

  // Get counsellor information
  const counsellorData = await db
    .select({
      id: users.id,
      name: users.fullName,
      designation: users.designation,
    })
    .from(users)
    .where(eq(users.id, counsellorId))
    .limit(1);

  const counsellor = counsellorData.length > 0 ? {
    id: counsellorData[0].id,
    name: counsellorData[0].name,
    designation: counsellorData[0].designation || null,
  } : null;

  // Get sale types and lead types
  const uniqueSaleTypeIds = [...new Set(clients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  const uniqueLeadTypeIds = [...new Set(clients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Fetch payments and product payments for each client
  const clientsWithDetails = await Promise.all(
    clients.map(async (client) => {
      try {
        const payments = await getPaymentsByClientId(client.clientId);
        const productPayments = await getProductPaymentsByClientId(client.clientId);

        const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
        const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

        return {
          ...client,
          counsellor: counsellor,
          saleType: saleType ? {
            saleTypeId: saleType.saleTypeId,
            saleType: saleType.saleType,
            amount: saleType.amount,
            isCoreProduct: saleType.isCoreProduct,
          } : null,
          leadType: leadType ? {
            id: leadType.id,
            leadType: leadType.leadType,
          } : null,
          payments: saleType?.isCoreProduct ? payments : [],
          productPayments: productPayments || [],
        };
      } catch (error) {
        const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
        const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
        return {
          ...client,
          counsellor: counsellor,
          saleType: saleType ? {
            saleTypeId: saleType.saleTypeId,
            saleType: saleType.saleType,
            amount: saleType.amount,
            isCoreProduct: saleType.isCoreProduct,
          } : null,
          leadType: leadType ? {
            id: leadType.id,
            leadType: leadType.leadType,
          } : null,
          payments: [],
          productPayments: [],
        };
      }
    })
  );

  // Group clients by year and month with counts
  const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

  clientsWithDetails.forEach(client => {
    if (!client.enrollmentDate) return;

    const enrollmentDate = new Date(client.enrollmentDate);
    const year = enrollmentDate.getFullYear().toString();
    const month = enrollmentDate.toLocaleString('default', { month: 'short' });

    if (!groupedClients[year]) {
      groupedClients[year] = {};
    }

    if (!groupedClients[year][month]) {
      groupedClients[year][month] = {
        clients: [],
        total: 0
      };
    }

    groupedClients[year][month].clients.push(client);
    groupedClients[year][month].total++;
  });

  // Sort years: descending (newest first: 2026 → 2025 → 2024)
  const currentYear = new Date().getFullYear().toString();
  const sortedYears = Object.keys(groupedClients).sort((a, b) => {
    return parseInt(b) - parseInt(a); // descending order (newest first)
  });

  // Sort months within each year: current month first, then chronological
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
  const currentMonthIndex = currentDate.getMonth();
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const result: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

  sortedYears.forEach(year => {
    result[year] = {};
    const months = Object.keys(groupedClients[year]);

    months.sort((a, b) => {
      if (year === currentYear) {
        const aIndex = monthOrder.indexOf(a);
        const bIndex = monthOrder.indexOf(b);

        if (a === currentMonth) return -1;
        if (b === currentMonth) return 1;

        const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
        const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

        return aFromCurrent - bFromCurrent;
      }

      return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });

    months.forEach(month => {
      result[year][month] = groupedClients[year][month];
    });
  });

  return result;
};

/* ==============================
   GET ALL ARCHIVED CLIENTS FOR MANAGER (FROM THEIR COUNSELLORS)
   Returns: { [counsellorId]: { counsellor: {...}, clients: { [year]: { [month]: {...} } } } }
============================== */
export const getAllArchivedClientsForManager = async (managerId: number) => {
  // Get all counsellors assigned to this manager
  const managerCounsellors = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.role, "counsellor"), eq(users.managerId, managerId)));

  if (managerCounsellors.length === 0) {
    return {};
  }

  const counsellorIds = managerCounsellors.map(c => c.id);

  // Get only archived clients from these counsellors
  const allClients = await db
    .select()
    .from(clientInformation)
    .where(and(inArray(clientInformation.counsellorId, counsellorIds), eq(clientInformation.archived, true)))
    .orderBy(desc(clientInformation.createdAt));

  if (allClients.length === 0) {
    return {};
  }

  // Get all counsellors info
  const counsellorsData = await db
    .select({
      id: users.id,
      name: users.fullName,
      isSupervisor: users.isSupervisor,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .where(inArray(users.id, counsellorIds));

  // Create counsellor map
  const counsellorMap = new Map(
    counsellorsData.map(c => [c.id, { id: c.id, name: c.name, designation: c.designation, isSupervisor: c.isSupervisor, role: c.role || null }])
  );

  // Get all unique saleTypeIds and leadTypeIds
  const uniqueSaleTypeIds = [...new Set(allClients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  const uniqueLeadTypeIds = [...new Set(allClients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Group clients by counsellor first
  const clientsByCounsellor = new Map<number, typeof allClients>();
  allClients.forEach(client => {
    if (!clientsByCounsellor.has(client.counsellorId)) {
      clientsByCounsellor.set(client.counsellorId, []);
    }
    clientsByCounsellor.get(client.counsellorId)!.push(client);
  });

  // Process each counsellor's clients
  const result: { [counsellorId: string]: { counsellor: any, clients: any } } = {};

  await Promise.all(
    Array.from(clientsByCounsellor.entries()).map(async ([counsellorId, counsellorClients]) => {
      const counsellor = counsellorMap.get(counsellorId) || null;

      const clientsWithDetails = await Promise.all(
        counsellorClients.map(async (client) => {
          try {
            const payments = await getPaymentsByClientId(client.clientId);
            const productPayments = await getProductPaymentsByClientId(client.clientId);

            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: saleType?.isCoreProduct ? payments : [],
              productPayments: productPayments || [],
            };
          } catch (error) {
            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: [],
              productPayments: [],
            };
          }
        })
      );

      // Group by year and month
      const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      clientsWithDetails.forEach(client => {
        if (!client.enrollmentDate) return;

        const enrollmentDate = new Date(client.enrollmentDate);
        const year = enrollmentDate.getFullYear().toString();
        const month = enrollmentDate.toLocaleString('default', { month: 'short' });

        if (!groupedClients[year]) {
          groupedClients[year] = {};
        }

        if (!groupedClients[year][month]) {
          groupedClients[year][month] = {
            clients: [],
            total: 0
          };
        }

        groupedClients[year][month].clients.push(client);
        groupedClients[year][month].total++;
      });

      // Sort years: descending (newest first)
      const currentYear = new Date().getFullYear().toString();
      const sortedYears = Object.keys(groupedClients).sort((a, b) => {
        return parseInt(b) - parseInt(a);
      });

      // Sort months
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
      const currentMonthIndex = currentDate.getMonth();
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const sortedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      sortedYears.forEach(year => {
        sortedClients[year] = {};
        const months = Object.keys(groupedClients[year]);

        months.sort((a, b) => {
          if (year === currentYear) {
            const aIndex = monthOrder.indexOf(a);
            const bIndex = monthOrder.indexOf(b);

            if (a === currentMonth) return -1;
            if (b === currentMonth) return 1;

            const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
            const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

            return aFromCurrent - bFromCurrent;
          }

          return monthOrder.indexOf(a) - monthOrder.indexOf(b);
        });

        months.forEach(month => {
          sortedClients[year][month] = groupedClients[year][month];
        });
      });

      result[counsellorId.toString()] = {
        counsellor: counsellor,
        clients: sortedClients,
      };
    })
  );

  return result;
};

/* ==============================
   GET ALL ARCHIVED CLIENTS FOR ADMIN (ALL COUNSELLORS)
   Returns: { [counsellorId]: { counsellor: {...}, clients: { [year]: { [month]: {...} } } } }
============================== */
export const getAllArchivedClientsForAdmin = async () => {
  // Get all archived clients from all counsellors
  const allClients = await db
    .select()
    .from(clientInformation)
    .where(eq(clientInformation.archived, true))
    .orderBy(desc(clientInformation.createdAt));

  if (allClients.length === 0) {
    return {};
  }

  // Get all unique counsellor IDs
  const uniqueCounsellorIds = [...new Set(allClients.map(client => client.counsellorId))];

  // Get all counsellors info
  const counsellorsData = uniqueCounsellorIds.length > 0 ? await db
    .select({
      id: users.id,
      name: users.fullName,
      isSupervisor: users.isSupervisor,
      role: users.role,
      designation: users.designation,
    })
    .from(users)
    .where(inArray(users.id, uniqueCounsellorIds))
    : [];

  // Create counsellor map
  const counsellorMap = new Map(
    counsellorsData.map(c => [c.id, { id: c.id, name: c.name, designation: c.designation, isSupervisor: c.isSupervisor, role: c.role || null }])
  );

  // Get all unique saleTypeIds and leadTypeIds
  const uniqueSaleTypeIds = [...new Set(allClients.map(client => client.saleTypeId))];
  const saleTypesData = uniqueSaleTypeIds.length > 0 ? await db
    .select()
    .from(saleTypes)
    .where(inArray(saleTypes.saleTypeId, uniqueSaleTypeIds))
    : [];

  const uniqueLeadTypeIds = [...new Set(allClients.map(client => client.leadTypeId))];
  const leadTypesData = uniqueLeadTypeIds.length > 0 ? await db
    .select()
    .from(leadTypes)
    .where(inArray(leadTypes.id, uniqueLeadTypeIds))
    : [];

  // Group clients by counsellor first
  const clientsByCounsellor = new Map<number, typeof allClients>();
  allClients.forEach(client => {
    if (!clientsByCounsellor.has(client.counsellorId)) {
      clientsByCounsellor.set(client.counsellorId, []);
    }
    clientsByCounsellor.get(client.counsellorId)!.push(client);
  });

  // Process each counsellor's clients
  const result: { [counsellorId: string]: { counsellor: any, clients: any } } = {};

  await Promise.all(
    Array.from(clientsByCounsellor.entries()).map(async ([counsellorId, counsellorClients]) => {
      const counsellor = counsellorMap.get(counsellorId) || null;

      const clientsWithDetails = await Promise.all(
        counsellorClients.map(async (client) => {
          try {
            const payments = await getPaymentsByClientId(client.clientId);
            const productPayments = await getProductPaymentsByClientId(client.clientId);

            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);

            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: saleType?.isCoreProduct ? payments : [],
              productPayments: productPayments || [],
            };
          } catch (error) {
            const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);
            const leadType = leadTypesData.find(lt => lt.id === client.leadTypeId);
            return {
              ...client,
              counsellor: counsellor,
              saleType: saleType ? {
                saleTypeId: saleType.saleTypeId,
                saleType: saleType.saleType,
                amount: saleType.amount,
                isCoreProduct: saleType.isCoreProduct,
              } : null,
              leadType: leadType ? {
                id: leadType.id,
                leadType: leadType.leadType,
              } : null,
              payments: [],
              productPayments: [],
            };
          }
        })
      );

      // Group by year and month
      const groupedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      clientsWithDetails.forEach(client => {
        if (!client.enrollmentDate) return;

        const enrollmentDate = new Date(client.enrollmentDate);
        const year = enrollmentDate.getFullYear().toString();
        const month = enrollmentDate.toLocaleString('default', { month: 'short' });

        if (!groupedClients[year]) {
          groupedClients[year] = {};
        }

        if (!groupedClients[year][month]) {
          groupedClients[year][month] = {
            clients: [],
            total: 0
          };
        }

        groupedClients[year][month].clients.push(client);
        groupedClients[year][month].total++;
      });

      // Sort years: descending (newest first)
      const currentYear = new Date().getFullYear().toString();
      const sortedYears = Object.keys(groupedClients).sort((a, b) => {
        return parseInt(b) - parseInt(a);
      });

      // Sort months
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'short' });
      const currentMonthIndex = currentDate.getMonth();
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const sortedClients: { [year: string]: { [month: string]: { clients: any[], total: number } } } = {};

      sortedYears.forEach(year => {
        sortedClients[year] = {};
        const months = Object.keys(groupedClients[year]);

        months.sort((a, b) => {
          if (year === currentYear) {
            const aIndex = monthOrder.indexOf(a);
            const bIndex = monthOrder.indexOf(b);

            if (a === currentMonth) return -1;
            if (b === currentMonth) return 1;

            const aFromCurrent = (aIndex - currentMonthIndex + 12) % 12;
            const bFromCurrent = (bIndex - currentMonthIndex + 12) % 12;

            return aFromCurrent - bFromCurrent;
          }

          return monthOrder.indexOf(a) - monthOrder.indexOf(b);
        });

        months.forEach(month => {
          sortedClients[year][month] = groupedClients[year][month];
        });
      });

      result[counsellorId.toString()] = {
        counsellor: counsellor,
        clients: sortedClients,
      };
    })
  );

  return result;
};
