// routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import connectDB from "../config/db.js";

const router = express.Router();

// Base route to fix "Route not found" error
router.get("/", (req, res) => {
  res.json({ 
    message: "Auth API working!",
    endpoints: [
      "POST /login",
      "POST /register", 
      "POST /signup",
      "GET /profile",
      "POST /logout",
      "POST /forgot-password"
    ]
  });
});

// Test route for debugging
router.get("/test", (req, res) => {
  res.json({ 
    message: "Auth test route works!",
    jwtSecretExists: !!process.env.JWT_SECRET,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ------------------ REGISTER ------------------
router.post("/register", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const { fullName, email, password, role } = req.body;

    console.log("Register attempt:", { fullName, email, role });

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = new User({ 
      fullName, 
      email, 
      password: hashedPassword, 
      role: role || 'user' 
    });
    
    await user.save();
    console.log("User registered successfully:", user.email);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ------------------ SIGNUP (Alternative endpoint for frontend consistency) ------------------
router.post("/signup", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const { name, fullName, email, password, role } = req.body;

    console.log("Signup attempt:", { name, fullName, email, role });

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use fullName if provided, otherwise use name
    const userFullName = fullName || name || "User";

    // Create user
    user = new User({ 
      fullName: userFullName, 
      email, 
      password: hashedPassword, 
      role: role || 'user'
    });
    
    await user.save();
    console.log("User signed up successfully:", user.email);

    // Generate token for immediate login after signup
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({ 
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ------------------ LOGIN ------------------
router.post("/login", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const { email, password } = req.body;

    console.log("Login attempt for email:", email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    console.log("Login successful for user:", email);

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ------------------ GET PROFILE ------------------
router.get("/profile", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Profile error:", err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------ LOGOUT ------------------
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// ------------------ FORGOT PASSWORD ------------------
router.post("/forgot-password", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const { email } = req.body;
    
    // Input validation
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid email address" 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: "No account found with this email address" 
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log("Email server is ready to send messages");
    } catch (error) {
      console.error("Email server verification failed:", error);
      throw new Error("Email service configuration error");
    }

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

    // Enhanced email template
    const mailOptions = {
      from: {
        name: "Your App Name",
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello,</p>
          <p>You requested a password reset for your account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        You requested a password reset for your account.
        
        Click this link to reset your password: ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this password reset, please ignore this email.
      `
    };

    console.log("Sending password reset email...");
    console.log("From:", process.env.EMAIL_USER);
    console.log("To:", user.email);
    
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully!");

    res.json({ 
      success: true, 
      message: "Password reset link has been sent to your email" 
    });

  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    
    // More specific error handling
    if (err.message.includes("Email service")) {
      return res.status(500).json({ 
        success: false, 
        message: "Email service is currently unavailable. Please try again later." 
      });
    }
    
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return res.status(500).json({ 
        success: false, 
        message: "Unable to send email. Please try again later." 
      });
    }

    if (err.message.includes("Invalid login") || err.message.includes("Username and Password not accepted")) {
      return res.status(500).json({ 
        success: false, 
        message: "Email configuration error. Please contact support." 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "An error occurred while processing your request. Please try again later." 
    });
  }
});

// ------------------ RESET PASSWORD ------------------
router.post("/reset-password/:token", async (req, res) => {
  try {
    await connectDB(); // Connect to database
    
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }, // token still valid
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    console.log("Password reset successful for user:", user.email);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;