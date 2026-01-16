# Frontend Dashboard WebSocket Implementation - Cursor Prompt

## Copy this prompt and give it to Cursor:

---

**PROMPT FOR CURSOR:**

```
I need to implement real-time dashboard updates using WebSocket (Socket.IO) in my React frontend.

BACKEND IS ALREADY SET UP:
- Backend emits "dashboard:updated" event to "admin:dashboard" room
- Event data structure:
  {
    filter: "today",
    data: {
      totalClients: { count, change, changeType },
      totalRevenue: { totalCorePayment, totalProductPayment, total, change, changeType },
      pendingAmount: { pendingAmount, breakdown: { initial, beforeVisa, afterVisa, submittedVisa }, label },
      newEnrollments: { count, label },
      revenueOverview: [{ month, revenue }, ...]
    }
  }
- Backend URL: http://localhost:5000 (or from VITE_API_URL env variable)

WHAT I NEED:
1. Install socket.io-client package
2. Create a socket utility file (utils/socket.ts) that:
   - Connects to backend WebSocket
   - Joins "admin:dashboard" room on connect
   - Exports connectDashboardSocket() and disconnectDashboardSocket() functions
   - Handles connection/disconnection events
3. Update my Dashboard component to:
   - Connect to WebSocket when component mounts
   - Listen for "dashboard:updated" events
   - Update dashboard data instantly when event is received (using React Query cache update or refetch)
   - Disconnect when component unmounts
4. Use React Query for data fetching (already using @tanstack/react-query)
5. The dashboard already has filter functionality (today, weekly, monthly, yearly, custom)
   - Currently WebSocket only emits for "today" filter
   - For "today" filter: update via WebSocket
   - For other filters: use REST API (GET /api/dashboard/stats?filter=weekly)

CURRENT DASHBOARD API:
- GET /api/dashboard/stats?filter=today (or weekly, monthly, yearly, custom)
- For custom: ?filter=custom&afterDate=2025-01-01&beforeDate=2025-01-31
- Response: { success: true, data: { totalClients, totalRevenue, pendingAmount, newEnrollments, revenueOverview } }

REQUIREMENTS:
- Use TypeScript
- Handle WebSocket errors gracefully
- Don't break existing REST API functionality
- Show loading states
- Handle disconnections (reconnect automatically if possible)
- Only update dashboard if current filter is "today" when WebSocket event is received

Please implement this step by step and explain what you're doing.
```

---

## What This Will Do:

1. **Install Socket.IO Client** - Adds the WebSocket library
2. **Create Socket Utility** - Handles WebSocket connection logic
3. **Update Dashboard Component** - Integrates WebSocket for real-time updates
4. **Maintain Existing Functionality** - REST API still works for all filters

---

## Step-by-Step Explanation:

### Step 1: Install Package
```bash
npm install socket.io-client
```

### Step 2: Create Socket Utility
- File: `utils/socket.ts` or `src/utils/socket.ts`
- Functions: `connectDashboardSocket()`, `disconnectDashboardSocket()`
- Handles: Connection, joining room, error handling

### Step 3: Update Dashboard Component
- Import socket utility
- Connect on mount
- Listen for "dashboard:updated" event
- Update React Query cache when event received
- Disconnect on unmount

### Step 4: Test
- Open dashboard
- Create/update client in another tab
- Dashboard should update instantly

---

## Expected Result:

✅ Dashboard updates instantly when:
- Client is created/updated
- Payment is created/updated
- Product payment is created/updated

✅ No page refresh needed
✅ Works alongside existing REST API
✅ Handles errors gracefully

---

## Additional Notes for Cursor:

- The backend already emits events, so frontend just needs to listen
- Use React Query's `setQueryData` to update cache directly (faster than refetch)
- Keep WebSocket connection alive while dashboard is open
- Only update UI if current filter matches the event filter ("today")

---

## Quick Test After Implementation:

1. Open dashboard in browser
2. Check browser console - should see: "✅ Dashboard socket connected"
3. Open another tab, create a client
4. Dashboard should update instantly without refresh

---

**Just copy the prompt above and paste it to Cursor!**
