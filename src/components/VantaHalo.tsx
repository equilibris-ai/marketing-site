"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
// The halo build expects a THREE instance passed in via options.
import HALO from "vanta/dist/vanta.halo.min";

type VantaEffect = {
  destroy: () => void;
  renderer?: {
    forceContextLoss?: () => void;
    dispose?: () => void;
  };
};

/**
 * Full-bleed animated Vanta HALO background, rendered into the fixed,
 * full-viewport `.vanta-bg` layer (z-index 0, behind `.vanta-veil` and
 * `.page`). Parameters mirror the configuration from the Vanta gallery.
 */
export default function VantaHalo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    if (!containerRef.current || effectRef.current) return;

    effectRef.current = HALO({
      el: containerRef.current,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      baseColor: 0x16370f,
      backgroundColor: 0x1566dc,
      amplitudeFactor: 0.1,
      xOffset: 0.02,
      yOffset: 0.5,
      size: 2.7,
    }) as VantaEffect;

    return () => {
      const fx = effectRef.current;
      effectRef.current = null;
      if (!fx) return;
      // Explicitly release the WebGL context so repeated dev hot-reloads don't
      // exhaust the browser's context limit (~16) and leave Vanta blank.
      const renderer = fx.renderer;
      try {
        fx.destroy();
      } catch {
        /* already torn down */
      }
      try {
        renderer?.forceContextLoss?.();
        renderer?.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return <div ref={containerRef} aria-hidden className="vanta-bg" />;
}
