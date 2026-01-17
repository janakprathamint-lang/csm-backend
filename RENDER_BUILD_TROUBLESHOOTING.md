# Render Build Troubleshooting Guide

## 🔴 Common Errors and Solutions

### **Error 1: TypeScript Type Definitions Not Found**

**Symptoms:**
```
error TS7016: Could not find a declaration file for module 'express'
```

**Solution:**
Ensure devDependencies are installed during build. Update your Render Build Command to:

```bash
npm ci && npm run build
```

Or if that doesn't work:

```bash
npm install --include=dev && npm run build
```

---

### **Error 2: Build Command Not Running TypeScript**

**Symptoms:**
```
==> Running build command 'npm install'...
==> Build successful
==> Error: Cannot find module 'dist/server.js'
```

**Solution:**
Your Build Command MUST include `npm run build`:

```bash
npm install && npm run build
```

---

### **Error 3: Module Resolution Issues**

**Symptoms:**
```
Error: Cannot find module './index'
```

**Solution:**
Make sure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

---

## ✅ Correct Render Configuration

### **Build Command (Recommended - Ensures devDependencies):**
```bash
npm install --include=dev && npm run build
```

### **Alternative Build Commands (if above doesn't work):**
```bash
# Option 1: Standard
npm install && npm run build

# Option 2: Clean install (if you have package-lock.json)
npm ci && npm run build

# Option 3: Explicit production=false
NODE_ENV=development npm install && npm run build
```

### **Start Command:**
```bash
npm start
```

**Note:** The `--include=dev` flag ensures TypeScript and all `@types/*` packages are installed during the build phase on Render.

---

## 🔍 Verify Your Configuration

1. Go to Render Dashboard → Your Service → Settings → Build & Deploy
2. Check Build Command is: `npm install && npm run build`
3. Check Start Command is: `npm start`
4. Save and redeploy

---

## 📋 Expected Build Log

**Successful build should show:**
```
==> Running build command 'npm install && npm run build'...
added 122 packages...
> tsc
Build successful! Output in dist/ folder
==> Build successful 🎉
==> Running 'npm start'
> node dist/server.js
🚀 Server running on port 10000
```

---

## 🎯 If Still Failing

Share the **exact error message** from Render logs so we can diagnose the specific issue.

---

## 🔴 Additional Common Errors

### **Error 4: TypeScript Compilation Fails During Build**

**Symptoms:**
```
error TS7016: Could not find a declaration file for module 'express'
error TS2305: Module '"express"' has no exported member 'Request'
```

**Solution 1: Ensure devDependencies are installed**
```bash
npm install --include=dev && npm run build
```

**Solution 2: Use npm ci (clean install)**
```bash
npm ci && npm run build
```

**Solution 3: Check tsconfig.json**
Make sure `tsconfig.json` doesn't have `typeRoots` that restricts type resolution, or remove it entirely to use defaults.

---

### **Error 5: Server Starts But Crashes Immediately**

**Symptoms:**
```
🚀 Server running on port 10000
Error: DATABASE_URL missing
```

**Solution:**
Add environment variables in Render Dashboard → Environment:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `PORT` (optional, defaults to 5000)

---

### **Error 6: Module Not Found After Build**

**Symptoms:**
```
Error: Cannot find module './config/databaseConnection'
```

**Solution:**
Check that `tsconfig.json` has correct paths:
```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  }
}
```

---

## 📝 Complete Working Configuration

### **Render Build Command:**
```bash
npm install --include=dev && npm run build
```

### **Render Start Command:**
```bash
npm start
```

### **Required Environment Variables:**
- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET` (your secret key)
- `FRONTEND_URL` (your frontend URL)
- `PORT` (optional, Render sets this automatically)

---

## 🔍 Debugging Steps

1. **Check Build Logs:**
   - Look for TypeScript compilation errors
   - Verify `dist/` folder is created
   - Check if all packages are installed

2. **Check Runtime Logs:**
   - Look for missing environment variables
   - Check database connection errors
   - Verify module imports

3. **Test Locally First:**
   ```bash
   npm install
   npm run build
   npm start
   ```
   If it works locally but fails on Render, it's likely an environment or configuration issue.
