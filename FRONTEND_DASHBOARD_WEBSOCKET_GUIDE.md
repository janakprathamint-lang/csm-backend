# Frontend Dashboard WebSocket Implementation Guide

## Overview

The dashboard now supports real-time updates via WebSocket. When client data changes (client created/updated, payment added/updated, product payment added/updated), the dashboard automatically updates without requiring a page refresh.

---

## Backend Implementation

### WebSocket Events

**Event Name:** `dashboard:updated`

**Event Data:**
```json
{
  "filter": "today",
  "data": {
    "totalClients": {
      "count": 16,
      "change": 12.5,
      "changeType": "increase"
    },
    "totalRevenue": {
      "totalCorePayment": "178596.00",
      "totalProductPayment": "506388.00",
      "total": "684984.00",
      "change": 8.2,
      "changeType": "increase"
    },
    "pendingAmount": {
      "pendingAmount": "50000.00",
      "breakdown": {
        "initial": "107100.00",
        "beforeVisa": "33999.00",
        "afterVisa": "37497.00",
        "submittedVisa": "0.00"
      },
      "label": "total outstanding"
    },
    "newEnrollments": {
      "count": 3,
      "label": "new clients today"
    },
    "revenueOverview": [
      {
        "month": "Jan",
        "revenue": "684984.00"
      },
      ...
    ]
  }
}
```

**When Emitted:**
- When a client is created or updated
- When a client payment is created or updated
- When a client product payment is created or updated

**Filter:** Currently emits for "today" filter only (simplest approach)

---

## Frontend Implementation

### Step 1: Install Socket.IO Client

```bash
npm install socket.io-client
```

---

### Step 2: Create Socket Connection

```typescript
// utils/socket.ts
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket: Socket | null = null;

export const connectDashboardSocket = (): Socket => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log("✅ Dashboard socket connected:", socket?.id);

    // Join dashboard room
    socket?.emit("join:dashboard");
  });

  socket.on("disconnect", () => {
    console.log("❌ Dashboard socket disconnected");
  });

  socket.on("error", (error) => {
    console.error("❌ Dashboard socket error:", error);
  });

  return socket;
};

export const disconnectDashboardSocket = () => {
  if (socket) {
    socket.emit("leave:dashboard");
    socket.disconnect();
    socket = null;
  }
};

export const getDashboardSocket = (): Socket | null => {
  return socket;
};
```

---

### Step 3: Use in Dashboard Component

```typescript
// components/Dashboard.tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { connectDashboardSocket, disconnectDashboardSocket, getDashboardSocket } from "../utils/socket";
import { getDashboardStats } from "../api/dashboard";

interface DashboardStats {
  totalClients: {
    count: number;
    change: number;
    changeType: "increase" | "decrease" | "no-change";
  };
  totalRevenue: {
    totalCorePayment: string;
    totalProductPayment: string;
    total: string;
    change: number;
    changeType: "increase" | "decrease" | "no-change";
  };
  pendingAmount: {
    pendingAmount: string;
    breakdown: {
      initial: string;
      beforeVisa: string;
      afterVisa: string;
      submittedVisa: string;
    };
    label: string;
  };
  newEnrollments: {
    count: number;
    label: string;
  };
  revenueOverview: Array<{
    month: string;
    revenue: string;
  }>;
}

const Dashboard = () => {
  const [filter, setFilter] = useState<"today" | "weekly" | "monthly" | "yearly" | "custom">("today");
  const [beforeDate, setBeforeDate] = useState<string | undefined>();
  const [afterDate, setAfterDate] = useState<string | undefined>();

  // Fetch initial dashboard data
  const { data: dashboardData, refetch } = useQuery({
    queryKey: ["dashboard", filter, beforeDate, afterDate],
    queryFn: () => getDashboardStats(filter, beforeDate, afterDate),
  });

  useEffect(() => {
    // Connect to WebSocket when component mounts
    const socket = connectDashboardSocket();

    // Listen for dashboard updates
    const handleDashboardUpdate = (eventData: { filter: string; data: DashboardStats }) => {
      console.log("📊 Dashboard update received:", eventData);

      // Only update if the filter matches "today" (current implementation)
      if (eventData.filter === "today" && filter === "today") {
        // Update React Query cache directly
        // This will trigger a re-render with new data
        refetch();
      }
    };

    socket.on("dashboard:updated", handleDashboardUpdate);

    // Cleanup on unmount
    return () => {
      socket.off("dashboard:updated", handleDashboardUpdate);
      // Don't disconnect - keep connection alive for other components
      // disconnectDashboardSocket();
    };
  }, [filter, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectDashboardSocket();
    };
  }, []);

  return (
    <div className="dashboard">
      {/* Filter controls */}
      <div className="filters">
        <button onClick={() => setFilter("today")}>Today</button>
        <button onClick={() => setFilter("weekly")}>Weekly</button>
        <button onClick={() => setFilter("monthly")}>Monthly</button>
        <button onClick={() => setFilter("yearly")}>Yearly</button>
        <button onClick={() => setFilter("custom")}>Custom</button>
      </div>

      {/* Dashboard content */}
      {dashboardData && (
        <div>
          <div className="stat-card">
            <h3>Total Clients</h3>
            <p>{dashboardData.totalClients.count}</p>
            <span className={dashboardData.totalClients.changeType}>
              {dashboardData.totalClients.change}%
            </span>
          </div>

          <div className="stat-card">
            <h3>Total Revenue</h3>
            <p>₹{dashboardData.totalRevenue.total}</p>
            <div>
              <span>Core: ₹{dashboardData.totalRevenue.totalCorePayment}</span>
              <span>Product: ₹{dashboardData.totalRevenue.totalProductPayment}</span>
            </div>
          </div>

          <div className="stat-card">
            <h3>Pending Amount</h3>
            <p>₹{dashboardData.pendingAmount.pendingAmount}</p>
            <div>
              <span>Initial: ₹{dashboardData.pendingAmount.breakdown.initial}</span>
              <span>Before Visa: ₹{dashboardData.pendingAmount.breakdown.beforeVisa}</span>
              <span>After Visa: ₹{dashboardData.pendingAmount.breakdown.afterVisa}</span>
            </div>
          </div>

          <div className="stat-card">
            <h3>New Enrollments</h3>
            <p>{dashboardData.newEnrollments.count}</p>
            <span>{dashboardData.newEnrollments.label}</span>
          </div>

          {/* Revenue Overview Chart */}
          <div className="chart">
            <h3>Revenue Overview</h3>
            {/* Render chart with dashboardData.revenueOverview */}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
```

---

### Step 4: Alternative - Direct Cache Update (More Efficient)

Instead of refetching, you can update the React Query cache directly:

```typescript
import { useQueryClient } from "@tanstack/react-query";

const Dashboard = () => {
  const queryClient = useQueryClient();
  // ... other code ...

  useEffect(() => {
    const socket = connectDashboardSocket();

    const handleDashboardUpdate = (eventData: { filter: string; data: DashboardStats }) => {
      console.log("📊 Dashboard update received:", eventData);

      // Only update if the filter matches "today"
      if (eventData.filter === "today" && filter === "today") {
        // Update React Query cache directly (no API call needed)
        queryClient.setQueryData(
          ["dashboard", "today", undefined, undefined],
          { success: true, data: eventData.data }
        );
      }
    };

    socket.on("dashboard:updated", handleDashboardUpdate);

    return () => {
      socket.off("dashboard:updated", handleDashboardUpdate);
    };
  }, [filter, queryClient]);

  // ... rest of component
};
```

---

## Testing

### Test WebSocket Connection

1. Open browser DevTools → Network → WS (WebSocket)
2. Open dashboard page
3. You should see a WebSocket connection established
4. Check console for: `✅ Dashboard socket connected`

### Test Real-time Updates

1. Open dashboard in one browser tab
2. Create/update a client in another tab (or use Postman)
3. Dashboard should update instantly without refresh

### Test Different Filters

- **Today filter:** Updates instantly via WebSocket
- **Other filters (weekly, monthly, yearly, custom):** Still use REST API (no WebSocket updates yet)

---

## Event Flow

```
1. User creates/updates client/payment/product payment
   ↓
2. Backend saves data successfully
   ↓
3. Backend calculates dashboard stats for "today" filter
   ↓
4. Backend emits "dashboard:updated" event to "admin:dashboard" room
   ↓
5. Frontend receives event
   ↓
6. Frontend updates dashboard UI (via React Query cache or refetch)
   ↓
7. Dashboard shows updated data instantly
```

---

## Notes

1. **Current Implementation:**
   - Only emits for "today" filter (simplest approach)
   - Emits immediately on each data change
   - Uses "admin:dashboard" room

2. **Future Enhancements:**
   - Support multiple filters (store active filter per session)
   - Batch updates (emit every 5 seconds instead of immediately)
   - Support custom date ranges

3. **Error Handling:**
   - WebSocket errors don't fail the main request
   - Frontend should handle disconnections gracefully
   - Fallback to REST API if WebSocket fails

---

## Troubleshooting

### WebSocket not connecting
- Check CORS settings in backend
- Verify `VITE_API_URL` environment variable
- Check browser console for errors

### Dashboard not updating
- Verify socket is connected (check console logs)
- Check if event is being emitted (check backend logs)
- Verify filter matches ("today" only currently)

### Multiple connections
- Ensure socket is created once and reused
- Clean up on component unmount
- Use singleton pattern for socket connection

---

## Example API Function

```typescript
// api/dashboard.ts
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const getDashboardStats = async (
  filter: "today" | "weekly" | "monthly" | "yearly" | "custom",
  beforeDate?: string,
  afterDate?: string
) => {
  const params: any = { filter };

  if (filter === "custom") {
    if (!beforeDate || !afterDate) {
      throw new Error("beforeDate and afterDate are required for custom filter");
    }
    params.beforeDate = beforeDate;
    params.afterDate = afterDate;
  }

  const response = await axios.get(`${API_URL}/api/dashboard/stats`, {
    params,
    withCredentials: true,
  });

  return response.data.data; // Return the data object
};
```

---

## Summary

✅ **Backend:** Emits `dashboard:updated` events when data changes
✅ **Frontend:** Connects to WebSocket, joins dashboard room, listens for updates
✅ **Result:** Dashboard updates instantly without page refresh

The implementation is complete and ready to use!
