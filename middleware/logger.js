import util from 'util';

// ANSI color codes for terminal formatting
const COLORS = {
  reset: '\x1b[0m',
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  dim: '\x1b[2m',      // Dimmed text
};

// Keys to redact from logs for security
const SENSITIVE_KEYS = ['password', 'token', 'apikey', 'authorization', 'secret'];

const sanitize = (data) => {
  if (!data || typeof data !== 'object') return data;
  const cleaned = { ...data };

  for (const key of Object.keys(cleaned)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      cleaned[key] = '***REDACTED***';
    } else if (typeof cleaned[key] === 'object') {
      cleaned[key] = sanitize(cleaned[key]);
    }
  }
  return cleaned;
};

export const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

function log(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const color = COLORS[level] || COLORS.reset;
  const tag = `[${timestamp}] [${level.toUpperCase()}]`;

  console.log(`${color}${tag}${COLORS.reset} ${message}`);

  if (meta) {
    const formattedMeta = util.inspect(sanitize(meta), {
      depth: 4,
      colors: true,
      compact: false,
    });
    console.log(`${COLORS.dim}${formattedMeta}${COLORS.reset}`);
  }
}

// Custom Express Middleware
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    const logPayload = {
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      method: req.method,
      url: req.originalUrl,
      query: Object.keys(req.query).length ? req.query : undefined,
      body: Object.keys(req.body || {}).length ? req.body : undefined,
      userAgent: req.get('user-agent'),
      responseTime: `${duration}ms`,
    };

    logger[level](`${req.method} ${req.originalUrl} ${statusCode} - ${duration}ms`, logPayload);
  });

  next();
};