import { describe, it, expect } from 'vitest';
import User from '../../../src/models/User';

describe('User model', () => {
    describe('password hashing (pre-save hook)', () => {
        it('hashes the password on save', async () => {
            const user = await User.create({
                email: 'hash-test@test.com',
                password: 'PlainPass#123',
                name: 'Hash Test',
            });

            expect(user.password).not.toBe('PlainPass#123');
            expect(user.password.length).toBeGreaterThan(20); // bcrypt hash length
            await expect(user.comparePassword('PlainPass#123')).resolves.toBe(true);
            await expect(user.comparePassword('WrongPass#123')).resolves.toBe(false);
        });

        it('does not rehash when password is unchanged', async () => {
            const user = await User.create({
                email: 'rehash-test@test.com',
                password: 'InitialPass#123',
                name: 'Rehash Test',
            });

            const hashBefore = user.password;
            user.name = 'Updated Name';
            await user.save();

            expect(user.password).toBe(hashBefore);
        });

        it('rehashes when the password changes', async () => {
            const user = await User.create({
                email: 'rehash2-test@test.com',
                password: 'InitialPass#123',
                name: 'Rehash Two',
            });

            const hashBefore = user.password;
            user.password = 'NewPassword#456';
            await user.save();

            expect(user.password).not.toBe(hashBefore);
            await expect(user.comparePassword('NewPassword#456')).resolves.toBe(true);
        });
    });

    describe('password field selection', () => {
        it('excludes the password from queries by default', async () => {
            await User.create({
                email: 'select-test@test.com',
                password: 'SelectPass#123',
                name: 'Select Test',
            });

            const user = await User.findOne({ email: 'select-test@test.com' });
            expect(user).not.toBeNull();
            expect(user!.password).toBeUndefined();
        });

        it('includes the password when explicitly requested', async () => {
            await User.create({
                email: 'select2-test@test.com',
                password: 'SelectPass#123',
                name: 'Select Two',
            });

            const user = await User.findOne({ email: 'select2-test@test.com' }).select('+password');
            expect(user).not.toBeNull();
            expect(user!.password).toBeDefined();
        });
    });

    describe('validation', () => {
        it('rejects invalid email addresses', async () => {
            await expect(User.create({
                email: 'not-an-email',
                password: 'ValidPass#123',
                name: 'Bad Email',
            })).rejects.toThrow(/valid email/);
        });

        it('accepts modern valid emails the legacy regex rejected', async () => {
            for (const email of ['user+tag@example.com', 'first-last@sub.domain.info', 'o@b.co']) {
                const user = await User.create({
                    email,
                    password: 'ValidPass#123',
                    name: 'Modern Email',
                });
                expect(user.email).toBe(email.toLowerCase());
            }
        });

        it('rejects duplicate emails', async () => {
            await User.create({
                email: 'dup-test@test.com',
                password: 'ValidPass#123',
                name: 'Dup One',
            });

            await expect(User.create({
                email: 'dup-test@test.com',
                password: 'ValidPass#456',
                name: 'Dup Two',
            })).rejects.toThrow();
        });

        it('rejects passwords shorter than 6 characters', async () => {
            await expect(User.create({
                email: 'shortpw-test@test.com',
                password: 'Ab#1',
                name: 'Short Pw',
            })).rejects.toThrow();
        });

        it('applies editor role and active status by default', async () => {
            const user = await User.create({
                email: 'defaults-test@test.com',
                password: 'ValidPass#123',
                name: 'Defaults Test',
            });

            expect(user.role).toBe('editor');
            expect(user.isActive).toBe(true);
        });
    });
});
