const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// FIX: listing all users is now admin-only, and password hashes are excluded
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
});

// FIX: a user may fetch their own profile; only admins may fetch others.
// Password hash is never returned regardless.
router.get('/:id', requireAuth, async (req, res) => {
  if (req.params.id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// FIX: a user may only edit their own profile, "role" can never be set via
// this endpoint (explicit whitelist), and the response never includes the
// password hash.
router.put('/:id', requireAuth, async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { bio, email } = req.body;
  const update = {};
  if (bio !== undefined) update.bio = String(bio).slice(0, 500);
  if (email !== undefined) update.email = String(email).slice(0, 200);

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
  res.json(user);
});

module.exports = router;
