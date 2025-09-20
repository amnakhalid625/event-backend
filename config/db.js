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
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds to select server
      socketTimeoutMS: 45000,          // 45 seconds for socket operations
      connectTimeoutMS: 30000,         // 30 seconds to establish connection
      bufferMaxEntries: 0,             // Disable buffering
      maxPoolSize: 10,                 // Maximum connections in pool
      minPoolSize: 2,                  // Minimum connections in pool
      maxIdleTimeMS: 30000,            // Close connections after 30 seconds of inactivity
      retryWrites: true,               // Automatically retry writes
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected successfully");
    console.log(`Connected to: ${conn.connection.host}:${conn.connection.port}`);
    console.log(`Database: ${conn.connection.name}`);
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    isConnected = false;
    
    // Log more specific error details
    if (err.name === 'MongoServerSelectionError') {
      console.error("Server selection failed - check network access and connection string");
    } else if (err.name === 'MongoTimeoutError') {
      console.error("Connection timeout - MongoDB server may be slow or unreachable");
    }
    
    throw err;
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to application termination');
  process.exit(0);
});

export default connectDB;