import mongoose from "mongoose";

// Cache connection for serverless (Vercel reuses warm function instances)
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return; // Reuse existing connection
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Do NOT call process.exit(1) in serverless — it crashes the whole function
    throw error;
  }
};
