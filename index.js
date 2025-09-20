import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js"; // Change this line - remove destructuring

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

// Basic route
app.get("/", async (req, res) => {
  await connectDB();
  res.json({ message: "API is running successfully 🚀" });
});

export default app;
