// backend/game/colorEngine.js - Color Trading Game Engine for Aviiaor Demo Platform
// Educational demo only - No real money transactions
// Timer-based color trading game with server-controlled outcomes

/**
 * Game Configuration Constants
 * All values are for demo/educational purposes only
 */
const COLOR_GAME_CONFIG = {
  // Available colors for betting
  COLORS: {
    RED: 'red',
    GREEN: 'green',
    VIOLET: 'violet'
  },
  
  // Color properties (display and payout)
  COLOR_PROPERTIES: {
    red: {
      name: 'Red',
      payoutMultiplier: 2.0,       // 1:1 payout (2x return)
      hexColor: '#EF4444',
      probability: 0.40           // 40% chance (weighted)
    },
    green: {
      name: 'Green',
      payoutMultiplier: 3.0,       // 2:1 payout (3x return)
      hexColor: '#10B981',
      probability: 0.35           // 35% chance (weighted)
    },
    violet: {
      name: 'Violet',
      payoutMultiplier: 14.0,      // 13:1 payout (14x return)
      hexColor: '#8B5CF6',
      probability: 0.25           // 25% chance (weighted)
    }
  },
  
  // Round timing configuration
  TIMING: {
    ROUND_DURATION: 10000,        // 10 seconds per round
    PRE_ROUND_DELAY: 3000,        // 3 seconds before round starts
    POST_ROUND_DELAY: 5000,       // 5 seconds between rounds
    COUNTDOWN_INTERVAL: 1000      // 1 second countdown updates
  },
  
  // Game mechanics configuration
  MECHANICS: {
    MIN_BET_AMOUNT: 1,            // Minimum bet (demo currency)
    MAX_BET_AMOUNT: 100000,       // Maximum bet (demo currency)
    LOSS_BIAS: 0.65,              // 65% chance platform wins (loss bias)
    MAX_WIN_CAP: 10000,           // Maximum win per round (demo currency)
    HOUSE_EDGE: 0.05,             // 5% house edge on all bets
    MAX_CONSECUTIVE_WINS: 3       // Maximum consecutive wins of same color
  },
  
  // Seed for deterministic random generation
  BASE_SEED: 0xCOLOR1234,
  
  // Maximum rounds to track for statistics
  MAX_HISTORY_ROUNDS: 100
};

/**
 * Game States for color trading rounds
 */
const COLOR_GAME_STATES = {
  IDLE: 'idle',           // Between rounds, no active game
  COUNTDOWN: 'countdown', // Pre-round countdown
  RUNNING: 'running',     // Round in progress, accepting bets
  REVEAL: 'reveal',       // Revealing winning color
  COMPLETED: 'completed'  // Round completed, processing results
};

/**
 * Deterministic pseudo-random number generator for color selection
 * Uses linear congruential generator for predictable results
 * @param {number} seed - Initial seed value
 * @returns {Function} PRNG function
 */
function createColorPRNG(seed) {
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
 * Hash function for string to number conversion
 * Used for seed generation from round IDs
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
 * Generate winning color for a round
 * Server decides outcome BEFORE round starts (deterministic)
 * @param {Object} options - Generation options
 * @param {string} options.roundId - Unique round identifier
 * @param {number} options.lossBias - Probability of platform win (0-1)
 * @param {number} options.customSeed - Optional custom seed
 * @param {Array} options.recentWinners - Recently winning colors for streak control
 * @returns {Object} Color selection result
 */
function generateWinningColor(options = {}) {
  const {
    roundId = Date.now().toString(),
    lossBias = COLOR_GAME_CONFIG.MECHANICS.LOSS_BIAS,
    customSeed = null,
    recentWinners = []
  } = options;
  
  // Validate input parameters
  if (lossBias < 0 || lossBias > 1) {
    throw new Error('lossBias must be between 0 and 1');
  }
  
  // Create deterministic seed from roundId
  const seedHash = hashString(roundId);
  const baseSeed = customSeed !== null ? customSeed : COLOR_GAME_CONFIG.BASE_SEED;
  const finalSeed = baseSeed ^ seedHash;
  
  // Initialize deterministic PRNG
  const prng = createColorPRNG(finalSeed);
  
  // Determine if this is a platform win (loss for players)
  const isPlatformWin = prng() < lossBias;
  
  let winningColor;
  let isWinRound = false;
  
  if (isPlatformWin) {
    // Platform wins - select losing color (least favorable for players)
    winningColor = selectLosingColor(prng, recentWinners);
    isWinRound = false;
  } else {
    // Players win - select winning color based on probabilities
    winningColor = selectWinningColor(prng, recentWinners);
    isWinRound = true;
  }
  
  // Get color properties
  const colorProps = COLOR_GAME_CONFIG.COLOR_PROPERTIES[winningColor];
  
  return {
    winningColor,
    colorName: colorProps.name,
    hexColor: colorProps.hexColor,
    payoutMultiplier: colorProps.payoutMultiplier,
    isWinRound,
    isPlatformWin,
    seed: finalSeed,
    generatedAt: new Date().toISOString(),
    metadata: {
      roundId,
      lossBias,
      probability: colorProps.probability
    }
  };
}

/**
 * Select winning color for player win rounds
 * Considers color probabilities and streak control
 * @param {Function} prng - Deterministic PRNG function
 * @param {Array} recentWinners - Recently winning colors
 * @returns {string} Selected winning color
 */
function selectWinningColor(prng, recentWinners = []) {
  const colors = Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES);
  
  // Check for consecutive win streaks
  if (recentWinners.length >= COLOR_GAME_CONFIG.MECHANICS.MAX_CONSECUTIVE_WINS) {
    const lastColor = recentWinners[recentWinners.length - 1];
    const streakCount = countConsecutiveWins(lastColor, recentWinners);
    
    // If same color has won too many times consecutively, force change
    if (streakCount >= COLOR_GAME_CONFIG.MECHANICS.MAX_CONSECUTIVE_WINS) {
      const otherColors = colors.filter(color => color !== lastColor);
      return selectColorByProbability(otherColors, prng);
    }
  }
  
  // Normal selection based on probabilities
  return selectColorByProbability(colors, prng);
}

/**
 * Select losing color for platform win rounds
 * Chooses color that maximizes platform profit
 * @param {Function} prng - Deterministic PRNG function
 * @param {Array} recentWinners - Recently winning colors
 * @returns {string} Selected losing color
 */
function selectLosingColor(prng, recentWinners = []) {
  const colors = Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES);
  
  // Analyze which color would be most profitable for players
  // Platform should select the color that players are NOT expecting
  
  // Simple strategy: avoid the color that hasn't won in a while
  if (recentWinners.length > 0) {
    const leastRecentColor = findLeastRecentColor(colors, recentWinners);
    if (leastRecentColor && prng() < 0.7) { // 70% chance to pick least recent
      return leastRecentColor;
    }
  }
  
  // Fallback: weighted selection favoring higher payout colors (for drama)
  const weightedColors = colors.flatMap(color => {
    const props = COLOR_GAME_CONFIG.COLOR_PROPERTIES[color];
    // Higher payout colors appear more often in losses (for excitement)
    const weight = Math.floor(props.payoutMultiplier * 10);
    return Array(weight).fill(color);
  });
  
  const randomIndex = Math.floor(prng() * weightedColors.length);
  return weightedColors[randomIndex];
}

/**
 * Select color based on configured probabilities
 * @param {Array} colors - Available colors
 * @param {Function} prng - Deterministic PRNG function
 * @returns {string} Selected color
 */
function selectColorByProbability(colors, prng) {
  const randomValue = prng();
  let cumulativeProbability = 0;
  
  for (const color of colors) {
    const props = COLOR_GAME_CONFIG.COLOR_PROPERTIES[color];
    cumulativeProbability += props.probability;
    
    if (randomValue <= cumulativeProbability) {
      return color;
    }
  }
  
  // Fallback to first color
  return colors[0];
}

/**
 * Count consecutive wins of a specific color
 * @param {string} color - Color to check
 * @param {Array} recentWinners - Array of recent winning colors
 * @returns {number} Consecutive win count
 */
function countConsecutiveWins(color, recentWinners) {
  let count = 0;
  
  // Count backwards from most recent
  for (let i = recentWinners.length - 1; i >= 0; i--) {
    if (recentWinners[i] === color) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Find the color that hasn't won in the longest time
 * @param {Array} colors - All available colors
 * @param {Array} recentWinners - Recent winning colors (most recent last)
 * @returns {string|null} Least recent winning color
 */
function findLeastRecentColor(colors, recentWinners) {
  if (recentWinners.length === 0) return null;
  
  const lastIndexMap = new Map();
  
  // Initialize with -1 (never appeared)
  colors.forEach(color => lastIndexMap.set(color, -1));
  
  // Record last appearance index for each color
  recentWinners.forEach((color, index) => {
    lastIndexMap.set(color, index);
  });
  
  // Find color with smallest last index (oldest appearance)
  let leastRecentColor = colors[0];
  let smallestIndex = lastIndexMap.get(leastRecentColor);
  
  for (const color of colors) {
    const lastIndex = lastIndexMap.get(color);
    if (lastIndex < smallestIndex) {
      smallestIndex = lastIndex;
      leastRecentColor = color;
    }
  }
  
  return leastRecentColor;
}

/**
 * Calculate potential payout for a bet
 * Applies house edge and win caps
 * @param {Object} betData - Bet information
 * @param {string} betData.color - Selected color
 * @param {number} betData.amount - Bet amount
 * @param {string} winningColor - Actual winning color
 * @returns {Object} Payout calculation result
 */
function calculateColorPayout(betData, winningColor) {
  const { color, amount } = betData;
  
  // Validate bet amount
  if (amount < COLOR_GAME_CONFIG.MECHANICS.MIN_BET_AMOUNT) {
    throw new Error(`Bet amount must be at least ${COLOR_GAME_CONFIG.MECHANICS.MIN_BET_AMOUNT}`);
  }
  
  if (amount > COLOR_GAME_CONFIG.MECHANICS.MAX_BET_AMOUNT) {
    throw new Error(`Bet amount cannot exceed ${COLOR_GAME_CONFIG.MECHANICS.MAX_BET_AMOUNT}`);
  }
  
  const isWin = color === winningColor;
  const colorProps = COLOR_GAME_CONFIG.COLOR_PROPERTIES[winningColor];
  
  let payout = 0;
  let profit = 0;
  
  if (isWin) {
    // Calculate base payout
    const basePayout = amount * colorProps.payoutMultiplier;
    
    // Apply house edge (deduct percentage)
    const houseEdgeDeduction = basePayout * COLOR_GAME_CONFIG.MECHANICS.HOUSE_EDGE;
    payout = basePayout - houseEdgeDeduction;
    
    // Apply win cap if necessary
    if (payout - amount > COLOR_GAME_CONFIG.MECHANICS.MAX_WIN_CAP) {
      payout = amount + COLOR_GAME_CONFIG.MECHANICS.MAX_WIN_CAP;
    }
    
    profit = payout - amount;
  } else {
    // Player loses entire bet
    payout = 0;
    profit = -amount;
  }
  
  // Round to 2 decimal places for demo display
  payout = parseFloat(payout.toFixed(2));
  profit = parseFloat(profit.toFixed(2));
  
  return {
    isWin,
    winningColor,
    betColor: color,
    betAmount: amount,
    payout,
    profit,
    payoutMultiplier: colorProps.payoutMultiplier,
    houseEdge: COLOR_GAME_CONFIG.MECHANICS.HOUSE_EDGE,
    isCapped: profit === COLOR_GAME_CONFIG.MECHANICS.MAX_WIN_CAP
  };
}

/**
 * Generate round timeline with color transitions
 * Creates visual progression for the round
 * @param {string} winningColor - Predetermined winning color
 * @param {number} roundDuration - Round duration in milliseconds
 * @param {Function} prng - Deterministic PRNG function
 * @returns {Array} Timeline of color displays
 */
function generateColorTimeline(winningColor, roundDuration, prng) {
  const timeline = [];
  const interval = 200; // Update every 200ms for smooth animation
  const totalSteps = Math.floor(roundDuration / interval);
  
  // Determine when to reveal winning color (last 20% of round)
  const revealStartStep = Math.floor(totalSteps * 0.8);
  
  const colors = Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES);
  
  for (let step = 0; step < totalSteps; step++) {
    const time = step * interval;
    let displayColor;
    
    if (step < revealStartStep) {
      // Pre-reveal: show random colors for excitement
      const randomIndex = Math.floor(prng() * colors.length);
      displayColor = colors[randomIndex];
    } else {
      // Reveal phase: gradually increase probability of showing winning color
      const revealProgress = (step - revealStartStep) / (totalSteps - revealStartStep);
      const winningProbability = 0.3 + (revealProgress * 0.7); // 30% → 100%
      
      displayColor = prng() < winningProbability ? winningColor : colors[Math.floor(prng() * colors.length)];
    }
    
    timeline.push({
      time,
      color: displayColor,
      colorName: COLOR_GAME_CONFIG.COLOR_PROPERTIES[displayColor].name,
      hexColor: COLOR_GAME_CONFIG.COLOR_PROPERTIES[displayColor].hexColor,
      isRevealPhase: step >= revealStartStep,
      revealProgress: step >= revealStartStep ? 
        (step - revealStartStep) / (totalSteps - revealStartStep) : 0
    });
  }
  
  // Ensure final step shows winning color
  if (timeline.length > 0) {
    timeline[timeline.length - 1].color = winningColor;
    timeline[timeline.length - 1].colorName = COLOR_GAME_CONFIG.COLOR_PROPERTIES[winningColor].name;
    timeline[timeline.length - 1].hexColor = COLOR_GAME_CONFIG.COLOR_PROPERTIES[winningColor].hexColor;
    timeline[timeline.length - 1].isRevealPhase = true;
    timeline[timeline.length - 1].revealProgress = 1;
  }
  
  return timeline;
}

/**
 * Simulate multiple rounds for statistical analysis
 * @param {number} roundCount - Number of rounds to simulate
 * @param {Object} options - Generation options
 * @returns {Object} Simulation results with statistics
 */
function simulateColorRounds(roundCount, options = {}) {
  if (roundCount < 1 || roundCount > 1000) {
    throw new Error('Round count must be between 1 and 1000');
  }
  
  const rounds = [];
  const recentWinners = [];
  
  for (let i = 0; i < roundCount; i++) {
    const roundId = `sim_${Date.now()}_${i}`;
    const roundOptions = {
      ...options,
      roundId,
      customSeed: COLOR_GAME_CONFIG.BASE_SEED + i,
      recentWinners: [...recentWinners]
    };
    
    const round = generateWinningColor(roundOptions);
    rounds.push(round);
    
    // Update recent winners (keep last 20)
    recentWinners.push(round.winningColor);
    if (recentWinners.length > 20) {
      recentWinners.shift();
    }
  }
  
  // Calculate statistics
  const stats = calculateColorStatistics(rounds);
  
  return {
    rounds,
    statistics: stats,
    simulationId: `color_sim_${Date.now()}`,
    simulatedAt: new Date().toISOString()
  };
}

/**
 * Calculate statistics from color rounds
 * @param {Array} rounds - Array of round results
 * @returns {Object} Statistical analysis
 */
function calculateColorStatistics(rounds) {
  if (!rounds.length) {
    return {
      totalRounds: 0,
      winRounds: 0,
      lossRounds: 0,
      colorDistribution: {},
      averagePayout: 0
    };
  }
  
  const colorCounts = {};
  let winRounds = 0;
  let lossRounds = 0;
  const payouts = [];
  
  // Initialize color counts
  Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES).forEach(color => {
    colorCounts[color] = 0;
  });
  
  // Count rounds
  rounds.forEach(round => {
    colorCounts[round.winningColor]++;
    
    if (round.isWinRound) {
      winRounds++;
      payouts.push(COLOR_GAME_CONFIG.COLOR_PROPERTIES[round.winningColor].payoutMultiplier);
    } else {
      lossRounds++;
      payouts.push(0);
    }
  });
  
  // Calculate color percentages
  const colorDistribution = {};
  Object.keys(colorCounts).forEach(color => {
    colorDistribution[color] = {
      count: colorCounts[color],
      percentage: (colorCounts[color] / rounds.length) * 100,
      expectedPercentage: COLOR_GAME_CONFIG.COLOR_PROPERTIES[color].probability * 100
    };
  });
  
  // Calculate average payout
  const averagePayout = payouts.length > 0 ? 
    payouts.reduce((sum, payout) => sum + payout, 0) / payouts.length : 0;
  
  // Calculate expected value
  let expectedValue = 0;
  Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES).forEach(color => {
    const props = COLOR_GAME_CONFIG.COLOR_PROPERTIES[color];
    const probability = props.probability;
    const payout = props.payoutMultiplier * (1 - COLOR_GAME_CONFIG.MECHANICS.HOUSE_EDGE);
    expectedValue += probability * payout;
  });
  
  // Calculate platform profitability
  const platformProfitability = 1 - expectedValue;
  
  return {
    totalRounds: rounds.length,
    winRounds,
    lossRounds,
    winRate: (winRounds / rounds.length) * 100,
    lossRate: (lossRounds / rounds.length) * 100,
    colorDistribution,
    averagePayout: parseFloat(averagePayout.toFixed(2)),
    expectedValue: parseFloat(expectedValue.toFixed(3)),
    platformProfitability: parseFloat((platformProfitability * 100).toFixed(2)),
    houseEdge: COLOR_GAME_CONFIG.MECHANICS.HOUSE_EDGE * 100
  };
}

/**
 * Validate a bet placement
 * @param {Object} betData - Bet information
 * @returns {Object} Validation result
 */
function validateColorBet(betData) {
  const { color, amount } = betData;
  const errors = [];
  
  // Validate color
  if (!COLOR_GAME_CONFIG.COLORS[color.toUpperCase()]) {
    errors.push(`Invalid color. Must be one of: ${Object.keys(COLOR_GAME_CONFIG.COLORS).join(', ')}`);
  }
  
  // Validate amount
  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Bet amount must be a valid number');
  } else {
    if (amount < COLOR_GAME_CONFIG.MECHANICS.MIN_BET_AMOUNT) {
      errors.push(`Minimum bet amount is ${COLOR_GAME_CONFIG.MECHANICS.MIN_BET_AMOUNT}`);
    }
    if (amount > COLOR_GAME_CONFIG.MECHANICS.MAX_BET_AMOUNT) {
      errors.push(`Maximum bet amount is ${COLOR_GAME_CONFIG.MECHANICS.MAX_BET_AMOUNT}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validatedBet: errors.length === 0 ? {
      color: color.toLowerCase(),
      amount: parseFloat(amount.toFixed(2)),
      placedAt: new Date().toISOString()
    } : null
  };
}

// Export engine functions and constants
module.exports = {
  // Constants
  COLOR_GAME_CONFIG,
  COLOR_GAME_STATES,
  
  // Core functions
  generateWinningColor,
  calculateColorPayout,
  generateColorTimeline,
  validateColorBet,
  
  // Simulation functions
  simulateColorRounds,
  calculateColorStatistics,
  
  // Helper functions
  createColorPRNG,
  hashString,
  
  // Convenience getters
  getAvailableColors: () => Object.keys(COLOR_GAME_CONFIG.COLOR_PROPERTIES),
  getColorProperties: (color) => COLOR_GAME_CONFIG.COLOR_PROPERTIES[color.toLowerCase()] || null,
  getPayoutMultiplier: (color) => {
    const props = COLOR_GAME_CONFIG.COLOR_PROPERTIES[color.toLowerCase()];
    return props ? props.payoutMultiplier : null;
  }
};
