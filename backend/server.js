require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes = require('./routes/auth');
const placeRoutes = require('./routes/places');
const userRoutes = require('./routes/users');

const app = express();

// FIX: fail fast on startup if required secrets are missing/weak, rather than
// silently falling back to a hardcoded default.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
}
if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI must be set.');
}

// FIX: explicit origin allowlist instead of reflecting any origin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// FIX: security headers (CSP, X-Frame-Options, HSTS, etc.)
app.use(helmet());

// FIX: request logging so connection/CORS issues are visible during dev/ops
app.use(morgan('dev'));

app.use(bodyParser.json({ limit: '1mb' }));

// FIX: strips any keys starting with "$" or containing "." from req.body/
// req.query/req.params - the core NoSQL-injection defense at the framework level.
app.use(mongoSanitize());

// FIX: rate limiting on auth endpoints specifically (most brute-force-sensitive)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' }
});
app.use('/api/auth', authLimiter);

// General API rate limit as a baseline
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

// FIX: uploaded files still served statically (needed for the app to work),
// but filenames are now server-generated random UUIDs (see routes/places.js)
// so they can't be guessed/targeted, and upload itself is validated.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check - lets you quickly confirm the server + DB are actually up
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/users', userRoutes);

// FIX: generic error responses to the client; full detail only logged server-side
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

// FIX: app is exported so it can be imported directly in tests (supertest)
// without needing a live listening port; the server only actually listens
// when this file is run directly (`node server.js` / `npm run dev`).
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('Mongo connection error', err.message);
      process.exit(1);
    });
} else {
  mongoose.connect(process.env.MONGO_URI).catch((err) => console.error('Mongo connection error', err.message));
}

module.exports = app;
