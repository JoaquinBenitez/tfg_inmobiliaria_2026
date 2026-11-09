import { describe, it, expect } from 'vitest';
import {
    validatePasswordStrength,
    getPasswordStrengthDescription,
    generateSecurePassword,
} from '../../src/utils/passwordValidation';

describe('validatePasswordStrength', () => {
    it('rejects passwords shorter than 8 characters', () => {
        const result = validatePasswordStrength('Ab#1x');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('rejects passwords without an uppercase letter', () => {
        const result = validatePasswordStrength('lowercase1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects passwords without a lowercase letter', () => {
        const result = validatePasswordStrength('UPPERCASE1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects passwords without a number', () => {
        const result = validatePasswordStrength('NoDigitsHere!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects passwords without a special character', () => {
        const result = validatePasswordStrength('NoSpecial123A');
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('special character'))).toBe(true);
    });

    it('rejects common passwords regardless of other rules', () => {
        const result = validatePasswordStrength('Password123');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common and easily guessable');
        expect(result.score).toBe(0);
    });

    it('rejects passwords with more than 2 consecutive identical characters', () => {
        const result = validatePasswordStrength('Aaabbb12!Xy');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password should not contain more than 2 consecutive identical characters');
    });

    it('rejects passwords containing keyboard patterns', () => {
        const result = validatePasswordStrength('Qwerty123!x');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password should not contain common keyboard patterns');
    });

    it('accepts a strong password with score capped at 5', () => {
        const result = validatePasswordStrength('Tr0ub4dor&3xYq');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.score).toBe(5);
    });

    it('caps the score at 5 even for minimal valid passwords', () => {
        const result = validatePasswordStrength('Abcdef1!');
        expect(result.isValid).toBe(true);
        expect(result.score).toBe(5); // base 5 rules passed; cap applies
    });
});

describe('getPasswordStrengthDescription', () => {
    it.each([
        [0, 'Very Weak'],
        [1, 'Very Weak'],
        [2, 'Weak'],
        [3, 'Fair'],
        [4, 'Good'],
        [5, 'Strong'],
        [99, 'Unknown'],
    ])('maps score %i to %s', (score, expected) => {
        expect(getPasswordStrengthDescription(score)).toBe(expected);
    });
});

describe('generateSecurePassword', () => {
    it('generates 16-character passwords that pass validation', () => {
        for (let i = 0; i < 50; i++) {
            const password = generateSecurePassword();
            expect(password).toHaveLength(16);
            const result = validatePasswordStrength(password);
            expect(result.isValid).toBe(true);
        }
    });
});
