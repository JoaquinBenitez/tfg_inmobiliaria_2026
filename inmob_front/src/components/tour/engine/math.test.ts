import { describe, it, expect } from 'vitest';
import {
  clamp,
  clampPitch,
  normalizeYaw,
  damp,
  directionVector,
  projectToScreen,
  screenToAngles,
  navigationBounds,
  coverageToTextureTransform
} from './math';

describe('clamp / clampPitch / normalizeYaw', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('clamps pitch to ±85', () => {
    expect(clampPitch(89)).toBe(85);
    expect(clampPitch(-89)).toBe(-85);
    expect(clampPitch(12)).toBe(12);
  });

  it('wraps yaw into [-180, 180)', () => {
    expect(normalizeYaw(190)).toBe(-170);
    expect(normalizeYaw(-190)).toBe(170);
    expect(normalizeYaw(360)).toBe(0);
    expect(normalizeYaw(720 + 45)).toBe(45);
    expect(normalizeYaw(180)).toBe(-180);
  });
});

describe('damp', () => {
  it('moves toward the target framerate-independently', () => {
    const one = damp(0, 100, 10, 0.5);
    const twoSteps = damp(damp(0, 100, 10, 0.25), 100, 10, 0.25);
    expect(one).toBeCloseTo(twoSteps, 5); // same total time → same result
    expect(damp(50, 50, 10, 0.1)).toBe(50);
  });
  it('never overshoots', () => {
    expect(damp(0, 10, 100, 1)).toBeLessThanOrEqual(10);
    expect(damp(10, 0, 100, 1)).toBeGreaterThanOrEqual(0);
  });
});

describe('projectToScreen / screenToAngles', () => {
  const viewport = { width: 800, height: 400 };
  const view = { pitch: 0, yaw: 0, fov: 90 };

  it('projects the view center to the viewport center', () => {
    const p = projectToScreen({ pitch: 0, yaw: 0 }, view, viewport);
    expect(p.x).toBeCloseTo(400, 5);
    expect(p.y).toBeCloseTo(200, 5);
    expect(p.visible).toBe(true);
  });

  it('marks targets behind the camera as not visible', () => {
    const behind = projectToScreen({ pitch: 0, yaw: 180 }, view, viewport);
    expect(behind.visible).toBe(false);
    expect(behind.forwardDot).toBeLessThan(0);
  });

  it('projects yaw consistently: +yaw target appears on the left (turn-left convention)', () => {
    // Girar la cámara a la izquierda (+yaw) es donde vive un objetivo +yaw → aparece a la IZQUIERDA del centro.
    const p = projectToScreen({ pitch: 0, yaw: 45 }, view, viewport);
    expect(p.x).toBeLessThan(400);
    const right = projectToScreen({ pitch: 0, yaw: -45 }, view, viewport);
    expect(right.x).toBeGreaterThan(400);
  });

  it('projects pitch up as up on screen', () => {
    const up = projectToScreen({ pitch: 30, yaw: 0 }, view, viewport);
    expect(up.y).toBeLessThan(200);
  });

  it('culls off-screen targets', () => {
    const p = projectToScreen({ pitch: 0, yaw: 170 }, view, viewport);
    expect(p.visible).toBe(false);
  });

  it('round-trips screenToAngles through projectToScreen', () => {
    for (const [px, py] of [[400, 200], [600, 150], [200, 300], [550, 260]] as const) {
      const angles = screenToAngles(px, py, view, viewport);
      const back = projectToScreen(angles, view, viewport);
      expect(back.x).toBeCloseTo(px, 3);
      expect(back.y).toBeCloseTo(py, 3);
    }
  });

  it('screenToAngles respects the current view rotation', () => {
    const rotated = { pitch: 0, yaw: 90, fov: 90 };
    const angles = screenToAngles(400, 200, rotated, viewport); // center of a rotated view
    expect(angles.yaw).toBeCloseTo(90, 3);
  });
});

describe('navigationBounds', () => {
  it('gives free yaw and ±85 pitch for full spheres', () => {
    const b = navigationBounds(undefined, 75, 16 / 9);
    expect(b.minYaw).toBe(-180);
    expect(b.maxYaw).toBe(180);
    expect(b.minPitch).toBe(-85);
    expect(b.maxPitch).toBe(85);
  });

  it('stops the frustum exactly at the coverage edge (no black past the image)', () => {
    const coverage = { minYaw: -60, maxYaw: 60, minPitch: -30, maxPitch: 30 };
    const b = navigationBounds(coverage, 90, 1); // halfH = halfV = 45°
    expect(b.minYaw).toBeCloseTo(-15, 5); // −60 + 45
    expect(b.maxYaw).toBeCloseTo(15, 5);
    // pitch span 60 < frustum 90 → colapsa al centro de la ventana (0), simétrico
    expect(b.minPitch).toBeCloseTo(0, 5);
    expect(b.maxPitch).toBeCloseTo(0, 5);
  });

  it('keeps a navigable range when the window is wider than the frustum', () => {
    const coverage = { minYaw: -120, maxYaw: 120, minPitch: -45, maxPitch: 45 };
    const b = navigationBounds(coverage, 90, 1);
    expect(b.minYaw).toBeCloseTo(-75, 5);
    expect(b.maxYaw).toBeCloseTo(75, 5);
    expect(b.minPitch).toBeCloseTo(0, 5); // span 90 = frustum 90 → centro único
    expect(b.maxPitch).toBeCloseTo(0, 5);
  });

  it('collapses to the center instead of inverting on tiny coverage', () => {
    const coverage = { minYaw: -20, maxYaw: 20, minPitch: -10, maxPitch: 10 };
    const b = navigationBounds(coverage, 100, 2);
    expect(b.minYaw).toBeLessThanOrEqual(b.maxYaw);
    expect(b.minPitch).toBeLessThanOrEqual(b.maxPitch);
  });
});

describe('coverageToTextureTransform', () => {
  it('returns the equirect-correcting transform for full spheres', () => {
    // three.js identity rotation is 90° off for standard equirect images:
    // u de la esfera = 0.75 − yaw/360, así que yaw −180 debe muestrear la u=0 de la imagen.
    expect(coverageToTextureTransform(undefined)).toEqual({ repeatX: 1, repeatY: 1, offsetX: -0.25, offsetY: 0 });
  });

  it('maps a half-yaw window to repeat 2 anchored at the window edge', () => {
    const t = coverageToTextureTransform({ minYaw: -90, maxYaw: 90, minPitch: -45, maxPitch: 45 });
    expect(t.repeatX).toBeCloseTo(2, 5); // 360°/180°
    expect(t.repeatY).toBeCloseTo(2, 5); // 180°/90°
    // el borde izquierdo de la imagen (u=0) debe caer en maxYaw=90: sphere_u(90°)=0.5 → 0.5·2+offset=0
    expect(t.offsetX).toBeCloseTo(-1, 5);
    // el borde inferior de la imagen (v=0) debe caer en minPitch=-45: uv.y=(90−45)/180=0.25 → 0.25·2+offset=0
    expect(t.offsetY).toBeCloseTo(-0.5, 5);
  });

  it('anchors an off-center window at its edges', () => {
    const t = coverageToTextureTransform({ minYaw: 0, maxYaw: 180, minPitch: 0, maxPitch: 90 });
    expect(t.repeatX).toBeCloseTo(2, 5);
    expect(t.repeatY).toBeCloseTo(2, 5);
    // u=0 at maxYaw=180: sphere_u(180°)=0.25 → 0.25·2+offset=0 → offset=−0.5
    expect(t.offsetX).toBeCloseTo(-0.5, 5);
    // v=0 at minPitch=0: uv.y=0.5 → 0.5·2+offset=0 → offset=−1
    expect(t.offsetY).toBeCloseTo(-1, 5);
  });

  it('keeps the image center at the coverage center', () => {
    // sanity: sample the image coordinate at the coverage center for a few windows
    const sphereU = (yaw: number) => 0.75 - yaw / 360;
    for (const cov of [
      { minYaw: -90, maxYaw: 90, minPitch: -45, maxPitch: 45 },
      { minYaw: 0, maxYaw: 180, minPitch: 0, maxPitch: 90 },
      { minYaw: -45, maxYaw: 135, minPitch: -30, maxPitch: 30 }
    ]) {
      const t = coverageToTextureTransform(cov);
      const centerYaw = (cov.minYaw + cov.maxYaw) / 2;
      const centerPitch = (cov.minPitch + cov.maxPitch) / 2;
      const imgU = sphereU(centerYaw) * t.repeatX + t.offsetX;
      const imgV = ((90 + centerPitch) / 180) * t.repeatY + t.offsetY;
      expect(((imgU % 1) + 1) % 1).toBeCloseTo(0.5, 5);
      expect(imgV).toBeCloseTo(0.5, 5);
    }
  });
});

describe('directionVector', () => {
  it('yaw 0 pitch 0 looks at -Z', () => {
    const v = directionVector(0, 0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });
  it('is a unit vector everywhere', () => {
    for (const yaw of [-170, -45, 0, 90, 160]) {
      for (const pitch of [-80, -10, 0, 25, 85]) {
        const v = directionVector(yaw, pitch);
        expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 6);
      }
    }
  });
});
