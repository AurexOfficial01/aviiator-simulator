// server.js - Main entry point for Aviiaor demo platform backend
// Educational demo only - No real money transactions

const express = require('express');
const http = require('http');
const cors = require('cors');
const gameRoutes = require('./routes/game.routes');
const authRoutes = require('./routes/auth.routes');
const helmet = require('helmet');
const { connectDB } = require('./database/connect');
const morgan = require('morgan');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration for demo platform
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).send('aviiator running');
});

// API routes (to be implemented in separate modules)
app.use('/api/auth', require('./routes/auth.routes')); // Authentication routes
app.use('/game', gameRoutes);
app.use('/auth', authRoutes);

// WebSocket server setup (for future game implementation)
const initializeWebSocketServer = () => {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws',
    clientTracking: true,
  });

  // Store connected clients (demo users only)
  const demoClients = new Map();

  wss.on('connection', (ws, req) => {
    const clientId = req.headers['sec-websocket-key'] || Date.now().toString();
    demoClients.set(clientId, ws);
    
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_established',
      message: 'Connected to Aviiaor demo platform',
      clientId,
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received WebSocket message from ${clientId}:`, data.type);
        
        // Echo back for demo purposes (will be replaced with game logic)
        ws.send(JSON.stringify({
          type: 'demo_echo',
          originalMessage: data,
          receivedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    // Handle client disconnection
    ws.on('close', () => {
      demoClients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      demoClients.delete(clientId);
    });
  });

  // Broadcast function for future game events
  wss.broadcast = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  console.log('WebSocket server initialized (demo mode)');
  return wss;
};

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'This endpoint does not exist on the Aviiaor demo platform',
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;
  
  res.status(statusCode).json({
    error: 'Server error',
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Server startup function
const startServer = async () => {
  try {
    // Initialize WebSocket server
    const wss = initializeWebSocketServer();
    
    await connectDB();

    server.listen(PORT, () => {
      console.log(`
      🚀 Aviiaor Demo Platform Backend
      ---------------------------------
      📍 Environment: ${NODE_ENV}
      🌐 Server URL: http://localhost:${PORT}
      🔌 WebSocket: ws://localhost:${PORT}/ws
      🩺 Health check: http://localhost:${PORT}/health
      ---------------------------------
      ⚠️  REMINDER: This is a demo platform only
      ⚠️  No real money transactions allowed
      ---------------------------------
      `);
    });

    // Graceful shutdown handling
    const gracefulShutdown = () => {
      console.log('Received shutdown signal, closing server gracefully...');
      
      // Close WebSocket connections
      wss.clients.forEach((client) => {
        client.close();
      });
      
      server.close(() => {
        console.log('Server closed. Goodbye!');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled promise rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, server };
