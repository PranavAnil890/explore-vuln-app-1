const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
  email: { type: String, required: true, trim: true },
  password: { type: String, required: true }, // bcrypt hash
  // FIX: role restricted to a fixed enum and can never be set to anything else,
  // regardless of what a client sends - this is the schema-level backstop for
  // the mass-assignment fix already applied in the route handlers.
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  bio: { type: String, maxlength: 500, default: '' }
});

module.exports = mongoose.model('User', UserSchema);
