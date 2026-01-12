// backend/game/rounds.js - Round Lifecycle Manager for Aviiaor Demo Platform
// Educational demo only - No real money transactions
// Manages round states and transitions: IDLE → RUNNING → CRASHED → NEXT

const { generateCrashMultiplier } = require('./engine');

/**
 * Round Lifecycle States
 * Each round transitions through these states in sequence
 */
const ROUND_STATES = {
  IDLE: 'idle',          // Round is queued but not active
  RUNNING: 'running',    // Round is in progress, multiplier increasing
  CRASHED: 'crashed',    // Round has ended (crashed)
  COMPLETED: 'completed' // Round data has been processed
};

/**
 * Round Lifecycle Configuration
 * Demo platform settings for round management
 */
const ROUND_CONFIG = {
  // Time between rounds in milliseconds
  INTERVAL_BETWEEN_ROUNDS: 5000, // 5 seconds
  
  // Minimum round duration in milliseconds
  MIN_ROUND_DURATION: 3000, // 3 seconds
  
  // Maximum round duration in milliseconds
  MAX_ROUND_DURATION: 60000, // 60 seconds
  
  // Default loss bias (80% loss, 20% win)
  DEFAULT_LOSS_BIAS: 0.8,
  
  // Default maximum win multiplier
  DEFAULT_MAX_WIN_MULTIPLIER: 100,
  
  // Maximum rounds to keep in memory for history
  MAX_HISTORY_ROUNDS: 100
};

/**
 * Round Object Structure
 * Represents a single game round in the demo platform
 */
class Round {
  constructor(roundId, options = {}) {
    this.roundId = roundId;
    
    // Game engine parameters
    this.lossBias = options.lossBias || ROUND_CONFIG.DEFAULT_LOSS_BIAS;
    this.maxWinMultiplier = options.maxWinMultiplier || ROUND_CONFIG.DEFAULT_MAX_WIN_MULTIPLIER;
    
    // Round state and timing
    this.state = ROUND_STATES.IDLE;
    this.startedAt = null;
    this.endedAt = null;
    this.crashMultiplier = null;
    this.roundType = null; // 'win' or 'loss'
    
    // Game progression data (populated when round starts)
    this.crashCurve = []; // Array of {time, multiplier} points
    this.gameDuration = 0; // Total duration in milliseconds
    
    // Generated at timestamps
    this.generatedAt = null;
    this.crashedAt = null;
    
    // Round statistics (populated during runtime)
    this.statistics = {
      totalPlayers: 0,
      totalBets: 0,
      totalWagered: 0,
      totalPayout: 0,
      highestBet: 0,
      highestWin: 0,
      playersCashedOut: 0,
      playersCrashed: 0
    };
    
    // Metadata
    this.metadata = {
      seed: null,
      isDemoRound: true,
      engineVersion: '1.0',
      ...options.metadata
    };
  }
  
  /**
   * Start the round - transitions from IDLE to RUNNING
   * @returns {boolean} Success status
   */
  start() {
    if (this.state !== ROUND_STATES.IDLE) {
      console.warn(`Round ${this.roundId} cannot start from state: ${this.state}`);
      return false;
    }
    
    try {
      // Generate crash multiplier using game engine
      const gameResult = generateCrashMultiplier({
        lossBias: this.lossBias,
        maxWinMultiplier: this.maxWinMultiplier,
        roundId: this.roundId
      });
      
      // Set round properties from game engine
      this.crashMultiplier = gameResult.crashMultiplier;
      this.roundType = gameResult.roundType;
      this.crashCurve = gameResult.crashCurve;
      this.gameDuration = gameResult.gameDuration;
      this.metadata.seed = gameResult.seed;
      this.generatedAt = gameResult.generatedAt;
      
      // Set round state and timing
      this.state = ROUND_STATES.RUNNING;
      this.startedAt = new Date();
      
      console.log(`Round ${this.roundId} started. Multiplier: ${this.crashMultiplier}x, Type: ${this.roundType}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to start round ${this.roundId}:`, error);
      return false;
    }
  }
  
  /**
   * End the round - transitions from RUNNING to CRASHED
   * @returns {boolean} Success status
   */
  end() {
    if (this.state !== ROUND_STATES.RUNNING) {
      console.warn(`Round ${this.roundId} cannot end from state: ${this.state}`);
      return false;
    }
    
    try {
      // Set round state and timing
      this.state = ROUND_STATES.CRASHED;
      this.endedAt = new Date();
      this.crashedAt = new Date().toISOString();
      
      // Calculate actual duration (might differ slightly from gameDuration)
      const actualDuration = this.endedAt - this.startedAt;
      
      console.log(`Round ${this.roundId} crashed at ${this.crashMultiplier}x. ` +
                 `Expected: ${this.gameDuration}ms, Actual: ${actualDuration}ms`);
      
      return true;
    } catch (error) {
      console.error(`Failed to end round ${this.roundId}:`, error);
      return false;
    }
  }
  
  /**
   * Complete the round - transitions from CRASHED to COMPLETED
   * Used for cleanup and statistics finalization
   * @returns {boolean} Success status
   */
  complete() {
    if (this.state !== ROUND_STATES.CRASHED) {
      console.warn(`Round ${this.roundId} cannot complete from state: ${this.state}`);
      return false;
    }
    
    try {
      this.state = ROUND_STATES.COMPLETED;
      
      // Finalize any pending calculations
      this.finalizeStatistics();
      
      console.log(`Round ${this.roundId} completed. Final stats: ` +
                 `${this.statistics.totalBets} bets, $${this.statistics.totalWagered} wagered`);
      
      return true;
    } catch (error) {
      console.error(`Failed to complete round ${this.roundId}:`, error);
      return false;
    }
  }
  
  /**
   * Get current multiplier based on elapsed time
   * @returns {number} Current multiplier or null if not running
   */
  getCurrentMultiplier() {
    if (this.state !== ROUND_STATES.RUNNING || !this.startedAt) {
      return null;
    }
    
    const elapsed = Date.now() - this.startedAt.getTime();
    
    // Find the closest point in the crash curve
    for (let i = 0; i < this.crashCurve.length; i++) {
      if (this.crashCurve[i].time >= elapsed) {
        return this.crashCurve[i].multiplier;
      }
    }
    
    // If we've passed all points, return the crash multiplier
    return this.crashMultiplier;
  }
  
  /**
   * Get time remaining until crash (estimate)
   * @returns {number} Milliseconds remaining or 0 if crashed/completed
   */
  getTimeRemaining() {
    if (this.state !== ROUND_STATES.RUNNING || !this.startedAt) {
      return 0;
    }
    
    const elapsed = Date.now() - this.startedAt.getTime();
    return Math.max(0, this.gameDuration - elapsed);
  }
  
  /**
   * Check if a cashout would succeed at the current multiplier
   * @param {number} cashoutMultiplier - Multiplier at which to cash out
   * @returns {boolean} True if cashout would succeed
   */
  wouldCashoutSucceed(cashoutMultiplier) {
    if (this.state !== ROUND_STATES.RUNNING) {
      return false;
    }
    
    // If multiplier is already above crash point, it's too late
    if (cashoutMultiplier >= this.crashMultiplier) {
      return false;
    }
    
    // Check if the current multiplier is above the cashout point
    const currentMultiplier = this.getCurrentMultiplier();
    return currentMultiplier >= cashoutMultiplier;
  }
  
  /**
   * Update round statistics (to be called when bets are placed)
   * @param {Object} betData - Bet information
   */
  updateStatistics(betData) {
    this.statistics.totalBets++;
    this.statistics.totalWagered += betData.amount;
    
    if (betData.amount > this.statistics.highestBet) {
      this.statistics.highestBet = betData.amount;
    }
  }
  
  /**
   * Finalize statistics when round completes
   */
  finalizeStatistics() {
    // Calculate win/loss ratios
    if (this.statistics.totalBets > 0) {
      this.statistics.winRate = (this.statistics.playersCashedOut / this.statistics.totalBets) * 100;
      this.statistics.crashRate = (this.statistics.playersCrashed / this.statistics.totalBets) * 100;
    }
    
    // Calculate house edge (demo only)
    if (this.statistics.totalWagered > 0) {
      const totalReturned = this.statistics.totalPayout;
      this.statistics.houseEdge = ((this.statistics.totalWagered - totalReturned) / this.statistics.totalWagered) * 100;
    }
  }
  
  /**
   * Get round data for API response
   * @returns {Object} Public round data
   */
  getPublicData() {
    return {
      roundId: this.roundId,
      state: this.state,
      crashMultiplier: this.crashMultiplier,
      roundType: this.roundType,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      gameDuration: this.gameDuration,
      currentMultiplier: this.getCurrentMultiplier(),
      timeRemaining: this.getTimeRemaining(),
      statistics: {
        totalBets: this.statistics.totalBets,
        totalWagered: this.statistics.totalWagered,
        totalPayout: this.statistics.totalPayout,
        playersCashedOut: this.statistics.playersCashedOut,
        playersCrashed: this.statistics.playersCrashed
      },
      metadata: {
        isDemo: this.metadata.isDemoRound,
        engineVersion: this.metadata.engineVersion
      }
    };
  }
}

/**
 * Round Manager Class
 * Manages multiple rounds and their lifecycle
 */
class RoundManager {
  constructor() {
    // Active and historical rounds
    this.rounds = new Map(); // roundId → Round object
    this.roundHistory = []; // Array of completed rounds
    
    // Current round tracking
    this.currentRoundId = null;
    this.nextRoundId = null;
    
    // Round generation sequence
    this.roundSequence = 0;
    
    // Timer for auto-round management
    this.roundTimer = null;
    
    // Callbacks for round events
    this.eventCallbacks = {
      onRoundStart: [],
      onRoundCrash: [],
      onRoundComplete: [],
      onNextRoundQueued: []
    };
  }
  
  /**
   * Initialize the round manager
   * @param {Object} options - Configuration options
   */
  initialize(options = {}) {
    console.log('Initializing Round Manager...');
    
    // Merge configuration
    this.config = { ...ROUND_CONFIG, ...options };
    
    // Generate initial round
    this.currentRoundId = this.generateRoundId();
    const currentRound = new Round(this.currentRoundId, options);
    this.rounds.set(this.currentRoundId, currentRound);
    
    // Queue next round
    this.queueNextRound();
    
    console.log(`Round Manager initialized. Current round: ${this.currentRoundId}`);
  }
  
  /**
   * Start the current round
   * @returns {boolean} Success status
   */
  startCurrentRound() {
    const round = this.getCurrentRound();
    if (!round) {
      console.error('No current round to start');
      return false;
    }
    
    const success = round.start();
    
    if (success) {
      // Notify listeners
      this.triggerEvent('onRoundStart', round.getPublicData());
      
      // Schedule crash based on game duration
      const crashDelay = Math.min(
        Math.max(round.gameDuration, this.config.MIN_ROUND_DURATION),
        this.config.MAX_ROUND_DURATION
      );
      
      setTimeout(() => {
        this.crashCurrentRound();
      }, crashDelay);
    }
    
    return success;
  }
  
  /**
   * Crash the current round
   * @returns {boolean} Success status
   */
  crashCurrentRound() {
    const round = this.getCurrentRound();
    if (!round) {
      console.error('No current round to crash');
      return false;
    }
    
    const success = round.end();
    
    if (success) {
      // Notify listeners
      this.triggerEvent('onRoundCrash', round.getPublicData());
      
      // Complete the round after a short delay
      setTimeout(() => {
        this.completeCurrentRound();
      }, 1000);
    }
    
    return success;
  }
  
  /**
   * Complete the current round
   * @returns {boolean} Success status
   */
  completeCurrentRound() {
    const round = this.getCurrentRound();
    if (!round) {
      console.error('No current round to complete');
      return false;
    }
    
    const success = round.complete();
    
    if (success) {
      // Add to history
      this.roundHistory.push(round.getPublicData());
      
      // Keep history size manageable
      if (this.roundHistory.length > this.config.MAX_HISTORY_ROUNDS) {
        this.roundHistory.shift();
      }
      
      // Notify listeners
      this.triggerEvent('onRoundComplete', round.getPublicData());
      
      // Remove from active rounds
      this.rounds.delete(this.currentRoundId);
      
      // Move to next round
      this.advanceToNextRound();
    }
    
    return success;
  }
  
  /**
   * Advance to the next queued round
   */
  advanceToNextRound() {
    if (!this.nextRoundId) {
      console.error('No next round queued');
      return;
    }
    
    // Update current round
    this.currentRoundId = this.nextRoundId;
    
    console.log(`Advanced to next round: ${this.currentRoundId}`);
    
    // Queue another next round
    this.queueNextRound();
    
    // Start the new current round after interval
    setTimeout(() => {
      this.startCurrentRound();
    }, this.config.INTERVAL_BETWEEN_ROUNDS);
  }
  
  /**
   * Queue the next round
   */
  queueNextRound() {
    this.nextRoundId = this.generateRoundId();
    const nextRound = new Round(this.nextRoundId);
    this.rounds.set(this.nextRoundId, nextRound);
    
    console.log(`Next round queued: ${this.nextRoundId}`);
    
    // Notify listeners
    this.triggerEvent('onNextRoundQueued', {
      roundId: this.nextRoundId,
      queuedAt: new Date().toISOString()
    });
  }
  
  /**
   * Generate a unique round ID
   * @returns {string} Unique round identifier
   */
  generateRoundId() {
    this.roundSequence++;
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `demo_round_${timestamp}_${this.roundSequence}_${random}`;
  }
  
  /**
   * Get the current active round
   * @returns {Round|null} Current round object
   */
  getCurrentRound() {
    return this.rounds.get(this.currentRoundId) || null;
  }
  
  /**
   * Get the next queued round
   * @returns {Round|null} Next round object
   */
  getNextRound() {
    return this.rounds.get(this.nextRoundId) || null;
  }
  
  /**
   * Get round by ID
   * @param {string} roundId - Round identifier
   * @returns {Round|null} Round object
   */
  getRound(roundId) {
    return this.rounds.get(roundId) || null;
  }
  
  /**
   * Get recent round history
   * @param {number} limit - Maximum number of rounds to return
   * @returns {Array} Array of round data
   */
  getRoundHistory(limit = 10) {
    return this.roundHistory.slice(-limit).reverse();
  }
  
  /**
   * Get all active rounds
   * @returns {Array} Array of round data
   */
  getActiveRounds() {
    const activeRounds = [];
    
    for (const [roundId, round] of this.rounds) {
      if (round.state !== ROUND_STATES.COMPLETED) {
        activeRounds.push(round.getPublicData());
      }
    }
    
    return activeRounds;
  }
  
  /**
   * Register event callback
   * @param {string} eventName - Event to listen for
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
   * Stop the round manager and clean up
   */
  stop() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    
    console.log('Round Manager stopped');
  }
  
  /**
   * Get manager status
   * @returns {Object} Manager status information
   */
  getStatus() {
    const currentRound = this.getCurrentRound();
    const nextRound = this.getNextRound();
    
    return {
      isRunning: !!currentRound,
      currentRoundId: this.currentRoundId,
      nextRoundId: this.nextRoundId,
      totalRoundsManaged: this.roundSequence,
      activeRoundsCount: this.rounds.size,
      historySize: this.roundHistory.length,
      currentRoundState: currentRound ? currentRound.state : null,
      nextRoundState: nextRound ? nextRound.state : null,
      config: this.config
    };
  }
}

// Create singleton instance
const roundManager = new RoundManager();

// Export functions and classes
module.exports = {
  Round,
  RoundManager,
  roundManager, // Singleton instance
  ROUND_STATES,
  ROUND_CONFIG,
  
  // Convenience functions
  startRoundManager: (options) => roundManager.initialize(options),
  getCurrentRound: () => roundManager.getCurrentRound(),
  getRoundHistory: (limit) => roundManager.getRoundHistory(limit),
  getManagerStatus: () => roundManager.getStatus(),
  
  // Event registration
  onRoundStart: (callback) => roundManager.on('onRoundStart', callback),
  onRoundCrash: (callback) => roundManager.on('onRoundCrash', callback),
  onRoundComplete: (callback) => roundManager.on('onRoundComplete', callback)
};
