require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Place = require('./models/Place');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Place.deleteMany({});

  const pass = await bcrypt.hash('password123', 12);

  const alice = await User.create({ username: 'alice', email: 'alice@example.com', password: pass, role: 'user' });
  const bob = await User.create({ username: 'bob', email: 'bob@example.com', password: pass, role: 'user' });
  const admin = await User.create({ username: 'admin', email: 'admin@example.com', password: pass, role: 'admin' });

  await Place.create({ title: 'Public Beach', description: 'A nice beach.', category: 'nature', ownerId: alice._id.toString(), isPrivate: false });
  await Place.create({ title: "Alice's Secret Spot", description: 'Shh.', category: 'hidden', ownerId: alice._id.toString(), isPrivate: true });
  await Place.create({ title: 'City Park', description: 'Open to everyone.', category: 'urban', ownerId: bob._id.toString(), isPrivate: false });

  console.log('Seeded users: alice/bob/admin (password: password123)');
  console.log('Seeded 3 places, one private (owned by alice)');
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
