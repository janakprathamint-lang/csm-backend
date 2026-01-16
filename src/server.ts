import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app from "./index";
import { checkDbConnection } from "./config/databaseConnection";
import { initializeSocket } from "./config/socket";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server
initializeSocket(httpServer);

// Start server - listen on all network interfaces (0.0.0.0) to allow network access
httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server accessible on network at:`);

  // Get network IP addresses
  const os = require("os");
  const networkInterfaces = os.networkInterfaces();

  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    if (interfaces) {
      interfaces.forEach((iface: any) => {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(`   http://${iface.address}:${PORT}`);
        }
      });
    }
  });

  console.log(`   http://localhost:${PORT} (local)`);

  // Check database connection asynchronously
  checkDbConnection()
    .then(() => {
      console.log("✅ Database connected");
    })
    .catch((error) => {
      console.error("❌ Database connection failed");
      process.exit(1); // stop app if DB fails
    });
});
