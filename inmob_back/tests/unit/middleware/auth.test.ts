import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin, requireAdminOrEditor } from '../../../src/middleware/auth';
import { env } from '../../../src/config/env';
import User from '../../../src/models/User';

function mockRes() {
    const res = { statusCode: 0, body: undefined as any } as any;
    res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
    res.json = vi.fn((body: any) => { res.body = body; return res; });
    return res;
}

function mockReq(headers: Record<string, string> = {}, user?: any) {
    return { headers, user } as any;
}

const validUser = {
    email: 'mw-test@test.com',
    password: 'ValidPass#123',
    name: 'Middleware Test',
    role: 'admin' as const,
};

describe('authenticateToken middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
        const req = mockReq();
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Access token required');
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for a malformed token', async () => {
        const req = mockReq({ authorization: 'Bearer not-a-real-token' });
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Invalid token');
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 with a specific message for an expired token', async () => {
        const user = await User.create(validUser);
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            env.JWT_SECRET,
            { expiresIn: -10 } // already expired
        );

        const req = mockReq({ authorization: `Bearer ${token}` });
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Token expired');
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when the user no longer exists', async () => {
        const user = await User.create(validUser);
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            env.JWT_SECRET
        );
        await User.findByIdAndDelete(user._id);

        const req = mockReq({ authorization: `Bearer ${token}` });
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Invalid token or account deactivated');
    });

    it('returns 401 when the account is deactivated', async () => {
        const user = await User.create({ ...validUser, isActive: false });
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            env.JWT_SECRET
        );

        const req = mockReq({ authorization: `Bearer ${token}` });
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Invalid token or account deactivated');
    });

    it('attaches the user and calls next() for a valid token', async () => {
        const user = await User.create(validUser);
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            env.JWT_SECRET
        );

        const req = mockReq({ authorization: `Bearer ${token}` });
        const res = mockRes();
        const next = vi.fn();

        await authenticateToken(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe(validUser.email);
        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe('requireAdmin middleware', () => {
    it('returns 401 when no user is attached', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(mockReq({}, undefined), res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 for a non-admin user', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(mockReq({}, { role: 'editor' }), res, next);

        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('Admin access required');
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for an admin user', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(mockReq({}, { role: 'admin' }), res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe('requireAdminOrEditor middleware', () => {
    it('returns 401 when no user is attached', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdminOrEditor(mockReq({}, undefined), res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 for an unknown role', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdminOrEditor(mockReq({}, { role: 'viewer' }), res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for an editor user', () => {
        const res = mockRes();
        const next = vi.fn();

        requireAdminOrEditor(mockReq({}, { role: 'editor' }), res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});
