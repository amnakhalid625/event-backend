import app from "../index.js";
import connectDB from "../config/db.js";

export default async function handler(req, res) {
  try {
    // Connect to database first
    await connectDB();
    
    // Let Express handle CORS (remove manual CORS headers)
    // The CORS is already configured in your main index.js
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      res.status(200).end();
      return;
    }

    // Debug logging
    console.log(`Vercel Handler: ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    
    // Pass to Express app with proper error handling
    return new Promise((resolve) => {
      app(req, res, (error) => {
        if (error) {
          console.error("Express app error:", error);
          res.status(500).json({
            error: "Internal server error",
            message: error.message
          });
        }
        resolve();
      });
    });
    
  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({
      error: "Serverless function crashed",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}