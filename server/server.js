import express from "express";
import "dotenv/config";
import http from "http";
import cors from "cors";
import path from "path";
import { Server } from "socket.io";

import { connectDB } from "./lib/db.js";
import User from "./models/User.js";
import Message from "./models/Message.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";

const app = express();
const server = http.createServer(app);

/* ---------------- SOCKET.IO SETUP ---------------- */
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* userId -> socketId */
export const userSocketMap = {};

/* ---------------- SOCKET EVENTS ---------------- */
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected:", userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
    io.emit("userOnline", { userId });

    // Mark pending sent messages as delivered for this connected receiver
    Message.updateMany(
      { receiverId: userId, status: "sent" },
      { status: "delivered" }
    ).then(() => {
      io.emit("messagesDelivered", { receiverId: userId });
    }).catch((err) => console.error("Error updating delivered status:", err.message));
  }

  // Send online users list
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  /* ----------- TYPING EVENTS ----------- */
  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId });
    }
  });

  /* ----------- READ RECEIPTS ----------- */
  socket.on("markRead", async ({ senderId, receiverId }) => {
    try {
      await Message.updateMany(
        { senderId, receiverId, status: { $ne: "read" } },
        { seen: true, status: "read" }
      );
      const senderSocketId = userSocketMap[senderId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesRead", { readerId: receiverId });
      }
    } catch (err) {
      console.error("Error in markRead:", err.message);
    }
  });

  /* ----------- DISCONNECT ----------- */
  socket.on("disconnect", async () => {
    console.log("User disconnected:", userId);
    if (userId) {
      delete userSocketMap[userId];
      const lastSeen = new Date();
      try {
        await User.findByIdAndUpdate(userId, { lastSeen });
      } catch (err) {
        console.error("Failed to update lastSeen:", err.message);
      }
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      io.emit("userOffline", { userId, lastSeen });
    }
  });
});

/* ---------------- MIDDLEWARES ---------------- */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ---------------- ROUTES ---------------- */
app.use("/api/status", (req, res) => res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

/* ---------------- DB ---------------- */
await connectDB();

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
