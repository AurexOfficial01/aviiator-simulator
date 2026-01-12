// backend/database/connect.js - MongoDB Connection Manager for Aviiaor Demo Platform
// Educational demo only - No real money transactions

const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Environment variables provide flexibility for demo/testing/production
 */
const DB_CONFIG = {
  // MongoDB URI from environment variable (required)
  URI: process.env.MONGODB_URI,
  
  // Connection options for better performance and reliability
  OPTIONS: {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 5, // Maintain at least 5 socket connections
    heartbeatFrequencyMS: 2000, // Send heartbeat every 2 seconds
  },
  
  // Database name for demo platform (extracted from URI or default)
  DATABASE_NAME: 'aviiator_demo_db',
  
  // Reconnection settings
  RECONNECT: {
    MAX_ATTEMPTS: 10,
    RETRY_DELAY: 2000, // 2 seconds between retries
  }
};

// Connection state tracking
let connectionState = {
  isConnected: false,
  lastConnectionAttempt: null,
  connectionAttempts: 0,
  connectionError: null
};

// MongoDB event listeners for monitoring
function setupMongoEventListeners() {
  mongoose.connection.on('connected', () => {
    console.log(`✅ MongoDB connected successfully to: ${mongoose.connection.host}`);
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    connectionState.isConnected = true;
    connectionState.lastConnectionAttempt = new Date();
    connectionState.connectionError = null;
    connectionState.connectionAttempts = 0;
  });

  mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB connection error:', error.message);
    
    connectionState.isConnected = false;
    connectionState.connectionError = error.message;
    connectionState.lastConnectionAttempt = new Date();
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
    
    connectionState.isConnected = false;
    connectionState.lastConnectionAttempt = new Date();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔁 MongoDB reconnected');
    
    connectionState.isConnected = true;
    connectionState.lastConnectionAttempt = new Date();
    connectionState.connectionError = null;
  });

  mongoose.connection.on('reconnectFailed', () => {
    console.error('❌ MongoDB reconnection failed');
    
    connectionState.isConnected = false;
    connectionState.lastConnectionAttempt = new Date();
  });
}

/**
 * Connect to MongoDB database
 * @returns {Promise<Object>} Connection result
 */
async function connectDB() {
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    console.log('📊 MongoDB already connected');
    return {
      success: true,
      message: 'Already connected to MongoDB',
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      state: connectionState
    };
  }

  // Validate MongoDB URI
  if (!DB_CONFIG.URI) {
    const errorMessage = 'MONGODB_URI environment variable is not set';
    console.error(`❌ ${errorMessage}`);
    
    // For demo purposes, provide helpful suggestion
    console.info('💡 For demo/testing, you can use MongoDB Atlas or local MongoDB');
    console.info('💡 Example local URI: mongodb://localhost:27017/aviiator_demo');
    console.info('💡 Set MONGODB_URI in your .env file');
    
    connectionState.connectionError = errorMessage;
    
    return {
      success: false,
      error: errorMessage,
      state: connectionState,
      suggestion: 'Set MONGODB_URI environment variable with your MongoDB connection string'
    };
  }

  // Parse database name from URI for logging
  try {
    const url = new URL(DB_CONFIG.URI);
    const dbName = url.pathname.substring(1); // Remove leading slash
    if (dbName) {
      DB_CONFIG.DATABASE_NAME = dbName;
    }
  } catch (error) {
    // If URI parsing fails, use default name
    console.warn('Could not parse database name from URI, using default');
  }

  console.log('🔗 Connecting to MongoDB...');
  console.log(`   Database: ${DB_CONFIG.DATABASE_NAME}`);
  
  // Track connection attempt
  connectionState.lastConnectionAttempt = new Date();
  connectionState.connectionAttempts++;

  try {
    // Setup event listeners before connecting
    setupMongoEventListeners();
    
    // Attempt connection
    await mongoose.connect(DB_CONFIG.URI, DB_CONFIG.OPTIONS);
    
    // Log successful connection details (without credentials)
    const connection = mongoose.connection;
    const host = connection.host || 'unknown';
    const port = connection.port || 'unknown';
    
    console.log(`✅ MongoDB connection established`);
    console.log(`   Host: ${host}:${port}`);
    console.log(`   Database: ${connection.name}`);
    console.log(`   Ready State: ${connection.readyState} (1 = connected)`);
    
    return {
      success: true,
      message: 'MongoDB connected successfully',
      database: connection.name,
      host: connection.host,
      port: connection.port,
      state: connectionState
    };
    
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    
    connectionState.connectionError = error.message;
    
    // Provide helpful error information for demo
    let userMessage = error.message;
    let suggestions = [];
    
    if (error.message.includes('ENOTFOUND')) {
      userMessage = 'Could not connect to MongoDB server. Host not found.';
      suggestions = [
        'Check if MongoDB is running',
        'Verify the hostname in MONGODB_URI',
        'For local MongoDB: Ensure mongod service is running'
      ];
    } else if (error.message.includes('Authentication failed')) {
      userMessage = 'MongoDB authentication failed';
      suggestions = [
        'Verify username and password in MONGODB_URI',
        'Check if the user has access to the database',
        'For MongoDB Atlas: Ensure IP is whitelisted'
      ];
    } else if (error.message.includes('timed out')) {
      userMessage = 'Connection to MongoDB timed out';
      suggestions = [
        'Check network connectivity',
        'Verify MongoDB server is accessible',
        'Increase serverSelectionTimeoutMS in connection options'
      ];
    }
    
    return {
      success: false,
      error: userMessage,
      originalError: error.message,
      suggestions,
      state: connectionState,
      retryInfo: {
        attempts: connectionState.connectionAttempts,
        maxAttempts: DB_CONFIG.RECONNECT.MAX_ATTEMPTS
      }
    };
  }
}

/**
 * Disconnect from MongoDB database
 * @returns {Promise<Object>} Disconnection result
 */
async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) { // 0 = disconnected
      await mongoose.disconnect();
      console.log('🔌 MongoDB disconnected successfully');
      
      connectionState.isConnected = false;
      connectionState.lastConnectionAttempt = new Date();
      
      return {
        success: true,
        message: 'MongoDB disconnected successfully',
        state: connectionState
      };
    }
    
    return {
      success: true,
      message: 'MongoDB already disconnected',
      state: connectionState
    };
    
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
    
    return {
      success: false,
      error: error.message,
      state: connectionState
    };
  }
}

/**
 * Get current connection status
 * @returns {Object} Connection status information
 */
function getConnectionStatus() {
  const readyStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  
  const readyState = mongoose.connection.readyState;
  
  return {
    readyState,
    readyStateText: readyStateMap[readyState] || 'unknown',
    isConnected: readyState === 1,
    database: mongoose.connection.name,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    models: Object.keys(mongoose.connection.models),
    state: {
      ...connectionState,
      mongoReadyState: readyState
    }
  };
}

/**
 * Health check for database connection
 * @returns {Promise<Object>} Health check result
 */
async function healthCheck() {
  try {
    const status = getConnectionStatus();
    
    if (!status.isConnected) {
      return {
        healthy: false,
        status: 'disconnected',
        timestamp: new Date().toISOString(),
        details: status
      };
    }
    
    // Perform a simple ping to verify connection is alive
    const adminDb = mongoose.connection.db.admin();
    const pingResult = await adminDb.ping();
    
    return {
      healthy: pingResult.ok === 1,
      status: pingResult.ok === 1 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      ping: pingResult,
      details: status
    };
    
  } catch (error) {
    return {
      healthy: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      details: getConnectionStatus()
    };
  }
}

/**
 * Graceful shutdown handler for database connections
 */
async function gracefulShutdown() {
  console.log('Received shutdown signal, closing MongoDB connection...');
  
  try {
    await disconnectDB();
    console.log('MongoDB connection closed gracefully');
  } catch (error) {
    console.error('Error during MongoDB graceful shutdown:', error);
  }
}

// Export connection functions
module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  healthCheck,
  gracefulShutdown,
  
  // Configuration for reference
  DB_CONFIG,
  
  // Connection state for monitoring
  connectionState
};
