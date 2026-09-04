import type {
  LargeTextEffects,
  TextExtrusionEffect,
  TextShadowEffect,
} from "./types";

export const DEFAULT_TEXT_SHADOW: Readonly<TextShadowEffect> = {
  color: "#000000",
  offsetXMm: 1,
  offsetYMm: 1,
  blurMm: 0.9,
  opacity: 0.42,
};

export const DEFAULT_TEXT_EXTRUSION: Readonly<TextExtrusionEffect> = {
  color: "#70430f",
  depthMm: 1.2,
  angleDeg: 45,
  opacity: 0.95,
};

export function createDefaultTextEffects(): LargeTextEffects {
  return {};
}

export function createDefaultTextShadow(): TextShadowEffect {
  return { ...DEFAULT_TEXT_SHADOW };
}

export function createDefaultTextExtrusion(): TextExtrusionEffect {
  return { ...DEFAULT_TEXT_EXTRUSION };
}

export interface TextEffectOffset {
  xMm: number;
  yMm: number;
  opacity: number;
}

/** Produces a bounded number of evenly spaced layers while preserving any requested depth. */
export function textExtrusionOffsets(effect: TextExtrusionEffect | undefined): TextEffectOffset[] {
  if (!effect || !Number.isFinite(effect.depthMm) || effect.depthMm <= 0) return [];
  const depth = effect.depthMm;
  const angle = (Number.isFinite(effect.angleDeg) ? effect.angleDeg : 45) * Math.PI / 180;
  const steps = Math.max(1, Math.min(36, Math.ceil(depth / 0.16)));
  const opacity = Number.isFinite(effect.opacity)
    ? Math.max(0, Math.min(1, effect.opacity))
    : DEFAULT_TEXT_EXTRUSION.opacity;
  return Array.from({ length: steps }, (_, index) => {
    const progress = (steps - index) / steps;
    return {
      xMm: Math.cos(angle) * depth * progress,
      yMm: Math.sin(angle) * depth * progress,
      opacity,
    };
  });
}

export function normalizedTextShadow(effect: TextShadowEffect | undefined): TextShadowEffect | undefined {
  if (!effect) return undefined;
  return {
    color: effect.color || DEFAULT_TEXT_SHADOW.color,
    offsetXMm: Number.isFinite(effect.offsetXMm) ? effect.offsetXMm : DEFAULT_TEXT_SHADOW.offsetXMm,
    offsetYMm: Number.isFinite(effect.offsetYMm) ? effect.offsetYMm : DEFAULT_TEXT_SHADOW.offsetYMm,
    blurMm: Number.isFinite(effect.blurMm) ? Math.max(0, effect.blurMm) : DEFAULT_TEXT_SHADOW.blurMm,
    opacity: Number.isFinite(effect.opacity)
      ? Math.max(0, Math.min(1, effect.opacity))
      : DEFAULT_TEXT_SHADOW.opacity,
  };
}
