# Frontend Admin WebSocket Fix

## Backend Changes (Already Done ✅)

### 1. Admin Room Created
- Admin users can now join `admin` room
- Events are emitted to both counsellor rooms AND admin room

### 2. New WebSocket Events
- `join:admin` - Join admin room
- `leave:admin` - Leave admin room

### 3. Event Data Structure
When `client:created` or `client:updated` is emitted:
- **To counsellor room**: `{ action, client, clients: counsellorClientsList }`
- **To admin room**: `{ action, client, clients: allClientsList }`

## Frontend Changes Required

### 1. Update Socket Connection

**In your socket service/context:**

```typescript
// When user connects, check their role
const connect = (userId: number, userRole: string) => {
  if (socket?.connected) {
    // Rejoin rooms if already connected
    if (userRole === "admin") {
      socket.emit("join:admin");
    } else {
      socket.emit("join:counsellor", userId);
    }
    return;
  }

  const newSocket = io('http://localhost:5000', {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  newSocket.on('connect', () => {
    console.log('✅ Connected to WebSocket');

    // Join appropriate room based on role
    if (userRole === "admin") {
      newSocket.emit("join:admin");
      console.log('👑 Joined admin room');
    } else {
      newSocket.emit("join:counsellor", userId);
      console.log(`👤 Joined counsellor room: ${userId}`);
    }
  });

  setSocket(newSocket);
};
```

### 2. Update Event Listeners

**In your client list component:**

```typescript
useEffect(() => {
  if (!socket || !user) return;

  const userRole = user.role; // "admin" | "counsellor" | "manager"
  const isAdmin = userRole === "admin";

  // Handle client created/updated events
  const handleClientCreated = (data: any) => {
    console.log('Client created:', data);

    if (isAdmin) {
      // Admin: Use setQueryData with full admin list
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      // Counsellor: Use setQueryData with counsellor list
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    // Show notification
    toast.success('New client added!');
  };

  const handleClientUpdated = (data: any) => {
    console.log('Client updated:', data);

    if (isAdmin) {
      queryClient.setQueryData(['clients'], data.clients);
    } else {
      queryClient.setQueryData(['counsellor-clients'], data.clients);
    }

    toast.success('Client updated!');
  };

  // Register listeners
  socket.on('client:created', handleClientCreated);
  socket.on('client:updated', handleClientUpdated);

  // Cleanup
  return () => {
    socket.off('client:created', handleClientCreated);
    socket.off('client:updated', handleClientUpdated);
  };
}, [socket, user]);
```

### 3. Update React Query Configuration

**Remove `invalidateQueries` for admin, use `setQueryData` instead:**

```typescript
// ❌ OLD (Admin view - slow, uses refetch)
const { data: clients } = useQuery({
  queryKey: ['clients'],
  queryFn: fetchAllClients,
  // Don't use invalidateQueries on socket events
});

// ✅ NEW (Admin view - instant, uses cache update)
// Listen to socket events and use setQueryData directly
// See event handlers above
```

### 4. Query Keys

Make sure your query keys match:
- **Admin**: `['clients']`
- **Counsellor**: `['counsellor-clients']`

### 5. Disconnect Handling

```typescript
const disconnect = () => {
  if (socket) {
    if (userRole === "admin") {
      socket.emit("leave:admin");
    } else {
      socket.emit("leave:counsellor", userId);
    }
    socket.disconnect();
  }
};
```

## Testing Checklist

1. ✅ Admin joins admin room on connection
2. ✅ Counsellor joins counsellor room on connection
3. ✅ Admin receives `client:created` events
4. ✅ Counsellor receives `client:created` events
5. ✅ Admin cache updates instantly (no refetch)
6. ✅ Counsellor cache updates instantly
7. ✅ Both see updates in real-time
8. ✅ Rooms are left on disconnect

## Event Flow

```
User creates client
  ↓
Backend saves to DB
  ↓
Backend emits to:
  - counsellor:${counsellorId} room (counsellor list)
  - admin room (full list)
  ↓
Frontend receives event
  ↓
Updates React Query cache with setQueryData
  ↓
UI updates instantly ✨
```

## Summary

**Key Changes:**
1. Join `admin` room if user role is "admin"
2. Listen for events in appropriate room
3. Use `setQueryData` instead of `invalidateQueries` for instant updates
4. Handle both admin and counsellor event data correctly
