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

    // Fixed connection options for serverless functions
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,  // 5 seconds to select server
      socketTimeoutMS: 10000,          // 10 seconds for socket operations
      connectTimeoutMS: 10000,         // 10 seconds to establish connection
      maxPoolSize: 5,                  // Maximum connections in pool
      minPoolSize: 1,                  // Minimum connections in pool
      maxIdleTimeMS: 10000,            // Close connections after 10 seconds of inactivity
      bufferCommands: false,           // Disable mongoose buffering for serverless
      // REMOVED: bufferMaxEntries - This option is deprecated
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