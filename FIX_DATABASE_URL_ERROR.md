# Fix: DATABASE_URL Missing Error

## 🔴 The Error
```
Error: DATABASE_URL missing
at databaseConnection.js:9
```

## 🔍 Why This Happens

### **The Problem:**
1. `databaseConnection.js` checks for `DATABASE_URL` **immediately** when imported
2. If `.env` file hasn't been loaded yet, `DATABASE_URL` is `undefined`
3. The check throws an error before the server can start

### **When It Happens:**
- Running `node index.js` (doesn't load .env)
- Running from `dist/` folder (can't find .env in parent directory)
- `.env` file missing or in wrong location

---

## ✅ Solutions

### **Solution 1: Always Use npm start (Recommended)**

From project root:
```powershell
npm start
```

This:
1. Runs `node dist/server.js`
2. `server.js` loads `.env` FIRST (line 6-7)
3. Then imports everything else
4. ✅ Works correctly!

### **Solution 2: Run from Project Root**

If running directly:
```powershell
# From project root (NOT from dist folder)
node dist/server.js
```

**Why:** `.env` file is in project root, and `dotenv.config()` looks for it in current directory.

### **Solution 3: Check .env File Location**

Make sure `.env` file is in project root:
```
crm-backend/
  ├── .env              ✅ Must be here
  ├── package.json
  ├── src/
  └── dist/
```

---

## 🎯 Correct Execution Order

### **✅ Correct (server.js):**
```
1. dotenv.config()      → Loads .env file
2. import databaseConnection → DATABASE_URL is available ✅
3. Start server
```

### **❌ Wrong (index.js or direct import):**
```
1. import databaseConnection → Checks DATABASE_URL
2. DATABASE_URL is undefined ❌
3. Error thrown
4. dotenv.config() never runs
```

---

## 📋 Quick Fix

**Always run from project root:**
```powershell
# Make sure you're in: d:\crm-fullstack\crm-backend
npm start
```

**Never run:**
```powershell
cd dist
node index.js  # ❌ Wrong!
node server.js  # ❌ Might work but not recommended
```

---

## 🔧 If .env File is Missing

Create `.env` file in project root:
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

---

## ✅ Summary

| Command | Location | Result |
|---------|----------|--------|
| `npm start` | Project root | ✅ Works |
| `node dist/server.js` | Project root | ✅ Works |
| `node index.js` | dist/ folder | ❌ Fails |
| `node server.js` | dist/ folder | ⚠️ Might fail (env path) |

**Best Practice: Always use `npm start` from project root!**
