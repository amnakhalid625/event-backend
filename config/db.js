import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }

    console.log("Attempting to connect to MongoDB...");

    // Optimized for serverless functions
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,  // Reduced for serverless
      socketTimeoutMS: 10000,          // Reduced timeout
      connectTimeoutMS: 10000,         // Reduced timeout
      maxPoolSize: 5,                  // Smaller pool for serverless
      minPoolSize: 1,                  
      maxIdleTimeMS: 10000,            // Shorter idle time
      bufferCommands: false,           // Disable mongoose buffering
      bufferMaxEntries: 0,             // Disable mongoose buffering
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected successfully");
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    isConnected = false;
    throw err;
  }
};

export default connectDB;