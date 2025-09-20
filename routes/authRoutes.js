// routes/authRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const router = express.Router();

// ADDED: Base route to fix "Route not found" error
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

// ADDED: Test route for debugging
router.get("/test", (req, res) => {
  res.json({ 
    message: "Auth test route works!",
    jwtSecretExists: !!process.env.JWT_SECRET,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ------------------ REGISTER ------------------
router.post("/register", async (req, res) => {
  const { fullName, email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ fullName, email, password: hashedPassword, role });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ------------------ SIGNUP (Alternative endpoint for frontend consistency) ------------------
router.post("/signup", async (req, res) => {
  const { name, fullName, email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use fullName if provided, otherwise use name
    const userFullName = fullName || name;

    user = new User({ 
      fullName: userFullName, 
      email, 
      password: hashedPassword, 
      role 
    });
    await user.save();

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
    res.status(500).json({ message: err.message });
  }
});

// ------------------ LOGIN ------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

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
    res.status(500).json({ message: err.message });
  }
});

// ------------------ GET PROFILE ------------------
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// ------------------ LOGOUT ------------------
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// ------------------ FORGOT PASSWORD ------------------
router.post("/forgot-password", async (req, res) => {
  console.log("=== FORGOT PASSWORD REQUEST ===");
  console.log("Request body:", req.body);
  console.log("Environment check:");
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
  console.log("EMAIL_PASS length:", process.env.EMAIL_PASS?.length);
  
  const { email } = req.body;
  
  try {
    // Input validation
    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Invalid email format:", email);
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid email address" 
      });
    }

    console.log("🔍 Looking for user with email:", email);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("❌ User not found for email:", email);
      return res.status(400).json({ 
        success: false, 
        message: "No account found with this email address" 
      });
    }
    
    console.log("✅ User found:", user._id);

    // Generate secure reset token
    console.log("🔑 Generating reset token...");
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    console.log("💾 Saving user with reset token...");
    await user.save();
    console.log("✅ Reset token saved to database");

    // Create email transporter (FIXED: createTransport, not createTransporter)
    console.log("📧 Creating email transporter...");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    console.log("🔐 Verifying email configuration...");
    try {
      await transporter.verify();
      console.log("✅ Email server is ready to send messages");
    } catch (error) {
      console.error("❌ Email server verification failed:", error);
      console.error("Email config details:", {
        user: process.env.EMAIL_USER,
        hasPass: !!process.env.EMAIL_PASS,
        passLength: process.env.EMAIL_PASS?.length
      });
      throw new Error("Email service configuration error");
    }

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
    console.log("🔗 Reset URL generated:", resetUrl);

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
      // Fallback plain text version
      text: `
        Password Reset Request
        
        You requested a password reset for your account.
        
        Click this link to reset your password: ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this password reset, please ignore this email.
      `
    };

    console.log("📤 Sending password reset email...");
    console.log("From:", process.env.EMAIL_USER);
    console.log("To:", user.email);
    
    await transporter.sendMail(mailOptions);
    console.log("✅ Password reset email sent successfully!");

    res.json({ 
      success: true, 
      message: "Password reset link has been sent to your email" 
    });

  } catch (err) {
    console.error("❌ FORGOT PASSWORD ERROR:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
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

    // Gmail specific errors
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
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }, // token still valid
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // clear reset fields
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;