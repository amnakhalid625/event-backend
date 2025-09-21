import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import PublisherRequest from "../models/PublisherRequest.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// ✅ Create Publisher Account + Request with Website Analysis
router.post("/create", async (req, res) => {
  try {
    const { 
      fullName, email, password, companyName, website, 
      category, audienceSize, phone, address,
      domainAuthority, pageAuthority, monthlyTrafficAhrefs, topTrafficCountry,
      pricing = {},
      grayNiches = [],
      socialMedia = {}
    } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with proper role
    user = new User({
      fullName,
      email,
      password: hashedPassword,
      role: "user" // Start as user, will be changed to publisher when approved
    });
    await user.save();

    // 🔥 Website analysis - simplified for now
    let websiteAnalysis = {
      title: '',
      description: '',
      monthlyTraffic: monthlyTrafficAhrefs || 0,
      estimatedAudience: parseInt(audienceSize) || 0,
      trustScore: 0,
      category: category,
      hasAnalytics: false,
      domainAuthority: domainAuthority || 0,
      pageAuthority: pageAuthority || 0,
      ahrefsTraffic: monthlyTrafficAhrefs || 0,
      topTrafficCountry: topTrafficCountry || '',
      socialMedia: socialMedia || {},
      lastAnalyzed: new Date(),
      analysisSource: 'manual'
    };

    // If you have website analytics service, uncomment this:
    /*
    try {
      console.log('Analyzing website:', website);
      const analyticsResult = await WebsiteAnalyticsService.analyzeWebsite(website, {
        socialLinks: socialMedia,
        similarWebApiKey: process.env.SIMILARWEB_API_KEY
      });
      
      websiteAnalysis = {
        ...websiteAnalysis,
        title: analyticsResult.websiteInfo?.title || '',
        description: analyticsResult.websiteInfo?.description || '',
        monthlyTraffic: analyticsResult.trafficData?.monthlyVisits || monthlyTrafficAhrefs || 0,
        trustScore: analyticsResult.analysis?.trustScore || 0,
        hasAnalytics: analyticsResult.websiteInfo?.hasAnalytics || false,
        analysisSource: 'automatic'
      };
      
      console.log('Website analysis completed');
    } catch (error) {
      console.error('Website analysis failed:', error.message);
      websiteAnalysis.errors = [error.message];
    }
    */

    // Create publisher request with all data
    const publisherRequest = new PublisherRequest({
      user: user._id,
      fullName,
      email,
      companyName,
      website,
      category,
      grayNiches: grayNiches || [],
      audienceSize: parseInt(audienceSize) || 0,
      phone,
      address,
      
      // SEO Metrics
      domainAuthority: domainAuthority || 0,
      pageAuthority: pageAuthority || 0,
      monthlyTrafficAhrefs: monthlyTrafficAhrefs || 0,
      topTrafficCountry: topTrafficCountry || '',
      
      // Pricing
      pricing: {
        standardPostPrice: pricing.standardPostPrice || 0,
        grayNichePrice: pricing.grayNichePrice || 0
      },
      
      // Link Details
      linkDetails: {
        dofollowAllowed: true,
        nofollowAllowed: true
      },
      
      // Content Details
      contentDetails: {
        postSampleUrl: '',
        contentGuidelines: '',
        additionalNotes: ''
      },
      
      status: "pending",
      
      // Website Analytics Data
      websiteAnalysis: websiteAnalysis,
      
      // Additional fields
      businessType: "other",
      monthlyPageViews: monthlyTrafficAhrefs || 0,
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

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({
      message: "Publisher request created successfully",
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
      },
      websiteAnalysis: {
        trafficFound: websiteAnalysis.monthlyTraffic > 0,
        estimatedMonthlyVisitors: websiteAnalysis.monthlyTraffic || 0,
        trustScore: websiteAnalysis.trustScore || 0
      }
    });
  } catch (err) {
    console.error('Publisher creation error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Re-analyze website data
router.post("/analyze-website/:requestId", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { socialMedia } = req.body;
    
    const publisherRequest = await PublisherRequest.findOne({
      _id: requestId,
      user: req.user.id
    });

    if (!publisherRequest) {
      return res.status(404).json({ message: "Publisher request not found" });
    }

    // For now, just update the analysis timestamp
    // In future, implement WebsiteAnalyticsService.analyzeWebsite
    publisherRequest.websiteAnalysis.lastAnalyzed = new Date();
    if (socialMedia) {
      publisherRequest.websiteAnalysis.socialMedia = socialMedia;
    }

    await publisherRequest.save();

    res.json({
      message: "Website re-analyzed successfully",
      analysis: publisherRequest.websiteAnalysis
    });
  } catch (err) {
    console.error('Re-analyze error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get Publisher Requests with Analytics
router.get("/", authMiddleware, async (req, res) => {
  try {
    const requests = await PublisherRequest.find({ user: req.user.id })
      .populate('user', 'fullName email role')
      .sort({ createdAt: -1 });
    
    // Add analytics summary to each request
    const requestsWithAnalytics = requests.map(req => ({
      ...req.toObject(),
      analyticsSummary: {
        totalAudience: (req.websiteAnalysis?.monthlyTraffic || 0) + 
                      (req.audienceSize || 0),
        trustLevel: req.websiteAnalysis?.trustScore >= 70 ? 'High' : 
                   req.websiteAnalysis?.trustScore >= 40 ? 'Medium' : 'Low',
        hasVerifiedData: req.websiteAnalysis?.hasAnalytics || false,
        priceRange: req.pricing?.standardPostPrice ? 
                   `${req.pricing.standardPostPrice}${req.pricing.grayNichePrice ? ` - ${req.pricing.grayNichePrice}` : ''}` 
                   : 'Not Set'
      }
    }));
    
    res.json(requestsWithAnalytics);
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get single publisher request
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const request = await PublisherRequest.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('user', 'fullName email role');

    if (!request) {
      return res.status(404).json({ message: "Publisher request not found" });
    }

    res.json(request);
  } catch (err) {
    console.error('Get single request error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Update publisher request
router.put("/:id", authMiddleware, async (req, res) => {
  try {
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
      'monthlyTrafficAhrefs', 'topTrafficCountry', 'pricing', 'linkDetails', 
      'contentDetails'
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
      request.reviewedBy = undefined;
      request.reviewedAt = undefined;
    }

    await request.save();

    res.json({
      message: "Publisher request updated successfully",
      request
    });
  } catch (err) {
    console.error('Update request error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get Publisher Stats with Analytics
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const requests = await PublisherRequest.find({ user: req.user.id });
    
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status === "pending").length;
    const approvedRequests = requests.filter(r => r.status === "approved").length;
    const rejectedRequests = requests.filter(r => r.status === "rejected").length;
    
    // Calculate total audience across all requests
    const totalAudience = requests.reduce((sum, req) => {
      return sum + (req.websiteAnalysis?.monthlyTraffic || 0) + (req.audienceSize || 0);
    }, 0);
    
    // Calculate average trust score
    const avgTrustScore = requests.reduce((sum, req) => {
      return sum + (req.websiteAnalysis?.trustScore || 0);
    }, 0) / (totalRequests || 1);

    res.json({ 
      totalRequests, 
      pendingRequests, 
      approvedRequests,
      rejectedRequests,
      totalEstimatedAudience: totalAudience,
      averageTrustScore: Math.round(avgTrustScore),
      analyticsEnabled: requests.filter(r => r.websiteAnalysis?.hasAnalytics).length
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get website verification status (simplified)
router.get("/verify-website/:url", authMiddleware, async (req, res) => {
  try {
    const { url } = req.params;
    const decodedUrl = decodeURIComponent(url);
    
    // Simple URL validation
    try {
      new URL(decodedUrl);
      res.json({
        isAccessible: true,
        title: 'Website Found',
        description: 'Website appears to be accessible',
        hasAnalytics: false,
        hasFacebookPixel: false
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
  } catch (err) {
    console.error('Verify website error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete publisher request (if pending)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const request = await PublisherRequest.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!request) {
      return res.status(404).json({ message: "Publisher request not found" });
    }

    // Only allow deletion if status is pending or rejected
    if (request.status === 'approved') {
      return res.status(400).json({ message: "Cannot delete approved request" });
    }

    await PublisherRequest.findByIdAndDelete(req.params.id);

    res.json({ message: "Publisher request deleted successfully" });
  } catch (err) {
    console.error('Delete request error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;