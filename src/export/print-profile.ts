export const BUILT_IN_PRINT_PROFILES = [
  {
    id: "coated",
    label: "Мелованная глянцевая или матовая бумага",
    name: "ISO Coated v2 300% (ECI)",
    url: "/icc/ISOcoated_v2_300_eci.icc",
  },
  {
    id: "uncoated-white",
    label: "Немелованная белая бумага",
    name: "PSO Uncoated ISO12647 (ECI)",
    url: "/icc/PSO_Uncoated_ISO12647_eci.icc",
  },
  {
    id: "uncoated-yellowish",
    label: "Немелованная желтоватая бумага",
    name: "ISO Uncoated Yellowish (ECI)",
    url: "/icc/ISOuncoatedyellowish.icc",
  },
] as const;

export type PrintProfileChoice = typeof BUILT_IN_PRINT_PROFILES[number]["id"] | "custom" | "rgb";
