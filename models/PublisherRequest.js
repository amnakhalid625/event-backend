import mongoose from "mongoose";

const websiteAnalyticsSchema = new mongoose.Schema({
  title: String,
  description: String,
  monthlyTraffic: { type: Number, default: 0 },
  estimatedAudience: { type: Number, default: 0 },
  trustScore: { type: Number, default: 0, min: 0, max: 100 },
  category: String,
  hasAnalytics: { type: Boolean, default: false },
  hasFacebookPixel: { type: Boolean, default: false },
  
  // SEO Metrics
  domainAuthority: { type: Number, default: 0, min: 0, max: 100 },
  pageAuthority: { type: Number, default: 0, min: 0, max: 100 },
  ahrefsTraffic: { type: Number, default: 0 },
  topTrafficCountry: String,
  
  socialMedia: {
    facebook: {
      url: String,
      followers: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    },
    instagram: {
      url: String,
      followers: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    },
    twitter: {
      url: String,
      followers: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    },
    youtube: {
      url: String,
      subscribers: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    },
    linkedin: {
      url: String,
      followers: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    }
  },
  lastAnalyzed: { type: Date, default: Date.now },
  analysisSource: { type: String, default: 'automatic' },
  errors: [String]
});

const publisherRequestSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  fullName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  companyName: { 
    type: String, 
    required: true 
  },
  website: { 
    type: String, 
    required: true 
  },
  
  // Main Category (required)
  category: { 
    type: String, 
    required: true,
    enum: [
      "Business / Finance",
      "Technology", 
      "Health / Fitness",
      "Lifestyle",
      "Travel",
      "Food / Drink",
      "Education",
      "Fashion / Beauty",
      "Sports",
      "Entertainment",
      "Home / Garden",
      "Parenting / Family",
      "Automotive",
      "Real Estate",
      "News / Media",
      "Other"
    ]
  },
  
  // Gray Niches (array - can select multiple)
  grayNiches: {
    type: [String],
    enum: [
      "Casino / Gambling",
      "CBD / Cannabis", 
      "Adult",
      "Crypto / Forex",
      "Betting / Sportsbook",
      "Other"
    ],
    default: []
  },
  
  audienceSize: { 
    type: Number, 
    required: true,
    min: 0
  },
  phone: { 
    type: String, 
    required: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  
  // SEO Metrics (user-provided)
  domainAuthority: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0
  },
  pageAuthority: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0
  },
  monthlyTrafficAhrefs: { 
    type: Number, 
    min: 0,
    default: 0
  },
  topTrafficCountry: {
    type: String,
    default: ''
  },
  
  // Pricing
  pricing: {
    standardPostPrice: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    grayNichePrice: { 
      type: Number, 
      min: 0,
      default: 0
    }
  },
  
  // Link Details
  linkDetails: {
    dofollowAllowed: { 
      type: Boolean, 
      default: true 
    },
    nofollowAllowed: { 
      type: Boolean, 
      default: true 
    }
  },
  
  // Content & Samples
  contentDetails: {
    postSampleUrl: String,
    contentGuidelines: String,
    additionalNotes: String
  },
  
  status: { 
    type: String, 
    default: "pending",
    enum: ["pending", "approved", "rejected", "under_review"]
  },
  
  // Website Analytics Data
  websiteAnalysis: websiteAnalyticsSchema,
  
  // Additional fields for better publisher management
  businessType: {
    type: String,
    enum: ["blog", "news", "ecommerce", "corporate", "personal", "ngo", "other"],
    default: "other"
  },
  
  monthlyPageViews: { type: Number, default: 0 },
  primaryTrafficSource: {
    type: String,
    enum: ["organic", "social", "direct", "referral", "paid", "email"],
    default: "organic"
  },
  
  contentLanguages: [String],
  
  targetAudience: {
    ageGroup: {
      type: String,
      enum: ["18-24", "25-34", "35-44", "45-54", "55+", "mixed"]
    },
    gender: {
      type: String,
      enum: ["male", "female", "mixed"]
    },
    interests: [String],
    geography: [String]
  },
  
  monetization: {
    currentMethods: [String],
    monthlyRevenue: { type: Number, default: 0 },
    revenueRange: {
      type: String,
      enum: ["0-100", "100-500", "500-1000", "1000-5000", "5000+"]
    }
  },
  
  // Verification status
  verification: {
    websiteOwnership: { type: Boolean, default: false },
    businessRegistration: { type: Boolean, default: false },
    taxId: { type: Boolean, default: false },
    bankAccount: { type: Boolean, default: false }
  },
  
  // Admin notes and feedback
  adminNotes: String,
  rejectionReason: String,
  approvalDate: Date,
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  reviewedAt: Date,
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  
  // Performance tracking
  performanceMetrics: {
    campaignsCompleted: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalEarnings: { type: Number, default: 0 },
    lastActive: Date
  }
}, { 
  timestamps: true 
});

// Add indexes for better query performance
publisherRequestSchema.index({ user: 1, status: 1 });
publisherRequestSchema.index({ category: 1, status: 1 });
publisherRequestSchema.index({ grayNiches: 1 });
publisherRequestSchema.index({ "pricing.standardPostPrice": 1 });
publisherRequestSchema.index({ "websiteAnalysis.monthlyTraffic": -1 });
publisherRequestSchema.index({ "websiteAnalysis.trustScore": -1 });
publisherRequestSchema.index({ "websiteAnalysis.domainAuthority": -1 });
publisherRequestSchema.index({ email: 1 });
publisherRequestSchema.index({ website: 1 });

// Virtual for total audience (website + social)
publisherRequestSchema.virtual('totalAudience').get(function() {
  const websiteTraffic = this.websiteAnalysis?.monthlyTraffic || 0;
  const socialFollowers = this.websiteAnalysis?.socialMedia ? 
    Object.values(this.websiteAnalysis.socialMedia).reduce((sum, social) => {
      return sum + (social.followers || social.subscribers || 0);
    }, 0) : 0;
  
  return websiteTraffic + socialFollowers + this.audienceSize;
});

// Virtual for pricing display
publisherRequestSchema.virtual('priceRange').get(function() {
  const standard = this.pricing?.standardPostPrice || 0;
  const gray = this.pricing?.grayNichePrice || standard;
  
  if (standard === gray) {
    return `$${standard}`;
  }
  return `$${standard} - $${gray}`;
});

// Method to update analytics
publisherRequestSchema.methods.updateAnalytics = async function(analyticsData) {
  this.websiteAnalysis = {
    ...this.websiteAnalysis,
    ...analyticsData,
    domainAuthority: this.domainAuthority,
    pageAuthority: this.pageAuthority,
    ahrefsTraffic: this.monthlyTrafficAhrefs,
    topTrafficCountry: this.topTrafficCountry,
    lastAnalyzed: new Date()
  };
  return this.save();
};

// Static method to find publishers by category and niche
publisherRequestSchema.statics.findByCategory = function(category, grayNiche = null) {
  const query = { 
    status: 'approved',
    category: category
  };
  
  if (grayNiche) {
    query.grayNiches = grayNiche;
  }
  
  return this.find(query).sort({ 'websiteAnalysis.monthlyTraffic': -1 });
};

// Static method to find high-performing publishers
publisherRequestSchema.statics.findHighPerforming = function() {
  return this.find({
    status: 'approved',
    'websiteAnalysis.trustScore': { $gte: 70 },
    'websiteAnalysis.monthlyTraffic': { $gte: 10000 }
  }).sort({ 'websiteAnalysis.monthlyTraffic': -1 });
};

// Static method to find publishers by price range
publisherRequestSchema.statics.findByPriceRange = function(minPrice, maxPrice) {
  return this.find({
    status: 'approved',
    'pricing.standardPostPrice': { 
      $gte: minPrice, 
      $lte: maxPrice 
    }
  }).sort({ 'pricing.standardPostPrice': 1 });
};

// Method to check if publisher accepts gray niches
publisherRequestSchema.methods.acceptsGrayNiche = function(niche) {
  return this.grayNiches.includes(niche);
};

// Pre-save middleware to set default values
publisherRequestSchema.pre('save', function(next) {
  if (!this.websiteAnalysis) {
    this.websiteAnalysis = {
      monthlyTraffic: this.monthlyTrafficAhrefs || 0,
      domainAuthority: this.domainAuthority || 0,
      pageAuthority: this.pageAuthority || 0,
      topTrafficCountry: this.topTrafficCountry || 'Unknown',
      lastAnalyzed: new Date()
    };
  }
  next();
});

export default mongoose.model("PublisherRequest", publisherRequestSchema);