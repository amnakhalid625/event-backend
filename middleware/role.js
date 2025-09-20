// Role-based access control middleware
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists (should be set by authMiddleware)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Convert single role to array for consistency
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Admin only middleware
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  
  next();
};

// Publisher only middleware
export const publisherOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'publisher') {
    return res.status(403).json({ message: 'Access denied. Publishers only.' });
  }
  
  next();
};

// Advertiser only middleware
export const advertiserOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'advertiser') {
    return res.status(403).json({ message: 'Access denied. Advertisers only.' });
  }
  
  next();
};

// Multiple roles middleware (flexible version)
export const multipleRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}`,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

// Admin or Publisher middleware (common use case)
export const adminOrPublisher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!['admin', 'publisher'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Access denied. Admin or Publisher access required.' 
    });
  }
  
  next();
};

// Check if user owns resource or is admin
export const ownerOrAdmin = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // If admin, allow access
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.resource ? req.resource[resourceUserField] : req.params.userId;
    
    if (req.user._id.toString() !== resourceUserId?.toString()) {
      return res.status(403).json({ 
        message: 'Access denied. You can only access your own resources.' 
      });
    }

    next();
  };
};

// Role hierarchy checker (admin > publisher > advertiser > user)
export const roleHierarchy = (minimumRole) => {
  const hierarchy = {
    'user': 0,
    'advertiser': 1,
    'publisher': 2,
    'admin': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userLevel = hierarchy[req.user.role] || 0;
    const requiredLevel = hierarchy[minimumRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        message: `Access denied. Minimum role required: ${minimumRole}`,
        userRole: req.user.role
      });
    }

    next();
  };
};