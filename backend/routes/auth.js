const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET; // FIX: no weak fallback - fail loudly instead
const SALT_ROUNDS = 12;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Refusing to start with no/weak secret.');
}

// FIX: strict input validation - rejects non-string / malformed input, which is
// what stops NoSQL injection payloads like { "$ne": null } from ever reaching
// a Mongo query in the first place.
function isValidCredentials(username, password) {
  return (
    typeof username === 'string' &&
    typeof password === 'string' &&
    username.length >= 3 && username.length <= 50 &&
    password.length >= 8 && password.length <= 200
  );
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, bio } = req.body; // FIX: "role" intentionally
    // not destructured - even if a client sends it, it is never read or saved.

    if (!isValidCredentials(username, password)) {
      return res.status(400).json({ error: 'Invalid username or password format' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // FIX: bcrypt with a real per-user salt instead of unsalted MD5
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      username,
      email,
      password: passwordHash,
      role: 'user', // FIX: role is always hardcoded server-side, never client-controlled
      bio: typeof bio === 'string' ? bio.slice(0, 500) : ''
    });
    await user.save();

    // FIX: never return the password hash (or the full raw document) to the client
    res.status(201).json({
      message: 'Registered',
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err); // FIX: log full detail server-side only
    res.status(500).json({ error: 'Registration failed' }); // FIX: generic message to client
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // FIX: type/format validation before any DB query blocks NoSQL injection
    if (!isValidCredentials(username, password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = await User.findOne({ username }); // FIX: only ever a plain string now
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // FIX: token now expires, and payload carries only what's needed
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    // FIX: never send password hash back to the client
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
