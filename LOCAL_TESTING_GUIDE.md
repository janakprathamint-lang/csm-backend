# Local Testing Guide - How to Run the Server

## 🔴 The Error You're Seeing

```
Error: DATABASE_URL missing
==> Running 'node index.js'
```

## 🔍 Why This Happens

### **Problem:**
You're running `node index.js` from the `dist/` folder, but:

1. **`index.js` is NOT the entry point**
   - It's just the Express app configuration
   - It doesn't load environment variables (`.env` file)
   - It doesn't start the server

2. **`server.js` is the actual entry point**
   - It loads `.env` file with `dotenv.config()`
   - It creates the HTTP server
   - It starts listening on the port

### **File Structure:**
```
dist/
  ├── index.js      ❌ NOT the entry point (just Express app config)
  └── server.js     ✅ ACTUAL entry point (starts the server)
```

---

## ✅ Correct Way to Run

### **Option 1: Use npm start (Recommended)**
```powershell
# From project root (d:\crm-fullstack\crm-backend)
npm start
```

This runs: `node dist/server.js`

### **Option 2: Run server.js directly**
```powershell
# From project root
node dist/server.js
```

### **Option 3: Run from dist folder**
```powershell
# From dist folder
cd dist
node server.js
```

---

## ❌ Wrong Way (What You Did)

```powershell
cd dist
node index.js  # ❌ WRONG - This doesn't start the server!
```

**Why it fails:**
- `index.js` doesn't load `.env` file
- `index.js` doesn't start the server
- Environment variables are undefined
- Database connection fails

---

## 📋 Complete Testing Steps

### **1. Build the Project**
```powershell
npm run build
```

### **2. Make sure .env file exists**
```powershell
# Check if .env exists in project root
Test-Path .env
```

Your `.env` should have:
```
DATABASE_URL=your_database_url
JWT_SECRET=your_secret
FRONTEND_URL=http://localhost:5173
PORT=5000
```

### **3. Start the Server**
```powershell
npm start
```

**Expected Output:**
```
[dotenv] injecting env...
🚀 Server running on port 5000
✅ Database connected
```

---

## 🎯 Summary

| Command | Result |
|---------|--------|
| `node dist/index.js` | ❌ Fails - No env vars, doesn't start server |
| `node dist/server.js` | ✅ Works - Loads env, starts server |
| `npm start` | ✅ Works - Runs `node dist/server.js` |

**Always use `npm start` or `node dist/server.js`!**
