import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Join room for specific counsellor
    socket.on("join:counsellor", (counsellorId: number | string) => {
      // Validate counsellorId
      const id = typeof counsellorId === "string" ? parseInt(counsellorId, 10) : counsellorId;

      if (isNaN(id) || id <= 0) {
        console.error(`❌ Invalid counsellorId: ${counsellorId}`);
        socket.emit("error", { message: "Invalid counsellor ID" });
        return;
      }

      const room = `counsellor:${id}`;
      socket.join(room);
      console.log(`👤 Socket ${socket.id} joined room: ${room}`);
    });

    // Leave room
    socket.on("leave:counsellor", (counsellorId: number | string) => {
      // Validate counsellorId
      const id = typeof counsellorId === "string" ? parseInt(counsellorId, 10) : counsellorId;

      if (isNaN(id) || id <= 0) {
        console.error(`❌ Invalid counsellorId: ${counsellorId}`);
        return;
      }

      const room = `counsellor:${id}`;
      socket.leave(room);
      console.log(`👋 Socket ${socket.id} left room: ${room}`);
    });

    // Join admin room
    socket.on("join:admin", () => {
      socket.join("admin");
      console.log(`👑 Socket ${socket.id} joined admin room`);
    });

    // Leave admin room
    socket.on("leave:admin", () => {
      socket.leave("admin");
      console.log(`👋 Socket ${socket.id} left admin room`);
    });

    // Join dashboard room (for admin dashboard updates)
    socket.on("join:dashboard", () => {
      socket.join("admin:dashboard");
      console.log(`📊 Socket ${socket.id} joined dashboard room`);
    });

    // Leave dashboard room
    socket.on("leave:dashboard", () => {
      socket.leave("admin:dashboard");
      console.log(`👋 Socket ${socket.id} left dashboard room`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  console.log("🔌 WebSocket server initialized");
  return io;
};

/**
 * Get WebSocket server instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket first.");
  }
  return io;
};

/**
 * Emit event to specific counsellor room
 */
export const emitToCounsellor = (counsellorId: number, event: string, data: any) => {
  const io = getIO();
  const room = `counsellor:${counsellorId}`;
  io.to(room).emit(event, data);
  console.log(`📤 Emitted '${event}' to room: ${room}`);
};

/**
 * Emit event to admin room
 */
export const emitToAdmin = (event: string, data: any) => {
  const io = getIO();
  io.to("admin").emit(event, data);
  console.log(`📤 Emitted '${event}' to admin room`);
};

/**
 * Emit event to all connected clients
 */
export const emitToAll = (event: string, data: any) => {
  const io = getIO();
  io.emit(event, data);
  console.log(`📤 Emitted '${event}' to all clients`);
};

/**
 * Emit dashboard update to admin dashboard room
 */
export const emitDashboardUpdate = (event: string, data: any) => {
  const io = getIO();
  io.to("admin:dashboard").emit(event, data);
  console.log(`📊 Emitted '${event}' to dashboard room`);
};
