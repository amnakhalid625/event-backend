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

// CORS Configuration - MUST BE BEFORE OTHER MIDDLEWARE
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://event-frontend-chi-ivory.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// Routes - CORRECT MAPPING
app.use("/api/auth", authRoutes);
app.use("/api/publisher-requests", publisherRoutes);  // Changed this line
app.use("/api/advertiser", advertiseRoutes);
app.use("/api/admin", adminRoutes);

// Basic route with error handling
app.get("/", async (req, res) => {
  try {
    await connectDB();
    res.json({ 
      message: "API is running successfully 🚀",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      error: "Database connection failed",
      message: error.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Catch all undefined routes
app.use("*", (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

export default app;