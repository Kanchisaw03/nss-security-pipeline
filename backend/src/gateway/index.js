import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

/**
 * API Gateway Layer
 * 
 * Central entry point enforcing platform-wide controls.
 * Implements defense-in-depth at the perimeter:
 * - Security headers
 * - Rate limiting
 * - Request logging
 * - Global error handling
 * - CORS protection
 */

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/gateway.log' })
  ]
});

// Rate limiting configuration
const createRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: 15 * 60
      });
    }
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    });
  });

  next();
};

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: 'Internal server error',
    ...(isDevelopment && { message: err.message, stack: err.stack })
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  logger.warn({
    message: 'Route not found',
    path: req.path,
    method: req.method
  });

  res.status(404).json({
    error: 'Resource not found',
    path: req.path
  });
};

// Initialize gateway
export const createGateway = () => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration - permissive in development
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175'
      ];

      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200
  }));

  // Body parsing - increased limit for large dataset uploads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Rate limiting
  app.use(createRateLimiter());

  // Request logging
  app.use(requestLogger);

  return {
    app,
    notFoundHandler,
    globalErrorHandler,
    logger
  };
};

export { logger };
