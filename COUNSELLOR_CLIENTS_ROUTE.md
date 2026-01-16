# Route: Get All Clients by Counsellor ID (from Middleware)

## Route Details

**Endpoint:** `GET /api/clients/counsellor-clients`

**File:** `src/routes/client.routes.ts` (lines 20-25)

**Controller:** `getAllClientsController` in `src/controllers/client.controller.ts` (lines 77-92)

**Model:** `getClientsByCounsellor` in `src/models/client.model.ts` (lines 164-199)

---

## How It Works

### 1. **Route Definition**
```typescript
router.get(
  "/counsellor-clients",
  requireAuth,                                    // ✅ Extracts user ID from JWT token
  requireRole("admin", "counsellor", "manager"), // ✅ Checks user role
  getAllClientsController                         // ✅ Controller function
);
```

### 2. **Middleware Flow**

#### Step 1: `requireAuth` Middleware
**File:** `src/middlewares/auth.middleware.ts` (lines 94-141)

```typescript
export const requireAuth = async (req, res, next) => {
  // 1. Extract JWT token from cookie or Authorization header
  const token = req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  // 2. Verify token and extract user info
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    userId: string;  // ✅ This is the counsellor ID
    role: Role;
    sessionId: number;
  };

  // 3. Validate session is active
  const [session] = await db
    .select()
    .from(refreshTokens)
    .where(/* session validation */);

  // 4. Attach user to request object
  req.user = {
    id: decoded.userId,  // ✅ Counsellor ID stored here
    role: decoded.role,
  };

  next();
};
```

**Result:** `req.user.id` contains the counsellor ID from the JWT token.

#### Step 2: `requireRole` Middleware
**File:** `src/middlewares/auth.middleware.ts` (lines 142-156)

```typescript
export const requireRole = (...allowedRoles: Role[]) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient role",
      });
    }

    next();
  };
```

**Result:** Only users with role "admin", "counsellor", or "manager" can access.

### 3. **Controller Function**
**File:** `src/controllers/client.controller.ts` (lines 77-92)

```typescript
export const getAllClientsController = async (req: Request, res: Response) => {
  try {
    // ✅ Uses req.user.id from middleware (counsellor ID)
    const clients = await getClientsByCounsellor(req.user!.id);

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
```

**Key Point:** `req.user!.id` is the counsellor ID extracted from the JWT token by the middleware.

### 4. **Model Function**
**File:** `src/models/client.model.ts` (lines 164-199)

```typescript
export const getClientsByCounsellor = async (counsellorId: number) => {
  // 1. Get all clients for this counsellor
  const clients = await db
    .select()
    .from(clientInformation)
    .where(eq(clientInformation.counsellorId, counsellorId))
    .orderBy(desc(clientInformation.createdAt));

  // 2. Get sale types for clients
  const clientIds = clients.map(client => client.clientId);
  const saleTypesData = /* fetch sale types */;

  // 3. Fetch payments and product payments for each client
  const clientsWithDetails = await Promise.all(
    clients.map(async (client) => {
      const payments = await getPaymentsByClientId(client.clientId);
      const productPayments = await getProductPaymentsByClientId(client.clientId);

      const saleType = saleTypesData.find(st => st.saleTypeId === client.saleTypeId);

      return {
        ...client,
        saleType: saleType ? {
          saleTypeId: saleType.saleTypeId,
          saleType: saleType.saleType,
          amount: saleType.amount,
          isCoreProduct: saleType.isCoreProduct,
        } : null,
        payments: saleType?.isCoreProduct ? payments : [],
        productPayments: productPayments || [],
      };
    })
  );

  return clientsWithDetails;
};
```

---

## Complete Flow Diagram

```
1. Client Request
   ↓
   GET /api/clients/counsellor-clients
   ↓
2. requireAuth Middleware
   - Extract JWT token
   - Verify token
   - Extract userId (counsellor ID)
   - Set req.user = { id: userId, role: role }
   ↓
3. requireRole Middleware
   - Check if role is "admin", "counsellor", or "manager"
   ↓
4. getAllClientsController
   - Use req.user.id (counsellor ID from middleware)
   - Call getClientsByCounsellor(req.user.id)
   ↓
5. getClientsByCounsellor Model
   - Query: WHERE counsellorId = req.user.id
   - Get clients + payments + product payments
   - Return complete client data
   ↓
6. Response
   {
     success: true,
     data: [/* clients with details */]
   }
```

---

## Request Example

```http
GET /api/clients/counsellor-clients
Authorization: Bearer <JWT_TOKEN>
Cookie: accessToken=<JWT_TOKEN>
```

**JWT Token contains:**
```json
{
  "userId": 123,  // ✅ This becomes req.user.id
  "role": "counsellor",
  "sessionId": 456
}
```

---

## Response Example

```json
{
  "success": true,
  "data": [
    {
      "clientId": 1,
      "counsellorId": 123,  // ✅ Matches req.user.id
      "fullName": "John Doe",
      "enrollmentDate": "2026-01-01",
      "saleTypeId": 1,
      "saleType": {
        "saleTypeId": 1,
        "saleType": "Student Visa",
        "amount": "5000",
        "isCoreProduct": true
      },
      "payments": [/* client payments */],
      "productPayments": [/* product payments with entity data */]
    },
    // ... more clients
  ]
}
```

---

## Key Points

1. **Counsellor ID comes from JWT token** - Not from URL params or request body
2. **Middleware extracts it** - `requireAuth` sets `req.user.id`
3. **Automatic filtering** - Only returns clients where `counsellorId = req.user.id`
4. **Role-based access** - Only "admin", "counsellor", "manager" can access
5. **Complete data** - Returns clients with payments and product payments

---

## Alternative Route (by URL param)

There's also a route that takes counsellor ID from URL:

**Endpoint:** `GET /api/clients/:counsellorId`

**Controller:** `getAllClientsByCounsellorController`

**Difference:** Uses `req.params.counsellorId` instead of `req.user.id`

This is useful for admins viewing other counsellors' clients.

---

## Summary

✅ **Route:** `GET /api/clients/counsellor-clients`
✅ **Middleware:** `requireAuth` extracts counsellor ID from JWT → `req.user.id`
✅ **Controller:** Uses `req.user.id` to get clients
✅ **Model:** Queries `WHERE counsellorId = req.user.id`
✅ **Returns:** All clients for the authenticated counsellor with full details
