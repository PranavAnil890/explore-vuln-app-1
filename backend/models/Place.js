const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema({
  title: String,
  description: String, // VULN: rendered unescaped on frontend -> stored XSS
  category: String,
  imageUrl: String,
  ownerId: String,       // used (incorrectly) for access control -> IDOR
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Place', PlaceSchema);
