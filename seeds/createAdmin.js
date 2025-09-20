// seeds/createAdmin.js - existing file ko update karein

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database';
    console.log('Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    console.log('Checking for existing admin...');
    const existingAdmin = await User.findOne({ email: 'admin@yoursite.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.fullName);
      console.log('Role:', existingAdmin.role);
      console.log('Created:', existingAdmin.createdAt);
      
      // Test password
      const testPassword = 'Admin123!';
      const isPasswordCorrect = await bcrypt.compare(testPassword, existingAdmin.password);
      console.log('Password test result:', isPasswordCorrect ? 'Correct' : 'Incorrect');
      
      if (!isPasswordCorrect) {
        console.log('Updating admin password...');
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        await User.findByIdAndUpdate(existingAdmin._id, { password: hashedPassword });
        console.log('Password updated successfully!');
      }
      
      mongoose.disconnect();
      return;
    }

    // Create new admin user
    console.log('Creating new admin user...');
    
    const adminPassword = 'Admin123!';
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = new User({
      fullName: 'System Administrator',
      email: 'admin@yoursite.com',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Saving admin user...');
    await adminUser.save();
    
    console.log('\nSUCCESS! Admin user created successfully!');
    console.log('================================');
    console.log('Email: admin@yoursite.com');
    console.log('Password: Admin123!');
    console.log('Role: admin');
    console.log('================================');
    console.log('IMPORTANT: Change the password after first login!');
    
    // Verify creation
    console.log('\nVerifying admin creation...');
    const createdAdmin = await User.findOne({ email: 'admin@yoursite.com' });
    
    if (createdAdmin) {
      console.log('Admin user verified in database');
      console.log('ID:', createdAdmin._id);
      console.log('Created at:', createdAdmin.createdAt);
      
      // Test password
      const passwordTest = await bcrypt.compare(adminPassword, createdAdmin.password);
      console.log('Password verification:', passwordTest ? 'Correct' : 'Failed');
    } else {
      console.log('Failed to verify admin user creation');
    }

  } catch (error) {
    console.error('Error creating admin user:', error);
    
    if (error.code === 11000) {
      console.log('Duplicate key error - admin user already exists');
    }
    
    if (error.name === 'ValidationError') {
      console.log('Validation error:', error.message);
    }
  } finally {
    console.log('\nDisconnecting from database...');
    mongoose.disconnect();
    console.log('Disconnected. Goodbye!');
  }
};

// Run the function
console.log('Starting admin user creation script...\n');
createAdminUser();