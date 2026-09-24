import mongoose from "mongoose";

// Cache connection for serverless (Vercel reuses warm function instances)
let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return; // Reuse existing connection in warm instances
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
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
