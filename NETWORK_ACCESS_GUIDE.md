# How to Run Backend on Network

## ✅ Already Configured!

The backend is now configured to run on the network. When you start the server, it will automatically:
- Listen on all network interfaces (`0.0.0.0`)
- Show your network IP addresses in the console
- Allow CORS from network IPs in development mode

---

## 🚀 How to Start

### Step 1: Start the Backend Server

```bash
npm run dev
# or
npm start
```

### Step 2: Check Console Output

When the server starts, you'll see:

```
🚀 Server running on port 5000
🌐 Server accessible on network at:
   http://192.168.1.100:5000
   http://10.0.0.50:5000
   http://localhost:5000 (local)
```

**Copy one of the network IP addresses** (e.g., `http://192.168.1.100:5000`)

---

## 📱 Access from Other Devices

### On the Same Network:

1. **Find your computer's IP address** (shown in console)
2. **On another device** (phone, tablet, another computer):
   - Open browser
   - Go to: `http://YOUR_IP_ADDRESS:5000/health`
   - Example: `http://192.168.1.100:5000/health`
   - Should see: `{ "status": "ok" }`

### Frontend Configuration:

Update your frontend `.env` file:

```env
VITE_API_URL=http://192.168.1.100:5000
```

Replace `192.168.1.100` with your actual network IP address.

---

## 🔍 Find Your IP Address Manually

### Windows:
```bash
ipconfig
```
Look for "IPv4 Address" under your network adapter (usually `192.168.x.x` or `10.x.x.x`)

### Mac/Linux:
```bash
ifconfig
# or
ip addr show
```
Look for `inet` address (usually `192.168.x.x` or `10.x.x.x`)

---

## 🔧 Configuration Details

### Server Configuration (`src/server.ts`):
- Listens on `0.0.0.0` (all network interfaces)
- Automatically detects and displays network IPs

### CORS Configuration (`src/index.ts`):
- **Development mode**: Allows all local network IPs
- **Production mode**: Only allows explicit origins from `FRONTEND_URL` env variable

---

## 🧪 Test Network Access

### Test 1: Health Check
```bash
# From another device on same network:
curl http://YOUR_IP:5000/health
# Should return: {"status":"ok"}
```

### Test 2: API Endpoint
```bash
# From another device:
curl http://YOUR_IP:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Test 3: Frontend Connection
- Update frontend `.env` with network IP
- Restart frontend dev server
- Open frontend on another device
- Should connect to backend successfully

---

## ⚠️ Important Notes

1. **Firewall**: Make sure Windows Firewall allows port 5000
   - Windows: Go to Windows Defender Firewall → Allow an app → Node.js
   - Or allow port 5000 in firewall settings

2. **Same Network**: Devices must be on the same Wi-Fi/network

3. **Development Only**: Network access is enabled in development mode
   - For production, use proper domain and HTTPS

4. **Security**: This allows access from any device on your network
   - Only use in trusted networks (home/office)
   - Don't expose to public internet without proper security

---

## 🔥 Firewall Configuration (Windows)

### Allow Port 5000:

1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → **Next**
5. Select **TCP** → Enter port **5000** → **Next**
6. Select **Allow the connection** → **Next**
7. Check all profiles → **Next**
8. Name it "Node.js Backend" → **Finish**

### Or via Command Line (Run as Administrator):

```powershell
netsh advfirewall firewall add rule name="Node.js Backend" dir=in action=allow protocol=TCP localport=5000
```

---

## 📝 Quick Checklist

- [ ] Backend server is running
- [ ] Console shows network IP addresses
- [ ] Firewall allows port 5000
- [ ] Test health endpoint from another device
- [ ] Update frontend `.env` with network IP
- [ ] Test frontend connection from another device

---

## 🎯 Example Setup

**Backend Computer:**
- IP: `192.168.1.100`
- Port: `5000`
- URL: `http://192.168.1.100:5000`

**Frontend Device:**
- Update `.env`: `VITE_API_URL=http://192.168.1.100:5000`
- Access frontend: `http://192.168.1.100:5173` (or your frontend port)

**Mobile Device:**
- Open browser: `http://192.168.1.100:5173`
- Frontend connects to backend automatically

---

## 🆘 Troubleshooting

### Can't access from other devices:
1. Check firewall settings
2. Verify devices are on same network
3. Check IP address is correct
4. Try disabling firewall temporarily to test

### CORS errors:
- Backend already allows network IPs in development
- Check frontend is using correct backend URL
- Verify `NODE_ENV` is not set to "production"

### Connection refused:
- Check server is actually running
- Verify port 5000 is not blocked
- Check Windows Firewall settings

---

## ✅ Success Indicators

When everything is working:
- ✅ Backend console shows network IPs
- ✅ Health check works from another device
- ✅ Frontend connects successfully
- ✅ API calls work from network devices
- ✅ WebSocket connections work from network devices

---

**That's it! Your backend is now accessible on the network!** 🎉
