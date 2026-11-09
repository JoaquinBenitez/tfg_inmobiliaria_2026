import jwt from 'jsonwebtoken';
import User from '../../src/models/User';
import { env } from '../../src/config/env';

interface UserOverrides {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    isActive?: boolean;
}

export async function createTestUser(overrides: UserOverrides = {}) {
    const defaults = {
        email: `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`,
        password: 'TestPass#123',
        name: 'Test User',
        role: 'editor' as const,
    };
    return User.create({ ...defaults, ...overrides });
}

export function signTokenFor(user: { _id: object; email: string; role: string }, expiresIn: string | number = '1h'): string {
    return jwt.sign(
        { userId: user._id.toString(), email: user.email, role: user.role },
        env.JWT_SECRET,
        typeof expiresIn === 'string' ? { expiresIn } : { expiresIn }
    );
}

export function authHeader(user: { _id: object; email: string; role: string }): { Authorization: string } {
    return { Authorization: `Bearer ${signTokenFor(user)}` };
}
