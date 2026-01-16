# Create .env File - Quick Guide

## 🔴 Problem
Your `.env` file is missing, which causes:
```
Error: DATABASE_URL missing
```

## ✅ Solution

### Step 1: Create `.env` File

Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```

Or create manually:
```powershell
New-Item .env
```

### Step 2: Fill in Your Values

Open `.env` file and update these values:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# JWT Secrets (Generate strong random strings)
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### Step 3: Update Required Values

**1. DATABASE_URL:**
- Replace with your actual PostgreSQL connection string
- Format: `postgresql://user:password@host:port/database`

**2. JWT_SECRET:**
- Generate a random string (at least 32 characters)
- Example: `openssl rand -hex 32`

**3. JWT_REFRESH_SECRET:**
- Generate a different random string (at least 32 characters)
- Example: `openssl rand -hex 32`

**4. FRONTEND_URL:**
- Your frontend URL (default: `http://localhost:5173`)

### Step 4: Verify File Location

Make sure `.env` is in project root:
```
crm-backend/
  ├── .env          ✅ Must be here
  ├── package.json
  ├── src/
  └── dist/
```

### Step 5: Run Server

From project root:
```powershell
npm start
```

---

## 🔐 Generate JWT Secrets (PowerShell)

```powershell
# Generate JWT_SECRET
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Or use online generator: https://randomkeygen.com/
```

---

## ✅ After Creating .env

The error will be fixed and server will start successfully!
