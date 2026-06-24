// Vanta.js ships no TypeScript types. We only use the HALO effect, whose
// factory takes an options object and returns an instance with a destroy().
declare module "vanta/dist/vanta.halo.min" {
  interface VantaHaloOptions {
    el: HTMLElement;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    backgroundColor?: number;
    baseColor?: number;
    size?: number;
    amplitudeFactor?: number;
    xOffset?: number;
    yOffset?: number;
  }

  interface VantaEffect {
    destroy: () => void;
  }

  const HALO: (options: VantaHaloOptions) => VantaEffect;
  export default HALO;
}
