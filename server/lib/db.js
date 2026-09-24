import mongoose from "mongoose";
import dns from "dns";

// Use Google's public DNS to resolve MongoDB Atlas SRV records
// This fixes ECONNREFUSED errors on networks with restrictive DNS
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

// Cache connection for serverless (Vercel reuses warm function instances)
let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return; // Reuse existing connection in warm instances
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Do NOT call process.exit(1) in serverless — it crashes the whole function
    throw error;
  }
};
