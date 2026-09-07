/**
 * These tests prove the FIXED behavior. Run against a test database.
 * Set MONGO_URI (e.g. to mongodb://localhost:27017/exploreAppTest) and
 * JWT_SECRET in your environment before running `npm test`.
 */
const request = require('supertest');
const mongoose = require('mongoose');

let app;

beforeAll(async () => {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/exploreAppTest';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_at_least_32_characters_long';
  process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
  app = require('../server'); // NOTE: server.js currently calls app.listen() directly;
  // for a cleaner test setup, export the app separately from the listener.
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Auth fixes', () => {
  test('NoSQL injection payload is rejected, not treated as a query operator', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400); // rejected by input validation, never reaches the DB query
  });

  test('registering with a role field is ignored - user is never admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser1', email: 'a@example.com', password: 'password123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  test('login response never includes the password hash', async () => {
    await request(app).post('/api/auth/register')
      .send({ username: 'testuser2', email: 'b@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'testuser2', password: 'password123' });
    expect(res.body.user.password).toBeUndefined();
  });
});

describe('Places access control fixes', () => {
  let tokenA, tokenB, placeId;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ username: 'ownerA', email: 'oa@example.com', password: 'password123' });
    await request(app).post('/api/auth/register').send({ username: 'ownerB', email: 'ob@example.com', password: 'password123' });
    const loginA = await request(app).post('/api/auth/login').send({ username: 'ownerA', password: 'password123' });
    const loginB = await request(app).post('/api/auth/login').send({ username: 'ownerB', password: 'password123' });
    tokenA = loginA.body.token;
    tokenB = loginB.body.token;

    const createRes = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A place', description: 'desc', isPrivate: true });
    placeId = createRes.body._id;
  });

  test('another user cannot delete a place they do not own', async () => {
    const res = await request(app)
      .delete(`/api/places/${placeId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  test('another user cannot view a private place they do not own', async () => {
    const res = await request(app)
      .get(`/api/places/${placeId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('stored description is sanitized of script content', async () => {
    const res = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'XSS test', description: '<img src=x onerror=alert(1)>' });
    expect(res.body.description).not.toContain('onerror');
    expect(res.body.description).not.toContain('<img');
  });
});

describe('Users access control fixes', () => {
  test('a regular user cannot list all users', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'ownerA', password: 'password123' });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});
