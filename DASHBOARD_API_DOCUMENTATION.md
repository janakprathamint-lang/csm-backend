# Dashboard API Documentation

## Overview

The Dashboard API provides statistics and metrics for the CRM system, including total clients, revenue, pending amounts, and new enrollments. It supports multiple date filters and calculates percentage changes compared to previous periods.

## Endpoint

```
GET /api/dashboard/stats
```

## Authentication

Requires authentication via `requireAuth` middleware and one of these roles:
- `admin`
- `counsellor`
- `manager`

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | string | No | `"today"` | Date filter: `"today"`, `"weekly"`, `"monthly"`, `"yearly"`, or `"custom"` |
| `beforeDate` | string (YYYY-MM-DD) | Yes (for custom) | - | End date for custom filter |
| `afterDate` | string (YYYY-MM-DD) | Yes (for custom) | - | Start date for custom filter |

## Filter Types

### 1. Today
Returns data for the current day only.

**Example:**
```
GET /api/dashboard/stats?filter=today
```

### 2. Weekly
Returns data for the last 7 days (including today).

**Example:**
```
GET /api/dashboard/stats?filter=weekly
```

### 3. Monthly
Returns data for the current month (from 1st to today).

**Example:**
```
GET /api/dashboard/stats?filter=monthly
```

### 4. Yearly
Returns data for the current year (from January 1st to today).

**Example:**
```
GET /api/dashboard/stats?filter=yearly
```

### 5. Custom
Returns data for a custom date range. Requires `beforeDate` and `afterDate`.

**Example:**
```
GET /api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31
```

**Note:** `beforeDate` must be greater than or equal to `afterDate`.

## Response Structure

```typescript
{
  success: true,
  data: {
    totalClients: {
      count: number,           // Total number of clients
      change: number,          // Percentage change (e.g., 12.5)
      changeType: "increase" | "decrease" | "no-change"
    },
    totalRevenue: {
      amount: string,          // Total revenue (e.g., "7523.00")
      change: number,         // Percentage change (e.g., 8.2)
      changeType: "increase" | "decrease" | "no-change"
    },
    pendingAmount: {
      amount: string,         // Total outstanding amount (e.g., "242300.00")
      label: "total outstanding"
    },
    newEnrollments: {
      count: number,          // Number of new enrollments
      label: string          // e.g., "new clients today", "new clients this week"
    },
    revenueOverview: [        // Last 6 months revenue data for chart
      {
        month: "Jan",
        revenue: "12000.00"
      },
      {
        month: "Feb",
        revenue: "18000.00"
      },
      // ... up to 6 months
    ]
  }
}
```

## Metrics Explained

### 1. Total Clients
- **Count**: Number of non-archived clients created within the date range
- **Change**: Percentage change compared to the previous equivalent period
  - Today vs Yesterday
  - This Week vs Last Week
  - This Month vs Last Month
  - This Year vs Last Year
  - Custom period vs Previous custom period

### 2. Total Revenue
- **Amount**: Sum of all payments within the date range
  - Includes: `clientPayments.amount` (core products)
  - Includes: `clientProductPayments.amount` (non-core products)
  - Filtered by: `paymentDate` within the date range
- **Change**: Percentage change compared to the previous equivalent period

### 3. Pending Amount (Outstanding)
- **Amount**: Total expected amount minus total paid amount
  - Total Expected: Sum of `saleTypes.amount` for all non-archived clients
  - Total Paid: Sum of all payments (client payments + product payments)
  - **Note**: This metric is NOT filtered by date range (shows all outstanding payments)
- **Label**: Always "total outstanding"

### 4. New Enrollments
- **Count**: Number of non-archived clients created within the date range
- **Label**: Dynamic based on filter:
  - `"new clients today"` (for today filter)
  - `"new clients this week"` (for weekly filter)
  - `"new clients this month"` (for monthly filter)
  - `"new clients this year"` (for yearly filter)
  - `"new clients in period"` (for custom filter)

### 5. Revenue Overview
- **Data**: Monthly revenue for the last 6 months (including current month)
- **Format**: Array of objects with `month` (short name) and `revenue` (string amount)
- **Purpose**: Used for the revenue chart visualization

## Example Requests

### Get Today's Stats
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=today" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Weekly Stats
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=weekly" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Custom Date Range Stats
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Example Response

```json
{
  "success": true,
  "data": {
    "totalClients": {
      "count": 150,
      "change": 12.5,
      "changeType": "increase"
    },
    "totalRevenue": {
      "amount": "7523.00",
      "change": 8.2,
      "changeType": "increase"
    },
    "pendingAmount": {
      "amount": "242300.00",
      "label": "total outstanding"
    },
    "newEnrollments": {
      "count": 5,
      "label": "new clients today"
    },
    "revenueOverview": [
      {
        "month": "Jan",
        "revenue": "12000.00"
      },
      {
        "month": "Feb",
        "revenue": "18000.00"
      },
      {
        "month": "Mar",
        "revenue": "25000.00"
      },
      {
        "month": "Apr",
        "revenue": "20000.00"
      },
      {
        "month": "May",
        "revenue": "31000.00"
      },
      {
        "month": "Jun",
        "revenue": "45000.00"
      }
    ]
  }
}
```

## Error Responses

### Invalid Filter
```json
{
  "success": false,
  "message": "Invalid filter. Must be one of: today, weekly, monthly, yearly, custom"
}
```
**Status Code:** 400

### Missing Date Parameters (Custom Filter)
```json
{
  "success": false,
  "message": "beforeDate and afterDate are required for custom filter"
}
```
**Status Code:** 400

### Invalid Date Format
```json
{
  "success": false,
  "message": "Date format must be YYYY-MM-DD"
}
```
**Status Code:** 400

### Invalid Date Range
```json
{
  "success": false,
  "message": "beforeDate must be greater than or equal to afterDate"
}
```
**Status Code:** 400

### Server Error
```json
{
  "success": false,
  "message": "Failed to fetch dashboard stats"
}
```
**Status Code:** 500

## Implementation Details

### Files Created

1. **`src/models/dashboard.model.ts`**
   - Contains all database queries and calculations
   - Functions:
     - `getDashboardStats()` - Main function
     - `getTotalClients()` - Count clients
     - `getTotalRevenue()` - Sum payments
     - `getPendingAmount()` - Calculate outstanding
     - `getNewEnrollments()` - Count new clients
     - `getRevenueOverview()` - Monthly revenue data
     - `calculatePercentageChange()` - Percentage calculations
     - `getDateRange()` - Date range helpers

2. **`src/controllers/dashboard.controller.ts`**
   - Request handler with validation
   - Validates query parameters
   - Calls model functions
   - Returns formatted response

3. **`src/routes/dashboard.routes.ts`**
   - Route definition
   - Authentication middleware
   - Role-based access control

4. **`src/index.ts`**
   - Updated to include dashboard routes

### Database Queries

- Uses Drizzle ORM for type-safe queries
- Aggregations: `COUNT()`, `SUM()`
- Date filtering: `gte()`, `lte()`
- Null checks: `isNotNull()`
- Array filtering: `inArray()`

### Performance Considerations

- All metrics calculated in parallel using `Promise.all()`
- Efficient database queries with proper indexes
- Date range calculations optimized
- Revenue overview cached (if needed in future)

## Frontend Integration

### React Query Example

```typescript
import { useQuery } from '@tanstack/react-query';

const useDashboardStats = (filter: string, beforeDate?: string, afterDate?: string) => {
  return useQuery({
    queryKey: ['dashboard-stats', filter, beforeDate, afterDate],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      if (beforeDate) params.append('beforeDate', beforeDate);
      if (afterDate) params.append('afterDate', afterDate);

      const response = await fetch(`/api/dashboard/stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.json();
    }
  });
};
```

### Usage in Component

```typescript
const Dashboard = () => {
  const [filter, setFilter] = useState('today');
  const { data, isLoading } = useDashboardStats(filter);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div>Total Clients: {data.data.totalClients.count}</div>
      <div>Total Revenue: ₹{data.data.totalRevenue.amount}</div>
      <div>Pending Amount: ₹{data.data.pendingAmount.amount}</div>
      <div>New Enrollments: {data.data.newEnrollments.count}</div>
    </div>
  );
};
```

## Notes

1. **Pending Amount**: Not filtered by date range - shows all outstanding payments across all clients
2. **Percentage Changes**: Calculated by comparing current period with previous equivalent period
3. **Revenue Overview**: Always shows last 6 months (not affected by filter)
4. **Date Format**: All dates must be in `YYYY-MM-DD` format
5. **Amounts**: All amounts returned as strings with 2 decimal places (e.g., "7523.00")
