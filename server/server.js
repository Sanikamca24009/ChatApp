import express from "express";
import "dotenv/config";
import http from "http";
import cors from "cors";
import path from "path";
import { Server } from "socket.io";

import { connectDB } from "./lib/db.js";
import User from "./models/User.js";
import Message from "./models/Message.js";
import Call from "./models/Call.js";
import Group from "./models/Group.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import groupRouter from "./routes/groupRoutes.js";

const app = express();
const server = http.createServer(app);

/* ---------------- SOCKET.IO SETUP ---------------- */
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean);

const corsOriginCheck = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin) || origin.includes("vercel.app") || origin.includes("localhost")) {
    return callback(null, true);
  }
  return callback(null, true);
};

// Wrap in try-catch so Socket.IO failures don't crash the whole app on Vercel
let _io = null;
try {
  _io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    allowEIO3: true,
  });
} catch (err) {
  console.error("Socket.IO init failed (OK in serverless):", err.message);
}
export const io = _io;

/* userId -> socketId */
export const userSocketMap = {};

/* socketId -> { callerId, receiverId, partnerSocketId, callType } */
const activeCalls = new Map();

/* groupId -> { groupId, groupName, callerId, callType, participants: Map(socketId -> { userId, userInfo, socketId }) } */
const activeGroupCalls = new Map();

const formatCallDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const logCallRecord = async ({
  callerId,
  receiverId = null,
  groupId = null,
  isGroup = false,
  duration = 0,
  status = "missed",
  callType = "voice",
}) => {
  try {
    if (!callerId) return;

    // Persist Call record
    await Call.create({
      caller: callerId,
      receiver: receiverId || undefined,
      groupId: groupId || undefined,
      isGroup,
      duration,
      status,
      callType,
    });

    // Create inline chat system message
    const isVideo = callType === "video";
    const icon = isVideo ? "🎥" : "📞";
    const prefix = isGroup ? "Group " : "";
    const callText =
      status === "answered"
        ? `${icon} ${prefix}${isVideo ? "Video" : "Voice"} call · ${formatCallDuration(duration)}`
        : status === "declined" || status === "rejected"
        ? `${icon} ${prefix}${isVideo ? "Video" : "Voice"} call declined`
        : `${icon} Missed ${prefix}${isVideo ? "video " : ""}call`;

    const newMessage = await Message.create({
      senderId: callerId,
      receiverId: receiverId || undefined,
      groupId: groupId || undefined,
      text: callText,
      messageType: "call",
      callDetails: {
        duration,
        status,
        callType,
      },
      status: "delivered",
    });

    if (isGroup && groupId) {
      const group = await Group.findById(groupId);
      if (group) {
        group.members.forEach((memberId) => {
          const mStr = memberId.toString();
          const sId = userSocketMap[mStr];
          if (sId) {
            io.to(sId).emit("newMessage", newMessage);
          }
        });
      }
    } else {
      const callerSocketId = userSocketMap[callerId?.toString()];
      const receiverSocketId = userSocketMap[receiverId?.toString()];

      if (callerSocketId) {
        io.to(callerSocketId).emit("newMessage", newMessage);
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }
  } catch (err) {
    console.error("Error logging call record:", err.message);
  }
};

/* ---------------- SOCKET EVENTS ---------------- */
if (io) {
  io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected:", userId);

  if (userId) {
    socket.join(userId.toString());
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
  socket.on("typing", async ({ senderId, receiverId, groupId }) => {
    try {
      if (groupId) {
        const group = await Group.findById(groupId);
        if (group?.members) {
          group.members.forEach((mId) => {
            const mIdStr = mId.toString();
            if (mIdStr !== senderId?.toString()) {
              io.to(mIdStr).emit("typing", { senderId, groupId });
            }
          });
        }
      } else if (receiverId) {
        const rIdStr = receiverId.toString();
        io.to(rIdStr).emit("typing", { senderId });
        const receiverSocketId = userSocketMap[rIdStr];
        if (receiverSocketId && receiverSocketId !== socket.id) {
          io.to(receiverSocketId).emit("typing", { senderId });
        }
      }
    } catch (err) {
      console.error("Error in typing event:", err.message);
    }
  });

  socket.on("stopTyping", async ({ senderId, receiverId, groupId }) => {
    try {
      if (groupId) {
        const group = await Group.findById(groupId);
        if (group?.members) {
          group.members.forEach((mId) => {
            const mIdStr = mId.toString();
            if (mIdStr !== senderId?.toString()) {
              io.to(mIdStr).emit("stopTyping", { senderId, groupId });
            }
          });
        }
      } else if (receiverId) {
        const rIdStr = receiverId.toString();
        io.to(rIdStr).emit("stopTyping", { senderId });
        const receiverSocketId = userSocketMap[rIdStr];
        if (receiverSocketId && receiverSocketId !== socket.id) {
          io.to(receiverSocketId).emit("stopTyping", { senderId });
        }
      }
    } catch (err) {
      console.error("Error in stopTyping event:", err.message);
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

  /* ----------- WEBRTC VOICE & VIDEO CALL EVENTS ----------- */
  socket.on("call:offer", ({ callerId, receiverId, callerInfo, callType = "voice", offer }) => {
    const receiverSocketId = userSocketMap[receiverId?.toString()];
    if (!receiverSocketId) {
      socket.emit("call:failed", { reason: "User is offline" });
      logCallRecord({ callerId, receiverId, duration: 0, status: "missed", callType });
      return;
    }
    activeCalls.set(socket.id, { callerId, receiverId, partnerSocketId: receiverSocketId, callType });
    io.to(receiverSocketId).emit("call:incoming", {
      callerId,
      receiverId,
      callerInfo,
      callType,
      offer,
    });
  });

  socket.on("call:answer", ({ callerId, receiverId, answer }) => {
    const callerSocketId = userSocketMap[callerId?.toString()];
    if (callerSocketId) {
      const existing = activeCalls.get(socket.id);
      activeCalls.set(socket.id, { callerId, receiverId, partnerSocketId: callerSocketId, callType: existing?.callType || "voice" });
      io.to(callerSocketId).emit("call:answered", {
        callerId,
        receiverId,
        answer,
      });
    }
  });

  socket.on("call:ice-candidate", ({ targetUserId, candidate }) => {
    const targetSocketId = userSocketMap[targetUserId?.toString()];
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:ice-candidate", { candidate });
    }
  });

  socket.on("call:reject", async ({ callerId, receiverId, reason = "declined", callType = "voice" }) => {
    activeCalls.delete(socket.id);
    const callerSocketId = userSocketMap[callerId?.toString()];
    if (callerSocketId) {
      io.to(callerSocketId).emit("call:rejected", { reason });
    }
    await logCallRecord({
      callerId,
      receiverId,
      duration: 0,
      status: reason === "busy" ? "declined" : "rejected",
      callType,
    });
  });

  socket.on("call:timeout", async ({ callerId, receiverId, callType = "voice" }) => {
    activeCalls.delete(socket.id);
    const receiverSocketId = userSocketMap[receiverId?.toString()];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:timeout");
    }
    await logCallRecord({ callerId, receiverId, duration: 0, status: "missed", callType });
  });

  socket.on("call:end", async ({ callerId, receiverId, duration = 0, status = "answered", callType = "voice" }) => {
    activeCalls.delete(socket.id);
    const otherUserId = String(userId) === String(callerId) ? receiverId : callerId;
    const otherSocketId = userSocketMap[otherUserId?.toString()];
    if (otherSocketId) {
      io.to(otherSocketId).emit("call:ended", { duration, status, callType });
    }
    await logCallRecord({ callerId, receiverId, duration, status, callType });
  });

  socket.on("call:camera-toggle", ({ targetUserId, fromUserId, isCameraOff }) => {
    const targetSocketId = userSocketMap[targetUserId?.toString()];
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:camera-toggle", {
        fromUserId,
        isCameraOff,
      });
    }
  });

  socket.on("call:group-camera-toggle", ({ groupId, userId, isCameraOff }) => {
    const groupCall = activeGroupCalls.get(groupId?.toString());
    if (groupCall) {
      groupCall.participants.forEach((p) => {
        if (p.socketId !== socket.id) {
          io.to(p.socketId).emit("call:group-camera-toggle", {
            userId,
            isCameraOff,
          });
        }
      });
    }
  });

  /* ----------- WEBRTC GROUP CALL EVENTS ----------- */
  socket.on("call:group-offer", async ({ groupId, groupName, callerInfo, callType = "voice" }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group) return;

      const participants = new Map();
      participants.set(socket.id, {
        userId: callerInfo._id.toString(),
        userInfo: callerInfo,
        socketId: socket.id,
      });

      activeGroupCalls.set(groupId.toString(), {
        groupId: groupId.toString(),
        groupName: groupName || group.name,
        callerId: callerInfo._id,
        callType,
        startTime: Date.now(),
        participants,
      });

      // Notify all online group members except caller
      group.members.forEach((memberId) => {
        const mStr = memberId.toString();
        if (mStr !== callerInfo._id.toString()) {
          const sId = userSocketMap[mStr];
          if (sId) {
            io.to(sId).emit("call:group-incoming", {
              groupId: groupId.toString(),
              groupName: groupName || group.name,
              callerInfo,
              callType,
            });
          }
        }
      });

      // Auto-cut group call if nobody joins within 30 seconds
      setTimeout(async () => {
        const currentCall = activeGroupCalls.get(groupId.toString());
        if (currentCall && currentCall.participants.size <= 1) {
          currentCall.participants.forEach((p) => {
            io.to(p.socketId).emit("call:group-ended", {
              duration: 0,
              status: "missed",
              callType: currentCall.callType,
              reason: "No one joined the call",
            });
          });
          group.members.forEach((memberId) => {
            const mStr = memberId.toString();
            const sId = userSocketMap[mStr];
            if (sId) {
              io.to(sId).emit("call:group-ended", {
                duration: 0,
                status: "missed",
                callType: currentCall.callType,
                reason: "Call timed out",
              });
            }
          });
          activeGroupCalls.delete(groupId.toString());
          await logCallRecord({
            callerId: currentCall.callerId,
            groupId: currentCall.groupId,
            isGroup: true,
            duration: 0,
            status: "missed",
            callType: currentCall.callType,
          });
        }
      }, 30000);
    } catch (err) {
      console.error("Error in call:group-offer:", err.message);
    }
  });

  socket.on("call:group-join", ({ groupId, userId, userInfo }) => {
    const groupCall = activeGroupCalls.get(groupId?.toString());
    if (!groupCall) {
      socket.emit("call:group-ended", { reason: "Call already ended" });
      return;
    }

    // Existing participants to send to the joiner
    const existingList = Array.from(groupCall.participants.values()).filter(
      (p) => p.socketId !== socket.id
    );
    socket.emit("call:group-existing-users", {
      users: existingList,
      callType: groupCall.callType,
    });

    // Inform all existing participants about the new joiner
    existingList.forEach((participant) => {
      io.to(participant.socketId).emit("call:group-user-joined", {
        userId: userId.toString(),
        userInfo,
        socketId: socket.id,
      });
    });

    // Add new participant to active group call
    groupCall.participants.set(socket.id, {
      userId: userId.toString(),
      userInfo,
      socketId: socket.id,
    });
  });

  socket.on("call:group-signal", ({ targetSocketId, signal, fromUserId, fromUserInfo }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:group-signal", {
        fromSocketId: socket.id,
        fromUserId,
        fromUserInfo,
        signal,
      });
    }
  });

  socket.on("call:group-leave", async ({ groupId, userId, duration = 0 }) => {
    const groupCall = activeGroupCalls.get(groupId?.toString());
    if (groupCall) {
      groupCall.participants.delete(socket.id);
      groupCall.participants.forEach((p) => {
        io.to(p.socketId).emit("call:group-user-left", {
          userId,
          socketId: socket.id,
        });
      });

      if (groupCall.participants.size <= 1) {
        groupCall.participants.forEach((p) => {
          io.to(p.socketId).emit("call:group-ended", {
            duration,
            status: "answered",
            callType: groupCall.callType,
            reason: "All other participants left the call",
          });
        });
        activeGroupCalls.delete(groupId.toString());
        await logCallRecord({
          callerId: groupCall.callerId,
          groupId: groupCall.groupId,
          isGroup: true,
          duration,
          status: "answered",
          callType: groupCall.callType,
        });
      }
    }
  });

  socket.on("call:group-end", async ({ groupId, callerId, duration = 0, status = "answered", callType = "voice" }) => {
    const groupCall = activeGroupCalls.get(groupId?.toString());
    if (groupCall) {
      groupCall.participants.forEach((p) => {
        if (p.socketId !== socket.id) {
          io.to(p.socketId).emit("call:group-ended", { duration, status, callType });
        }
      });
      activeGroupCalls.delete(groupId.toString());
    }

    try {
      const group = await Group.findById(groupId);
      if (group) {
        group.members.forEach((memberId) => {
          const sId = userSocketMap[memberId.toString()];
          if (sId && sId !== socket.id) {
            io.to(sId).emit("call:group-ended", { duration, status, callType });
          }
        });
      }
    } catch (e) {
      console.error("Error notifying group members on end:", e);
    }

    await logCallRecord({
      callerId,
      groupId,
      isGroup: true,
      duration,
      status,
      callType,
    });
  });

  /* ----------- DISCONNECT ----------- */
  socket.on("disconnect", async () => {
    console.log("User disconnected:", userId);

    if (activeCalls.has(socket.id)) {
      const activeCall = activeCalls.get(socket.id);
      activeCalls.delete(socket.id);
      if (activeCall?.partnerSocketId) {
        io.to(activeCall.partnerSocketId).emit("call:ended", {
          duration: 0,
          status: "declined",
          reason: "User disconnected",
        });
      }
    }

    // Clean up any group call participant
    activeGroupCalls.forEach(async (groupCall, gId) => {
      if (groupCall.participants.has(socket.id)) {
        groupCall.participants.delete(socket.id);
        groupCall.participants.forEach((p) => {
          io.to(p.socketId).emit("call:group-user-left", {
            userId,
            socketId: socket.id,
          });
        });

        if (groupCall.participants.size <= 1) {
          const duration = Math.floor((Date.now() - groupCall.startTime) / 1000);
          groupCall.participants.forEach((p) => {
            io.to(p.socketId).emit("call:group-ended", {
              duration,
              status: "answered",
              callType: groupCall.callType,
              reason: "All other participants disconnected",
            });
          });
          activeGroupCalls.delete(gId);
          await logCallRecord({
            callerId: groupCall.callerId,
            groupId: groupCall.groupId,
            isGroup: true,
            duration,
            status: "answered",
            callType: groupCall.callType,
          });
        }
      }
    });

    if (userId) {
      const activeSockets = await io.in(userId.toString()).allSockets();
      if (activeSockets.size === 0) {
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
    }
  });
});
}

/* ---------------- MIDDLEWARES ---------------- */
app.use(cors({
  origin: corsOriginCheck,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ---------------- DB MIDDLEWARE ---------------- */
// Connect to DB on first request (serverless-safe, cached connection)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err.message);
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

/* ---------------- ROUTES ---------------- */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ChatApp Server API is running live on Vercel!",
    timestamp: new Date().toISOString(),
  });
});
app.get("/api/status", (req, res) => res.json({ success: true, message: "Server is live" }));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/groups", groupRouter);

/* ---------------- START SERVER ---------------- */
// In local dev, start the server normally.
// In Vercel serverless, we export the app and Vercel handles it.
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, async () => {
    try {
      await connectDB();
    } catch (err) {
      console.error("MongoDB initial connection error:", err.message);
    }
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express app (NOT http.Server) — Vercel needs a callable handler
export default app;

