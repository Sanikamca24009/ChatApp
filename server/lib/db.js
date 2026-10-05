import dns from "node:dns";
import mongoose from "mongoose";

// Only override DNS servers in local dev if needed, never in serverless (Vercel)
if (process.env.VERCEL !== "1") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // ignore
  }
}

// Cache connection for serverless (Vercel reuses warm function instances)
export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // Reuse existing connection

  const rawUri = process.env.MONGODB_URI || "";
  const uri = rawUri.trim().replace(/^["']|["']$/g, ""); // Strip any surrounding quotes

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is missing or empty");
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};
