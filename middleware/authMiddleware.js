import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.header('Authorization');
    
    console.log('Authorization header:', req.header('Authorization')); // Debug log
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Remove Bearer from string if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    console.log('Token after processing:', token); // Debug log

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded); // Debug log

    // Get user from token
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('User found:', { id: user._id, email: user.email, role: user.role }); // Debug log

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    res.status(500).json({ message: 'Server error in authentication' });
  }
};

// Alternative auth middleware for testing
export const debugAuthMiddleware = async (req, res, next) => {
  try {
    console.log('\n=== DEBUG AUTH MIDDLEWARE ===');
    console.log('Headers:', req.headers);
    console.log('Authorization:', req.header('Authorization'));
    
    let token = req.header('Authorization');
    
    if (!token) {
      console.log('❌ No token found');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    console.log('🔑 Token:', token.substring(0, 20) + '...');
    console.log('🔐 JWT_SECRET exists:', !!process.env.JWT_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded successfully:', decoded);

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ User not found for ID:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('👤 User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    });
    
    req.user = user;
    console.log('=== END DEBUG ===\n');
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    console.log('=== END DEBUG ===\n');
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token', error: error.message });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', error: error.message });
    }
    
    res.status(500).json({ message: 'Server error in authentication', error: error.message });
  }
};