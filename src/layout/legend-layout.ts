export interface LegendLayoutItemInput {
  id: string;
  label: string;
}

export interface LegendLayoutItem {
  id: string;
  xMm: number;
  widthMm: number;
  labelOffsetMm: number;
}

export interface RightAlignedLegendLayout {
  fontSizeMm: number;
  markerSizeMm: number;
  itemGapMm: number;
  startXMm: number;
  contentWidthMm: number;
  items: LegendLayoutItem[];
}

function estimatedTextWidthMm(value: string, fontSizeMm: number): number {
  let em = 0;
  for (const character of Array.from(value)) {
    if (/\s/u.test(character)) em += 0.28;
    else if (/[.,:;!()\-/]/u.test(character)) em += 0.3;
    else em += 0.54;
  }
  return em * fontSizeMm;
}

/**
 * Packs the complete legend against its right edge. Empty horizontal space is
 * deliberately left on the left so a printed calendar can be annotated there.
 */
export function buildRightAlignedLegendLayout(
  widthMm: number,
  heightMm: number,
  items: readonly LegendLayoutItemInput[],
  measureTextMm: (value: string, fontSizeMm: number) => number = estimatedTextWidthMm,
): RightAlignedLegendLayout {
  const safeWidth = Math.max(0, widthMm);
  const safeHeight = Math.max(0, heightMm);
  if (items.length === 0) {
    return {
      fontSizeMm: Math.min(3.1, safeHeight * 0.42),
      markerSizeMm: 0,
      itemGapMm: 0,
      startXMm: safeWidth,
      contentWidthMm: 0,
      items: [],
    };
  }

  const baseFontSizeMm = Math.max(1.4, Math.min(3.1, safeHeight * 0.42));
  const baseMarkerSizeMm = Math.max(3, Math.min(16, safeHeight - 1.2));
  const baseItemGapMm = 4;
  const markerLabelGapMm = 3;

  const contentWidthFor = (fontSizeMm: number, markerSizeMm: number, itemGapMm: number) =>
    items.reduce(
      (sum, item) => sum + markerSizeMm + markerLabelGapMm + measureTextMm(item.label, fontSizeMm),
      Math.max(0, items.length - 1) * itemGapMm,
    );

  let fontSizeMm = baseFontSizeMm;
  let markerSizeMm = baseMarkerSizeMm;
  let itemGapMm = baseItemGapMm;
  let contentWidthMm = contentWidthFor(fontSizeMm, markerSizeMm, itemGapMm);

  if (contentWidthMm > safeWidth && contentWidthMm > 0) {
    const scale = safeWidth / contentWidthMm;
    fontSizeMm = Math.max(1.2, baseFontSizeMm * scale);
    markerSizeMm = Math.max(2.4, baseMarkerSizeMm * scale);
    itemGapMm = Math.max(1, baseItemGapMm * scale);
    contentWidthMm = contentWidthFor(fontSizeMm, markerSizeMm, itemGapMm);
  }

  // Extremely narrow user-created frames still remain inside their own bounds.
  const finalScale = contentWidthMm > safeWidth && contentWidthMm > 0
    ? safeWidth / contentWidthMm
    : 1;
  fontSizeMm *= finalScale;
  markerSizeMm *= finalScale;
  itemGapMm *= finalScale;
  const labelOffsetMm = markerSizeMm + markerLabelGapMm * finalScale;
  const widths = items.map((item) =>
    labelOffsetMm + measureTextMm(item.label, fontSizeMm),
  );
  contentWidthMm = widths.reduce(
    (sum, itemWidth) => sum + itemWidth,
    Math.max(0, items.length - 1) * itemGapMm,
  );
  const startXMm = Math.max(0, safeWidth - contentWidthMm);
  let cursorMm = startXMm;
  const layoutItems = items.map((item, index) => {
    const layoutItem = {
      id: item.id,
      xMm: cursorMm,
      widthMm: widths[index]!,
      labelOffsetMm,
    };
    cursorMm += layoutItem.widthMm + itemGapMm;
    return layoutItem;
  });

  return {
    fontSizeMm,
    markerSizeMm,
    itemGapMm,
    startXMm,
    contentWidthMm,
    items: layoutItems,
  };
}
