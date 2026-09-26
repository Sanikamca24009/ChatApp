import mongoose from "mongoose";

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
