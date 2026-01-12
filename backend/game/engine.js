// backend/game/engine.js - Crash Game Engine for Aviiaor Demo Platform
// Educational demo only - No real money transactions
// Deterministic server-controlled crash multiplier generation

/**
 * Game Engine Configuration
 * All values are for demo/educational purposes only
 */
const ENGINE_CONFIG = {
  // Base seed for deterministic random number generation
  SEED: 0xABCD1234,
  
  // Minimum crash multiplier (game always starts above this)
  MIN_MULTIPLIER: 1.0,
  
  // Default loss bias if not provided (80% loss, 20% win)
  DEFAULT_LOSS_BIAS: 0.8,
  
  // Multiplier increment per "tick" (controls game speed)
  MULTIPLIER_INCREMENT: 0.01,
  
  // Maximum game duration in milliseconds (safety limit)
  MAX_GAME_DURATION: 60000, // 60 seconds
  
  // Loss round configurations
  LOSS_ROUND: {
    // Loss rounds crash between these multipliers
    MIN_CRASH: 1.1,
    MAX_CRASH: 2.0,
    // Probability distribution within loss range (normal distribution)
    DISTRIBUTION: {
      MEAN: 1.3,
      STD_DEV: 0.2
    }
  },
  
  // Win round configurations
  WIN_ROUND: {
    // Win rounds start crashing after this multiplier
    MIN_WIN: 2.0,
    // Maximum crash point is controlled by admin settings
    DEFAULT_MAX_WIN: 100.0
  }
};

/**
 * Deterministic pseudo-random number generator (PRNG)
 * Uses a linear congruential generator for predictable results
 * @param {number} seed - Initial seed value
 * @returns {Function} PRNG function
 */
function createDeterministicPRNG(seed) {
  const MODULUS = 2 ** 31;
  const MULTIPLIER = 1103515245;
  const INCREMENT = 12345;
  
  let currentSeed = seed;
  
  return function() {
    currentSeed = (MULTIPLIER * currentSeed + INCREMENT) % MODULUS;
    return currentSeed / MODULUS; // Returns value between 0 and 1
  };
}

/**
 * Generate a crash multiplier based on game parameters
 * @param {Object} options - Game generation options
 * @param {number} options.lossBias - Probability of loss round (0-1), default 0.8
 * @param {number} options.maxWinMultiplier - Maximum allowed win multiplier
 * @param {string} options.roundId - Unique round identifier for seed generation
 * @param {number} options.customSeed - Optional custom seed for deterministic testing
 * @returns {Object} Game result with multiplier and metadata
 */
function generateCrashMultiplier(options = {}) {
  const {
    lossBias = ENGINE_CONFIG.DEFAULT_LOSS_BIAS,
    maxWinMultiplier = ENGINE_CONFIG.WIN_ROUND.DEFAULT_MAX_WIN,
    roundId = Date.now().toString(),
    customSeed = null
  } = options;
  
  // Validate input parameters
  if (lossBias < 0 || lossBias > 1) {
    throw new Error('lossBias must be between 0 and 1');
  }
  
  if (maxWinMultiplier < ENGINE_CONFIG.MIN_MULTIPLIER) {
    throw new Error(`maxWinMultiplier must be at least ${ENGINE_CONFIG.MIN_MULTIPLIER}`);
  }
  
  // Create deterministic seed from roundId and base seed
  const seedHash = hashString(roundId);
  const baseSeed = customSeed !== null ? customSeed : ENGINE_CONFIG.SEED;
  const finalSeed = baseSeed ^ seedHash;
  
  // Initialize deterministic PRNG
  const prng = createDeterministicPRNG(finalSeed);
  
  // Determine if this is a loss or win round based on loss bias
  const isLossRound = prng() < lossBias;
  
  let crashMultiplier;
  let roundType;
  
  if (isLossRound) {
    // Generate loss round - crashes early
    roundType = 'loss';
    crashMultiplier = generateLossMultiplier(prng);
  } else {
    // Generate win round - crashes later, capped by maxWinMultiplier
    roundType = 'win';
    crashMultiplier = generateWinMultiplier(prng, maxWinMultiplier);
  }
  
  // Calculate game duration based on multiplier
  const gameDuration = calculateGameDuration(crashMultiplier);
  
  // Generate crash curve (multiplier progression over time)
  const crashCurve = generateCrashCurve(crashMultiplier, gameDuration, prng);
  
  return {
    crashMultiplier: parseFloat(crashMultiplier.toFixed(4)),
    roundType,
    isLossRound,
    gameDuration,
    crashCurve,
    seed: finalSeed,
    generatedAt: new Date().toISOString(),
    metadata: {
      lossBias,
      maxWinMultiplier,
      roundId
    }
  };
}

/**
 * Generate multiplier for loss rounds (crashes early)
 * Uses normal distribution favoring lower multipliers
 * @param {Function} prng - Deterministic PRNG function
 * @returns {number} Crash multiplier
 */
function generateLossMultiplier(prng) {
  // Generate normally distributed value for loss rounds
  const normalValue = generateNormalDistribution(prng);
  
  // Scale and shift to fit loss range with bias toward lower values
  let multiplier = ENGINE_CONFIG.LOSS_ROUND.DISTRIBUTION.MEAN + 
                   normalValue * ENGINE_CONFIG.LOSS_ROUND.DISTRIBUTION.STD_DEV;
  
  // Clamp to loss round bounds
  multiplier = Math.max(multiplier, ENGINE_CONFIG.LOSS_ROUND.MIN_CRASH);
  multiplier = Math.min(multiplier, ENGINE_CONFIG.LOSS_ROUND.MAX_CRASH);
  
  return multiplier;
}

/**
 * Generate multiplier for win rounds (crashes later)
 * @param {Function} prng - Deterministic PRNG function
 * @param {number} maxWinMultiplier - Maximum allowed win multiplier
 * @returns {number} Crash multiplier
 */
function generateWinMultiplier(prng, maxWinMultiplier) {
  // Start from minimum win threshold
  const minWin = ENGINE_CONFIG.WIN_ROUND.MIN_WIN;
  
  // Generate random multiplier between minWin and maxWinMultiplier
  // Using exponential distribution to favor lower win multipliers
  const randomValue = prng();
  const exponentialFactor = Math.log(maxWinMultiplier / minWin);
  const multiplier = minWin * Math.exp(randomValue * exponentialFactor);
  
  // Ensure we don't exceed the maximum
  return Math.min(multiplier, maxWinMultiplier);
}

/**
 * Generate crash curve (multiplier progression over time)
 * @param {number} crashMultiplier - Final crash multiplier
 * @param {number} duration - Total game duration in ms
 * @param {Function} prng - Deterministic PRNG function
 * @returns {Array} Array of [time, multiplier] points
 */
function generateCrashCurve(crashMultiplier, duration, prng) {
  const curve = [];
  const points = 100; // Number of points in the curve
  
  // Base growth follows exponential curve
  const growthFactor = Math.log(crashMultiplier) / (points - 1);
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const time = (duration * progress);
    
    // Exponential base growth
    let multiplier = Math.exp(growthFactor * i);
    
    // Add small random fluctuations for realism (deterministic)
    if (i > 10 && i < points - 10) { // Don't fluctuate at start or end
      const fluctuation = (prng() - 0.5) * 0.02 * multiplier;
      multiplier += fluctuation;
    }
    
    // Ensure multiplier doesn't decrease (except for tiny fluctuations)
    if (i > 0) {
      multiplier = Math.max(multiplier, curve[i - 1].multiplier * 0.999);
    }
    
    // Cap at crash multiplier
    multiplier = Math.min(multiplier, crashMultiplier);
    
    curve.push({
      time: Math.round(time),
      multiplier: parseFloat(multiplier.toFixed(4))
    });
  }
  
  // Ensure last point is exactly the crash multiplier
  if (curve.length > 0) {
    curve[curve.length - 1].multiplier = crashMultiplier;
  }
  
  return curve;
}

/**
 * Calculate game duration based on crash multiplier
 * @param {number} multiplier - Crash multiplier
 * @returns {number} Duration in milliseconds
 */
function calculateGameDuration(multiplier) {
  // Base duration increases with multiplier, but not linearly
  const baseDuration = Math.log(multiplier) * 5000; // ~5 seconds per order of magnitude
  
  // Add some random variation (deterministic seed already applied)
  const duration = Math.min(
    baseDuration * (0.8 + Math.log(multiplier + 1) * 0.2),
    ENGINE_CONFIG.MAX_GAME_DURATION
  );
  
  return Math.round(duration);
}

/**
 * Generate normally distributed random number using Box-Muller transform
 * @param {Function} prng - Deterministic PRNG function
 * @returns {number} Normally distributed value (mean 0, std dev 1)
 */
function generateNormalDistribution(prng) {
  // Box-Muller transform requires two uniform random numbers
  const u1 = 1 - prng(); // Avoid 0
  const u2 = prng();
  
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  return z0;
}

/**
 * Simple hash function to convert string to number
 * Used for seed generation from roundId
 * @param {string} str - Input string
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Validate if a cashout is successful at a given multiplier
 * @param {number} cashoutMultiplier - Multiplier at which user tries to cash out
 * @param {number} crashMultiplier - Actual crash multiplier for the round
 * @param {number} cashoutDelay - Simulated network/processing delay in ms
 * @param {number} gameDuration - Total game duration in ms
 * @returns {boolean} True if cashout succeeds, false if it crashes before
 */
function validateCashout(cashoutMultiplier, crashMultiplier, cashoutDelay = 100, gameDuration = 10000) {
  // Cashout multiplier must be less than crash multiplier to succeed
  if (cashoutMultiplier >= crashMultiplier) {
    return false;
  }
  
  // Calculate time at which user would reach cashout multiplier
  const cashoutTime = (cashoutMultiplier / crashMultiplier) * gameDuration;
  
  // Account for network/processing delay
  const effectiveCashoutTime = cashoutTime + cashoutDelay;
  
  // Calculate crash time
  const crashTime = gameDuration;
  
  // Cashout succeeds if it happens before crash
  return effectiveCashoutTime < crashTime;
}

/**
 * Calculate profit from a bet
 * @param {number} betAmount - Amount bet
 * @param {number} cashoutMultiplier - Multiplier at which user cashed out
 * @returns {number} Profit amount (can be negative)
 */
function calculateProfit(betAmount, cashoutMultiplier) {
  const payout = betAmount * cashoutMultiplier;
  const profit = payout - betAmount;
  return parseFloat(profit.toFixed(2));
}

/**
 * Generate a batch of rounds for statistical analysis
 * @param {number} count - Number of rounds to generate
 * @param {Object} options - Game generation options
 * @returns {Array} Array of round results
 */
function generateRoundBatch(count, options = {}) {
  const rounds = [];
  
  for (let i = 0; i < count; i++) {
    const roundId = `batch_${Date.now()}_${i}`;
    const roundOptions = {
      ...options,
      roundId,
      customSeed: ENGINE_CONFIG.SEED + i // Ensure determinism across batch
    };
    
    const round = generateCrashMultiplier(roundOptions);
    rounds.push(round);
  }
  
  return rounds;
}

/**
 * Analyze statistics from generated rounds
 * @param {Array} rounds - Array of round results
 * @returns {Object} Statistical analysis
 */
function analyzeRoundStatistics(rounds) {
  if (!rounds.length) {
    return {
      totalRounds: 0,
      lossRounds: 0,
      winRounds: 0,
      averageMultiplier: 0,
      medianMultiplier: 0,
      highestMultiplier: 0,
      lowestMultiplier: 0
    };
  }
  
  const multipliers = rounds.map(r => r.crashMultiplier);
  const lossRounds = rounds.filter(r => r.isLossRound);
  const winRounds = rounds.filter(r => !r.isLossRound);
  
  multipliers.sort((a, b) => a - b);
  
  return {
    totalRounds: rounds.length,
    lossRounds: lossRounds.length,
    winRounds: winRounds.length,
    lossPercentage: (lossRounds.length / rounds.length) * 100,
    winPercentage: (winRounds.length / rounds.length) * 100,
    averageMultiplier: multipliers.reduce((a, b) => a + b, 0) / multipliers.length,
    medianMultiplier: multipliers[Math.floor(multipliers.length / 2)],
    highestMultiplier: Math.max(...multipliers),
    lowestMultiplier: Math.min(...multipliers),
    averageLossMultiplier: lossRounds.length ? 
      lossRounds.reduce((sum, r) => sum + r.crashMultiplier, 0) / lossRounds.length : 0,
    averageWinMultiplier: winRounds.length ? 
      winRounds.reduce((sum, r) => sum + r.crashMultiplier, 0) / winRounds.length : 0
  };
}

// Export engine functions
module.exports = {
  generateCrashMultiplier,
  generateRoundBatch,
  analyzeRoundStatistics,
  validateCashout,
  calculateProfit,
  ENGINE_CONFIG
};
