import type { LinearGradientFill } from "./types";

export const PRINT_GOLD_COLOR = "#d4af37";

export function createGoldGradient(): LinearGradientFill {
  return {
    kind: "linear-gradient",
    direction: "horizontal",
    startColor: "#7a4a00",
    centerColor: "#ffe7a0",
    endColor: "#b7791f",
  };
}

export function createLinearGradient(color = "#d4af37"): LinearGradientFill {
  return {
    kind: "linear-gradient",
    direction: "horizontal",
    startColor: color,
    centerColor: "#ffffff",
    endColor: color,
  };
}

export function normalizedOpacity(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value!));
}

interface RgbChannels {
  red: number;
  green: number;
  blue: number;
}

function parseHex(value: string): RgbChannels {
  const normalized = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(normalized);
  const long = /^#([0-9a-f]{6})$/i.exec(normalized);
  const hex = short
    ? short[1]!.split("").map((part) => part + part).join("")
    : long?.[1] ?? "000000";
  return {
    red: Number.parseInt(hex.slice(0, 2), 16) / 255,
    green: Number.parseInt(hex.slice(2, 4), 16) / 255,
    blue: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function mix(left: RgbChannels, right: RgbChannels, amount: number): RgbChannels {
  const t = Math.max(0, Math.min(1, amount));
  return {
    red: left.red + (right.red - left.red) * t,
    green: left.green + (right.green - left.green) * t,
    blue: left.blue + (right.blue - left.blue) * t,
  };
}

/** Returns normalized RGB channels at a position from 0 to 1. */
export function gradientColorAt(
  gradient: LinearGradientFill,
  position: number,
): RgbChannels {
  const t = Math.max(0, Math.min(1, position));
  const start = parseHex(gradient.startColor);
  const center = parseHex(gradient.centerColor);
  const end = parseHex(gradient.endColor);
  return t <= 0.5
    ? mix(start, center, t * 2)
    : mix(center, end, (t - 0.5) * 2);
}
