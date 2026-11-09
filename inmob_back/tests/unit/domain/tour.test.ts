import { describe, it, expect } from 'vitest';
import {
    EMPTY_TOUR,
    defaultCoverage,
    isFullSphereAspect,
    toTourDomain,
    validateTourUpdate
} from '../../../src/domain/tour';

const scene = (id: string) => ({
    id,
    name: `Escena ${id}`,
    hotspots: [],
    image: {
        url: `http://localhost:3000/uploads/tours/p/${id}.webp`,
        publicId: `tours/p/${id}.webp`,
        posterUrl: `http://localhost:3000/uploads/tours/p/${id}-poster.webp`,
        posterPublicId: `tours/p/${id}-poster.webp`,
        width: 4096,
        height: 2048
    },
    initialView: { pitch: 0, yaw: 0, fov: 75 }
});

describe('isFullSphereAspect', () => {
    it('accepts ~2:1 as full sphere', () => {
        expect(isFullSphereAspect(4096, 2048)).toBe(true);
        expect(isFullSphereAspect(8192, 4096)).toBe(true);
        expect(isFullSphereAspect(4000, 2000)).toBe(true);
    });
    it('rejects partial aspects', () => {
        expect(isFullSphereAspect(8000, 1500)).toBe(false);
        expect(isFullSphereAspect(2048, 1024 * 1.5)).toBe(false);
    });
});

describe('defaultCoverage', () => {
    it('derives yaw span from aspect, clamped to [90, 360]', () => {
        expect(defaultCoverage(4000, 2000).maxYaw).toBe(60); // aspect 2 → span 120 → half 60
    });
    it('clamps to full 360 span for very wide panos', () => {
        const cov = defaultCoverage(8000, 1500); // aspect ~5.3 → span 320 → half 160
        expect(cov.minYaw).toBe(-160);
        expect(cov.maxYaw).toBe(160);
        const cov2 = defaultCoverage(12000, 1500); // aspect 8 → span 480 → clamped 360
        expect(cov2.maxYaw - cov2.minYaw).toBe(360);
    });
    it('derives the pitch span from the image aspect (no stretch)', () => {
        const cov = defaultCoverage(12000, 1500); // aspect 8, yaw clamped 360 → pitch 360/8
        expect(cov.maxPitch - cov.minPitch).toBe(45);
    });
    it('keeps a single angular scale: yawSpan/pitchSpan === width/height', () => {
        const cov = defaultCoverage(6000, 2000); // aspect 3 → yaw 180, pitch 60
        expect((cov.maxYaw - cov.minYaw) / (cov.maxPitch - cov.minPitch)).toBeCloseTo(3, 5);
    });
});

describe('validateTourUpdate', () => {
    it('accepts an empty patch', () => {
        expect(validateTourUpdate(EMPTY_TOUR, {})).toEqual([]);
    });

    it('rejects non-object patches', () => {
        expect(validateTourUpdate(EMPTY_TOUR, 'nope')).toHaveLength(1);
    });

    it('rejects unknown scene ids', () => {
        const errors = validateTourUpdate(
            { ...EMPTY_TOUR, scenes: [scene('a')] },
            { scenes: [{ id: 'ghost' }] }
        );
        expect(errors.some((e) => e.field === 'scenes[0].id')).toBe(true);
    });

    it('rejects out-of-range initial view angles', () => {
        const errors = validateTourUpdate(
            { ...EMPTY_TOUR, scenes: [scene('a')] },
            { scenes: [{ id: 'a', initialView: { pitch: 90, yaw: 0, fov: 75 } }] }
        );
        expect(errors.some((e) => e.field === 'scenes[0].initialView.pitch')).toBe(true);
        const errors2 = validateTourUpdate(
            { ...EMPTY_TOUR, scenes: [scene('a')] },
            { scenes: [{ id: 'a', initialView: { pitch: 0, yaw: 0, fov: 10 } }] }
        );
        expect(errors2.some((e) => e.field === 'scenes[0].initialView.fov')).toBe(true);
    });

    it('rejects invalid coverage spans', () => {
        const errors = validateTourUpdate(
            { ...EMPTY_TOUR, scenes: [scene('a')] },
            { scenes: [{ id: 'a', coverage: { minYaw: -10, maxYaw: 10, minPitch: -30, maxPitch: 30 } }] } // yaw span 20 ok
        );
        expect(errors).toEqual([]);
        const errors2 = validateTourUpdate(
            { ...EMPTY_TOUR, scenes: [scene('a')] },
            { scenes: [{ id: 'a', coverage: { minYaw: 0, maxYaw: 10, minPitch: -30, maxPitch: 30 } }] } // yaw span 10 < 20
        );
        expect(errors2.some((e) => e.field === 'scenes[0].coverage.yawSpan')).toBe(true);
    });

    it('validates hotspot scene references and uniqueness', () => {
        const tour = { ...EMPTY_TOUR, scenes: [scene('a'), scene('b')] };
        const ok = validateTourUpdate(tour, {
            scenes: [{ id: 'a', hotspots: [{ id: 'h1', toScene: 'b', pitch: 10, yaw: -20, label: 'Cocina' }] }]
        });
        expect(ok).toEqual([]);

        const bad = validateTourUpdate(tour, {
            scenes: [{
                id: 'a',
                hotspots: [
                    { id: 'h1', toScene: 'ghost', pitch: 10, yaw: -20, label: 'x' },
                    { id: 'h1', toScene: 'b', pitch: 10, yaw: -20, label: 'x' }
                ]
            }]
        });
        expect(bad.some((e) => e.field === 'scenes[0].hotspots[0].toScene')).toBe(true);
        expect(bad.some((e) => e.field === 'scenes[0].hotspots[1].id')).toBe(true);
    });

    it('rejects invalid enabled flag', () => {
        expect(validateTourUpdate(EMPTY_TOUR, { enabled: 'yes' })).toHaveLength(1);
    });
});

describe('toTourDomain', () => {
    it('returns undefined for missing tour', () => {
        expect(toTourDomain(undefined)).toBeUndefined();
    });

    it('coerces a persisted document with defaults', () => {
        const tour = toTourDomain({
            enabled: true,
            scenes: [{ id: 'a', name: 'A', image: { url: 'u', publicId: 'p', posterUrl: 'pu', posterPublicId: 'pp', width: 10, height: 5 }, initialView: { pitch: 1, yaw: 2, fov: 75 }, hotspots: [{ id: 'h', toScene: 'a', pitch: 5, yaw: 6, label: 'L' }] }]
        });
        expect(tour?.enabled).toBe(true);
        expect(tour?.scenes[0].initialView.pitch).toBe(1);
        expect(tour?.scenes[0].coverage).toBeUndefined();
        expect(tour?.scenes[0].hotspots[0].toScene).toBe('a');
    });
});
