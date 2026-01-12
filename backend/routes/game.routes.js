// backend/routes/game.routes.js - Game API Routes for Aviiaor Demo Platform
// Educational demo only - No real money transactions

const express = require('express');
const router = express.Router();
const gameController = require('../game/index');

/**
 * @route   GET /game/status
 * @desc    Get overall game controller status
 * @access  Public (demo platform)
 * @returns {Object} Game controller status and statistics
 */
router.get('/status', (req, res) => {
  try {
    const status = gameController.getGameControllerStatus();
    
    res.status(200).json({
      success: true,
      message: 'Game controller status retrieved successfully',
      timestamp: new Date().toISOString(),
      data: status
    });
  } catch (error) {
    console.error('Error getting game status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve game status',
      error: error.message
    });
  }
});

/**
 * @route   GET /game/engine-info
 * @desc    Get game engine configuration and information
 * @access  Public (demo platform)
 * @returns {Object} Game engine configurations
 */
router.get('/engine-info', (req, res) => {
  try {
    const engineInfo = gameController.getEngineInfo();
    
    res.status(200).json({
      success: true,
      message: 'Game engine information retrieved successfully',
      timestamp: new Date().toISOString(),
      data: engineInfo
    });
  } catch (error) {
    console.error('Error getting engine info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve engine information',
      error: error.message
    });
  }
});

// ============================================
// CRASH GAME ROUTES
// ============================================

/**
 * @route   GET /game/crash/current
 * @desc    Get current crash game round information
 * @access  Public (demo platform)
 * @returns {Object} Current crash round data
 */
router.get('/crash/current', (req, res) => {
  try {
    const result = gameController.getCurrentCrashRound();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.isActive ? 'Active crash round retrieved' : 'No active crash round',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Failed to retrieve crash round',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting current crash round:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve current crash round',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /game/crash/history
 * @desc    Get crash game round history
 * @access  Public (demo platform)
 * @query   {number} limit - Number of rounds to retrieve (default: 10, max: 50)
 * @returns {Array} Historical crash round data
 */
router.get('/crash/history', (req, res) => {
  try {
    // Parse limit parameter with bounds
    const limit = Math.min(
      parseInt(req.query.limit) || 10,
      50 // Maximum limit for demo platform
    );
    
    const result = gameController.getCrashRoundHistory(limit);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Crash round history retrieved successfully',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Failed to retrieve crash history',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting crash history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve crash round history',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/crash/simulate
 * @desc    Simulate a crash multiplier generation (for demo/testing)
 * @access  Public (demo platform)
 * @body    {Object} options - Crash game generation options
 * @returns {Object} Generated crash multiplier result
 */
router.post('/crash/simulate', (req, res) => {
  try {
    const { options } = req.body;
    
    const result = gameController.generateCrashMultiplier(options || {});
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Crash multiplier generated successfully',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to generate crash multiplier',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error simulating crash multiplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate crash multiplier',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/crash/validate-cashout
 * @desc    Validate a crash game cashout scenario
 * @access  Public (demo platform)
 * @body    {Object} cashoutData - Cashout validation data
 * @returns {Object} Cashout validation result
 */
router.post('/crash/validate-cashout', (req, res) => {
  try {
    const cashoutData = req.body;
    
    // Validate required fields
    if (!cashoutData || typeof cashoutData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid cashout data provided',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = gameController.validateCrashCashout(cashoutData);
    
    res.status(200).json({
      success: true,
      message: 'Cashout validation completed',
      timestamp: new Date().toISOString(),
      data: result
    });
  } catch (error) {
    console.error('Error validating cashout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate cashout',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// COLOR TRADING GAME ROUTES
// ============================================

/**
 * @route   GET /game/color/current
 * @desc    Get current color trading round information
 * @access  Public (demo platform)
 * @returns {Object} Current color round data
 */
router.get('/color/current', (req, res) => {
  try {
    const result = gameController.getCurrentColorRound();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.isActive ? 'Active color round retrieved' : 'No active color round',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Failed to retrieve color round',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting current color round:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve current color round',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/color/start
 * @desc    Start a new color trading round
 * @access  Public (demo platform)
 * @body    {Object} options - Round configuration options
 * @returns {Object} Started round information
 */
router.post('/color/start', (req, res) => {
  try {
    const { options } = req.body;
    
    const result = gameController.startColorTradingRound(options || {});
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Color trading round started successfully',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to start color trading round',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error starting color round:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start color trading round',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/color/bet
 * @desc    Place a bet on current color trading round
 * @access  Public (demo platform)
 * @body    {Object} betData - Bet information (color, amount)
 * @returns {Object} Bet placement result
 */
router.post('/color/bet', (req, res) => {
  try {
    const betData = req.body;
    
    // Validate required fields
    if (!betData || typeof betData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid bet data provided',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!betData.color || !betData.amount) {
      return res.status(400).json({
        success: false,
        message: 'Bet data must include color and amount',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = gameController.placeColorBet(betData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Color bet placed successfully',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to place color bet',
        error: result.errors || result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error placing color bet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place color bet',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/color/validate-bet
 * @desc    Validate a color bet without placing it
 * @access  Public (demo platform)
 * @body    {Object} betData - Bet information to validate
 * @returns {Object} Bet validation result with potential outcomes
 */
router.post('/color/validate-bet', (req, res) => {
  try {
    const betData = req.body;
    
    // Validate required fields
    if (!betData || typeof betData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid bet data provided',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = gameController.validateColorBet(betData);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.isValid ? 'Bet is valid' : 'Bet is invalid',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to validate bet',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error validating color bet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate color bet',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/color/simulate
 * @desc    Simulate a color trading result (for demo/testing)
 * @access  Public (demo platform)
 * @body    {Object} options - Color game generation options
 * @returns {Object} Generated color result
 */
router.post('/color/simulate', (req, res) => {
  try {
    const { options } = req.body;
    
    const result = gameController.generateColorResult(options || {});
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Color result generated successfully',
        timestamp: new Date().toISOString(),
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to generate color result',
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error simulating color result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate color result',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /game/initialize
 * @desc    Initialize or reinitialize the game controller
 * @access  Public (demo platform)
 * @body    {Object} options - Game controller configuration options
 * @returns {Object} Initialization result
 */
router.post('/initialize', (req, res) => {
  try {
    const { options } = req.body;
    
    const result = gameController.initializeGameController(options || {});
    
    res.status(200).json({
      success: true,
      message: 'Game controller initialized successfully',
      timestamp: new Date().toISOString(),
      data: result
    });
  } catch (error) {
    console.error('Error initializing game controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize game controller',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export router
module.exports = router;
