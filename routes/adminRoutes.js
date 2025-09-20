import express from 'express';
import bcrypt from 'bcryptjs'; // Add this import - this was missing!
import PublisherRequest from '../models/PublisherRequest.js';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/role.js'; // Import adminOnly instead of roleMiddleware

const router = express.Router();

// Remove custom adminMiddleware - use adminOnly from role.js instead

// GET /api/admin/dashboard-stats - Get admin dashboard statistics
router.get('/dashboard-stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalRequests = await PublisherRequest.countDocuments();
    const pendingRequests = await PublisherRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await PublisherRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await PublisherRequest.countDocuments({ status: 'rejected' });
    
    const totalUsers = await User.countDocuments();
    const publisherUsers = await User.countDocuments({ role: 'publisher' });
    const advertiserUsers = await User.countDocuments({ role: 'advertiser' });

    // Calculate total traffic from approved publishers
    const approvedPublishers = await PublisherRequest.find({ 
      status: 'approved',
      'websiteAnalysis.trafficData.monthlyVisits': { $exists: true } 
    });
    
    const totalTraffic = approvedPublishers.reduce((sum, pub) => {
      return sum + (pub.websiteAnalysis?.trafficData?.monthlyVisits || 0);
    }, 0);

    res.json({
      stats: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        totalTraffic: totalTraffic
      },
      users: {
        total: totalUsers,
        publishers: publisherUsers,
        advertisers: advertiserUsers
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/admin/publisher-requests - Get all publisher requests
router.get('/publisher-requests', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    // Build query
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { publisherName: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const requests = await PublisherRequest.find(query)
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PublisherRequest.countDocuments(query);

    res.json({
      requests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get publisher requests error:', error);
    res.status(500).json({ message: 'Failed to fetch publisher requests' });
  }
});

// GET /api/admin/publisher-requests/:id - Get single publisher request
router.get('/publisher-requests/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const request = await PublisherRequest.findById(req.params.id)
      .populate('user', 'fullName email createdAt');
    
    if (!request) {
      return res.status(404).json({ message: 'Publisher request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Get publisher request error:', error);
    res.status(500).json({ message: 'Failed to fetch publisher request' });
  }
});

// PUT /api/admin/publisher-requests/:id/approve - Approve publisher request
router.put('/publisher-requests/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { adminNotes } = req.body;
    
    const request = await PublisherRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Publisher request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    // Update request status
    request.status = 'approved';
    request.approvedBy = req.user._id;
    request.approvalDate = new Date();
    request.reviewedAt = new Date();
    if (adminNotes) request.adminNotes = adminNotes;

    await request.save();

    // Update user role to publisher when approved
    if (request.user) {
      await User.findByIdAndUpdate(request.user, { role: 'publisher' });
    }

    res.json({ 
      message: 'Publisher request approved successfully',
      request 
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Failed to approve request' });
  }
});

// PUT /api/admin/publisher-requests/:id/reject - Reject publisher request
router.put('/publisher-requests/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const request = await PublisherRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Publisher request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    // Update request status
    request.status = 'rejected';
    request.rejectionReason = rejectionReason;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    if (adminNotes) request.adminNotes = adminNotes;

    await request.save();

    res.json({ 
      message: 'Publisher request rejected',
      request 
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Failed to reject request' });
  }
});

// PUT /api/admin/publisher-requests/:id/status - Update request status (for bulk operations)
router.put('/publisher-requests/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, rejectionReason, adminNotes } = req.body;
    
    const request = await PublisherRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Publisher request not found' });
    }

    // Validate status change
    const validStatuses = ['pending', 'approved', 'rejected', 'under_review'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // If rejecting, require rejection reason
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    // Update request
    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    
    if (status === 'approved') {
      request.approvedBy = req.user._id;
      request.approvalDate = new Date();
      
      // Update user role to publisher when approved
      if (request.user) {
        await User.findByIdAndUpdate(request.user, { role: 'publisher' });
      }
    }
    
    if (status === 'rejected') {
      request.rejectionReason = rejectionReason;
    }
    
    if (adminNotes) {
      request.adminNotes = adminNotes;
    }

    await request.save();

    res.json({ 
      message: `Publisher request ${status} successfully`,
      request 
    });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ message: 'Failed to update request status' });
  }
});

// GET /api/admin/users - Get all users
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role, page = 1, limit = 10, search } = req.query;
    
    let query = {};
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    // Validate role
    const validRoles = ['user', 'advertiser', 'publisher', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from changing their own role
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const user = await User.findByIdAndUpdate(
      id, 
      { role }, 
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message: 'User role updated successfully',
      user 
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// DELETE /api/admin/publisher-requests/:id - Delete publisher request
router.delete('/publisher-requests/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const request = await PublisherRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Publisher request not found' });
    }

    await PublisherRequest.findByIdAndDelete(req.params.id);

    res.json({ message: 'Publisher request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Failed to delete request' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated publisher requests
    await PublisherRequest.deleteMany({ user: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// POST /api/admin/run-seed - Create admin user (Fixed with bcrypt import)
router.post('/run-seed', async (req, res) => {
  try {
    console.log('Running seed script to create admin user...');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@yoursite.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return res.json({ 
        message: 'Admin user already exists', 
        user: { 
          email: existingAdmin.email, 
          role: existingAdmin.role,
          fullName: existingAdmin.fullName
        } 
      });
    }

    console.log('Creating new admin user...');

    // Create admin user with proper bcrypt hashing
    const adminPassword = 'Admin123!';
    const saltRounds = 10;
    
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    
    const adminUser = new User({
      fullName: 'System Administrator',
      email: 'admin@yoursite.com',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Saving admin user to database...');
    await adminUser.save();
    
    console.log('Admin user created successfully!');
    
    res.json({ 
      message: 'Admin user created successfully', 
      user: {
        id: adminUser._id,
        email: adminUser.email,
        fullName: adminUser.fullName,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    
    // Handle duplicate key error (user already exists)
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Admin user already exists with this email' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Error creating admin user', 
      error: error.message 
    });
  }
});

export default router;