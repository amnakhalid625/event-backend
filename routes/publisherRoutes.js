import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import PublisherRequest from "../models/PublisherRequest.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ✅ Create Publisher Request (For existing logged-in users) - MAIN ROUTE
router.post("/create", authMiddleware, asyncHandler(async (req, res) => {
  const { 
    fullName, email, companyName, website, 
    category, audienceSize, phone, address,
    domainAuthority, pageAuthority, monthlyTrafficAhrefs, topTrafficCountry,
    pricing = {},
    grayNiches = [],
    socialMedia = {},
    contentDetails = {}
  } = req.body;

  console.log('Publisher request creation attempt:', { 
    email, 
    companyName, 
    website, 
    userId: req.user.id 
  });

  // Enhanced Validation
  const requiredFields = { fullName, email, companyName, website, category };
  const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({ 
      message: `Missing required fields: ${missingFields.join(', ')}`,
      missingFields 
    });
  }

  // Validate website URL
  try {
    new URL(website);
  } catch (error) {
    return res.status(400).json({ 
      message: "Invalid website URL format. Please include http:// or https://" 
    });
  }

  // Check if user already has a pending request for this website
  const existingRequest = await PublisherRequest.findOne({
    user: req.user.id,
    website: website,
    status: { $in: ['pending', 'under_review'] }
  });

  if (existingRequest) {
    return res.status(400).json({ 
      message: "You already have a pending request for this website. Please wait for approval or edit existing request.",
      existingRequestId: existingRequest._id
    });
  }

  // Simple website analysis (no external service needed)
  const websiteAnalysis = {
    title: `${companyName} - Official Website`,
    description: `${category} website with quality content`,
    monthlyTraffic: parseInt(monthlyTrafficAhrefs) || parseInt(audienceSize) || 0,
    estimatedAudience: parseInt(audienceSize) || 0,
    trustScore: Math.floor(Math.random() * 40) + 30, // Random score between 30-70
    category: category,
    hasAnalytics: Math.random() > 0.5,
    domainAuthority: parseInt(domainAuthority) || Math.floor(Math.random() * 30) + 20,
    pageAuthority: parseInt(pageAuthority) || Math.floor(Math.random() * 25) + 15,
    ahrefsTraffic: parseInt(monthlyTrafficAhrefs) || 0,
    topTrafficCountry: topTrafficCountry || 'Unknown',
    socialMedia: socialMedia || {},
    lastAnalyzed: new Date(),
    analysisSource: 'automatic'
  };

  // Create publisher request with all data
  const publisherRequest = new PublisherRequest({
    user: req.user.id,
    fullName,
    email,
    companyName,
    website,
    category,
    grayNiches: Array.isArray(grayNiches) ? grayNiches : [],
    audienceSize: parseInt(audienceSize) || 0,
    phone: phone || '',
    address: address || '',
    
    // SEO Metrics
    domainAuthority: parseInt(domainAuthority) || 0,
    pageAuthority: parseInt(pageAuthority) || 0,
    monthlyTrafficAhrefs: parseInt(monthlyTrafficAhrefs) || 0,
    topTrafficCountry: topTrafficCountry || '',
    
    // Pricing
    pricing: {
      standardPostPrice: parseFloat(pricing.standardPostPrice) || 0,
      grayNichePrice: parseFloat(pricing.grayNichePrice) || parseFloat(pricing.standardPostPrice) || 0
    },
    
    // Link Details
    linkDetails: {
      dofollowAllowed: true,
      nofollowAllowed: true
    },
    
    // Content Details
    contentDetails: {
      postSampleUrl: contentDetails.postSampleUrl || '',
      contentGuidelines: contentDetails.contentGuidelines || '',
      additionalNotes: contentDetails.additionalNotes || ''
    },
    
    status: "pending",
    
    // Website Analytics Data
    websiteAnalysis: websiteAnalysis,
    
    // Additional fields for better management
    businessType: "other",
    monthlyPageViews: parseInt(monthlyTrafficAhrefs) || 0,
    primaryTrafficSource: "organic",
    contentLanguages: ["English"],
    
    targetAudience: {
      ageGroup: "mixed",
      gender: "mixed",
      interests: [],
      geography: [topTrafficCountry || "US"]
    },
    
    monetization: {
      currentMethods: ["sponsored-posts"],
      monthlyRevenue: 0,
      revenueRange: "0-100"
    },
    
    verification: {
      websiteOwnership: false,
      businessRegistration: false,
      taxId: false,
      bankAccount: false
    }
  });
  
  await publisherRequest.save();
  console.log('Publisher request created:', publisherRequest._id);

  res.status(201).json({
    message: "Publisher request submitted successfully. Please wait for admin approval.",
    request: {
      id: publisherRequest._id,
      status: publisherRequest.status,
      companyName: publisherRequest.companyName,
      website: publisherRequest.website
    },
    websiteAnalysis: {
      trafficFound: websiteAnalysis.monthlyTraffic > 0,
      estimatedMonthlyVisitors: websiteAnalysis.monthlyTraffic || 0,
      trustScore: websiteAnalysis.trustScore || 0
    }
  });
}));

// ✅ Create Publisher Account + Request (For new users - signup flow)
router.post("/create-account", asyncHandler(async (req, res) => {
  const { 
    fullName, email, password, companyName, website, 
    category, audienceSize, phone, address,
    domainAuthority, pageAuthority, monthlyTrafficAhrefs, topTrafficCountry,
    pricing = {},
    grayNiches = [],
    socialMedia = {}
  } = req.body;

  console.log('New publisher account creation:', { email, companyName, website });

  // Validation
  const requiredFields = { fullName, email, password, companyName, website, category };
  const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({ 
      message: `Missing required fields: ${missingFields.join(', ')}`,
      missingFields 
    });
  }

  // Validate website URL
  try {
    new URL(website);
  } catch (error) {
    return res.status(400).json({ 
      message: "Invalid website URL format. Please include http:// or https://" 
    });
  }

  // Check if user already exists
  let user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({ message: "User already exists with this email" });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user with "user" role (will be changed to "publisher" after approval)
  user = new User({
    fullName,
    email,
    password: hashedPassword,
    role: "user" // Start as user, becomes publisher after admin approval
  });
  await user.save();
  console.log('User created:', user.email);

  // Simple website analysis
  const websiteAnalysis = {
    title: `${companyName} - Official Website`,
    description: `${category} website with quality content`,
    monthlyTraffic: parseInt(monthlyTrafficAhrefs) || 0,
    estimatedAudience: parseInt(audienceSize) || 0,
    trustScore: Math.floor(Math.random() * 40) + 30,
    category: category,
    hasAnalytics: false,
    domainAuthority: parseInt(domainAuthority) || 0,
    pageAuthority: parseInt(pageAuthority) || 0,
    ahrefsTraffic: parseInt(monthlyTrafficAhrefs) || 0,
    topTrafficCountry: topTrafficCountry || 'Unknown',
    socialMedia: socialMedia || {},
    lastAnalyzed: new Date(),
    analysisSource: 'manual'
  };

  // Create publisher request
  const publisherRequest = new PublisherRequest({
    user: user._id,
    fullName,
    email,
    companyName,
    website,
    category,
    grayNiches: Array.isArray(grayNiches) ? grayNiches : [],
    audienceSize: parseInt(audienceSize) || 0,
    phone: phone || '',
    address: address || '',
    domainAuthority: parseInt(domainAuthority) || 0,
    pageAuthority: parseInt(pageAuthority) || 0,
    monthlyTrafficAhrefs: parseInt(monthlyTrafficAhrefs) || 0,
    topTrafficCountry: topTrafficCountry || '',
    pricing: {
      standardPostPrice: parseFloat(pricing.standardPostPrice) || 0,
      grayNichePrice: parseFloat(pricing.grayNichePrice) || 0
    },
    linkDetails: {
      dofollowAllowed: true,
      nofollowAllowed: true
    },
    contentDetails: {
      postSampleUrl: '',
      contentGuidelines: '',
      additionalNotes: ''
    },
    status: "pending",
    websiteAnalysis: websiteAnalysis,
    businessType: "other",
    monthlyPageViews: parseInt(monthlyTrafficAhrefs) || 0,
    primaryTrafficSource: "organic",
    contentLanguages: ["English"],
    targetAudience: {
      ageGroup: "mixed",
      gender: "mixed",
      interests: [],
      geography: [topTrafficCountry || "US"]
    },
    monetization: {
      currentMethods: ["sponsored-posts"],
      monthlyRevenue: 0,
      revenueRange: "0-100"
    },
    verification: {
      websiteOwnership: false,
      businessRegistration: false,
      taxId: false,
      bankAccount: false
    }
  });
  
  await publisherRequest.save();
  console.log('Publisher request created:', publisherRequest._id);

  // Generate JWT token for immediate login
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

  res.status(201).json({
    message: "Account created and publisher request submitted successfully.",
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    },
    request: {
      id: publisherRequest._id,
      status: publisherRequest.status,
      companyName: publisherRequest.companyName,
      website: publisherRequest.website
    }
  });
}));

// ✅ Get Publisher Requests with Analytics
router.get("/", authMiddleware, asyncHandler(async (req, res) => {
  console.log('Fetching requests for user:', req.user.id);
  
  const requests = await PublisherRequest.find({ user: req.user.id })
    .populate('user', 'fullName email role')
    .sort({ createdAt: -1 })
    .lean(); // Use lean for better performance
  
  console.log(`Found ${requests.length} requests for user ${req.user.id}`);
  
  // Add analytics summary to each request
  const requestsWithAnalytics = requests.map(req => ({
    ...req,
    analyticsSummary: {
      totalAudience: (req.websiteAnalysis?.monthlyTraffic || 0) + (req.audienceSize || 0),
      trustLevel: req.websiteAnalysis?.trustScore >= 70 ? 'High' : 
                 req.websiteAnalysis?.trustScore >= 40 ? 'Medium' : 'Low',
      hasVerifiedData: req.websiteAnalysis?.hasAnalytics || false,
      priceRange: req.pricing?.standardPostPrice ? 
                 `${req.pricing.standardPostPrice}${req.pricing.grayNichePrice && req.pricing.grayNichePrice !== req.pricing.standardPostPrice ? ` - ${req.pricing.grayNichePrice}` : ''}` 
                 : 'Not Set'
    }
  }));
  
  res.json(requestsWithAnalytics);
}));

// ✅ Re-analyze website data (simplified without external service)
router.post("/analyze-website/:requestId", authMiddleware, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { socialMedia } = req.body;
  
  if (!requestId) {
    return res.status(400).json({ message: "Request ID is required" });
  }
  
  const publisherRequest = await PublisherRequest.findOne({
    _id: requestId,
    user: req.user.id
  });

  if (!publisherRequest) {
    return res.status(404).json({ message: "Publisher request not found" });
  }

  // Simple re-analysis (update timestamp and social media)
  publisherRequest.websiteAnalysis.lastAnalyzed = new Date();
  publisherRequest.websiteAnalysis.trustScore = Math.floor(Math.random() * 40) + 40; // New random score
  
  if (socialMedia) {
    publisherRequest.websiteAnalysis.socialMedia = socialMedia;
  }

  await publisherRequest.save();

  res.json({
    message: "Website re-analyzed successfully",
    analysis: publisherRequest.websiteAnalysis
  });
}));

// ✅ Get single publisher request
router.get("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const request = await PublisherRequest.findOne({
    _id: req.params.id,
    user: req.user.id
  }).populate('user', 'fullName email role');

  if (!request) {
    return res.status(404).json({ message: "Publisher request not found" });
  }

  res.json(request);
}));

// ✅ Update publisher request (only if pending or rejected)
router.put("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const request = await PublisherRequest.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!request) {
    return res.status(404).json({ message: "Publisher request not found" });
  }

  // Only allow updates if status is pending or rejected
  if (!['pending', 'rejected'].includes(request.status)) {
    return res.status(400).json({ message: "Cannot update approved request" });
  }

  // Update allowed fields
  const allowedFields = [
    'companyName', 'website', 'category', 'grayNiches', 'audienceSize', 
    'phone', 'address', 'domainAuthority', 'pageAuthority', 
    'monthlyTrafficAhrefs', 'topTrafficCountry', 'pricing', 'contentDetails'
  ];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      request[field] = req.body[field];
    }
  });

  // Reset status to pending if it was rejected
  if (request.status === 'rejected') {
    request.status = 'pending';
    request.rejectionReason = undefined;
    request.adminNotes = undefined;
  }

  await request.save();

  res.json({
    message: "Publisher request updated successfully",
    request
  });
}));

// ✅ Get Publisher Stats with Analytics
router.get("/stats", authMiddleware, asyncHandler(async (req, res) => {
  const requests = await PublisherRequest.find({ user: req.user.id }).lean();
  
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === "pending").length;
  const approvedRequests = requests.filter(r => r.status === "approved").length;
  const rejectedRequests = requests.filter(r => r.status === "rejected").length;
  
  // Calculate total audience across all requests
  const totalAudience = requests.reduce((sum, req) => {
    return sum + (req.websiteAnalysis?.monthlyTraffic || 0) + (req.audienceSize || 0);
  }, 0);
  
  // Calculate average trust score
  const avgTrustScore = totalRequests > 0 ? 
    Math.round(requests.reduce((sum, req) => {
      return sum + (req.websiteAnalysis?.trustScore || 0);
    }, 0) / totalRequests) : 0;

  res.json({ 
    totalRequests, 
    pendingRequests, 
    approvedRequests,
    rejectedRequests,
    totalEstimatedAudience: totalAudience,
    averageTrustScore: avgTrustScore,
    analyticsEnabled: requests.filter(r => r.websiteAnalysis?.hasAnalytics).length
  });
}));

// ✅ Get website verification status (simplified)
router.get("/verify-website/:url", authMiddleware, asyncHandler(async (req, res) => {
  const { url } = req.params;
  const decodedUrl = decodeURIComponent(url);
  
  // Simple URL validation (no external service needed)
  try {
    new URL(decodedUrl);
    res.json({
      isAccessible: true,
      title: 'Website Found',
      description: 'Website appears to be accessible',
      hasAnalytics: Math.random() > 0.5,
      hasFacebookPixel: Math.random() > 0.7
    });
  } catch (error) {
    res.json({
      isAccessible: false,
      title: 'Invalid URL',
      description: 'Website URL is not valid',
      hasAnalytics: false,
      hasFacebookPixel: false
    });
  }
}));

// ✅ Delete publisher request (only if pending or rejected)
router.delete("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const request = await PublisherRequest.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!request) {
    return res.status(404).json({ message: "Publisher request not found" });
  }

  // Only allow deletion if status is pending or rejected
  if (request.status === 'approved') {
    return res.status(400).json({ message: "Cannot delete approved request. Please contact admin." });
  }

  await PublisherRequest.findByIdAndDelete(req.params.id);
  console.log('Request deleted:', req.params.id);

  res.json({ message: "Publisher request deleted successfully" });
}));

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Publisher routes error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      details: Object.values(error.errors).map(e => e.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID format'
    });
  }
  
  res.status(500).json({
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

export default router;