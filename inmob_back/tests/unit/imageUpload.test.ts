import { describe, it, expect } from 'vitest';
import {
    extractPublicId,
    extractLocalPath,
    extractStorageId,
} from '../../src/utils/imageUpload';

describe('extractPublicId (Cloudinary URLs)', () => {
    it('extracts the public ID from a versioned URL', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/properties/abc/image.jpg';
        expect(extractPublicId(url)).toBe('properties/abc/image');
    });

    it('extracts the public ID from an unversioned URL', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/properties/abc/image.png';
        expect(extractPublicId(url)).toBe('properties/abc/image');
    });

    it('returns null for a non-Cloudinary URL', () => {
        expect(extractPublicId('http://localhost:3000/uploads/properties/abc/image.jpg')).toBeNull();
        expect(extractPublicId('http://example.com/some/other/path.jpg')).toBeNull();
    });
});

describe('extractLocalPath (local storage URLs)', () => {
    it('extracts the relative path from a local uploads URL', () => {
        const url = 'http://localhost:3000/uploads/properties/abc/image.jpg';
        expect(extractLocalPath(url)).toBe('properties/abc/image.jpg');
    });

    it('extracts from a relative URL', () => {
        expect(extractLocalPath('/uploads/hero/img.png')).toBe('hero/img.png');
    });

    it('returns null when there is no /uploads/ segment', () => {
        expect(extractLocalPath('http://example.com/nope/image.jpg')).toBeNull();
    });
});

describe('extractStorageId (unified resolver)', () => {
    it('resolves Cloudinary URLs to public IDs', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/properties/x/img.jpg';
        expect(extractStorageId(url)).toBe('properties/x/img');
    });

    it('resolves local URLs to relative paths', () => {
        const url = 'http://localhost:3000/uploads/properties/abc/image.jpg';
        expect(extractStorageId(url)).toBe('properties/abc/image.jpg');
    });

    it('returns null for unknown URL formats', () => {
        expect(extractStorageId('http://example.com/some/other/path.jpg')).toBeNull();
    });
});
