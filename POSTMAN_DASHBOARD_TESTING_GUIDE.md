# Postman Testing Guide - Dashboard API

## Endpoint Details

**Base URL:** `http://localhost:5000` (or your server URL)
**Endpoint:** `/api/dashboard/stats`
**Method:** `GET`
**Authentication:** Required (Bearer Token)
**Role Required:** `admin`

---

## Step 1: Get Authentication Token

Before testing the dashboard API, you need to get an authentication token.

### Login Request

**Endpoint:** `POST /api/users/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": {
      "id": 1,
      "role": "admin",
      ...
    }
  }
}
```

**Copy the `accessToken` from the response.**

---

## Step 2: Test Dashboard API

### Setup Request in Postman

1. **Create New Request:**
   - Click "New" → "HTTP Request"
   - Name it: "Dashboard Stats"

2. **Set Method:**
   - Select `GET`

3. **Set URL:**
   - `http://localhost:5000/api/dashboard/stats`

4. **Add Headers:**
   - Go to "Headers" tab
   - Add:
     ```
     Key: Authorization
     Value: Bearer YOUR_ACCESS_TOKEN_HERE
     ```
   - Replace `YOUR_ACCESS_TOKEN_HERE` with the token from Step 1

---

## Step 3: Test Different Filters

### 1. Today Filter (Default)

**URL:**
```
http://localhost:5000/api/dashboard/stats?filter=today
```

**Or simply:**
```
http://localhost:5000/api/dashboard/stats
```
(Default is "today" if no filter is provided)

**Query Parameters:**
- `filter` = `today`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalClients": {
      "count": 3,
      "change": 76.92,
      "changeType": "decrease"
    },
    "totalRevenue": {
      "totalCorePayment": "194000.00",
      "totalProductPayment": "50000.00",
      "total": "244000.00",
      "change": 8.2,
      "changeType": "increase"
    },
    "pendingAmount": {
      "amount": "50000.00",
      "breakdown": {
        "initial": "194000.00",
        "beforeVisa": "0.00",
        "afterVisa": "0.00",
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
        "month": "Feb",
        "revenue": "12000.00"
      },
      {
        "month": "Mar",
        "revenue": "18000.00"
      },
      ...
    ]
  }
}
```

---

### 2. Weekly Filter

**URL:**
```
http://localhost:5000/api/dashboard/stats?filter=weekly
```

**Query Parameters:**
- `filter` = `weekly`

**What it does:**
- Returns data for the last 7 days (including today)

---

### 3. Monthly Filter

**URL:**
```
http://localhost:5000/api/dashboard/stats?filter=monthly
```

**Query Parameters:**
- `filter` = `monthly`

**What it does:**
- Returns data for the current month (from 1st to today)

---

### 4. Yearly Filter

**URL:**
```
http://localhost:5000/api/dashboard/stats?filter=yearly
```

**Query Parameters:**
- `filter` = `yearly`

**What it does:**
- Returns data for the current year (from January 1st to today)

---

### 5. Custom Date Range Filter

**URL:**
```
http://localhost:5000/api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31
```

**Query Parameters:**
- `filter` = `custom`
- `afterDate` = `2026-01-01` (Start date - YYYY-MM-DD format)
- `beforeDate` = `2026-01-31` (End date - YYYY-MM-DD format)

**Important:**
- `beforeDate` must be greater than or equal to `afterDate`
- Both dates are required for custom filter
- Date format must be `YYYY-MM-DD`

**Example:**
```
http://localhost:5000/api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31
```

---

## Postman Collection Setup

### Option 1: Manual Setup

1. **Create Collection:**
   - Click "New" → "Collection"
   - Name: "CRM Dashboard API"

2. **Add Requests:**
   - Create separate requests for each filter type
   - Save the Authorization token at collection level

3. **Set Collection Variables:**
   - Go to Collection → Variables
   - Add:
     - `base_url` = `http://localhost:5000`
     - `access_token` = `YOUR_TOKEN_HERE`

4. **Use Variables in Requests:**
   - URL: `{{base_url}}/api/dashboard/stats?filter=today`
   - Header: `Authorization: Bearer {{access_token}}`

---

### Option 2: Import Collection (JSON)

Create a file `dashboard.postman_collection.json`:

```json
{
  "info": {
    "name": "Dashboard API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Dashboard - Today",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/dashboard/stats?filter=today",
          "host": ["{{base_url}}"],
          "path": ["api", "dashboard", "stats"],
          "query": [
            {
              "key": "filter",
              "value": "today"
            }
          ]
        }
      }
    },
    {
      "name": "Dashboard - Weekly",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/dashboard/stats?filter=weekly",
          "host": ["{{base_url}}"],
          "path": ["api", "dashboard", "stats"],
          "query": [
            {
              "key": "filter",
              "value": "weekly"
            }
          ]
        }
      }
    },
    {
      "name": "Dashboard - Monthly",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/dashboard/stats?filter=monthly",
          "host": ["{{base_url}}"],
          "path": ["api", "dashboard", "stats"],
          "query": [
            {
              "key": "filter",
              "value": "monthly"
            }
          ]
        }
      }
    },
    {
      "name": "Dashboard - Yearly",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/dashboard/stats?filter=yearly",
          "host": ["{{base_url}}"],
          "path": ["api", "dashboard", "stats"],
          "query": [
            {
              "key": "filter",
              "value": "yearly"
            }
          ]
        }
      }
    },
    {
      "name": "Dashboard - Custom Date Range",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31",
          "host": ["{{base_url}}"],
          "path": ["api", "dashboard", "stats"],
          "query": [
            {
              "key": "filter",
              "value": "custom"
            },
            {
              "key": "afterDate",
              "value": "2026-01-01"
            },
            {
              "key": "beforeDate",
              "value": "2026-01-31"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000"
    },
    {
      "key": "access_token",
      "value": "YOUR_TOKEN_HERE"
    }
  ]
}
```

**To Import:**
1. Open Postman
2. Click "Import"
3. Select the JSON file or paste the JSON
4. Update the `access_token` variable with your actual token

---

## Quick Test Steps

### Step-by-Step:

1. **Login to get token:**
   ```
   POST http://localhost:5000/api/users/login
   Body: { "email": "admin@example.com", "password": "password" }
   ```

2. **Copy the accessToken from response**

3. **Test Dashboard:**
   ```
   GET http://localhost:5000/api/dashboard/stats?filter=today
   Headers: Authorization: Bearer YOUR_TOKEN
   ```

4. **Check Response:**
   - Status: `200 OK`
   - Body: JSON with dashboard stats

---

## Common Issues & Solutions

### Issue 1: 401 Unauthorized

**Error:**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**Solution:**
- Check if Authorization header is set correctly
- Verify the token is valid (not expired)
- Make sure token format is: `Bearer YOUR_TOKEN` (with space after Bearer)

---

### Issue 2: 403 Forbidden

**Error:**
```json
{
  "success": false,
  "message": "Access denied"
}
```

**Solution:**
- User must have `admin` role
- Check user role in database or login response

---

### Issue 3: 400 Bad Request - Invalid Filter

**Error:**
```json
{
  "success": false,
  "message": "Invalid filter. Must be one of: today, weekly, monthly, yearly, custom"
}
```

**Solution:**
- Check filter value is one of: `today`, `weekly`, `monthly`, `yearly`, `custom`
- Case-sensitive, must be lowercase

---

### Issue 4: 400 Bad Request - Missing Dates

**Error:**
```json
{
  "success": false,
  "message": "beforeDate and afterDate are required for custom filter"
}
```

**Solution:**
- For `custom` filter, both `afterDate` and `beforeDate` are required
- Format: `YYYY-MM-DD` (e.g., `2026-01-31`)

---

### Issue 5: 400 Bad Request - Invalid Date Format

**Error:**
```json
{
  "success": false,
  "message": "Date format must be YYYY-MM-DD"
}
```

**Solution:**
- Use format: `YYYY-MM-DD`
- Example: `2026-01-31` ✅
- Wrong: `31-01-2026` ❌, `2026/01/31` ❌

---

## Response Structure

### Success Response (200 OK)

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
      "totalCorePayment": "50000.00",
      "totalProductPayment": "25000.00",
      "total": "75000.00",
      "change": 8.2,
      "changeType": "increase"
    },
    "pendingAmount": {
      "amount": "242300.00",
      "breakdown": {
        "initial": "100000.00",
        "beforeVisa": "50000.00",
        "afterVisa": "50000.00",
        "submittedVisa": "42300.00"
      },
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
      ...
    ]
  }
}
```

---

## Testing Checklist

- [ ] Login and get access token
- [ ] Test Today filter
- [ ] Test Weekly filter
- [ ] Test Monthly filter
- [ ] Test Yearly filter
- [ ] Test Custom date range filter
- [ ] Verify response structure
- [ ] Check all metrics are showing correct values
- [ ] Verify revenue overview shows 12 months
- [ ] Test with invalid filter (should return 400)
- [ ] Test without authentication (should return 401)
- [ ] Test with non-admin user (should return 403)

---

## Tips

1. **Save Token:** Save the access token as a Postman variable to reuse
2. **Environment Variables:** Create different environments (dev, prod) with different base URLs
3. **Pre-request Script:** Automatically get token before each request (optional)
4. **Tests:** Add tests to verify response structure and status codes

---

## Example cURL Commands

### Today Filter
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=today" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Weekly Filter
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=weekly" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Custom Date Range
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?filter=custom&afterDate=2026-01-01&beforeDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Need Help?

If you encounter issues:
1. Check server logs for errors
2. Verify database connection
3. Ensure user has admin role
4. Check token expiration
5. Verify date formats are correct
