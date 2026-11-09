import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import { createTestUser, authHeader } from '../helpers/auth';

const ADMIN_CREDS = { email: 'routes-admin@test.com', password: 'AdminPass#123', name: 'Admin', role: 'admin' as const };

describe('POST /api/auth/login', () => {
    it('returns 400 when email or password is missing', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'a@test.com' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email and password are required');
    });

    it('returns 401 for an unknown email', async () => {
        const res = await request(app).post('/api/auth/login').send({
            email: 'ghost@test.com',
            password: 'Whatever#123',
        });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns 401 for a wrong password', async () => {
        await createTestUser({ email: 'wrongpw@test.com', password: 'RightPass#123' });

        const res = await request(app).post('/api/auth/login').send({
            email: 'wrongpw@test.com',
            password: 'WrongPass#456',
        });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns 403 for a deactivated account', async () => {
        await createTestUser({ email: 'inactive@test.com', password: 'ValidPass#123', isActive: false });

        const res = await request(app).post('/api/auth/login').send({
            email: 'inactive@test.com',
            password: 'ValidPass#123',
        });

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('deactivated');
    });

    it('returns 200 with a token and user data (no password) for valid credentials', async () => {
        await createTestUser(ADMIN_CREDS);

        const res = await request(app).post('/api/auth/login').send({
            email: ADMIN_CREDS.email,
            password: ADMIN_CREDS.password,
        });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Login successful');
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.split('.')).toHaveLength(3); // JWT shape
        expect(res.body.user.email).toBe(ADMIN_CREDS.email);
        expect(res.body.user.role).toBe('admin');
        expect(res.body.user.password).toBeUndefined();
    });
});

describe('POST /api/auth/register', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'noauth@test.com', password: 'ValidPass#123', name: 'No Auth',
        });

        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const editor = await createTestUser({ role: 'editor' });

        const res = await request(app)
            .post('/api/auth/register')
            .set(authHeader(editor))
            .send({ email: 'x@test.com', password: 'ValidPass#123', name: 'X' });

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Admin access required');
    });

    it('returns 400 for a weak password', async () => {
        const admin = await createTestUser(ADMIN_CREDS);

        const res = await request(app)
            .post('/api/auth/register')
            .set(authHeader(admin))
            .send({ email: 'weak@test.com', password: 'weak', name: 'Weak' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Password does not meet security requirements');
        expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('returns 400 for an invalid role', async () => {
        const admin = await createTestUser(ADMIN_CREDS);

        const res = await request(app)
            .post('/api/auth/register')
            .set(authHeader(admin))
            .send({ email: 'badrole@test.com', password: 'ValidPass#123', name: 'Bad Role', role: 'superadmin' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Role must be either admin or editor');
    });

    it('returns 400 for a duplicate email', async () => {
        const admin = await createTestUser(ADMIN_CREDS);
        await createTestUser({ email: 'dupe@test.com' });

        const res = await request(app)
            .post('/api/auth/register')
            .set(authHeader(admin))
            .send({ email: 'dupe@test.com', password: 'ValidPass#123', name: 'Dupe' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('already exists');
    });

    it('returns 201 and creates an editor for valid input', async () => {
        const admin = await createTestUser(ADMIN_CREDS);

        const res = await request(app)
            .post('/api/auth/register')
            .set(authHeader(admin))
            .send({ email: 'neweditor@test.com', password: 'ValidPass#123', name: 'New Editor', role: 'editor' });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('User created successfully');
        expect(res.body.user.email).toBe('neweditor@test.com');
        expect(res.body.user.role).toBe('editor');
        expect(res.body.user.password).toBeUndefined();

        const stored = await User.findOne({ email: 'neweditor@test.com' }).select('+password');
        expect(stored).not.toBeNull();
        expect(stored!.password).not.toBe('ValidPass#123'); // hashed by pre-save hook
    });
});

describe('GET /api/auth/me', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed token', async () => {
        const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nonsense');
        expect(res.status).toBe(401);
    });

    it('returns the current user for a valid token', async () => {
        const user = await createTestUser({ name: 'Me Test' });

        const res = await request(app).get('/api/auth/me').set(authHeader(user));

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(user.email);
        expect(res.body.user.name).toBe('Me Test');
        expect(res.body.user.password).toBeUndefined();
    });
});

describe('PUT /api/auth/profile', () => {
    it('updates only the name', async () => {
        const user = await createTestUser({ name: 'Before' });

        const res = await request(app)
            .put('/api/auth/profile')
            .set(authHeader(user))
            .send({ name: 'After' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Profile updated successfully');
        expect(res.body.user.name).toBe('After');
    });

    it('rejects updates to fields other than name', async () => {
        const user = await createTestUser({ role: 'editor' });

        const res = await request(app)
            .put('/api/auth/profile')
            .set(authHeader(user))
            .send({ name: 'Hacker', role: 'admin' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid updates. Only name can be updated.');
    });
});

describe('PUT /api/auth/users/:id/password (admin reset)', () => {
    it('returns 403 for a non-admin caller', async () => {
        const editor = await createTestUser({ email: 'reset-editor@test.com', password: 'ValidPass#123', role: 'editor' });
        const target = await createTestUser({ email: 'reset-target@test.com', password: 'OldPass#12345' });

        const res = await request(app)
            .put(`/api/auth/users/${target._id}/password`)
            .set(authHeader(editor))
            .send({ password: 'NewPass#12345' });

        expect(res.status).toBe(403);
    });

    it('returns 400 for a weak password', async () => {
        const admin = await createTestUser(ADMIN_CREDS);
        const target = await createTestUser({ email: 'weak-target@test.com', password: 'OldPass#12345' });

        const res = await request(app)
            .put(`/api/auth/users/${target._id}/password`)
            .set(authHeader(admin))
            .send({ password: 'weak' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Password does not meet security requirements');
    });

    it('returns 404 for an unknown user', async () => {
        const admin = await createTestUser(ADMIN_CREDS);

        const res = await request(app)
            .put('/api/auth/users/000000000000000000000000/password')
            .set(authHeader(admin))
            .send({ password: 'NewPass#12345' });

        expect(res.status).toBe(404);
    });

    it('admin resets a password: old one fails, new one logs in', async () => {
        const admin = await createTestUser(ADMIN_CREDS);
        const target = await createTestUser({ email: 'reset-ok@test.com', password: 'OldPass#12345' });

        const res = await request(app)
            .put(`/api/auth/users/${target._id}/password`)
            .set(authHeader(admin))
            .send({ password: 'NewPass#67890' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Password updated successfully');

        const oldLogin = await request(app).post('/api/auth/login').send({
            email: 'reset-ok@test.com',
            password: 'OldPass#12345',
        });
        expect(oldLogin.status).toBe(401);

        const newLogin = await request(app).post('/api/auth/login').send({
            email: 'reset-ok@test.com',
            password: 'NewPass#67890',
        });
        expect(newLogin.status).toBe(200);
    });
});
