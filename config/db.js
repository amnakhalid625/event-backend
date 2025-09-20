import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    isConnected = conn.connections[0].readyState === 1;
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    throw err;
  }
};

export default connectDB;