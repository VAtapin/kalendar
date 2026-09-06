import type { TypikonMarkKind } from "./typikon-style";

export interface TypikonMarkerAsset {
  id: TypikonMarkKind;
  label: string;
  svgSource: string;
  pdfRasterSource: string;
}

export const TYPIKON_MARKERS: Readonly<Record<TypikonMarkKind, TypikonMarkerAsset>> = {
  great: {
    id: "great",
    label: "Великий праздник",
    svgSource: "/assets/typikon/great.svg",
    pdfRasterSource: "/assets/typikon/great-print.png",
  },
  vigil: {
    id: "vigil",
    label: "Бденный праздник",
    svgSource: "/assets/typikon/vigil.svg",
    pdfRasterSource: "/assets/typikon/vigil-print.png",
  },
  polyeleos: {
    id: "polyeleos",
    label: "Полиелейный праздник",
    svgSource: "/assets/typikon/polyeleos.svg",
    pdfRasterSource: "/assets/typikon/polyeleos-print.png",
  },
  doxology: {
    id: "doxology",
    label: "Славословная служба",
    svgSource: "/assets/typikon/doxology.svg",
    pdfRasterSource: "/assets/typikon/doxology-print.png",
  },
  six_stichera: {
    id: "six_stichera",
    label: "Шестеричная служба",
    svgSource: "/assets/typikon/six-stichera.svg",
    pdfRasterSource: "/assets/typikon/six-stichera-print.png",
  },
} as const;

export function typikonMarkerSvgSource(kind: TypikonMarkKind): string {
  return TYPIKON_MARKERS[kind].svgSource;
}

export function typikonMarkerPdfSource(kind: TypikonMarkKind): string {
  return TYPIKON_MARKERS[kind].pdfRasterSource;
}
