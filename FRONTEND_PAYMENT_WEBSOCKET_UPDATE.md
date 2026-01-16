# Frontend Payment WebSocket Events Update

## Backend Changes (Already Done ✅)

### New WebSocket Events Added

1. **Payment Events:**
   - `payment:created` - When a client payment is created
   - `payment:updated` - When a client payment is updated

2. **Product Payment Events:**
   - `productPayment:created` - When a product payment is created
   - `productPayment:updated` - When a product payment is updated

### Event Data Structure

**Payment Events:**
```typescript
{
  action: "CREATED" | "UPDATED",
  payment: {
    paymentId: number,
    clientId: number,
    totalPayment: string,
    stage: "INITIAL" | "BEFORE_VISA" | "AFTER_VISA" | "SUBMITTED_VISA",
    amount: string,
    paymentDate: string | null,
    invoiceNo: string | null,
    remarks: string | null,
    // ... other payment fields
  },
  clientId: number,
  client: {
    // Full client details with updated payments array
    client: {...},
    saleType: {...},
    leadType: {...},
    payments: [...updated payments...], // ✅ Updated payments
    productPayments: [...],
  },
  clients: {
    // Full client list (counsellor or admin structure)
    // For admin: { [counsellorId]: { counsellor, clients } }
    // For counsellor: { [year]: { [month]: { clients, total } } }
  }
}
```

**Product Payment Events:**
```typescript
{
  action: "CREATED" | "UPDATED",
  productPayment: {
    productPaymentId: number,
    clientId: number,
    productName: string,
    entityId: number | null,
    entityType: string,
    // ... other product payment fields
  },
  clientId: number,
  client: {
    // Full client details with updated productPayments array
    client: {...},
    saleType: {...},
    leadType: {...},
    payments: [...],
    productPayments: [...updated productPayments...], // ✅ Updated productPayments
  },
  clients: {
    // Full client list (counsellor or admin structure)
  }
}
```

## Frontend Changes Required

### 1. Update Socket Event Listeners

**In your client details component or payment component:**

```typescript
useEffect(() => {
  if (!socket || !user) return;

  const userRole = user.role;
  const isAdmin = userRole === "admin";

  // Handle payment created/updated
  const handlePaymentCreated = (data: any) => {
    console.log('Payment created:', data);

    // Update client details cache with new payment
    queryClient.setQueryData(['client', data.clientId], data.client);

    // Update client list cache
    if (isAdmin) {
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    toast.success('Payment added!');
  };

  const handlePaymentUpdated = (data: any) => {
    console.log('Payment updated:', data);

    // Update client details cache
    queryClient.setQueryData(['client', data.clientId], data.client);

    // Update client list cache
    if (isAdmin) {
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    toast.success('Payment updated!');
  };

  // Handle product payment created/updated
  const handleProductPaymentCreated = (data: any) => {
    console.log('Product payment created:', data);

    // Update client details cache with new product payment
    queryClient.setQueryData(['client', data.clientId], data.client);

    // Update client list cache
    if (isAdmin) {
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    toast.success('Product payment added!');
  };

  const handleProductPaymentUpdated = (data: any) => {
    console.log('Product payment updated:', data);

    // Update client details cache
    queryClient.setQueryData(['client', data.clientId], data.client);

    // Update client list cache
    if (isAdmin) {
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    toast.success('Product payment updated!');
  };

  // Register all listeners
  socket.on('payment:created', handlePaymentCreated);
  socket.on('payment:updated', handlePaymentUpdated);
  socket.on('productPayment:created', handleProductPaymentCreated);
  socket.on('productPayment:updated', handleProductPaymentUpdated);

  // Cleanup
  return () => {
    socket.off('payment:created', handlePaymentCreated);
    socket.off('payment:updated', handlePaymentUpdated);
    socket.off('productPayment:created', handleProductPaymentCreated);
    socket.off('productPayment:updated', handleProductPaymentUpdated);
  };
}, [socket, user]);
```

### 2. Update Client Details Component

**If you have a client details page that shows payments:**

```typescript
const ClientDetailsPage = ({ clientId }) => {
  const { data: clientData } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientDetails(clientId),
  });

  // Socket listeners will automatically update this query cache
  // when payment/productPayment events are received

  return (
    <div>
      {/* Client Info */}
      <ClientInfo client={clientData?.client} />

      {/* Payments Section - Will update automatically via WebSocket */}
      <PaymentsList payments={clientData?.payments || []} />

      {/* Product Payments Section - Will update automatically via WebSocket */}
      <ProductPaymentsList productPayments={clientData?.productPayments || []} />
    </div>
  );
};
```

### 3. Update Client List Component

**The client list should also update when payments change:**

```typescript
// In your ClientList component, the existing socket listeners
// for client:created/updated will also handle payment updates
// because the event includes the full updated client list

// No additional changes needed if you're already listening to:
// - client:created
// - client:updated
// These events now include updated payment data
```

### 4. Query Keys to Update

Make sure you're using consistent query keys:

```typescript
// Client details
queryKey: ['client', clientId]

// Client list (admin)
queryKey: ['clients']

// Client list (counsellor)
queryKey: ['counsellor-clients']

// Payments (if you have a separate query)
queryKey: ['payments', clientId]

// Product payments (if you have a separate query)
queryKey: ['productPayments', clientId]
```

### 5. Optional: Separate Payment Queries

**If you have separate queries for payments/productPayments, update them too:**

```typescript
// For payments list page
const handlePaymentCreated = (data: any) => {
  // Update payments query
  queryClient.setQueryData(['payments', data.clientId], data.client.payments);

  // Update client details
  queryClient.setQueryData(['client', data.clientId], data.client);

  // Update client list
  if (isAdmin) {
    queryClient.setQueryData(['clients'], data.clients);
  } else {
    queryClient.setQueryData(['counsellor-clients'], data.clients);
  }
};

// For product payments list page
const handleProductPaymentCreated = (data: any) => {
  // Update productPayments query
  queryClient.setQueryData(['productPayments', data.clientId], data.client.productPayments);

  // Update client details
  queryClient.setQueryData(['client', data.clientId], data.client);

  // Update client list
  if (isAdmin) {
    queryClient.setQueryData(['clients'], data.clients);
  } else {
    queryClient.setQueryData(['counsellor-clients'], data.clients);
  }
};
```

## Event Flow

```
User creates/updates payment
  ↓
Backend saves to DB
  ↓
Backend gets counsellorId from clientId
  ↓
Backend gets full client details (with updated payments)
  ↓
Backend emits WebSocket events:
  - payment:created/updated to counsellor room
  - payment:created/updated to admin room
  ↓
Frontend receives event
  ↓
Updates React Query cache:
  - ['client', clientId] - client details
  - ['clients'] or ['counsellor-clients'] - client list
  ↓
UI updates instantly ✨
```

## Summary of Frontend Changes

### Required:
1. ✅ Add event listeners for `payment:created` and `payment:updated`
2. ✅ Add event listeners for `productPayment:created` and `productPayment:updated`
3. ✅ Update client details cache when payment events received
4. ✅ Update client list cache when payment events received

### Optional (if you have separate payment pages):
5. Update separate payments query cache
6. Update separate productPayments query cache

### Where to Add:
- Client details page component
- Client list component
- Payments list page (if separate)
- Product payments list page (if separate)

## Testing Checklist

1. ✅ Create a payment → Should appear instantly in client details
2. ✅ Update a payment → Should update instantly in client details
3. ✅ Create a product payment → Should appear instantly in client details
4. ✅ Update a product payment → Should update instantly in client details
5. ✅ Client list should reflect payment changes
6. ✅ Multiple users see updates in real-time
