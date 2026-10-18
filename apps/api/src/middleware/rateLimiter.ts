import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10), // Limit each key/IP to 120 req/window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit per API Key if present, otherwise fallback to IP
    const apiKey = req.header('X-API-Key') || req.header('x-api-key');
    return apiKey ? `key:${apiKey}` : `ip:${req.ip || 'anonymous'}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again later.',
        details: {
          retryAfterSeconds: Math.ceil(
            parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000
          ),
        },
      },
    });
  },
});
