// models.js - MongoDB models for Aviiaor demo platform
// Educational demo only - No real money transactions

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema - Demo platform user (educational purposes only)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  
  // Password will be hashed before saving
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  
  // Demo balance (fake money for educational purposes only)
  balance: {
    type: Number,
    default: 10000, // Starting demo balance
    min: [0, 'Balance cannot be negative'],
    validate: {
      validator: Number.isFinite,
      message: 'Balance must be a valid number'
    }
  },
  
  // User role for demo platform access control
  role: {
    type: String,
    enum: ['player', 'demo-admin', 'system'],
    default: 'player'
  },
  
  // Language preference for demo platform interface
  language: {
    type: String,
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
    default: 'en'
  },
  
  // Account creation and activity timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  // Demo account flag to distinguish from real accounts
  isDemoAccount: {
    type: Boolean,
    default: true
  },
  
  // Statistics for educational purposes
  statistics: {
    totalBets: {
      type: Number,
      default: 0
    },
    totalWagered: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    highestWin: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt for demo platform (educational use only)
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords for authentication
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual property to display formatted balance
userSchema.virtual('formattedBalance').get(function() {
  return `$${this.balance.toFixed(2)}`;
});

// Round Schema - Represents a single demo game round
const roundSchema = new mongoose.Schema({
  roundId: {
    type: String,
    required: [true, 'Round ID is required'],
    unique: true,
    index: true
  },
  
  // Crash multiplier for the round (demo only - no real money)
  crashMultiplier: {
    type: Number,
    required: [true, 'Crash multiplier is required'],
    min: [1.0, 'Crash multiplier must be at least 1.0'],
    max: [1000, 'Crash multiplier cannot exceed 1000.0'],
    validate: {
      validator: Number.isFinite,
      message: 'Crash multiplier must be a valid number'
    }
  },
  
  // Type of round for demo analysis
  roundType: {
    type: String,
    enum: ['normal', 'bonus', 'training', 'system'],
    default: 'normal'
  },
  
  // When the round started
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  // When the round crashed (ended)
  crashedAt: {
    type: Date,
    default: null
  },
  
  // Duration of the round in milliseconds (calculated)
  duration: {
    type: Number,
    default: 0,
    min: [0, 'Duration cannot be negative']
  },
  
  // Round statistics for educational purposes
  statistics: {
    totalPlayers: {
      type: Number,
      default: 0
    },
    totalBets: {
      type: Number,
      default: 0
    },
    totalWagered: {
      type: Number,
      default: 0
    },
    totalPayout: {
      type: Number,
      default: 0
    },
    highestBet: {
      type: Number,
      default: 0
    },
    highestWin: {
      type: Number,
      default: 0
    }
  },
  
  // Flag to mark completed rounds
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate duration before saving if crashedAt is set
roundSchema.pre('save', function(next) {
  if (this.crashedAt && this.startedAt) {
    this.duration = this.crashedAt - this.startedAt;
  }
  next();
});

// Index for efficient querying of recent rounds
roundSchema.index({ createdAt: -1 });
roundSchema.index({ isCompleted: 1, createdAt: -1 });

// Bet Schema - Represents a demo bet placed by a user (educational only)
const betSchema = new mongoose.Schema({
  // Reference to User model
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  
  // Reference to Round model
  roundId: {
    type: String,
    required: [true, 'Round ID is required'],
    index: true
  },
  
  // Bet amount (demo money only)
  amount: {
    type: Number,
    required: [true, 'Bet amount is required'],
    min: [1, 'Minimum bet amount is 1'],
    max: [100000, 'Maximum bet amount is 100000'],
    validate: {
      validator: Number.isFinite,
      message: 'Bet amount must be a valid number'
    }
  },
  
  // Cashout multiplier (null if bet crashed)
  cashoutMultiplier: {
    type: Number,
    min: [1.0, 'Cashout multiplier must be at least 1.0'],
    max: [1000, 'Cashout multiplier cannot exceed 1000.0'],
    default: null
  },
  
  // Bet result (win/loss/crashed)
  result: {
    type: String,
    enum: ['win', 'loss', 'crashed', 'pending'],
    default: 'pending'
  },
  
  // Profit amount (can be negative for losses)
  profit: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isFinite,
      message: 'Profit must be a valid number'
    }
  },
  
  // When the bet was placed
  placedAt: {
    type: Date,
    default: Date.now
  },
  
  // When the bet was cashed out (null if crashed)
  cashedOutAt: {
    type: Date,
    default: null
  },
  
  // Demo platform metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    platform: String
  }
}, {
  timestamps: true
});

// Calculate profit based on result before saving
betSchema.pre('save', function(next) {
  if (this.result === 'win' && this.cashoutMultiplier) {
    this.profit = (this.amount * this.cashoutMultiplier) - this.amount;
  } else if (this.result === 'loss' || this.result === 'crashed') {
    this.profit = -this.amount;
  } else {
    this.profit = 0;
  }
  
  // Round profit to 2 decimal places for demo display
  if (this.profit !== 0) {
    this.profit = parseFloat(this.profit.toFixed(2));
  }
  
  next();
});

// Indexes for efficient querying
betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ roundId: 1, result: 1 });
betSchema.index({ result: 1, createdAt: -1 });

// Virtual property to display formatted profit
betSchema.virtual('formattedProfit').get(function() {
  const sign = this.profit >= 0 ? '+' : '';
  return `${sign}$${this.profit.toFixed(2)}`;
});

// Virtual property for bet status
betSchema.virtual('status').get(function() {
  if (this.result === 'pending') return 'Active';
  if (this.result === 'win') return 'Won';
  if (this.result === 'loss') return 'Lost';
  return 'Crashed';
});

// AdminSettings Schema - Demo platform configuration (educational only)
const adminSettingsSchema = new mongoose.Schema({
  // Loss bias for demo game algorithm (educational purposes)
  lossBias: {
    type: Number,
    default: 0.1,
    min: [0, 'Loss bias must be between 0 and 1'],
    max: [1, 'Loss bias must be between 0 and 1'],
    validate: {
      validator: Number.isFinite,
      message: 'Loss bias must be a valid number'
    }
  },
  
  // Maximum win multiplier for demo games
  maxWinMultiplier: {
    type: Number,
    default: 100,
    min: [1, 'Maximum win multiplier must be at least 1'],
    max: [10000, 'Maximum win multiplier cannot exceed 10000'],
    validate: {
      validator: Number.isFinite,
      message: 'Maximum win multiplier must be a valid number'
    }
  },
  
  // Demo deposit link (educational purposes only - no real money)
  depositLink: {
    type: String,
    default: '/demo/deposit',
    match: [/^\//, 'Deposit link must be a relative path starting with /']
  },
  
  // Demo withdrawal link (educational purposes only - no real money)
  withdrawLink: {
    type: String,
    default: '/demo/withdraw',
    match: [/^\//, 'Withdraw link must be a relative path starting with /']
  },
  
  // Platform-wide demo balance settings
  demoBalanceSettings: {
    startingBalance: {
      type: Number,
      default: 10000,
      min: [0, 'Starting balance must be positive']
    },
    maxBalance: {
      type: Number,
      default: 1000000,
      min: [0, 'Maximum balance must be positive']
    },
    resetInterval: {
      type: String,
      enum: ['never', 'daily', 'weekly', 'monthly'],
      default: 'never'
    }
  },
  
  // Last updated by (admin user)
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Settings version for tracking changes
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
adminSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Create Mongoose models
const User = mongoose.model('User', userSchema);
const Round = mongoose.model('Round', roundSchema);
const Bet = mongoose.model('Bet', betSchema);
const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);

// Export models
module.exports = {
  User,
  Round,
  Bet,
  AdminSettings
};
