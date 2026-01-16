# Frontend Changes Required

## Summary of Issues

The frontend is sending incorrect field names and values. Here's what needs to be fixed:

---

## 1. BEACON_ACCOUNT - Field Name Mismatch

### ❌ Current (Wrong):
```json
{
  "clientId": 176,
  "productName": "BEACON_ACCOUNT",
  "amount": "59000",
  "entityData": {
    "openingDate": "2026-01-07T18:30:00.000Z",
    "fundingDate": "2026-01-07T18:30:00.000Z",
    "cadAmount": 59000,  // ❌ WRONG FIELD NAME
    "remarks": ""
  }
}
```

### ✅ Correct:
```json
{
  "clientId": 176,
  "productName": "BEACON_ACCOUNT",
  "amount": "59000",
  "entityData": {
    "openingDate": "2026-01-07T18:30:00.000Z",
    "fundingDate": "2026-01-07T18:30:00.000Z",
    "fundingAmount": 59000,  // ✅ CORRECT FIELD NAME
    "remarks": ""
  }
}
```

**OR** you can use:
```json
{
  "entityData": {
    "amount": 59000,  // ✅ Also accepted
    "openingDate": "...",
    "fundingDate": "..."
  }
}
```

**Change Required:**
- Replace `cadAmount` → `fundingAmount` (or `amount`)

---

## 2. FOREX_FEES - Empty String for Required Field

### ❌ Current (Wrong):
```json
{
  "clientId": 176,
  "productName": "FOREX_FEES",
  "amount": "59000",
  "entityData": {
    "side": "",  // ❌ EMPTY STRING - NOT ALLOWED
    "amount": 59000,
    "date": "",
    "remarks": ""
  }
}
```

### ✅ Correct:
```json
{
  "clientId": 176,
  "productName": "FOREX_FEES",
  "amount": "59000",
  "entityData": {
    "side": "PI",  // ✅ MUST BE "PI" OR "TP" (not empty)
    "amount": 59000,
    "feeDate": "2026-01-08",  // ✅ Use "feeDate" not "date"
    "remarks": ""
  }
}
```

**Change Required:**
- `side` must be `"PI"` or `"TP"` (cannot be empty string)
- Replace `date` → `feeDate` (optional, but better to use correct field name)

---

## 3. TUTION_FEES - Wrong Field Name + Wrong Case

### ❌ Current (Wrong):
```json
{
  "clientId": 176,
  "productName": "TUTION_FEES",
  "amount": "0",
  "entityData": {
    "status": "Paid",  // ❌ WRONG FIELD NAME + WRONG CASE
    "date": "2026-01-07T18:30:00.000Z",
    "remarks": "AAAAAAA"
  }
}
```

### ✅ Correct:
```json
{
  "clientId": 176,
  "productName": "TUTION_FEES",
  "amount": "0",
  "entityData": {
    "tutionFeesStatus": "paid",  // ✅ CORRECT FIELD NAME + LOWERCASE
    "feeDate": "2026-01-07T18:30:00.000Z",  // ✅ Use "feeDate" not "date"
    "remarks": "AAAAAAA"
  }
}
```

**Change Required:**
- Replace `status` → `tutionFeesStatus`
- Value must be lowercase: `"paid"` or `"pending"` (not "Paid" or "PAID")
- Replace `date` → `feeDate` (optional, but better to use correct field name)

---

## Complete Field Mapping Reference

### BEACON_ACCOUNT
```typescript
entityData: {
  amount?: number | string;           // ✅ Accepted
  fundingAmount?: number | string;     // ✅ Accepted (preferred)
  accountDate?: string;                // Optional
  fundingDate?: string;                // Optional
  openingDate?: string;                 // Optional
  remarks?: string;                     // Optional
}
```

### FOREX_FEES
```typescript
entityData: {
  side: "PI" | "TP";                   // ✅ REQUIRED - must be "PI" or "TP"
  amount: number | string;              // ✅ REQUIRED
  feeDate?: string;                     // Optional (not "date")
  remarks?: string;                     // Optional
}
```

### TUTION_FEES
```typescript
entityData: {
  tutionFeesStatus: "paid" | "pending"; // ✅ REQUIRED - lowercase only
  feeDate?: string;                     // Optional (not "date")
  remarks?: string;                     // Optional
}
```

---

## Quick Fix Checklist

### For BEACON_ACCOUNT Form:
- [ ] Change `cadAmount` → `fundingAmount` (or `amount`)
- [ ] Keep `openingDate` and `fundingDate` as is

### For FOREX_FEES Form:
- [ ] Ensure `side` field has default value or validation
- [ ] `side` must be `"PI"` or `"TP"` (not empty, not null)
- [ ] Change `date` → `feeDate` (optional but recommended)

### For TUTION_FEES Form:
- [ ] Change field name `status` → `tutionFeesStatus`
- [ ] Ensure value is lowercase: `"paid"` or `"pending"`
- [ ] Add case conversion: `"Paid"` → `"paid"`, `"Pending"` → `"pending"`
- [ ] Change `date` → `feeDate` (optional but recommended)

---

## Example Frontend Code Fixes

### BEACON_ACCOUNT Fix:
```typescript
// Before
const entityData = {
  cadAmount: formData.amount,  // ❌ Wrong
  openingDate: formData.openingDate,
  fundingDate: formData.fundingDate
};

// After
const entityData = {
  fundingAmount: formData.amount,  // ✅ Correct
  openingDate: formData.openingDate,
  fundingDate: formData.fundingDate
};
```

### FOREX_FEES Fix:
```typescript
// Before
const entityData = {
  side: formData.side || "",  // ❌ Empty string not allowed
  amount: formData.amount,
  date: formData.date
};

// After
const entityData = {
  side: formData.side || "PI",  // ✅ Default to "PI" if empty
  amount: formData.amount,
  feeDate: formData.date  // ✅ Use correct field name
};
```

### TUTION_FEES Fix:
```typescript
// Before
const entityData = {
  status: formData.status,  // ❌ Wrong field name
  date: formData.date
};

// After
const entityData = {
  tutionFeesStatus: formData.status?.toLowerCase() || "pending",  // ✅ Correct field + lowercase
  feeDate: formData.date  // ✅ Use correct field name
};
```

---

## All Product Types Field Reference

| Product | Required Fields | Optional Fields |
|---------|----------------|-----------------|
| **BEACON_ACCOUNT** | `amount` OR `fundingAmount` | `accountDate`, `fundingDate`, `openingDate`, `remarks` |
| **FOREX_FEES** | `side` ("PI" or "TP"), `amount` | `feeDate`, `remarks` |
| **TUTION_FEES** | `tutionFeesStatus` ("paid" or "pending") | `feeDate`, `remarks` |
| **AIR_TICKET** | - | `isTicketBooked`, `amount`, `airTicket`, `ticketDate`, `remarks` |
| **INSURANCE** | `amount` | `insuranceDate`, `remarks` |
| **IELTS_ENROLLMENT** | `amount` | `enrolledStatus`, `enrollmentDate`, `remarks` |
| **LOAN_DETAILS** | `amount` | `disbursmentDate`, `remarks` |
| **SIM_CARD_ACTIVATION** | - | `activatedStatus`, `simcardPlan`, `simCardGivingDate`, `simActivationDate`, `remarks` |
| **CREDIT_CARD** | `amount` | `cardDate`, `remarks` |
| **VISA_EXTENSION** | `type`, `amount` | `extensionDate`, `invoiceNo`, `remarks` |
| **OTHER_NEW_SELL** | `serviceName`, `amount` | `serviceInformation`, `sellDate`, `remarks` |

---

## Summary

**3 Main Changes Needed:**

1. **BEACON_ACCOUNT**: `cadAmount` → `fundingAmount`
2. **FOREX_FEES**: `side` cannot be empty (must be "PI" or "TP")
3. **TUTION_FEES**: `status` → `tutionFeesStatus` + lowercase values

Make these changes and the errors will be resolved!
