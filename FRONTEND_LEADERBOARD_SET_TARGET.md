# Frontend: Set Target API Integration Guide

## 🎯 Overview
This guide explains how to integrate the "Set Target" feature in the frontend using the leaderboard API.

---

## 📋 API Endpoint

### **POST `/api/leaderboard/target`**

**Purpose:** Set or update monthly enrollment target for a counsellor

**Access:** Admin and Manager only

**Request Body:**
```json
{
  "counsellorId": 5,
  "target": 20,
  "month": 1,
  "year": 2026
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "action": "CREATED",  // or "UPDATED" if target already exists
  "data": {
    "id": 1,
    "manager_id": 3,
    "counsellor_id": 5,
    "target": 20,
    "achieved_target": 15,
    "rank": 0,
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "counsellorId, target, month, and year are required"
}
```

**Response (Error - 403):**
```json
{
  "success": false,
  "message": "You can only set targets for your own counsellors"
}
```

---

## 🎨 Frontend Implementation

### **React/TypeScript Example**

```typescript
import { useState } from 'react';

interface SetTargetFormData {
  counsellorId: number | null;
  month: number;
  year: number;
  target: number;
}

const SetTargetModal = () => {
  const [formData, setFormData] = useState<SetTargetFormData>({
    counsellorId: null,
    month: new Date().getMonth() + 1, // Current month (1-12)
    year: new Date().getFullYear(),    // Current year
    target: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.counsellorId) {
      setError('Please select a counsellor');
      return;
    }

    if (formData.target <= 0) {
      setError('Target must be greater than 0');
      return;
    }

    if (isSubmitting) return; // Prevent duplicate submissions

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/leaderboard/target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include auth token if needed
          // 'Authorization': `Bearer ${token}`
        },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({
          counsellorId: formData.counsellorId,
          target: formData.target,
          month: formData.month,
          year: formData.year,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to set target');
      }

      // Success - show success message and close modal
      console.log('Target set successfully:', data);
      alert(`Target ${data.action === 'CREATED' ? 'created' : 'updated'} successfully!`);

      // Close modal or refresh leaderboard data
      // onClose(); // If you have a close callback
      // refreshLeaderboard(); // Refresh the leaderboard data

    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error setting target:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2>Set Target</h2>
            <p>Set monthly enrollment target for a counsellor</p>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Counsellor Dropdown */}
          <div className="form-group">
            <label htmlFor="counsellor">Counsellor</label>
            <select
              id="counsellor"
              value={formData.counsellorId || ''}
              onChange={(e) => setFormData({
                ...formData,
                counsellorId: e.target.value ? parseInt(e.target.value) : null
              })}
              disabled={isSubmitting}
              required
            >
              <option value="">Select counsellor</option>
              {/* Populate from counsellors list */}
              {counsellors.map((counsellor) => (
                <option key={counsellor.id} value={counsellor.id}>
                  {counsellor.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Month Dropdown */}
          <div className="form-group">
            <label htmlFor="month">Month</label>
            <select
              id="month"
              value={`${formData.month}-${formData.year}`}
              onChange={(e) => {
                const [month, year] = e.target.value.split('-');
                setFormData({
                  ...formData,
                  month: parseInt(month),
                  year: parseInt(year),
                });
              }}
              disabled={isSubmitting}
              required
            >
              {/* Generate month/year options */}
              {generateMonthYearOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Input */}
          <div className="form-group">
            <label htmlFor="target">Target (Number of Clients)</label>
            <input
              type="number"
              id="target"
              min="1"
              value={formData.target || ''}
              onChange={(e) => setFormData({
                ...formData,
                target: parseInt(e.target.value) || 0
              })}
              placeholder="Enter target number"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.counsellorId || formData.target <= 0}
              className="btn-primary"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper function to generate month/year options
const generateMonthYearOptions = () => {
  const options = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Generate options for current year and next year
  for (let year = currentYear; year <= currentYear + 1; year++) {
    const startMonth = year === currentYear ? currentMonth : 1;
    const endMonth = year === currentYear ? 12 : 12;

    for (let month = startMonth; month <= endMonth; month++) {
      const date = new Date(year, month - 1, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      options.push({
        value: `${month}-${year}`,
        label: `${monthName} ${year}`,
      });
    }
  }

  return options;
};

export default SetTargetModal;
```

---

## 📝 Field Requirements

### **1. Counsellor Selection**
- **Type:** Dropdown/Select
- **Required:** Yes
- **Options:** List of all counsellors (for Admin) or only assigned counsellors (for Manager)
- **Value:** `counsellorId` (number)

**API to get counsellors:**
- Admin: `GET /api/users/counsellors`
- Manager: `GET /api/users/managers/:managerId/counsellors`

### **2. Month Selection**
- **Type:** Dropdown/Select
- **Required:** Yes
- **Format:** Month and Year (e.g., "January 2026")
- **Value:**
  - `month`: 1-12 (number)
  - `year`: 2000-3000 (number)

**Example Options:**
```typescript
[
  { value: "1-2026", label: "January 2026" },
  { value: "2-2026", label: "February 2026" },
  // ... etc
]
```

### **3. Target Input**
- **Type:** Number input
- **Required:** Yes
- **Min Value:** 1
- **Placeholder:** "Enter target number"
- **Value:** `target` (number) - Number of clients/enrollments

---

## 🔐 Permission Handling

### **Admin:**
- Can set targets for **any counsellor**
- No restrictions

### **Manager:**
- Can only set targets for **counsellors assigned to them**
- Backend will return 403 error if trying to set target for unassigned counsellor

**Frontend should:**
- Filter counsellor dropdown based on user role
- Show only relevant counsellors in the dropdown

```typescript
// Example: Filter counsellors based on role
const getAvailableCounsellors = async () => {
  if (userRole === 'admin') {
    // Get all counsellors
    const response = await fetch('/api/users/counsellors');
    return response.json();
  } else if (userRole === 'manager') {
    // Get only manager's counsellors
    const response = await fetch(`/api/users/managers/${userId}/counsellors`);
    return response.json();
  }
  return [];
};
```

---

## ✅ Validation Rules

### **Frontend Validation:**
1. ✅ Counsellor must be selected
2. ✅ Target must be a positive number (> 0)
3. ✅ Month must be between 1-12
4. ✅ Year must be between 2000-3000
5. ✅ Form should be disabled during submission

### **Backend Validation:**
- All frontend validations + additional checks
- Permission checks (Manager can only set for their counsellors)
- Counsellor existence check

---

## 🎯 Success Handling

After successful target creation/update:

1. **Show Success Message:**
   ```typescript
   alert(`Target ${data.action === 'CREATED' ? 'created' : 'updated'} successfully!`);
   // Or use a toast notification library
   ```

2. **Close Modal:**
   ```typescript
   onClose(); // Close the modal
   ```

3. **Refresh Leaderboard Data:**
   ```typescript
   // Refresh the leaderboard to show updated targets
   fetchLeaderboard(month, year);
   ```

---

## ❌ Error Handling

### **Common Errors:**

1. **400 - Missing Fields:**
   ```json
   { "success": false, "message": "counsellorId, target, month, and year are required" }
   ```

2. **400 - Invalid Target:**
   ```json
   { "success": false, "message": "Target must be a non-negative number" }
   ```

3. **403 - Permission Denied:**
   ```json
   { "success": false, "message": "You can only set targets for your own counsellors" }
   ```

4. **404 - Counsellor Not Found:**
   ```json
   { "success": false, "message": "Counsellor not found" }
   ```

**Error Display:**
```typescript
{error && (
  <div className="error-message" style={{ color: 'red', padding: '10px' }}>
    {error}
  </div>
)}
```

---

## 🔄 Update Existing Target

If a target already exists for the selected counsellor/month/year:
- The API will **update** the existing target (not create duplicate)
- Response will have `"action": "UPDATED"`
- `achieved_target` will be automatically recalculated

**No special handling needed** - the API handles this automatically!

---

## 📊 Complete Example with All Features

```typescript
import { useState, useEffect } from 'react';

interface Counsellor {
  id: number;
  fullName: string;
  email: string;
}

const SetTargetModal = ({ isOpen, onClose, onSuccess, month, year }) => {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState(month || new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(year || new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch counsellors on mount
  useEffect(() => {
    if (isOpen) {
      fetchCounsellors();
    }
  }, [isOpen]);

  const fetchCounsellors = async () => {
    try {
      setLoading(true);
      // Get user role from context/auth
      const userRole = getUserRole(); // Your auth function
      const userId = getUserId();

      let url = '';
      if (userRole === 'admin') {
        url = '/api/users/counsellors';
      } else if (userRole === 'manager') {
        url = `/api/users/managers/${userId}/counsellors`;
      } else {
        setError('You do not have permission to set targets');
        return;
      }

      const response = await fetch(url, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        setCounsellors(data.data.counsellors || data.data || []);
      }
    } catch (err) {
      setError('Failed to load counsellors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCounsellor) {
      setError('Please select a counsellor');
      return;
    }

    if (target <= 0) {
      setError('Target must be greater than 0');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/leaderboard/target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          counsellorId: selectedCounsellor,
          target: target,
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to set target');
      }

      // Success
      alert(`Target ${data.action === 'CREATED' ? 'created' : 'updated'} successfully!`);
      onSuccess?.(); // Callback to refresh leaderboard
      onClose(); // Close modal

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Set Target</h2>
            <p>Set monthly enrollment target for a counsellor</p>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message" style={{ color: 'red', padding: '10px', marginBottom: '10px' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="counsellor">Counsellor</label>
            <select
              id="counsellor"
              value={selectedCounsellor || ''}
              onChange={(e) => setSelectedCounsellor(e.target.value ? parseInt(e.target.value) : null)}
              disabled={isSubmitting || loading}
              required
            >
              <option value="">Select counsellor</option>
              {counsellors.map((counsellor) => (
                <option key={counsellor.id} value={counsellor.id}>
                  {counsellor.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="month">Month</label>
            <select
              id="month"
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split('-');
                setSelectedMonth(parseInt(m));
                setSelectedYear(parseInt(y));
              }}
              disabled={isSubmitting}
              required
            >
              {generateMonthYearOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="target">Target (Number of Clients)</label>
            <input
              type="number"
              id="target"
              min="1"
              value={target || ''}
              onChange={(e) => setTarget(parseInt(e.target.value) || 0)}
              placeholder="Enter target number"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedCounsellor || target <= 0 || loading}
              className="btn-primary"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper function
const generateMonthYearOptions = () => {
  const options = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  for (let year = currentYear; year <= currentYear + 1; year++) {
    const startMonth = year === currentYear ? currentMonth : 1;
    for (let month = startMonth; month <= 12; month++) {
      const date = new Date(year, month - 1, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      options.push({
        value: `${month}-${year}`,
        label: `${monthName} ${year}`,
      });
    }
  }
  return options;
};

export default SetTargetModal;
```

---

## 🎯 Summary

**API Endpoint:** `POST /api/leaderboard/target`

**Request Body:**
```json
{
  "counsellorId": 5,
  "target": 20,
  "month": 1,
  "year": 2026
}
```

**Key Points:**
- ✅ Admin can set targets for any counsellor
- ✅ Manager can only set targets for their own counsellors
- ✅ Target automatically updates if it already exists
- ✅ `achieved_target` is automatically calculated from enrollments
- ✅ Use duplicate request prevention (disable button during submission)
- ✅ Show proper error messages
- ✅ Refresh leaderboard after successful creation
