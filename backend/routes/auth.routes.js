// backend/routes/auth.routes.js - Authentication Routes for Aviiaor Demo Platform
// Educational demo only - No real money transactions
// Simple username/password authentication for demo purposes

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User } = require('../database/models');

/**
 * Input validation helper function
 * @param {string} username - Username to validate
 * @param {string} password - Password to validate
 * @returns {Array} Array of validation errors (empty if valid)
 */
function validateAuthInput(username, password) {
  const errors = [];
  
  // Username validation
  if (!username || username.trim() === '') {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (username.length > 20) {
    errors.push('Username cannot exceed 20 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers and underscores');
  }
  
  // Password validation
  if (!password || password.trim() === '') {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  return errors;
}

/**
 * Sanitize user object for response (remove sensitive data)
 * @param {Object} user - Mongoose user document
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  
  const userObj = user.toObject ? user.toObject() : user;
  
  // Remove sensitive fields
  delete userObj.password;
  delete userObj.__v;
  
  // Add formatted balance
  userObj.formattedBalance = `$${userObj.balance.toFixed(2)}`;
  
  return userObj;
}

/**
 * @route   POST /auth/signup
 * @desc    Register a new demo user account
 * @access  Public (demo platform)
 * @body    {Object} credentials - Username and password
 * @body    {string} credentials.username - Desired username
 * @body    {string} credentials.password - Desired password
 * @returns {Object} Registration result with user data
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    const validationErrors = validateAuthInput(username, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
        timestamp: new Date().toISOString()
      });
    }
    
    // Create new user (password will be hashed by Mongoose pre-save hook)
    const newUser = new User({
      username: username.trim(),
      password: password,
      balance: 10000, // Starting demo balance
      role: 'player',
      language: 'en',
      isDemoAccount: true
    });
    
    // Save user to database
    await newUser.save();
    
    // Sanitize user data for response
    const userResponse = sanitizeUser(newUser);
    
    console.log(`New demo user registered: ${username}`);
    
    res.status(201).json({
      success: true,
      message: 'Demo account created successfully',
      timestamp: new Date().toISOString(),
      data: {
        user: userResponse,
        note: 'This is a demo account only. No real money is involved.'
      }
    });
    
  } catch (error) {
    console.error('Error during user registration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Authenticate existing demo user
 * @access  Public (demo platform)
 * @body    {Object} credentials - Username and password
 * @body    {string} credentials.username - Registered username
 * @body    {string} credentials.password - Account password
 * @returns {Object} Authentication result with user data
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    const validationErrors = validateAuthInput(username, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Find user by username (include password for comparison)
    const user = await User.findOne({ username: username.trim() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if this is a demo account (should always be true for this platform)
    if (!user.isDemoAccount) {
      console.warn(`Non-demo account login attempt: ${username}`);
    }
    
    // Verify password using bcrypt
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
        timestamp: new Date().toISOString()
      });
    }
    
    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();
    
    // Sanitize user data for response
    const userResponse = sanitizeUser(user);
    
    console.log(`User logged in: ${username}`);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      timestamp: new Date().toISOString(),
      data: {
        user: userResponse,
        note: 'This is a demo platform. No real money is involved.'
      }
    });
    
  } catch (error) {
    console.error('Error during user login:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /auth/check-username/:username
 * @desc    Check if a username is available
 * @access  Public (demo platform)
 * @param   {string} username - Username to check
 * @returns {Object} Availability result
 */
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if username exists
    const existingUser = await User.findOne({ username: username.trim() });
    
    res.status(200).json({
      success: true,
      message: existingUser ? 'Username is taken' : 'Username is available',
      timestamp: new Date().toISOString(),
      data: {
        username: username.trim(),
        available: !existingUser,
        suggestions: existingUser ? [
          `${username.trim()}_demo`,
          `${username.trim()}${Math.floor(Math.random() * 100)}`,
          `demo_${username.trim()}`
        ] : []
      }
    });
    
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check username availability',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /auth/demo-quick-login
 * @desc    Quick login for demo purposes (bypasses password)
 * @access  Public (demo platform)
 * @body    {string} username - Demo username to quick login
 * @returns {Object} Authentication result with user data
 */
router.post('/demo-quick-login', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Username is required for quick login',
        timestamp: new Date().toISOString()
      });
    }
    
    // Find user by username
    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Demo user not found',
        timestamp: new Date().toISOString(),
        suggestion: 'Use /auth/signup to create a new demo account'
      });
    }
    
    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();
    
    // Sanitize user data for response
    const userResponse = sanitizeUser(user);
    
    console.log(`Demo quick login: ${username}`);
    
    res.status(200).json({
      success: true,
      message: 'Demo quick login successful',
      timestamp: new Date().toISOString(),
      data: {
        user: userResponse,
        note: 'Quick login bypasses password for demo purposes only.',
        warning: 'This feature is for demonstration only. Real applications require password authentication.'
      }
    });
    
  } catch (error) {
    console.error('Error during demo quick login:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to quick login',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /auth/demo-accounts
 * @desc    Get list of demo accounts (for demo/testing purposes)
 * @access  Public (demo platform)
 * @query   {number} limit - Maximum accounts to return (default: 10)
 * @returns {Object} List of demo accounts (without passwords)
 */
router.get('/demo-accounts', async (req, res) => {
  try {
    // Parse limit parameter with bounds
    const limit = Math.min(
      parseInt(req.query.limit) || 10,
      50 // Maximum limit for demo platform
    );
    
    // Get demo accounts (excluding passwords)
    const demoAccounts = await User.find({ isDemoAccount: true })
      .select('-password -__v')
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Format accounts for response
    const formattedAccounts = demoAccounts.map(account => {
      const accountObj = account.toObject();
      accountObj.formattedBalance = `$${accountObj.balance.toFixed(2)}`;
      return accountObj;
    });
    
    res.status(200).json({
      success: true,
      message: 'Demo accounts retrieved successfully',
      timestamp: new Date().toISOString(),
      data: {
        accounts: formattedAccounts,
        total: formattedAccounts.length,
        note: 'These are demo accounts only. No real money is involved.'
      }
    });
    
  } catch (error) {
    console.error('Error retrieving demo accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve demo accounts',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /auth/reset-demo-balance/:userId
 * @desc    Reset a demo user's balance to starting amount
 * @access  Public (demo platform)
 * @param   {string} userId - User ID to reset
 * @returns {Object} Reset result
 */
router.post('/reset-demo-balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate user ID format
    if (!userId || userId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
        timestamp: new Date().toISOString()
      });
    }
    
    // Find and update user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Demo user not found',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user.isDemoAccount) {
      return res.status(400).json({
        success: false,
        message: 'Only demo accounts can be reset',
        timestamp: new Date().toISOString()
      });
    }
    
    // Reset balance to starting amount
    const oldBalance = user.balance;
    user.balance = 10000; // Reset to starting demo balance
    
    // Reset statistics for educational purposes
    user.statistics = {
      totalBets: 0,
      totalWagered: 0,
      totalProfit: 0,
      highestWin: 0
    };
    
    await user.save();
    
    // Sanitize user data for response
    const userResponse = sanitizeUser(user);
    
    console.log(`Demo balance reset for user ${user.username}: ${oldBalance} -> ${user.balance}`);
    
    res.status(200).json({
      success: true,
      message: 'Demo balance reset successfully',
      timestamp: new Date().toISOString(),
      data: {
        user: userResponse,
        oldBalance,
        newBalance: user.balance,
        note: 'Balance reset for demo/educational purposes only.'
      }
    });
    
  } catch (error) {
    console.error('Error resetting demo balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset demo balance',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export router
module.exports = router;
