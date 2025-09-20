import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import PublisherRequest from "../models/PublisherRequest.js";
import User from "../models/User.js";
// import WebsiteAnalyticsService from "../../frontend/src/services/analyticsService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// ✅ Create Publisher Account + Request with Website Analysis
router.post("/create", async (req, res) => {
  try {
    const { 
      fullName, email, password, companyName, website, 
      category, audienceSize, phone, address,
      socialMedia = {} // Optional social media links
    } = req.body;

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
      role: "publisher"
    });
    await user.save();

    // 🔥 Analyze website for traffic and audience data
    let websiteAnalysis = {};
    try {
      console.log('Analyzing website:', website);
      websiteAnalysis = await WebsiteAnalyticsService.analyzeWebsite(website, {
        socialLinks: socialMedia,
        similarWebApiKey: process.env.SIMILARWEB_API_KEY // Optional
      });
      console.log('Website analysis completed');
    } catch (error) {
      console.error('Website analysis failed:', error.message);
      websiteAnalysis = {
        error: 'Could not analyze website',
        url: website,
        trafficData: { monthlyVisits: 0, estimatedTraffic: 0 }
      };
    }

    // Create publisher request with analyzed data
    const publisherRequest = new PublisherRequest({
      user: user._id,
      fullName,
      email,
      companyName,
      website,
      category,
      audienceSize: parseInt(audienceSize) || 0,
      phone,
      address,
      status: "pending",
      
      // 🔥 Add website analytics data
      websiteAnalysis: {
        title: websiteAnalysis.websiteInfo?.title,
        description: websiteAnalysis.websiteInfo?.description,
        monthlyTraffic: websiteAnalysis.trafficData?.monthlyVisits || 0,
        estimatedAudience: websiteAnalysis.totalAudience || parseInt(audienceSize) || 0,
        trustScore: websiteAnalysis.analysis?.trustScore || 0,
        category: websiteAnalysis.analysis?.category || category,
        hasAnalytics: websiteAnalysis.websiteInfo?.hasAnalytics || false,
        socialMedia: websiteAnalysis.socialData || {},
        lastAnalyzed: new Date()
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
      websiteAnalysis: {
        trafficFound: websiteAnalysis.trafficData?.monthlyVisits > 0,
        estimatedMonthlyVisitors: websiteAnalysis.trafficData?.monthlyVisits || 0,
        trustScore: websiteAnalysis.analysis?.trustScore || 0
      }
    });
  } catch (err) {
    console.error(err);
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

    // Re-analyze website
    const websiteAnalysis = await WebsiteAnalyticsService.analyzeWebsite(
      publisherRequest.website,
      {
        socialLinks: socialMedia,
        similarWebApiKey: process.env.SIMILARWEB_API_KEY
      }
    );

    // Update with new analysis
    publisherRequest.websiteAnalysis = {
      title: websiteAnalysis.websiteInfo?.title,
      description: websiteAnalysis.websiteInfo?.description,
      monthlyTraffic: websiteAnalysis.trafficData?.monthlyVisits || 0,
      estimatedAudience: websiteAnalysis.totalAudience || publisherRequest.audienceSize,
      trustScore: websiteAnalysis.analysis?.trustScore || 0,
      category: websiteAnalysis.analysis?.category || publisherRequest.category,
      hasAnalytics: websiteAnalysis.websiteInfo?.hasAnalytics || false,
      socialMedia: websiteAnalysis.socialData || {},
      lastAnalyzed: new Date()
    };

    await publisherRequest.save();

    res.json({
      message: "Website re-analyzed successfully",
      analysis: publisherRequest.websiteAnalysis
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get Publisher Requests with Analytics
router.get("/", authMiddleware, async (req, res) => {
  try {
    const requests = await PublisherRequest.find({ user: req.user.id });
    
    // Add analytics summary to each request
    const requestsWithAnalytics = requests.map(req => ({
      ...req.toObject(),
      analyticsSummary: {
        totalAudience: (req.websiteAnalysis?.monthlyTraffic || 0) + 
                      (req.websiteAnalysis?.estimatedAudience || req.audienceSize || 0),
        trustLevel: req.websiteAnalysis?.trustScore >= 70 ? 'High' : 
                   req.websiteAnalysis?.trustScore >= 40 ? 'Medium' : 'Low',
        hasVerifiedData: req.websiteAnalysis?.hasAnalytics || false
      }
    }));
    
    res.json(requestsWithAnalytics);
  } catch (err) {
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
      totalEstimatedAudience: totalAudience,
      averageTrustScore: Math.round(avgTrustScore),
      analyticsEnabled: requests.filter(r => r.websiteAnalysis?.hasAnalytics).length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get website verification status
router.get("/verify-website/:url", authMiddleware, async (req, res) => {
  try {
    const { url } = req.params;
    const decodedUrl = decodeURIComponent(url);
    
    const websiteInfo = await WebsiteAnalyticsService.getWebsiteInfo(decodedUrl);
    
    res.json({
      isAccessible: websiteInfo.status === 'active',
      title: websiteInfo.title,
      description: websiteInfo.description,
      hasAnalytics: websiteInfo.hasAnalytics,
      hasFacebookPixel: websiteInfo.hasFacebookPixel
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;