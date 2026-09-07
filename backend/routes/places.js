const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const router = express.Router();
const Place = require('../models/Place');

const JWT_SECRET = process.env.JWT_SECRET;
const DOMPurify = createDOMPurify(new JSDOM('').window);

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const token = header.split(' ')[1];
    // FIX: jwt.verify already rejects expired tokens now that login issues
    // tokens with expiresIn - an expired/tampered token throws here.
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// FIX: allowlist file types, cap size, and generate a random filename instead
// of trusting the client-supplied original name (blocks path traversal /
// overwrite and arbitrary file type upload).
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  }
});

function sanitize(html) {
  // FIX: strip all HTML/script content from user-submitted text - stored XSS fix
  return DOMPurify.sanitize(html || '', { ALLOWED_TAGS: [] });
}

// LIST - explore feed
router.get('/', async (req, res) => {
  // FIX: private places never returned in the public feed
  const places = await Place.find({ isPrivate: { $ne: true } });
  res.json(places);
});

// GET single place by id
router.get('/:id', async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Not found' });

    if (place.isPrivate) {
      // FIX: enforce visibility - only the owner (or an authenticated admin)
      // may view a private place, closing the IDOR.
      const header = req.headers.authorization;
      let requester = null;
      if (header) {
        try { requester = jwt.verify(header.split(' ')[1], JWT_SECRET); } catch (e) { /* ignore */ }
      }
      const isOwner = requester && requester.id === place.ownerId;
      const isAdmin = requester && requester.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: 'Not found' }); // 404, not 403 - avoid confirming existence
      }
    }

    res.json(place);
  } catch (err) {
    res.status(400).json({ error: 'Invalid id' });
  }
});

// CREATE
router.post('/', requireAuth, async (req, res) => {
  const { title, description, category, imageUrl, isPrivate } = req.body;

  if (typeof title !== 'string' || !title.trim() || title.length > 100) {
    return res.status(400).json({ error: 'Invalid title' });
  }

  const place = new Place({
    title: title.trim(),
    description: sanitize(description), // FIX: sanitized before storage
    category: typeof category === 'string' ? category.slice(0, 50) : '',
    imageUrl: typeof imageUrl === 'string' ? imageUrl.slice(0, 500) : '',
    isPrivate: Boolean(isPrivate),
    ownerId: req.user.id
  });
  await place.save();
  res.status(201).json(place);
});

// UPDATE
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Not found' });

    // FIX: ownership check - only the owner or an admin may edit
    if (place.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // FIX: explicit field whitelist instead of trusting the whole request body
    const { title, description, category, imageUrl, isPrivate } = req.body;
    if (title !== undefined) place.title = String(title).slice(0, 100);
    if (description !== undefined) place.description = sanitize(description);
    if (category !== undefined) place.category = String(category).slice(0, 50);
    if (imageUrl !== undefined) place.imageUrl = String(imageUrl).slice(0, 500);
    if (isPrivate !== undefined) place.isPrivate = Boolean(isPrivate);

    await place.save();
    res.json(place);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

// DELETE
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Not found' });

    // FIX: ownership check - only the owner or an admin may delete
    if (place.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await place.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

// IMAGE UPLOAD
router.post('/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    // FIX: multer errors (bad type, oversized file, malformed field) are now
    // caught here instead of crashing the process - fixes the DoS (CVE-class
    // issue) as well as being the general error-handling fix.
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // FIX: server-generated filename only, never the client-supplied name
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
