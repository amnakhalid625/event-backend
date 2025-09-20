import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }

    console.log("Attempting to connect to MongoDB...");

    // Add connection options to handle timeouts and connection issues
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds to select server
      socketTimeoutMS: 45000,          // 45 seconds for socket operations
      connectTimeoutMS: 30000,         // 30 seconds to establish connection
      maxPoolSize: 10,                 // Maximum connections in pool
      minPoolSize: 2,                  // Minimum connections in pool
      maxIdleTimeMS: 30000,            // Close connections after 30 seconds of inactivity
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected successfully");
    console.log(`Connected to: ${conn.connection.host}:${conn.connection.port}`);
    console.log(`Database: ${conn.connection.name}`);
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    isConnected = false;
    throw err;
  }
};

export default connectDB;