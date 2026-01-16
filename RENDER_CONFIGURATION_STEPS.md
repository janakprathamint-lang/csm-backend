# Render Configuration - Step by Step Guide

## 🔴 Current Problem
Render is running `node index.js` instead of `npm start`, and the build command is only running `npm install` (not building TypeScript).

## ✅ Solution: Configure Render Dashboard

### **Step 1: Go to Render Dashboard**
1. Open https://dashboard.render.com
2. Click on your service (crm-backend)

### **Step 2: Go to Settings**
1. Click **"Settings"** tab in the left sidebar

### **Step 3: Update Build & Start Commands**

#### **Build Command:**
```
npm install && npm run build
```

#### **Start Command:**
```
npm start
```

**⚠️ IMPORTANT:** Make sure you set BOTH commands correctly!

### **Step 4: Environment Variables**
Add these in **Environment** section:

| Key | Value | Required |
|-----|-------|----------|
| `NODE_ENV` | `production` | ✅ Yes |
| `PORT` | `10000` | ✅ Yes (Render default) |
| `DATABASE_URL` | `your_postgresql_connection_string` | ✅ Yes |
| `JWT_SECRET` | `your_secret_key` | ✅ Yes |
| `FRONTEND_URL` | `your_frontend_url` | ✅ Yes |

### **Step 5: Save and Redeploy**
1. Click **"Save Changes"**
2. Go to **"Manual Deploy"** → **"Deploy latest commit"**

---

## 📋 Quick Checklist

- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm start`
- [ ] Environment Variables added
- [ ] Changes saved
- [ ] Service redeployed

---

## 🔍 How to Verify Commands are Set

1. Go to **Settings** → **Build & Deploy**
2. Check **"Build Command"** field
3. Check **"Start Command"** field

If you see:
- ❌ Build Command: `npm install` → Change to `npm install && npm run build`
- ❌ Start Command: `node index.js` → Change to `npm start`

---

## 🎯 Expected Behavior After Fix

1. **Build Phase:**
   ```
   npm install && npm run build
   → Installs dependencies
   → Compiles TypeScript (src/ → dist/)
   → Creates dist/server.js
   ```

2. **Start Phase:**
   ```
   npm start
   → Runs: node dist/server.js
   → Server starts successfully
   ```

---

## 🐛 If Still Not Working

1. **Check Build Logs:**
   - Look for `> tsc` output
   - Should see TypeScript compilation

2. **Check Start Logs:**
   - Should see: `🚀 Server running on port 10000`
   - Should NOT see: `Cannot find module '/opt/render/project/src/index.js'`

3. **Verify dist/ folder exists:**
   - Build should create `dist/server.js`
   - If missing, build failed silently

---

## 📝 Alternative: Use render.yaml (If Supported)

If your Render plan supports `render.yaml`:
1. The file is already created in your repo
2. Push it to GitHub
3. Render should auto-detect and use it

**Note:** Free plans might not support render.yaml, so use Dashboard configuration instead.
