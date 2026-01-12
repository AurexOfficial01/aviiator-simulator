// backend/game/index.js - Game Controller for Aviiaor Demo Platform
// Educational demo only - No real money transactions
// Main controller that manages all game types and exposes game APIs

const crashEngine = require('./engine');
const roundManager = require('./rounds');
const colorEngine = require('./colorEngine');

/**
 * Game Types supported by the demo platform
 */
const GAME_TYPES = {
  CRASH: 'crash',
  COLOR_TRADING: 'color_trading'
};

/**
 * Game Controller Configuration
 */
const GAME_CONFIG = {
  // Default settings for crash game
  CRASH: {
    LOSS_BIAS: 0.8, // 80% loss rounds
    MAX_WIN_MULTIPLIER: 100,
    AUTO_START: true
  },
  
  // Default settings for color trading
  COLOR_TRADING: {
    ROUND_DURATION: 10000, // 10 seconds
    LOSS_BIAS: 0.65, // 65% platform wins
    MAX_WIN_CAP: 10000
  },
  
  // Platform-wide settings
  PLATFORM: {
    DEMO_MODE: true,
    MAX_CONCURRENT_GAMES: 10,
    GAME_HISTORY_SIZE: 50
  }
};

/**
 * Game Status Tracking
 */
class GameController {
  constructor() {
    this.gameStatus = {
      crash: {
        isActive: false,
        currentRound: null,
        lastUpdated: null
      },
      colorTrading: {
        isActive: false,
        currentRound: null,
        lastUpdated: null
      }
    };
    
    // Game history for both game types
    this.gameHistory = {
      crash: [],
      colorTrading: []
    };
    
    // Statistics tracking
    this.statistics = {
      crash: {
        totalRounds: 0,
        totalBets: 0,
        totalWagered: 0,
        totalPayout: 0
      },
      colorTrading: {
        totalRounds: 0,
        totalBets: 0,
        totalWagered: 0,
        totalPayout: 0
      }
    };
    
    // Event callbacks
    this.eventCallbacks = {
      onCrashRoundStart: [],
      onCrashRoundCrash: [],
      onColorRoundStart: [],
      onColorRoundEnd: []
    };
    
    // Color trading round timer
    this.colorRoundTimer = null;
  }
  
  /**
   * Initialize the game controller
   * @param {Object} options - Configuration options
   */
  initialize(options = {}) {
    console.log('Initializing Game Controller...');
    
    // Merge configuration
    this.config = { ...GAME_CONFIG, ...options };
    
    // Initialize crash game round manager
    if (this.config.CRASH.AUTO_START) {
      this.startCrashGame({
        lossBias: this.config.CRASH.LOSS_BIAS,
        maxWinMultiplier: this.config.CRASH.MAX_WIN_MULTIPLIER
      });
    }
    
    // Register event listeners for crash game
    this.setupCrashGameListeners();
    
    console.log('Game Controller initialized');
    return this.getStatus();
  }
  
  // ============================================
  // CRASH GAME FUNCTIONS
  // ============================================
  
  /**
   * Start the crash game
   * @param {Object} options - Crash game options
   * @returns {Object} Game status
   */
  startCrashGame(options = {}) {
    try {
      const crashOptions = {
        lossBias: options.lossBias || this.config.CRASH.LOSS_BIAS,
        maxWinMultiplier: options.maxWinMultiplier || this.config.CRASH.MAX_WIN_MULTIPLIER,
        ...options
      };
      
      // Start round manager
      roundManager.startRoundManager(crashOptions);
      
      // Update game status
      this.gameStatus.crash.isActive = true;
      this.gameStatus.crash.lastUpdated = new Date().toISOString();
      
      console.log('Crash game started with options:', crashOptions);
      
      return {
        success: true,
        gameType: GAME_TYPES.CRASH,
        status: 'active',
        config: crashOptions
      };
    } catch (error) {
      console.error('Failed to start crash game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Stop the crash game
   * @returns {Object} Operation result
   */
  stopCrashGame() {
    try {
      roundManager.roundManager.stop();
      
      this.gameStatus.crash.isActive = false;
      this.gameStatus.crash.lastUpdated = new Date().toISOString();
      
      console.log('Crash game stopped');
      
      return {
        success: true,
        gameType: GAME_TYPES.CRASH,
        status: 'inactive'
      };
    } catch (error) {
      console.error('Failed to stop crash game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get current crash round data
   * @returns {Object} Current round information
   */
  getCurrentCrashRound() {
    try {
      const currentRound = roundManager.getCurrentRound();
      
      if (!currentRound) {
        return {
          success: false,
          error: 'No active crash round',
          gameType: GAME_TYPES.CRASH,
          isActive: false
        };
      }
      
      const roundData = currentRound.getPublicData();
      
      return {
        success: true,
        gameType: GAME_TYPES.CRASH,
        isActive: true,
        round: roundData
      };
    } catch (error) {
      console.error('Error getting current crash round:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get crash round history
   * @param {number} limit - Number of rounds to retrieve
   * @returns {Object} Round history
   */
  getCrashRoundHistory(limit = 10) {
    try {
      const history = roundManager.getRoundHistory(limit);
      
      return {
        success: true,
        gameType: GAME_TYPES.CRASH,
        history,
        totalRounds: history.length
      };
    } catch (error) {
      console.error('Error getting crash round history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Generate a crash multiplier for simulation/testing
   * @param {Object} options - Generation options
   * @returns {Object} Generated crash multiplier
   */
  generateCrashMultiplier(options = {}) {
    try {
      const result = crashEngine.generateCrashMultiplier(options);
      
      // Track in history
      this.addToHistory(GAME_TYPES.CRASH, {
        type: 'simulation',
        ...result
      });
      
      return {
        success: true,
        gameType: GAME_TYPES.CRASH,
        result
      };
    } catch (error) {
      console.error('Error generating crash multiplier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validate a crash game cashout
   * @param {Object} cashoutData - Cashout information
   * @returns {Object} Validation result
   */
  validateCrashCashout(cashoutData) {
    try {
      const { cashoutMultiplier, crashMultiplier, cashoutDelay = 100, gameDuration = 10000 } = cashoutData;
      
      const isValid = crashEngine.validateCashout(
        cashoutMultiplier,
        crashMultiplier,
        cashoutDelay,
        gameDuration
      );
      
      const profit = isValid ? 
        crashEngine.calculateProfit(cashoutData.betAmount || 0, cashoutMultiplier) : 
        -cashoutData.betAmount || 0;
      
      return {
        success: true,
        isValid,
        profit,
        message: isValid ? 'Cashout successful' : 'Cashout failed - crashed before cashout'
      };
    } catch (error) {
      console.error('Error validating crash cashout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Setup event listeners for crash game
   */
  setupCrashGameListeners() {
    // Round start event
    roundManager.onRoundStart((roundData) => {
      this.gameStatus.crash.currentRound = roundData;
      this.gameStatus.crash.lastUpdated = new Date().toISOString();
      
      // Add to history
      this.addToHistory(GAME_TYPES.CRASH, {
        type: 'round_start',
        ...roundData,
        timestamp: new Date().toISOString()
      });
      
      // Update statistics
      this.statistics.crash.totalRounds++;
      
      // Trigger callbacks
      this.triggerEvent('onCrashRoundStart', roundData);
    });
    
    // Round crash event
    roundManager.onRoundCrash((roundData) => {
      this.gameStatus.crash.currentRound = roundData;
      this.gameStatus.crash.lastUpdated = new Date().toISOString();
      
      // Add to history
      this.addToHistory(GAME_TYPES.CRASH, {
        type: 'round_crash',
        ...roundData,
        timestamp: new Date().toISOString()
      });
      
      // Trigger callbacks
      this.triggerEvent('onCrashRoundCrash', roundData);
    });
    
    // Round complete event
    roundManager.onRoundComplete((roundData) => {
      // Update statistics from round data
      if (roundData.statistics) {
        this.statistics.crash.totalBets += roundData.statistics.totalBets || 0;
        this.statistics.crash.totalWagered += roundData.statistics.totalWagered || 0;
        this.statistics.crash.totalPayout += roundData.statistics.totalPayout || 0;
      }
    });
  }
  
  // ============================================
  // COLOR TRADING GAME FUNCTIONS
  // ============================================
  
  /**
   * Start a color trading round
   * @param {Object} options - Round options
   * @returns {Object} Round information
   */
  startColorTradingRound(options = {}) {
    try {
      // Clear any existing timer
      if (this.colorRoundTimer) {
        clearTimeout(this.colorRoundTimer);
      }
      
      // Generate round ID
      const roundId = `color_round_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Generate winning color (server decides before round starts)
      const roundOptions = {
        roundId,
        lossBias: options.lossBias || this.config.COLOR_TRADING.LOSS_BIAS,
        ...options
      };
      
      const colorResult = colorEngine.generateWinningColor(roundOptions);
      
      // Generate color timeline for the round
      const roundDuration = options.roundDuration || this.config.COLOR_TRADING.ROUND_DURATION;
      const prng = colorEngine.createColorPRNG(colorResult.seed);
      const timeline = colorEngine.generateColorTimeline(
        colorResult.winningColor,
        roundDuration,
        prng
      );
      
      // Create round object
      const colorRound = {
        roundId,
        state: colorEngine.COLOR_GAME_STATES.RUNNING,
        winningColor: colorResult.winningColor,
        colorName: colorResult.colorName,
        hexColor: colorResult.hexColor,
        isWinRound: colorResult.isWinRound,
        isPlatformWin: colorResult.isPlatformWin,
        roundDuration,
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + roundDuration).toISOString(),
        timeline,
        bets: [],
        statistics: {
          totalBets: 0,
          totalWagered: 0,
          totalPayout: 0,
          redBets: 0,
          greenBets: 0,
          violetBets: 0
        }
      };
      
      // Update game status
      this.gameStatus.colorTrading.isActive = true;
      this.gameStatus.colorTrading.currentRound = colorRound;
      this.gameStatus.colorTrading.lastUpdated = new Date().toISOString();
      
      // Schedule round end
      this.colorRoundTimer = setTimeout(() => {
        this.endColorTradingRound(roundId);
      }, roundDuration);
      
      // Add to history
      this.addToHistory(GAME_TYPES.COLOR_TRADING, {
        type: 'round_start',
        ...colorRound,
        timestamp: new Date().toISOString()
      });
      
      // Update statistics
      this.statistics.colorTrading.totalRounds++;
      
      // Trigger event
      this.triggerEvent('onColorRoundStart', colorRound);
      
      console.log(`Color trading round started: ${roundId}, Winning color: ${colorResult.colorName}`);
      
      return {
        success: true,
        gameType: GAME_TYPES.COLOR_TRADING,
        round: colorRound
      };
    } catch (error) {
      console.error('Failed to start color trading round:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * End a color trading round
   * @param {string} roundId - Round identifier
   * @returns {Object} Round result
   */
  endColorTradingRound(roundId) {
    try {
      if (!this.gameStatus.colorTrading.currentRound || 
          this.gameStatus.colorTrading.currentRound.roundId !== roundId) {
        return {
          success: false,
          error: 'Round not found or not active'
        };
      }
      
      const currentRound = this.gameStatus.colorTrading.currentRound;
      
      // Update round state
      currentRound.state = colorEngine.COLOR_GAME_STATES.COMPLETED;
      currentRound.endedAt = new Date().toISOString();
      currentRound.completedAt = new Date().toISOString();
      
      // Calculate payouts for all bets
      this.processColorRoundPayouts(currentRound);
      
      // Update game status
      this.gameStatus.colorTrading.isActive = false;
      this.gameStatus.colorTrading.lastUpdated = new Date().toISOString();
      
      // Update statistics
      this.statistics.colorTrading.totalBets += currentRound.statistics.totalBets;
      this.statistics.colorTrading.totalWagered += currentRound.statistics.totalWagered;
      this.statistics.colorTrading.totalPayout += currentRound.statistics.totalPayout;
      
      // Add to history
      this.addToHistory(GAME_TYPES.COLOR_TRADING, {
        type: 'round_end',
        ...currentRound,
        timestamp: new Date().toISOString()
      });
      
      // Clear current round
      const completedRound = { ...currentRound };
      this.gameStatus.colorTrading.currentRound = null;
      
      // Trigger event
      this.triggerEvent('onColorRoundEnd', completedRound);
      
      console.log(`Color trading round ended: ${roundId}, Winning color: ${completedRound.colorName}`);
      
      return {
        success: true,
        gameType: GAME_TYPES.COLOR_TRADING,
        round: completedRound
      };
    } catch (error) {
      console.error('Failed to end color trading round:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process payouts for a completed color round
   * @param {Object} round - Round object
   */
  processColorRoundPayouts(round) {
    if (!round.bets || round.bets.length === 0) {
      return;
    }
    
    let totalPayout = 0;
    
    round.bets.forEach(bet => {
      const payoutResult = colorEngine.calculateColorPayout(
        { color: bet.color, amount: bet.amount },
        round.winningColor
      );
      
      bet.result = payoutResult.isWin ? 'win' : 'loss';
      bet.payout = payoutResult.payout;
      bet.profit = payoutResult.profit;
      bet.processedAt = new Date().toISOString();
      
      if (payoutResult.isWin) {
        totalPayout += payoutResult.payout;
      }
    });
    
    round.statistics.totalPayout = totalPayout;
  }
  
  /**
   * Place a bet on current color trading round
   * @param {Object} betData - Bet information
   * @returns {Object} Bet result
   */
  placeColorBet(betData) {
    try {
      // Validate current round
      if (!this.gameStatus.colorTrading.isActive || !this.gameStatus.colorTrading.currentRound) {
        return {
          success: false,
          error: 'No active color trading round'
        };
      }
      
      const currentRound = this.gameStatus.colorTrading.currentRound;
      
      // Validate bet
      const validation = colorEngine.validateColorBet(betData);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }
      
      // Create bet object
      const bet = {
        betId: `color_bet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ...validation.validatedBet,
        roundId: currentRound.roundId,
        placedAt: new Date().toISOString(),
        state: 'pending'
      };
      
      // Add bet to round
      currentRound.bets.push(bet);
      
      // Update round statistics
      currentRound.statistics.totalBets++;
      currentRound.statistics.totalWagered += bet.amount;
      
      // Update color-specific bet count
      if (currentRound.statistics[`${bet.color}Bets`] !== undefined) {
        currentRound.statistics[`${bet.color}Bets`]++;
      }
      
      // Update game status
      this.gameStatus.colorTrading.lastUpdated = new Date().toISOString();
      
      console.log(`Color bet placed: ${bet.betId}, ${bet.color} $${bet.amount}`);
      
      return {
        success: true,
        bet,
        roundId: currentRound.roundId,
        currentMultiplier: colorEngine.getPayoutMultiplier(bet.color)
      };
    } catch (error) {
      console.error('Error placing color bet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get current color trading round data
   * @returns {Object} Current round information
   */
  getCurrentColorRound() {
    try {
      if (!this.gameStatus.colorTrading.isActive || !this.gameStatus.colorTrading.currentRound) {
        return {
          success: false,
          error: 'No active color trading round',
          gameType: GAME_TYPES.COLOR_TRADING,
          isActive: false
        };
      }
      
      const round = this.gameStatus.colorTrading.currentRound;
      
      // Calculate time remaining
      const endsAt = new Date(round.endsAt);
      const timeRemaining = Math.max(0, endsAt - Date.now());
      
      return {
        success: true,
        gameType: GAME_TYPES.COLOR_TRADING,
        isActive: true,
        round: {
          ...round,
          timeRemaining
        }
      };
    } catch (error) {
      console.error('Error getting current color round:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Generate a color trading result for simulation/testing
   * @param {Object} options - Generation options
   * @returns {Object} Generated color result
   */
  generateColorResult(options = {}) {
    try {
      const result = colorEngine.generateWinningColor(options);
      
      // Track in history
      this.addToHistory(GAME_TYPES.COLOR_TRADING, {
        type: 'simulation',
        ...result
      });
      
      return {
        success: true,
        gameType: GAME_TYPES.COLOR_TRADING,
        result
      };
    } catch (error) {
      console.error('Error generating color result:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validate a color bet without placing it
   * @param {Object} betData - Bet information
   * @returns {Object} Validation result
   */
  validateColorBet(betData) {
    try {
      const validation = colorEngine.validateColorBet(betData);
      
      if (validation.isValid) {
        // Calculate potential payout for each possible outcome
        const colors = colorEngine.getAvailableColors();
        const potentialOutcomes = {};
        
        colors.forEach(color => {
          const payout = colorEngine.calculateColorPayout(
            validation.validatedBet,
            color
          );
          potentialOutcomes[color] = {
            profit: payout.profit,
            payout: payout.payout,
            wouldWin: payout.isWin
          };
        });
        
        return {
          success: true,
          isValid: true,
          bet: validation.validatedBet,
          potentialOutcomes,
          maxWinCap: colorEngine.COLOR_GAME_CONFIG.MECHANICS.MAX_WIN_CAP
        };
      } else {
        return {
          success: false,
          isValid: false,
          errors: validation.errors
        };
      }
    } catch (error) {
      console.error('Error validating color bet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  /**
   * Add game event to history
   * @param {string} gameType - Type of game
   * @param {Object} eventData - Event data
   */
  addToHistory(gameType, eventData) {
    if (!this.gameHistory[gameType]) {
      this.gameHistory[gameType] = [];
    }
    
    this.gameHistory[gameType].push(eventData);
    
    // Trim history if too large
    if (this.gameHistory[gameType].length > this.config.PLATFORM.GAME_HISTORY_SIZE) {
      this.gameHistory[gameType].shift();
    }
  }
  
  /**
   * Register event callback
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  on(eventName, callback) {
    if (this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName].push(callback);
    }
  }
  
  /**
   * Trigger event callbacks
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  triggerEvent(eventName, data) {
    if (this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} callback:`, error);
        }
      });
    }
  }
  
  /**
   * Get controller status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      platform: {
        demoMode: this.config.PLATFORM.DEMO_MODE,
        initialized: true,
        timestamp: new Date().toISOString()
      },
      games: {
        crash: {
          isActive: this.gameStatus.crash.isActive,
          totalRounds: this.statistics.crash.totalRounds,
          totalBets: this.statistics.crash.totalBets
        },
        colorTrading: {
          isActive: this.gameStatus.colorTrading.isActive,
          totalRounds: this.statistics.colorTrading.totalRounds,
          totalBets: this.statistics.colorTrading.totalBets
        }
      },
      statistics: this.statistics,
      historySizes: {
        crash: this.gameHistory.crash.length,
        colorTrading: this.gameHistory.colorTrading.length
      }
    };
  }
  
  /**
   * Get game engine information
   * @returns {Object} Engine information
   */
  getEngineInfo() {
    return {
      crashEngine: {
        version: '1.0',
        config: crashEngine.ENGINE_CONFIG
      },
      colorEngine: {
        version: '1.0',
        config: colorEngine.COLOR_GAME_CONFIG
      },
      roundManager: roundManager.getManagerStatus()
    };
  }
  
  /**
   * Stop all games and clean up
   */
  shutdown() {
    // Stop crash game
    if (this.gameStatus.crash.isActive) {
      this.stopCrashGame();
    }
    
    // Stop color trading round
    if (this.colorRoundTimer) {
      clearTimeout(this.colorRoundTimer);
      this.colorRoundTimer = null;
    }
    
    // Clear game status
    this.gameStatus.colorTrading.isActive = false;
    this.gameStatus.colorTrading.currentRound = null;
    
    console.log('Game controller shut down');
  }
}

// Create singleton instance
const gameController = new GameController();

// Export functions and controllers
module.exports = {
  // Game types
  GAME_TYPES,
  
  // Game controller instance
  gameController,
  GameController,
  
  // Crash game functions
  startCrashGame: (options) => gameController.startCrashGame(options),
  stopCrashGame: () => gameController.stopCrashGame(),
  getCurrentCrashRound: () => gameController.getCurrentCrashRound(),
  getCrashRoundHistory: (limit) => gameController.getCrashRoundHistory(limit),
  generateCrashMultiplier: (options) => gameController.generateCrashMultiplier(options),
  validateCrashCashout: (data) => gameController.validateCrashCashout(data),
  
  // Color trading game functions
  startColorTradingRound: (options) => gameController.startColorTradingRound(options),
  getCurrentColorRound: () => gameController.getCurrentColorRound(),
  placeColorBet: (betData) => gameController.placeColorBet(betData),
  generateColorResult: (options) => gameController.generateColorResult(options),
  validateColorBet: (betData) => gameController.validateColorBet(betData),
  
  // Controller management
  initializeGameController: (options) => gameController.initialize(options),
  getGameControllerStatus: () => gameController.getStatus(),
  getEngineInfo: () => gameController.getEngineInfo(),
  shutdownGameController: () => gameController.shutdown(),
  
  // Event registration
  onCrashRoundStart: (callback) => gameController.on('onCrashRoundStart', callback),
  onCrashRoundCrash: (callback) => gameController.on('onCrashRoundCrash', callback),
  onColorRoundStart: (callback) => gameController.on('onColorRoundStart', callback),
  onColorRoundEnd: (callback) => gameController.on('onColorRoundEnd', callback)
};
