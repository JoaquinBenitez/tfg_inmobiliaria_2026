import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import React from 'react';
import TourViewer from './TourViewer';
import type { Tour } from '@/types/property';

// El chunk del motor está mockeado: jsdom no tiene WebGL. El mock registra el estricto
// contrato de ciclo de vida (init una vez, dispose al desmontar) del que es dueño el wrapper.
// vi.hoisted: the mock factory is hoisted above const declarations.
const instances = vi.hoisted(() => [] as MockEngine[]);

class MockEngine {
  disposed = false;
  loadedScenes: string[] = [];
  constructor() {
    instances.push(this);
  }
  loadScene(scene: { sceneId: string }): Promise<void> {
    this.loadedScenes.push(scene.sceneId);
    return Promise.resolve();
  }
  getView() {
    return { pitch: 0, yaw: 0, fov: 75 };
  }
  dispose() {
    this.disposed = true;
  }
}

vi.mock('./engine/viewer', () => ({
  PanoramaViewer: MockEngine
}));

const tour: Tour = {
  enabled: true,
  scenes: [
    {
      id: 'scene-1',
      name: 'Living',
      image: {
        url: 'http://localhost:3000/uploads/tours/p/1.webp',
        publicId: 'tours/p/1.webp',
        avifUrl: 'http://localhost:3000/uploads/tours/p/1.avif',
        avifPublicId: 'tours/p/1.avif',
        posterUrl: 'http://localhost:3000/uploads/tours/p/1-poster.webp',
        posterPublicId: 'tours/p/1-poster.webp',
        width: 4096,
        height: 2048
      },
      initialView: { pitch: 0, yaw: 0, fov: 75 },
      hotspots: []
    }
  ]
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  trigger(intersecting: boolean) {
    this.callback(
      [{ isIntersecting: intersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

describe('TourViewer engine lifecycle', () => {
  beforeEach(() => {
    instances.length = 0;
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the poster overlay but no engine until the section approaches the viewport', async () => {
    render(<TourViewer tour={tour} />);

    expect(await screenByAlt(/Vista previa del recorrido/i)).toBeTruthy();
    await waitFor(() => expect(instances).toHaveLength(0)); // engine NOT initialized

    act(() => {
      MockIntersectionObserver.instances[0].trigger(true);
    });
    await waitFor(() => expect(instances).toHaveLength(1));
  });

  it('loads the first scene into the engine and disposes it on unmount', async () => {
    const { unmount } = render(<TourViewer tour={tour} />);
    act(() => {
      MockIntersectionObserver.instances[0].trigger(true);
    });

    await waitFor(() => expect(instances).toHaveLength(1));
    await waitFor(() => expect(instances[0].loadedScenes).toContain('scene-1'));

    unmount();
    await waitFor(() => expect(instances[0].disposed).toBe(true));
  });
});

// helper chico para evitar importar screen aparte en cada aserción
function screenByAlt(matcher: RegExp): HTMLElement | null {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs.find((img) => matcher.test(img.alt || '')) ?? null;
}
