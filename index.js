import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import publisherRoutes from "./routes/publisherRoutes.js";
import advertiseRoutes from "./routes/advertise.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/publisher", publisherRoutes);
app.use("/api/advertiser", advertiseRoutes);
app.use("/api/admin", adminRoutes);

// Basic route with error handling
app.get("/", async (req, res) => {
  try {
    await connectDB();
    res.json({ message: "API is running successfully 🚀" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ 
      error: "Database connection failed",
      message: error.message 
    });
  }
});

// Catch all undefined routes
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;