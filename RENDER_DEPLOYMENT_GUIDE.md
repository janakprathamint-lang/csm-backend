# Render Deployment Guide

## 🚀 Deployment Configuration

### **Problem:**
Render was trying to run `node index.js` directly, but the project needs to:
1. Build TypeScript first (`npm run build`)
2. Run the compiled JavaScript (`npm start` → `node dist/server.js`)

### **Solution:**
Configure Render to use the correct build and start commands.

---

## 📋 Render Configuration Steps

### **Option 1: Using Render Dashboard (Recommended)**

1. **Go to your Render Dashboard** → Your Service → Settings

2. **Set Build Command:**
   ```
   npm install && npm run build
   ```

3. **Set Start Command:**
   ```
   npm start
   ```

4. **Environment Variables:**
   Add these in Render Dashboard → Environment:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=your_postgresql_connection_string
   JWT_SECRET=your_jwt_secret_key
   FRONTEND_URL=your_frontend_url
   ```

---

### **Option 2: Using render.yaml (If supported)**

The `render.yaml` file has been created in the project root. If your Render plan supports it, this will automatically configure the deployment.

---

## 🔧 Required Environment Variables

Add these in Render Dashboard → Environment:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `10000` (Render default) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key-here` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://your-frontend.com` |

---

## 📝 Build Process

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build TypeScript:**
   ```bash
   npm run build
   ```
   This compiles `src/` → `dist/`

3. **Start Server:**
   ```bash
   npm start
   ```
   This runs `node dist/server.js`

---

## ✅ Verification

After deployment, check:

1. **Health Check:**
   ```
   GET https://your-app.onrender.com/health
   ```

2. **API Endpoint:**
   ```
   GET https://your-app.onrender.com/api/users/health
   ```

---

## 🐛 Common Issues

### **Issue 1: "Cannot find module"**
- **Cause:** Build command not running
- **Fix:** Ensure `Build Command` is set to `npm install && npm run build`

### **Issue 2: "Port already in use"**
- **Cause:** Wrong PORT environment variable
- **Fix:** Set `PORT=10000` in Render environment variables

### **Issue 3: "Database connection failed"**
- **Cause:** Missing or incorrect `DATABASE_URL`
- **Fix:** Add correct PostgreSQL connection string in Render environment variables

### **Issue 4: "CORS error"**
- **Cause:** Missing or incorrect `FRONTEND_URL`
- **Fix:** Set `FRONTEND_URL` to your frontend URL in Render environment variables

---

## 📦 Files Updated

1. **package.json:**
   - Changed `"main"` from `"index.js"` to `"dist/server.js"`

2. **render.yaml:**
   - Created deployment configuration file

---

## 🎯 Summary

**Build Command:** `npm install && npm run build`
**Start Command:** `npm start`

The server will run on the port specified by Render (usually 10000), accessible via the `PORT` environment variable.
