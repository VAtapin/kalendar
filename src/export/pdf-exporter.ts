import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  TextRenderingMode,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  appendBezierCurve,
  clip,
  beginText,
  closePath,
  concatTransformationMatrix,
  endText,
  endPath,
  fill,
  drawObject,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
  setFontAndSize,
  setGraphicsState,
  setFillingGrayscaleColor,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  scale,
  translate,
} from "pdf-lib";
import type { OrthodoxCalendarYear } from "../calendar";
import {
  dayNumberTypikonStyle,
  eventTypikonStyle,
  typikonMarkForEvent,
} from "../calendar/presentation/typikon-style";
import {
  FOOD_RULES,
  foodRuleLegendLabel,
  resolveFoodRule,
  usedFoodRulesForMonths,
  type FoodRuleId,
} from "../calendar/presentation/fasting";
import { foodMarkerPackSource } from "../calendar/presentation/marker-packs";
import {
  TYPIKON_MARKERS,
  typikonMarkerPdfSource,
} from "../calendar/presentation/typikon-markers";
import type { TypikonMarkKind } from "../calendar/presentation/typikon-style";
import {
  calendarMonasteryEventLabel,
  calendarOldStylePrefix,
  calendarWeekdayLabels,
  localizedTextTitle,
} from "../calendar/localization/calendar-language";
import type {
  CalendarLanguage,
  CalendarGridElement,
  CalendarProject,
  DocumentAsset,
  ImageElement,
  LargeTextEffects,
  LayoutElementNode,
  LinearGradientFill,
  MonthTextElement,
  PageModel,
  ShapeElement,
  SvgElement,
  TextElement,
  TextTypography,
} from "../document/types";
import { gradientColorAt, normalizedOpacity } from "../document/paint";
import {
  normalizedTextShadow,
  textExtrusionOffsets,
} from "../document/text-effects";
import {
  buildCalendarGridLayout,
  calendarFoodMarkerGeometry,
  calendarCellTypography,
  layoutCalendarCellTextAutoFit,
} from "../layout/calendar-grid-layout";
import { layoutTextBlock } from "../layout/text-layout";
import { buildRightAlignedLegendLayout } from "../layout/legend-layout";
import { buildPageScene } from "../rendering/page-scene";
import {
  BUNDLED_FONT_FILES,
  type BundledFontFamily,
} from "../typography/font-catalog";
import { buildCropMarkSegments } from "./print-marks";
import { calculateImagePlacement } from "../document/image-placement";
import { findLayerLocation } from "../document/layer-operations";
import { hasRoundedCorners, resolvedCornerRadii } from "../document/corner-radii";

export const MM_TO_PT = 72 / 25.4;

export interface PdfFontFiles {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
  serifRegular?: Uint8Array;
  serifBold?: Uint8Array;
  serifItalic?: Uint8Array;
  serifBoldItalic?: Uint8Array;
  bundled?: Partial<Record<BundledFontFamily, PdfFontFamilyFiles>>;
}

export interface PdfFontFamilyFiles {
  regular: Uint8Array;
  bold?: Uint8Array;
  italic?: Uint8Array;
  boldItalic?: Uint8Array;
}

export interface PdfExportWarning {
  pageId: string;
  pageName: string;
  elementId?: string;
  code: "missing-asset" | "unsupported-asset" | "unsupported-font" | "missing-output-profile" | "text-overflow" | "calendar-overflow";
  message: string;
}

export interface PdfExportResult {
  bytes: Uint8Array;
  warnings: PdfExportWarning[];
}

export interface PdfExportOptions {
  loadAssetSource?: (source: string) => Promise<Uint8Array | undefined>;
}

interface EmbeddedFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  serifRegular: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
  serifBoldItalic: PDFFont;
  bundled: Map<string, EmbeddedFontFamily>;
}

interface EmbeddedFontFamily {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

interface PageContext {
  pdfDocument: PDFDocument;
  pdfPage: PDFPage;
  page: PageModel;
  calendar?: OrthodoxCalendarYear;
  fastingProfileId: CalendarProject["fastingProfileId"];
  calendarLanguage: CalendarLanguage;
  fonts: EmbeddedFonts;
  assets: Map<string, DocumentAsset>;
  warnings: PdfExportWarning[];
  foodImages: Map<FoodRuleId, PDFImage>;
  typikonImages: Map<TypikonMarkKind, PDFImage>;
  mediaHeightPt: number;
  trimOffsetXPt: number;
  trimOffsetTopPt: number;
}

function mm(value: number): number {
  return value * MM_TO_PT;
}

function color(value: string | undefined, fallback = "#17201d") {
  const normalized = (value ?? fallback).trim();
  const short = /^#([0-9a-f]{3})$/i.exec(normalized);
  const long = /^#([0-9a-f]{6})$/i.exec(normalized);
  const hex = short
    ? short[1]!.split("").map((part) => part + part).join("")
    : long?.[1] ?? fallback.replace("#", "");
  return rgb(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function xPt(context: PageContext, x: number): number {
  return context.trimOffsetXPt + mm(x);
}

function bottomPt(context: PageContext, y: number, height = 0): number {
  return context.mediaHeightPt - context.trimOffsetTopPt - mm(y + height);
}

function chooseFont(fonts: EmbeddedFonts, typography: TextTypography): PDFFont {
  const bold = (typography.fontWeight ?? 400) >= 600;
  const italic = typography.fontStyle === "italic";
  const bundled = fonts.bundled.get(typography.fontFamily.trim().toLocaleLowerCase());
  if (bundled) {
    if (bold && italic) return bundled.boldItalic;
    if (bold) return bundled.bold;
    if (italic) return bundled.italic;
    return bundled.regular;
  }
  const serif = /georgia|times|serif/i.test(typography.fontFamily);
  if (serif) {
    if (bold && italic) return fonts.serifBoldItalic;
    if (bold) return fonts.serifBold;
    if (italic) return fonts.serifItalic;
    return fonts.serifRegular;
  }
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

function beginElementRotation(
  context: PageContext,
  element: LayoutElementNode,
): boolean {
  if (!element.rotation) return false;
  const centerX = xPt(context, element.x + element.width / 2);
  const centerY = bottomPt(context, element.y + element.height / 2);
  // SVG/canvas use a top-left coordinate system, while PDF uses bottom-left.
  // Negating the angle keeps clockwise editor rotation identical in print.
  const radians = (-element.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  context.pdfPage.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      cos,
      sin,
      -sin,
      cos,
      centerX - cos * centerX + sin * centerY,
      centerY - sin * centerX - cos * centerY,
    ),
  );
  return true;
}

function roundedRectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number },
): PDFOperator[] {
  const topLeft = Math.max(0, Math.min(radii.topLeft, width / 2, height / 2));
  const topRight = Math.max(0, Math.min(radii.topRight, width / 2, height / 2));
  const bottomRight = Math.max(0, Math.min(radii.bottomRight, width / 2, height / 2));
  const bottomLeft = Math.max(0, Math.min(radii.bottomLeft, width / 2, height / 2));
  if (topLeft <= 0 && topRight <= 0 && bottomRight <= 0 && bottomLeft <= 0) {
    return [rectangle(x, y, width, height)];
  }
  const k = 0.5522847498;
  return [
    moveTo(x + bottomLeft, y),
    lineTo(x + width - bottomRight, y),
    appendBezierCurve(x + width - bottomRight + k * bottomRight, y, x + width, y + bottomRight - k * bottomRight, x + width, y + bottomRight),
    lineTo(x + width, y + height - topRight),
    appendBezierCurve(x + width, y + height - topRight + k * topRight, x + width - topRight + k * topRight, y + height, x + width - topRight, y + height),
    lineTo(x + topLeft, y + height),
    appendBezierCurve(x + topLeft - k * topLeft, y + height, x, y + height - topLeft + k * topLeft, x, y + height - topLeft),
    lineTo(x, y + bottomLeft),
    appendBezierCurve(x, y + bottomLeft - k * bottomLeft, x + bottomLeft - k * bottomLeft, y, x + bottomLeft, y),
    closePath(),
  ];
}

async function beginElementMask(context: PageContext, element: LayoutElementNode): Promise<boolean> {
  const radiiMm = resolvedCornerRadii(element);
  const layer = findLayerLocation(context.page, element.layerId)?.node;
  const layerMask = layer?.kind === "layer" && layer.mask?.enabled !== false ? layer.mask : undefined;
  const maskAsset = layerMask ? context.assets.get(layerMask.assetId) : undefined;
  let maskImage: PDFImage | undefined;
  if (maskAsset) maskImage = await embedAssetImage(context, maskAsset, element);
  if (layerMask && !maskImage) {
    context.warnings.push({
      pageId: context.page.id,
      pageName: context.page.name,
      elementId: element.id,
      code: maskAsset ? "unsupported-asset" : "missing-asset",
      message: maskAsset
        ? `Маску слоя «${maskAsset.name}» не удалось поместить в PDF.`
        : "Файл маски слоя не найден.",
    });
  }
  if (!hasRoundedCorners(element) && !maskImage) return false;

  const frameX = xPt(context, element.x);
  const frameY = bottomPt(context, element.y, element.height);
  const frameWidth = mm(element.width);
  const frameHeight = mm(element.height);
  const operators: PDFOperator[] = [
    pushGraphicsState(),
    ...roundedRectanglePath(frameX, frameY, frameWidth, frameHeight, {
      topLeft: mm(radiiMm.topLeft),
      topRight: mm(radiiMm.topRight),
      bottomRight: mm(radiiMm.bottomRight),
      bottomLeft: mm(radiiMm.bottomLeft),
    }),
    clip(),
    endPath(),
    setFillingGrayscaleColor(maskImage ? 0 : 1),
    rectangle(frameX, frameY, frameWidth, frameHeight),
    fill(),
  ];
  if (maskImage) {
    const placement = calculateImagePlacement(
      { x: element.x, y: element.y, width: element.width, height: element.height },
      maskImage.width,
      maskImage.height,
      "fit",
    );
    operators.push(
      pushGraphicsState(),
      translate(xPt(context, placement.x), bottomPt(context, placement.y, placement.height)),
      scale(mm(placement.width), mm(placement.height)),
      drawObject(PDFName.of("LayerMaskImage")),
      popGraphicsState(),
    );
  }
  operators.push(popGraphicsState());

  const pdfContext = context.pdfDocument.context;
  const group = pdfContext.formXObject(operators, {
    BBox: [0, 0, context.pdfPage.getWidth(), context.pdfPage.getHeight()],
    Group: {
      Type: "Group",
      S: "Transparency",
      CS: maskImage ? "DeviceRGB" : "DeviceGray",
      I: true,
      K: false,
    },
    Resources: maskImage ? { XObject: { LayerMaskImage: maskImage.ref } } : {},
  });
  const groupReference = pdfContext.register(group);
  const graphicsState = pdfContext.obj({
    Type: "ExtGState",
    SMask: {
      Type: "Mask",
      S: "Luminosity",
      G: groupReference,
      BC: [0],
    },
  });
  const key = context.pdfPage.node.newExtGState("ObjectMask", graphicsState);
  context.pdfPage.pushOperators(pushGraphicsState(), setGraphicsState(key));
  return true;
}

function alignedX(
  align: TextTypography["align"],
  left: number,
  width: number,
  textWidth: number,
): number {
  if (align === "center") return left + (width - textWidth) / 2;
  if (align === "right") return left + width - textWidth;
  return left;
}

function trackedTextWidth(font: PDFFont, text: string, size: number, spacing: number): number {
  return font.widthOfTextAtSize(text, size) + Math.max(0, Array.from(text).length - 1) * spacing;
}

function drawAxialGradient(
  page: PDFPage,
  gradient: LinearGradientFill,
  opacity: number,
  coordinates: readonly [number, number, number, number],
): void {
  const context = page.doc.context;
  const start = gradientColorAt(gradient, 0);
  const center = gradientColorAt(gradient, 0.5);
  const end = gradientColorAt(gradient, 1);
  const interpolation = (
    from: typeof start,
    to: typeof start,
  ) => context.obj({
    FunctionType: 2,
    Domain: [0, 1],
    C0: [from.red, from.green, from.blue],
    C1: [to.red, to.green, to.blue],
    N: 1,
  });
  const stitchingFunction = context.obj({
    FunctionType: 3,
    Domain: [0, 1],
    Functions: [interpolation(start, center), interpolation(center, end)],
    Bounds: [0.5],
    Encode: [0, 1, 0, 1],
  });
  const shading = context.obj({
    ShadingType: 2,
    ColorSpace: "DeviceRGB",
    Coords: [...coordinates],
    Function: stitchingFunction,
    Extend: [true, true],
  });

  page.node.normalize();
  const resources = page.node.Resources()!;
  const shadingResourceName = PDFName.of("Shading");
  let shadings = resources.lookupMaybe(shadingResourceName, PDFDict);
  if (!shadings) {
    shadings = context.obj({});
    resources.set(shadingResourceName, shadings);
  }
  const shadingKey = shadings.uniqueKey("Sh");
  shadings.set(shadingKey, context.register(shading));
  const graphicsStateKey = page.node.newExtGState("GS", context.obj({
    Type: "ExtGState",
    ca: normalizedOpacity(opacity),
    CA: normalizedOpacity(opacity),
  }));
  page.pushOperators(
    setGraphicsState(graphicsStateKey),
    PDFOperator.of(PDFOperatorNames.ShadingFill, [shadingKey]),
  );
}

function drawTrackedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  fill: ReturnType<typeof color>,
  spacing: number,
  opacity = 1,
): void {
  if (!spacing) {
    page.drawText(text, { x, y, size, font, color: fill, opacity });
    return;
  }
  let cursor = x;
  for (const character of text) {
    page.drawText(character, { x: cursor, y, size, font, color: fill, opacity });
    cursor += font.widthOfTextAtSize(character, size) + spacing;
  }
}

interface PdfPageFontState {
  setOrEmbedFont(font: PDFFont): {
    newFont: PDFFont;
    newFontKey: PDFName;
  };
}

function drawGradientTrackedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  spacing: number,
  effects: LargeTextEffects,
  opacity: number,
): void {
  const gradient = effects.gradient;
  if (!gradient) return;
  const width = trackedTextWidth(font, text, size, spacing);
  if (!text || width <= 0 || size <= 0) return;
  const { newFont, newFontKey } = (page as unknown as PdfPageFontState).setOrEmbedFont(font);
  const operators = [
    pushGraphicsState(),
    beginText(),
    setFontAndSize(newFontKey, size),
    setTextRenderingMode(TextRenderingMode.Clip),
    setTextMatrix(1, 0, 0, 1, x, y),
  ];
  if (spacing) operators.push(setCharacterSpacing(spacing));
  operators.push(showText(newFont.encodeText(text)), endText());
  page.pushOperators(...operators);
  const bottom = y - size * 0.28;
  const height = size * 1.35;
  drawAxialGradient(
    page,
    gradient,
    opacity,
    gradient.direction === "horizontal"
      ? [x, bottom, x + width, bottom]
      : [x, bottom + height, x, bottom],
  );
  page.pushOperators(popGraphicsState());
}

function drawLargeTrackedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  fill: ReturnType<typeof color>,
  spacing: number,
  effects: LargeTextEffects | undefined,
  opacity = 1,
): void {
  const objectOpacity = normalizedOpacity(opacity);
  const shadow = normalizedTextShadow(effects?.shadow);
  if (shadow) {
    const blur = mm(shadow.blurMm);
    const samples = blur > 0
      ? [
          [0, 0], [-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7],
          [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5],
        ] as const
      : [[0, 0]] as const;
    for (const [sampleX, sampleY] of samples) {
      drawTrackedText(
        page,
        text,
        x + mm(shadow.offsetXMm) + sampleX * blur,
        y - mm(shadow.offsetYMm) + sampleY * blur,
        size,
        font,
        color(shadow.color),
        spacing,
        objectOpacity * shadow.opacity / Math.sqrt(samples.length),
      );
    }
  }

  if (effects?.extrusion) {
    for (const offset of textExtrusionOffsets(effects.extrusion)) {
      drawTrackedText(
        page,
        text,
        x + mm(offset.xMm),
        y - mm(offset.yMm),
        size,
        font,
        color(effects.extrusion.color),
        spacing,
        objectOpacity * offset.opacity,
      );
    }
  }

  if (effects?.gradient) {
    drawGradientTrackedText(page, text, x, y, size, font, spacing, effects, objectOpacity);
  } else {
    drawTrackedText(page, text, x, y, size, font, fill, spacing, objectOpacity);
  }
}

function drawTextFrame(
  context: PageContext,
  element: TextElement | MonthTextElement,
): void {
  const typography = element.type === "text" && element.semanticRole === "calendar-month-title" && context.calendarLanguage === "cu"
    ? { ...element.typography, fontFamily: "Monomakh Unicode" }
    : element.typography;
  const font = chooseFont(context.fonts, typography);
  const fontSize = typography.fontSizePt;
  const lineHeight = fontSize * typography.lineHeight;
  const letterSpacing = typography.letterSpacingPt;
  const padding = mm(typography.paddingMm);
  const width = Math.max(0, mm(element.width) - padding * 2);
  const attributionSize = element.type === "month-text" && element.attribution
    ? fontSize * 0.72
    : 0;
  const attributionGap = attributionSize ? lineHeight * 0.25 : 0;
  const height = Math.max(
    0,
    mm(element.height) - padding * 2 - attributionSize - attributionGap,
  );
  const visibleTitle = element.type === "text"
    ? localizedTextTitle(element, context.page, context.calendar?.year ?? new Date().getFullYear(), context.calendarLanguage)
    : element.content.title;
  const layout = layoutTextBlock(
    visibleTitle,
    width,
    height,
    lineHeight,
    (value) => trackedTextWidth(font, value, fontSize, letterSpacing),
  );
  if (layout.overflow) {
    context.warnings.push({
      pageId: context.page.id,
      pageName: context.page.name,
      elementId: element.id,
      code: "text-overflow",
      message: `Текст не помещается в блоке «${visibleTitle.slice(0, 50)}».`,
    });
  }

  const frameTop = context.mediaHeightPt - context.trimOffsetTopPt - mm(element.y);
  const contentHeight = layout.consumedHeight + attributionSize + attributionGap;
  let top = frameTop - padding;
  if (typography.verticalAlign === "middle") {
    top -= Math.max(0, (mm(element.height) - padding * 2 - contentHeight) / 2);
  } else if (typography.verticalAlign === "bottom") {
    top -= Math.max(0, mm(element.height) - padding * 2 - contentHeight);
  }
  const left = xPt(context, element.x) + padding;

  layout.lines.forEach((line, index) => {
    const baseline = top - fontSize - index * lineHeight;
    drawLargeTrackedText(
      context.pdfPage,
      line.text,
      alignedX(typography.align, left, width, line.width),
      baseline,
      fontSize,
      font,
      color(typography.color),
      letterSpacing,
      element.type === "text" ? element.textEffects : undefined,
      normalizedOpacity(element.opacity),
    );
  });

  if (element.type === "month-text" && element.attribution) {
    const attributionFont = chooseFont(context.fonts, {
      ...typography,
      fontSizePt: attributionSize,
      fontWeight: 400,
    });
    const attributionWidth = trackedTextWidth(attributionFont, element.attribution, attributionSize, letterSpacing);
    drawTrackedText(
      context.pdfPage,
      element.attribution,
      alignedX(typography.align, left, width, attributionWidth),
      bottomPt(context, element.y + element.height - typography.paddingMm) - attributionSize * 0.15,
      attributionSize,
      attributionFont,
      color(typography.color),
      letterSpacing,
      normalizedOpacity(element.opacity),
    );
  }
}

function bytesFromDataUrl(source: string): Uint8Array | undefined {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s.exec(source);
  if (!match) return undefined;
  const payload = match[3] ?? "";
  if (match[2]) {
    if (typeof atob === "function") {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(payload, "base64"));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

async function bytesFromSource(
  source: string,
  options: PdfExportOptions,
): Promise<Uint8Array | undefined> {
  const inlineBytes = bytesFromDataUrl(source);
  if (inlineBytes) return inlineBytes;
  if (options.loadAssetSource) return options.loadAssetSource(source);
  if (typeof fetch !== "function") return undefined;
  try {
    const response = await fetch(source);
    if (!response.ok) return undefined;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function rasterizeDataUrl(
  source: string,
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array | undefined> {
  if (typeof document === "undefined" || typeof Image === "undefined") return undefined;
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("Не удалось растрировать изображение")), { once: true });
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.min(7000, Math.round(widthPx)));
  canvas.height = Math.max(1, Math.min(7000, Math.round(heightPx)));
  const drawing = canvas.getContext("2d");
  if (!drawing) return undefined;
  drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
}

async function embedAssetImage(
  context: PageContext,
  asset: DocumentAsset,
  element: Pick<LayoutElementNode, "width" | "height">,
): Promise<PDFImage | undefined> {
  try {
    const bytes = bytesFromDataUrl(asset.source);
    if (bytes && /png/i.test(asset.mimeType)) return context.pdfDocument.embedPng(bytes);
    if (bytes && /jpe?g/i.test(asset.mimeType)) return context.pdfDocument.embedJpg(bytes);
    const rasterized = await rasterizeDataUrl(
      asset.source,
      (element.width / 25.4) * 300,
      (element.height / 25.4) * 300,
    );
    if (rasterized) return context.pdfDocument.embedPng(rasterized);
  } catch {
    // A warning is added by the caller, keeping the remainder of the PDF usable.
  }
  return undefined;
}

function drawMissingAsset(context: PageContext, element: ImageElement | SvgElement, label: string): void {
  const x = xPt(context, element.x);
  const y = bottomPt(context, element.y, element.height);
  const width = mm(element.width);
  const height = mm(element.height);
  context.pdfPage.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: mm(0.25),
    borderColor: color("#8b9691"),
    color: color("#f4f1e8"),
  });
  context.pdfPage.drawLine({ start: { x, y }, end: { x: x + width, y: y + height }, thickness: mm(0.2), color: color("#a3aaa6") });
  context.pdfPage.drawLine({ start: { x: x + width, y }, end: { x, y: y + height }, thickness: mm(0.2), color: color("#a3aaa6") });
  const size = Math.min(12, Math.max(6, height * 0.09));
  const textWidth = context.fonts.regular.widthOfTextAtSize(label, size);
  context.pdfPage.drawText(label, {
    x: x + (width - textWidth) / 2,
    y: y + (height - size) / 2,
    size,
    font: context.fonts.regular,
    color: color("#53605a"),
  });
}

async function drawImageElement(
  context: PageContext,
  element: ImageElement | SvgElement,
): Promise<void> {
  const asset = context.assets.get(element.assetId);
  if (!asset) {
    drawMissingAsset(context, element, element.type === "svg" ? "SVG" : "ФОТО");
    context.warnings.push({
      pageId: context.page.id,
      pageName: context.page.name,
      elementId: element.id,
      code: "missing-asset",
      message: `Для объекта «${element.type === "svg" ? "SVG" : "Изображение"}» не выбран файл.`,
    });
    return;
  }
  const embedded = await embedAssetImage(context, asset, element);
  if (!embedded) {
    drawMissingAsset(context, element, "ФОРМАТ?");
    context.warnings.push({
      pageId: context.page.id,
      pageName: context.page.name,
      elementId: element.id,
      code: "unsupported-asset",
      message: `Файл «${asset.name}» не удалось поместить в PDF.`,
    });
    return;
  }

  const placement = calculateImagePlacement(
    { x: element.x, y: element.y, width: element.width, height: element.height },
    embedded.width,
    embedded.height,
    element.type === "image" ? element.fit : "fit",
    element.type === "image" ? element.crop : undefined,
  );
  const frameX = xPt(context, element.x);
  const frameY = bottomPt(context, element.y, element.height);
  const frameWidth = mm(element.width);
  const frameHeight = mm(element.height);
  const drawX = xPt(context, placement.x);
  const drawY = bottomPt(context, placement.y, placement.height);
  const drawWidth = mm(placement.width);
  const drawHeight = mm(placement.height);
  const clipped = element.type === "image" && element.fit === "crop";
  if (clipped) {
    context.pdfPage.pushOperators(
      pushGraphicsState(),
      rectangle(frameX, frameY, frameWidth, frameHeight),
      clip(),
      endPath(),
    );
  }
  context.pdfPage.drawImage(embedded, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
    opacity: normalizedOpacity(element.opacity),
  });
  if (clipped) context.pdfPage.pushOperators(popGraphicsState());
}

function weekdayLabels(element: CalendarGridElement, language: CalendarLanguage): readonly string[] {
  if (element.weekdayLabelMode === "custom" && element.customWeekdayLabels?.length === 7) {
    return element.customWeekdayLabels;
  }
  return calendarWeekdayLabels(language, element.weekdayLabelMode === "short");
}

function drawCalendarGrid(context: PageContext, element: CalendarGridElement): void {
  if (!context.calendar) return;
  const layout = buildCalendarGridLayout(element, context.calendar);
  const gridStyle = element.gridStyle ?? "editorial";
  if (layout.hasRowOverflow) {
    context.warnings.push({
      pageId: context.page.id,
      pageName: context.page.name,
      elementId: element.id,
      code: "calendar-overflow",
      message: `Для месяца требуется ${layout.requiredWeekRows} недель, а в сетке задано ${element.weekRows}.`,
    });
  }
  if (element.showFoodIcons) {
    const usedRules = new Set(
      context.calendar.days
        .filter((day) => day.date.month === element.month)
        .map((day) => resolveFoodRule(day, context.fastingProfileId).id)
        .filter((rule) => rule !== "no-fast"),
    );
    for (const rule of usedRules) {
      if (context.foodImages.has(rule)) continue;
      context.warnings.push({
        pageId: context.page.id,
        pageName: context.page.name,
        elementId: element.id,
        code: "missing-asset",
        message: `Не задано изображение для обозначения «${FOOD_RULES[rule].label}».`,
      });
    }
  }
  const headingFontSize = element.weekdayFontSizePt ?? 18;
  const headingFont = chooseFont(context.fonts, {
    fontFamily: context.calendarLanguage === "cu" ? "Monomakh Unicode" : element.weekdayFontFamily ?? "Ruslan Display",
    fontSizePt: headingFontSize,
    lineHeight: 1,
    letterSpacingPt: 0,
    fontWeight: 700,
    align: "center",
    verticalAlign: "middle",
    paddingMm: 0,
  });
  const labels = weekdayLabels(element, context.calendarLanguage);
  const availableLabelWidth = Math.max(1, mm(layout.columnWidth - 2));
  const widestRequestedLabel = Math.max(
    1,
    ...labels.map((label) => headingFont.widthOfTextAtSize(label, headingFontSize)),
  );
  const fittedHeadingSize = Math.max(
    0.1,
    headingFontSize * Math.min(1, availableLabelWidth / widestRequestedLabel),
  );
  labels.forEach((label, column) => {
    const cellX = element.x + layout.columnWidth * column;
    if (layout.headerHeight > 0) {
      if (gridStyle === "boxed") {
        context.pdfPage.drawRectangle({
          x: xPt(context, cellX),
          y: bottomPt(context, element.y, layout.headerHeight),
          width: mm(layout.columnWidth),
          height: mm(layout.headerHeight),
          color: color(column === 6 ? "#f0dfdc" : "#e6e8e4"),
          borderColor: color("#66736d"),
          borderWidth: mm(0.3),
        });
      }
      const labelWidth = headingFont.widthOfTextAtSize(label, fittedHeadingSize);
      drawLargeTrackedText(
        context.pdfPage,
        label,
        xPt(context, cellX) + (mm(layout.columnWidth) - labelWidth) / 2,
        bottomPt(context, element.y, layout.headerHeight * 0.64) - fittedHeadingSize * 0.35,
        fittedHeadingSize,
        headingFont,
        color(column === 6 ? "#9d2929" : "#26322d"),
        0,
        element.weekdayTextEffects,
      );
    }
  });
  if (gridStyle === "editorial" && layout.headerHeight > 0) {
    for (const headerY of [element.y, element.y + layout.headerHeight]) {
      context.pdfPage.drawLine({
        start: { x: xPt(context, element.x), y: bottomPt(context, headerY) },
        end: { x: xPt(context, element.x + element.width), y: bottomPt(context, headerY) },
        thickness: mm(0.45),
        color: color("#26322d"),
      });
    }
  }

  for (const cell of layout.cells) {
    const cellX = xPt(context, cell.x);
    const cellY = bottomPt(context, cell.y, cell.height);
    const cellWidth = mm(cell.width);
    const cellHeight = mm(cell.height);
    if (gridStyle === "boxed") {
      context.pdfPage.drawRectangle({
        x: cellX,
        y: cellY,
        width: cellWidth,
        height: cellHeight,
        color: color("#ffffff"),
        borderColor: color("#28342f"),
        borderWidth: mm(0.35),
      });
    } else if (gridStyle === "editorial") {
      context.pdfPage.drawLine({
        start: { x: cellX, y: cellY },
        end: { x: cellX + cellWidth, y: cellY },
        thickness: mm(0.28),
        color: color("#58645f"),
        dashArray: [mm(1.2), mm(1.05)],
      });
    }
    if (!cell.day) continue;

    const typography = calendarCellTypography(element);
    const numberStyle = dayNumberTypikonStyle(cell.day);
    const numberSize = mm(typography.dayNumberFontSizeMm);
    const numberFont = chooseFont(context.fonts, {
      fontFamily: element.dayNumberFontFamily ?? "Yeseva One",
      fontSizePt: element.dayNumberFontSizePt ?? 30,
      lineHeight: 1,
      letterSpacingPt: 0,
      fontWeight: numberStyle.fontWeight,
      align: "left",
      verticalAlign: "top",
      paddingMm: 0,
    });
    drawLargeTrackedText(
      context.pdfPage,
      String(cell.day.date.day),
      cellX + mm(typography.dayNumberXOffsetMm),
      bottomPt(context, cell.y + typography.dayNumberYOffsetMm + typography.dayNumberFontSizeMm) - numberSize * 0.12,
      numberSize,
      numberFont,
      color(element.showFeastColors === false ? "#17201d" : numberStyle.color),
      0,
      element.dayNumberTextEffects,
    );
    if (element.showOldStyleDate) {
      const oldStyle = `${calendarOldStylePrefix(context.calendarLanguage)} ${cell.day.oldStyleDate.day}.${cell.day.oldStyleDate.month}`;
      const oldStyleSize = mm(typography.oldStyleFontSizeMm);
      const oldStyleFont = chooseFont(context.fonts, {
        fontFamily: context.calendarLanguage === "cu" ? "Monomakh Unicode" : element.oldStyleFontFamily ?? "Cormorant Garamond",
        fontSizePt: element.oldStyleFontSizePt ?? 4.4,
        lineHeight: 1,
        letterSpacingPt: 0,
        fontWeight: 400,
        align: "left",
        verticalAlign: "top",
        paddingMm: 0,
      });
      context.pdfPage.drawText(oldStyle, {
        x: cellX + mm(typography.oldStyleXOffsetMm),
        y: bottomPt(context, cell.y + typography.oldStyleYOffsetMm + typography.oldStyleFontSizeMm) - oldStyleSize * 0.15,
        size: oldStyleSize,
        font: oldStyleFont,
        color: color("#76817c"),
      });
    }
    if (element.showFoodIcons && resolveFoodRule(cell.day, context.fastingProfileId).id !== "no-fast") {
      const marker = calendarFoodMarkerGeometry(element, cell);
      drawFoodMarker(
        context,
        resolveFoodRule(cell.day, context.fastingProfileId).id,
        cell.x + marker.xOffsetMm,
        cell.y + marker.yOffsetMm,
        marker.sizeMm,
      );
    }

    const eventMeasureFont = chooseFont(context.fonts, {
      fontFamily: context.calendarLanguage === "cu" ? "Monomakh Unicode" : element.eventFontFamily ?? "Cormorant Garamond",
      fontSizePt: element.eventFontSizePt ?? 10,
      lineHeight: element.eventLineHeight ?? 1.08,
      letterSpacingPt: 0,
      fontWeight: 400,
      align: "left",
      verticalAlign: "top",
      paddingMm: 0,
    });
    const eventTextLayout = layoutCalendarCellTextAutoFit(
      element,
      cell,
      (value, fontSizeMm) => eventMeasureFont.widthOfTextAtSize(value, mm(fontSizeMm)) / MM_TO_PT,
      context.calendarLanguage,
    );
    const primaryTypikonEvent = eventTextLayout.lines.find((line) => !line.isContinuation)?.event;
    if (element.showTypikonIcons === true && primaryTypikonEvent) {
      drawTypikonRankMarker(
        context,
        primaryTypikonEvent,
        cell.x + typography.eventMarkerXOffsetMm,
        cell.y + typography.eventMarkerYOffsetMm,
        typography.eventMarkerSizeMm,
      );
    }
    for (const line of eventTextLayout.lines) {
      const style = eventTypikonStyle(line.event, cell.day);
      const eventFont = chooseFont(context.fonts, {
        fontFamily: context.calendarLanguage === "cu" ? "Monomakh Unicode" : element.eventFontFamily ?? "Cormorant Garamond",
        fontSizePt: element.eventFontSizePt ?? 10,
        lineHeight: element.eventLineHeight ?? 1.08,
        letterSpacingPt: 0,
        fontWeight: style.fontWeight,
        align: "left",
        verticalAlign: "top",
        paddingMm: 0,
      });
      const eventSize = mm(line.fontSizeMm);
      context.pdfPage.drawText(line.text, {
        x: cellX + mm(line.x),
        y: bottomPt(context, cell.y + line.baselineY) - eventSize * 0.15,
        size: eventSize,
        font: eventFont,
        color: color(element.showFeastColors === false ? "#2a3530" : style.color),
      });
    }
  }
}

function drawTypikonRankMarker(
  context: PageContext,
  event: OrthodoxCalendarYear["days"][number]["events"][number],
  xMm: number,
  yMm: number,
  sizeMm: number,
): void {
  const kind = typikonMarkForEvent(event);
  const marker = context.typikonImages.get(kind);
  if (!marker) return;
  const size = mm(sizeMm);
  context.pdfPage.drawImage(marker, {
    x: xPt(context, xMm),
    y: bottomPt(context, yMm, sizeMm),
    width: size,
    height: size,
  });
}

function drawFoodMarker(
  context: PageContext,
  rule: FoodRuleId,
  xMm: number,
  yMm: number,
  sizeMm: number,
): void {
  const x = xPt(context, xMm);
  const y = bottomPt(context, yMm, sizeMm);
  const size = mm(sizeMm);
  const foodImage = context.foodImages.get(rule);
  if (!foodImage) return;
  const scale = Math.min(size / foodImage.width, size / foodImage.height);
  const width = foodImage.width * scale;
  const height = foodImage.height * scale;
  context.pdfPage.drawImage(foodImage, {
    x: x + (size - width) / 2,
    y: y + (size - height) / 2,
    width,
    height,
  });
}

function drawLegend(context: PageContext, element: Extract<LayoutElementNode, { type: "legend" }>): void {
  const items: Array<{ id: string; label: string; fill: string; foodRule?: FoodRuleId }> = [];
  const pageGrids = buildPageScene(context.page).elements.filter(
    (item): item is CalendarGridElement => item.type === "calendar-grid",
  );
  const months = new Set(pageGrids.map((grid) => grid.month));
  if (context.calendar?.days.some((day) => months.has(day.date.month) && day.events.some((event) => event.styleToken === "monastery-feast"))) {
    items.push({ id: "monastery", label: calendarMonasteryEventLabel(context.calendarLanguage), fill: "#8a641b" });
  }
  const rules = pageGrids.some((grid) => grid.showFoodIcons)
    ? usedFoodRulesForMonths(context.calendar?.days ?? [], months, context.fastingProfileId)
    : new Set<FoodRuleId>();
  for (const rule of Object.values(FOOD_RULES)) {
    if (rule.id !== "no-fast" && rules.has(rule.id)) {
      items.push({ id: rule.id, label: foodRuleLegendLabel(rule.id, context.calendarLanguage), fill: rule.color, foodRule: rule.id });
    }
  }
  const rowHeightMm = element.height;
  const baseFontSize = Math.min(mm(3.1), mm(rowHeightMm) * 0.42);
  const legendFont = chooseFont(context.fonts, {
    fontFamily: context.calendarLanguage === "cu" ? "Monomakh Unicode" : "Cormorant Garamond",
    fontSizePt: baseFontSize,
    lineHeight: 1,
    letterSpacingPt: 0,
    fontWeight: 600,
    align: "left",
    verticalAlign: "middle",
    paddingMm: 0,
  });
  const layout = buildRightAlignedLegendLayout(
    element.width,
    rowHeightMm,
    items,
    (value, fontSizeMm) => legendFont.widthOfTextAtSize(value, mm(fontSizeMm)) / MM_TO_PT,
  );
  const markerSize = layout.markerSizeMm;
  const fontSize = mm(layout.fontSizeMm);
  items.forEach((item, index) => {
    const itemLayout = layout.items[index]!;
    const x = xPt(context, element.x + itemLayout.xMm);
    const rowTopMm = element.y;
    const y = bottomPt(context, rowTopMm + rowHeightMm / 2) - fontSize * 0.32;
    if (item.foodRule) {
      drawFoodMarker(
        context,
        item.foodRule,
        element.x + itemLayout.xMm,
        rowTopMm + Math.max(0, (rowHeightMm - markerSize) / 2),
        markerSize,
      );
    }
    else context.pdfPage.drawCircle({ x: x + mm(markerSize / 2), y: bottomPt(context, rowTopMm + rowHeightMm / 2), size: mm(2.1), color: color(item.fill) });
    context.pdfPage.drawText(item.label, { x: x + mm(itemLayout.labelOffsetMm), y, size: fontSize, font: legendFont, color: color("#34413b") });
  });
}

function drawGradientShape(context: PageContext, element: ShapeElement, opacity: number): void {
  const gradient = element.fillGradient;
  if (!gradient || element.shape === "line") return;
  const x = xPt(context, element.x);
  const y = bottomPt(context, element.y, element.height);
  const width = mm(element.width);
  const height = mm(element.height);
  context.pdfPage.pushOperators(pushGraphicsState());
  if (element.shape === "ellipse") {
    const radiusX = width / 2;
    const radiusY = height / 2;
    const centerX = x + radiusX;
    const centerY = y + radiusY;
    const control = 0.5522847498307936;
    context.pdfPage.pushOperators(
      moveTo(centerX + radiusX, centerY),
      appendBezierCurve(
        centerX + radiusX, centerY + control * radiusY,
        centerX + control * radiusX, centerY + radiusY,
        centerX, centerY + radiusY,
      ),
      appendBezierCurve(
        centerX - control * radiusX, centerY + radiusY,
        centerX - radiusX, centerY + control * radiusY,
        centerX - radiusX, centerY,
      ),
      appendBezierCurve(
        centerX - radiusX, centerY - control * radiusY,
        centerX - control * radiusX, centerY - radiusY,
        centerX, centerY - radiusY,
      ),
      appendBezierCurve(
        centerX + control * radiusX, centerY - radiusY,
        centerX + radiusX, centerY - control * radiusY,
        centerX + radiusX, centerY,
      ),
      closePath(),
      clip(),
      endPath(),
    );
  } else {
    context.pdfPage.pushOperators(
      rectangle(x, y, width, height),
      clip(),
      endPath(),
    );
  }
  drawAxialGradient(
    context.pdfPage,
    gradient,
    opacity,
    gradient.direction === "horizontal"
      ? [x, y, x + width, y]
      : [x, y + height, x, y],
  );
  context.pdfPage.pushOperators(popGraphicsState());
}

function drawShape(context: PageContext, element: ShapeElement): void {
  const strokeColor = color(element.strokeColor, "#17201d");
  const fillColor = color(element.fillColor, "#f4f1e8");
  const opacity = normalizedOpacity(element.opacity);
  const usesGradient = Boolean(element.fillGradient && element.shape !== "line");
  if (usesGradient) drawGradientShape(context, element, opacity);
  if (element.shape === "rectangle") {
    context.pdfPage.drawRectangle({
      x: xPt(context, element.x),
      y: bottomPt(context, element.y, element.height),
      width: mm(element.width),
      height: mm(element.height),
      color: usesGradient ? undefined : fillColor,
      borderColor: strokeColor,
      borderWidth: mm(element.strokeWidthMm),
      opacity,
      borderOpacity: opacity,
    });
  } else if (element.shape === "ellipse") {
    context.pdfPage.drawEllipse({
      x: xPt(context, element.x + element.width / 2),
      y: bottomPt(context, element.y + element.height / 2),
      xScale: mm(element.width / 2),
      yScale: mm(element.height / 2),
      color: usesGradient ? undefined : fillColor,
      borderColor: strokeColor,
      borderWidth: mm(element.strokeWidthMm),
      opacity,
      borderOpacity: opacity,
    });
  } else {
    const upward = element.lineDirection === "up";
    context.pdfPage.drawLine({
      start: {
        x: xPt(context, element.x),
        y: bottomPt(context, upward ? element.y + element.height : element.y),
      },
      end: {
        x: xPt(context, element.x + element.width),
        y: bottomPt(context, upward ? element.y : element.y + element.height),
      },
      thickness: mm(element.strokeWidthMm),
      color: strokeColor,
      opacity,
    });
  }
}

async function drawElement(context: PageContext, element: LayoutElementNode): Promise<void> {
  const rotated = beginElementRotation(context, element);
  const masked = await beginElementMask(context, element);
  try {
    if (element.type === "text" || element.type === "month-text") {
      drawTextFrame(context, element);
    } else if (element.type === "shape") {
      drawShape(context, element);
    } else if (element.type === "calendar-grid") {
      drawCalendarGrid(context, element);
    } else if (element.type === "legend") {
      drawLegend(context, element);
    } else if (element.type === "image" || element.type === "svg") {
      await drawImageElement(context, element);
    }
  } finally {
    if (masked) context.pdfPage.pushOperators(popGraphicsState());
    if (rotated) context.pdfPage.pushOperators(popGraphicsState());
  }
}

async function embedFontFamily(
  pdfDocument: PDFDocument,
  files: PdfFontFamilyFiles,
): Promise<EmbeddedFontFamily> {
  const regular = await pdfDocument.embedFont(files.regular, { subset: true });
  const bold = files.bold
    ? await pdfDocument.embedFont(files.bold, { subset: true })
    : regular;
  const italic = files.italic
    ? await pdfDocument.embedFont(files.italic, { subset: true })
    : regular;
  const boldItalic = files.boldItalic
    ? await pdfDocument.embedFont(files.boldItalic, { subset: true })
    : files.bold
      ? bold
      : files.italic
        ? italic
        : regular;
  return { regular, bold, italic, boldItalic };
}

function setPdfXMetadata(pdfDocument: PDFDocument, project: CalendarProject): void {
  const now = new Date().toISOString();
  const title = project.name.replace(/[<>&]/gu, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[character] ?? character));
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" pdfxid:GTS_PDFXVersion="PDF/X-4" xmp:CreateDate="${now}" xmp:ModifyDate="${now}">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const metadata = pdfDocument.context.stream(new TextEncoder().encode(xmp), {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  pdfDocument.catalog.set(PDFName.of("Metadata"), pdfDocument.context.register(metadata));
  const infoRef = pdfDocument.context.trailerInfo.Info;
  if (infoRef) {
    const info = pdfDocument.context.lookup(infoRef, PDFDict);
    info.set(PDFName.of("GTS_PDFXVersion"), PDFString.of("PDF/X-4"));
    info.set(PDFName.of("Trapped"), PDFName.of("False"));
  }
}

async function attachOutputIntent(
  pdfDocument: PDFDocument,
  project: CalendarProject,
  assets: Map<string, DocumentAsset>,
  options: PdfExportOptions,
): Promise<boolean> {
  const profileId = project.printSettings?.iccProfileAssetId;
  const profileAsset = profileId ? assets.get(profileId) : undefined;
  if (!profileAsset) return false;
  const profileBytes = await bytesFromSource(profileAsset.source, options);
  if (!profileBytes?.length) return false;
  const profileStream = pdfDocument.context.flateStream(profileBytes, {
    N: PDFNumber.of(project.printSettings?.colorProfile === "CMYK-custom" ? 4 : 3),
  });
  const profileRef = pdfDocument.context.register(profileStream);
  const outputCondition = project.printSettings?.outputConditionName || profileAsset.name;
  const intent = pdfDocument.context.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFX"),
    OutputConditionIdentifier: PDFString.of(outputCondition),
    Info: PDFString.of(outputCondition),
    RegistryName: PDFString.of("https://www.color.org"),
    DestOutputProfile: profileRef,
  });
  const intentRef = pdfDocument.context.register(intent);
  pdfDocument.catalog.set(PDFName.of("OutputIntents"), pdfDocument.context.obj([intentRef]));
  return true;
}

export async function exportCalendarProjectPdf(
  project: CalendarProject,
  calendar: OrthodoxCalendarYear | undefined,
  fontFiles: PdfFontFiles,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.registerFontkit(fontkit);
  pdfDocument.setTitle(project.name);
  pdfDocument.setAuthor(project.publisherProfile.name || "Календарная мастерская");
  pdfDocument.setCreator("Календарная мастерская");
  pdfDocument.setProducer("Календарная мастерская / pdf-lib");
  pdfDocument.setSubject(`Православный календарь на ${project.year} год`);
  const warnings: PdfExportWarning[] = [];
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));

  const regular = await pdfDocument.embedFont(fontFiles.regular, { subset: true });
  const bold = await pdfDocument.embedFont(fontFiles.bold, { subset: true });
  const italic = await pdfDocument.embedFont(fontFiles.italic, { subset: true });
  const boldItalic = await pdfDocument.embedFont(fontFiles.boldItalic, { subset: true });
  const bundled = new Map<string, EmbeddedFontFamily>();
  for (const [family, files] of Object.entries(fontFiles.bundled ?? {})) {
    if (!files) continue;
    bundled.set(family.toLocaleLowerCase(), await embedFontFamily(pdfDocument, files));
  }
  const customFontFiles = new Map<string, PdfFontFamilyFiles>();
  for (const face of project.customFonts ?? []) {
    const asset = assets.get(face.assetId);
    if (!asset) continue;
    const bytes = await bytesFromSource(asset.source, options);
    if (!bytes) continue;
    const key = face.family.toLocaleLowerCase();
    const files = customFontFiles.get(key) ?? { regular: bytes };
    if (face.fontWeight >= 700 && face.fontStyle === "italic") files.boldItalic = bytes;
    else if (face.fontWeight >= 700) files.bold = bytes;
    else if (face.fontStyle === "italic") files.italic = bytes;
    else files.regular = bytes;
    customFontFiles.set(key, files);
  }
  for (const [family, files] of customFontFiles) {
    try {
      bundled.set(family, await embedFontFamily(pdfDocument, files));
    } catch {
      warnings.push({
        pageId: project.document.pages[0]?.id ?? "project",
        pageName: project.document.pages[0]?.name ?? project.name,
        code: "unsupported-font",
        message: `Пользовательский шрифт «${family}» не удалось встроить в PDF.`,
      });
    }
  }
  const fonts: EmbeddedFonts = {
    regular,
    bold,
    italic,
    boldItalic,
    serifRegular: fontFiles.serifRegular ? await pdfDocument.embedFont(fontFiles.serifRegular, { subset: true }) : regular,
    serifBold: fontFiles.serifBold ? await pdfDocument.embedFont(fontFiles.serifBold, { subset: true }) : bold,
    serifItalic: fontFiles.serifItalic ? await pdfDocument.embedFont(fontFiles.serifItalic, { subset: true }) : italic,
    serifBoldItalic: fontFiles.serifBoldItalic ? await pdfDocument.embedFont(fontFiles.serifBoldItalic, { subset: true }) : boldItalic,
    bundled,
  };
  const foodImages = new Map<FoodRuleId, PDFImage>();
  for (const rule of Object.keys(FOOD_RULES) as FoodRuleId[]) {
    const assetId = project.foodMarkerAssets?.[rule];
    const customAsset = assetId ? assets.get(assetId) : undefined;
    const source = customAsset?.source ?? foodMarkerPackSource(project.foodMarkerPackId, rule);
    const mimeType = customAsset?.mimeType ?? "image/png";
    const bytes = await bytesFromSource(source, options);
    if (!bytes) continue;
    try {
      if (/png/i.test(mimeType) || /\.png(?:$|[?#])/i.test(source)) {
        foodImages.set(rule, await pdfDocument.embedPng(bytes));
      } else if (/jpe?g/i.test(mimeType) || /\.jpe?g(?:$|[?#])/i.test(source)) {
        foodImages.set(rule, await pdfDocument.embedJpg(bytes));
      }
    } catch {
      // A damaged custom marker does not prevent the rest of the print document
      // from being exported; preflight still reports missing placed assets.
    }
  }
  const typikonImages = new Map<TypikonMarkKind, PDFImage>();
  for (const kind of Object.keys(TYPIKON_MARKERS) as TypikonMarkKind[]) {
    const source = typikonMarkerPdfSource(kind);
    const bytes = await bytesFromSource(source, options);
    if (!bytes) continue;
    try {
      typikonImages.set(kind, await pdfDocument.embedPng(bytes));
    } catch {
      // The calendar remains exportable if an installed marker file is damaged.
    }
  }
  if (project.printSettings?.pdfStandard === "PDF/X-4") {
    setPdfXMetadata(pdfDocument, project);
    if (!await attachOutputIntent(pdfDocument, project, assets, options)) {
      warnings.push({
        pageId: project.document.pages[0]?.id ?? "project",
        pageName: project.document.pages[0]?.name ?? project.name,
        code: "missing-output-profile",
        message: "PDF/X-4 создан без Output Intent: загрузите ICC-профиль типографии.",
      });
    }
  }

  for (const page of project.document.pages) {
    const scene = buildPageScene(page);
    const mediaWidthPt = mm(scene.mediaBox.width);
    const mediaHeightPt = mm(scene.mediaBox.height);
    const pdfPage = pdfDocument.addPage([mediaWidthPt, mediaHeightPt]);
    const leftBleedPt = mm(page.bleed.left);
    const bottomBleedPt = mm(page.bleed.bottom);
    pdfPage.setMediaBox(0, 0, mediaWidthPt, mediaHeightPt);
    pdfPage.setBleedBox(0, 0, mediaWidthPt, mediaHeightPt);
    pdfPage.setTrimBox(leftBleedPt, bottomBleedPt, mm(page.width), mm(page.height));
    pdfPage.setArtBox(
      leftBleedPt + mm(page.safeArea.left),
      bottomBleedPt + mm(page.safeArea.bottom),
      mm(page.width - page.safeArea.left - page.safeArea.right),
      mm(page.height - page.safeArea.top - page.safeArea.bottom),
    );
    pdfPage.drawRectangle({ x: 0, y: 0, width: mediaWidthPt, height: mediaHeightPt, color: color("#ffffff") });

    const context: PageContext = {
      pdfDocument,
      pdfPage,
      page,
      calendar,
      fastingProfileId: project.fastingProfileId,
      calendarLanguage: project.calendarLanguage ?? "ru",
      fonts,
      assets,
      warnings,
      foodImages,
      typikonImages,
      mediaHeightPt,
      trimOffsetXPt: leftBleedPt,
      trimOffsetTopPt: mm(page.bleed.top),
    };
    for (const element of scene.elements) await drawElement(context, element);
    const printSettings = project.printSettings;
    if (printSettings?.includeCropMarks) {
      for (const segment of buildCropMarkSegments(page, printSettings)) {
        pdfPage.drawLine({
          start: { x: xPt(context, segment.start.x), y: bottomPt(context, segment.start.y) },
          end: { x: xPt(context, segment.end.x), y: bottomPt(context, segment.end.y) },
          thickness: mm(0.15),
          color: color("#000000"),
        });
      }
    }
  }

  const reportedFoodMarkers = new Set<string>();
  const deduplicatedWarnings = warnings.filter((warning) => {
    if (!warning.message.startsWith("Не задано изображение для обозначения")) return true;
    if (reportedFoodMarkers.has(warning.message)) return false;
    reportedFoodMarkers.add(warning.message);
    return true;
  });
  return {
    bytes: await pdfDocument.save({ useObjectStreams: true, addDefaultPage: false }),
    warnings: deduplicatedWarnings,
  };
}

export function collectBundledFontFamilies(project: CalendarProject): Set<BundledFontFamily> {
  const result = new Set<BundledFontFamily>();
  const knownFamilies = new Map(
    (Object.keys(BUNDLED_FONT_FILES) as BundledFontFamily[]).map((family) => [family.toLocaleLowerCase(), family]),
  );
  const add = (family: string | undefined): void => {
    if (!family) return;
    const bundled = knownFamilies.get(family.trim().toLocaleLowerCase());
    if (bundled) result.add(bundled);
  };
  // Church-Slavonic combining marks and historic Cyrillic must not silently
  // fall back to .notdef glyphs in the PDF encoder.
  if (project.calendarLanguage === "cu") add("Monomakh Unicode");

  for (const page of project.document.pages) {
    for (const element of page.elements) {
      if (element.type === "text" || element.type === "month-text") {
        add(element.typography.fontFamily);
      } else if (element.type === "calendar-grid") {
        add(element.weekdayFontFamily ?? "Ruslan Display");
        add(element.dayNumberFontFamily ?? "Yeseva One");
        add(element.eventFontFamily ?? "Cormorant Garamond");
        add(element.oldStyleFontFamily ?? "Cormorant Garamond");
      } else if (element.type === "legend") {
        add("Cormorant Garamond");
      }
    }
  }
  return result;
}

export async function loadPdfFontFiles(
  baseUrl = "/fonts",
  requestedFamilies?: ReadonlySet<BundledFontFamily>,
): Promise<PdfFontFiles> {
  async function load(name: string): Promise<Uint8Array> {
    const response = await fetch(`${baseUrl}/${name}`);
    if (!response.ok) throw new Error(`Не удалось загрузить шрифт ${name}: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const [regular, bold, italic, boldItalic, serifRegular, serifBold, serifItalic, serifBoldItalic] = await Promise.all([
    load("DejaVuSans.ttf"),
    load("DejaVuSans-Bold.ttf"),
    load("DejaVuSans-Oblique.ttf"),
    load("DejaVuSans-BoldOblique.ttf"),
    load("DejaVuSerif.ttf"),
    load("DejaVuSerif-Bold.ttf"),
    load("DejaVuSerif-Italic.ttf"),
    load("DejaVuSerif-BoldItalic.ttf"),
  ]);
  const bundled = {} as Record<BundledFontFamily, PdfFontFamilyFiles>;
  for (const [family, files] of Object.entries(BUNDLED_FONT_FILES) as Array<
    [BundledFontFamily, (typeof BUNDLED_FONT_FILES)[BundledFontFamily]]
  >) {
    if (requestedFamilies && !requestedFamilies.has(family)) continue;
    const regularFile = await load(files.regular);
    const boldFile = files.bold ? await load(files.bold) : undefined;
    const italicFile = files.italic ? await load(files.italic) : undefined;
    const boldItalicFile = files.boldItalic ? await load(files.boldItalic) : undefined;
    bundled[family] = {
      regular: regularFile,
      ...(boldFile ? { bold: boldFile } : {}),
      ...(italicFile ? { italic: italicFile } : {}),
      ...(boldItalicFile ? { boldItalic: boldItalicFile } : {}),
    };
  }
  return {
    regular,
    bold,
    italic,
    boldItalic,
    serifRegular,
    serifBold,
    serifItalic,
    serifBoldItalic,
    bundled,
  };
}
