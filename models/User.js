import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["user", "publisher", "advertiser", "admin"], // Added "user" and "admin"
    default: "user" // Changed default from "publisher" to "user" for security
  },
  
  // Password reset fields
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Number, default: null }
}, { 
  timestamps: true,
  suppressReservedKeysWarning: true // This will suppress the mongoose warning
});

export default mongoose.model("User", userSchema);