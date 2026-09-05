import type { FoodMarkerPackId } from "../calendar/presentation/marker-packs";

export type DocumentUnit = "mm";
export type OverflowState = "none" | "warning" | "error";

export type PageKind = "cover" | "month" | "information";
export type PageFormatId = "A3" | "A4" | "A5" | "A6";
export type PageOrientation = "portrait" | "landscape";
export type LayoutElementType =
  | "text"
  | "image"
  | "shape"
  | "svg"
  | "calendar-grid"
  | "month-text"
  | "legend";

export interface CornerRadiiMm {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * Base type for every printable element.
 * All geometry is expressed in millimetres in the trim-box coordinate system.
 */
export interface LayoutElement<TType extends LayoutElementType = LayoutElementType> {
  id: string;
  type: TType;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  overflow: OverflowState;
  styleToken?: string;
  /** Object opacity: 0 is fully transparent, 1 is fully opaque. */
  opacity?: number;
  /** Non-destructive clipping radius for the printable object frame. */
  cornerRadiusMm?: number;
  /** Optional independent radii used when the four corners are unlinked. */
  cornerRadiiMm?: CornerRadiiMm;
}

/** A non-destructive luminosity mask attached to an object layer. */
export interface LayerMask {
  enabled: boolean;
  /** Image or SVG asset: white reveals, black hides, gray is translucent. */
  assetId: string;
}

export interface TextVariants {
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
}

export interface TextTypography {
  fontFamily: string;
  fontSizePt: number;
  lineHeight: number;
  letterSpacingPt: number;
  color?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  align: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  paddingMm: number;
}

export interface TextElement extends LayoutElement<"text"> {
  content: TextVariants;
  typography: TextTypography;
  /** Optional print-safe effects intended for display-size headings. */
  textEffects?: LargeTextEffects;
}

export interface ImageCrop {
  /** Horizontal crop focus, normalized to 0..1 (0 = left, 0.5 = centre, 1 = right). */
  x: number;
  /** Vertical crop focus, normalized to 0..1 (0 = top, 0.5 = centre, 1 = bottom). */
  y: number;
  /** Reserved for a future crop-window width; currently kept at 1. */
  width: number;
  /** Reserved for a future crop-window height; currently kept at 1. */
  height: number;
}

export interface ImageElement extends LayoutElement<"image"> {
  assetId: string;
  fit: "fill" | "fit" | "crop";
  crop?: ImageCrop;
  opacity: number;
}

export interface ShapeElement extends LayoutElement<"shape"> {
  shape: "rectangle" | "ellipse" | "line";
  fillToken?: string;
  strokeToken?: string;
  strokeWidthMm: number;
  fillColor?: string;
  strokeColor?: string;
  fillGradient?: LinearGradientFill;
  lineDirection?: "down" | "up";
}

export interface LinearGradientFill {
  kind: "linear-gradient";
  direction: "horizontal" | "vertical";
  startColor: string;
  centerColor: string;
  endColor: string;
}

export interface TextShadowEffect {
  color: string;
  offsetXMm: number;
  offsetYMm: number;
  blurMm: number;
  opacity: number;
}

export interface TextExtrusionEffect {
  color: string;
  depthMm: number;
  angleDeg: number;
  opacity: number;
}

export interface LargeTextEffects {
  gradient?: LinearGradientFill;
  extrusion?: TextExtrusionEffect;
  shadow?: TextShadowEffect;
}

export interface SvgElement extends LayoutElement<"svg"> {
  assetId: string;
  preserveAspectRatio: boolean;
  /** Present for SVGs inserted from the built-in decorative library. */
  libraryItemId?: string;
  decorColor?: string;
}

export type CommemorationRankFilterId =
  | "pascha-and-twelve"
  | "great"
  | "medium"
  | "memorial";

export type CommemorationRankFilter = Record<CommemorationRankFilterId, boolean>;

export interface CalendarGridElement extends LayoutElement<"calendar-grid"> {
  month: number;
  columns: 7;
  weekRows: 4 | 5 | 6;
  showOverflowWarnings: boolean;
  showWeekdayHeader: boolean;
  weekdayLabelMode: "full" | "short" | "custom";
  customWeekdayLabels?: [string, string, string, string, string, string, string];
  showOldStyleDate: boolean;
  maxVisibleEvents: number;
  showFoodIcons: boolean;
  showFeastColors: boolean;
  showTypikonIcons?: boolean;
  showFastingText?: boolean;
  showMarriageRules?: boolean;
  showScriptureReadings?: boolean;
  commemorationDetail?: "main" | "standard" | "full" | "custom";
  commemorationFilter?: CommemorationRankFilter;
  minorCommemorationFallback?: number;
  dayNumberFontFamily?: string;
  eventFontFamily?: string;
  dayNumberFontSizePt?: number;
  /** Absolute position inside every day cell, measured from its top-left corner. */
  dayNumberXOffsetMm?: number;
  dayNumberYOffsetMm?: number;
  oldStyleFontFamily?: string;
  oldStyleFontSizePt?: number;
  oldStyleXOffsetMm?: number;
  oldStyleYOffsetMm?: number;
  foodMarkerSizeMm?: number;
  foodMarkerXOffsetMm?: number;
  foodMarkerYOffsetMm?: number;
  eventFontSizePt?: number;
  eventTextXOffsetMm?: number;
  eventTextYOffsetMm?: number;
  eventTextRightInsetMm?: number;
  eventTextBottomInsetMm?: number;
  typikonMarkerSizeMm?: number;
  typikonMarkerXOffsetMm?: number;
  typikonMarkerYOffsetMm?: number;
  autoFitText?: boolean;
  minimumEventFontSizePt?: number;
  /** Extra leading between lines of the same event, in typographic points. */
  eventLineSpacingPt?: number;
  /** Extra distance between two separate events, in typographic points. */
  eventGapPt?: number;
  /** @deprecated Legacy multiplier; migrated to eventLineSpacingPt. */
  eventLineHeight?: number;
  cellPaddingMm?: number;
  gridStyle?: "editorial" | "boxed" | "minimal";
  weekdayFontFamily?: string;
  weekdayFontSizePt?: number;
  weekdayTextEffects?: LargeTextEffects;
  dayNumberTextEffects?: LargeTextEffects;
}

export interface MonthTextElement extends LayoutElement<"month-text"> {
  content: TextVariants;
  attribution?: string;
  placement: "fixed-frame" | "trailing-free-cells" | "calendar-free-cells";
  typography: TextTypography;
}

export interface LegendElement extends LayoutElement<"legend"> {
  generatedFromVisibleMarkers: true;
  columns: number;
}

export type LayoutElementNode =
  | TextElement
  | ImageElement
  | ShapeElement
  | SvgElement
  | CalendarGridElement
  | MonthTextElement
  | LegendElement;

export interface PageInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageModel {
  id: string;
  name: string;
  kind: PageKind;
  formatId: PageFormatId;
  orientation: PageOrientation;
  width: number;
  height: number;
  bleed: PageInsets;
  safeArea: PageInsets;
  backgroundToken: string;
  layers: PageLayerNode[];
  elements: LayoutElementNode[];
}

export interface PageLayerBase {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
  color: string;
  /** A system layer that the editor must not rename, move, hide or remove. */
  protected?: boolean;
  /** Keeps this layer above ordinary printable layers. */
  pinnedToFront?: boolean;
}

/** A leaf in the page layer tree. It may contain zero or one printable object. */
export interface PageObjectLayer extends PageLayerBase {
  kind: "layer";
  elementId?: string;
  mask?: LayerMask;
}

/** A non-printing folder used to organise layers and nested folders. */
export interface PageLayerGroup extends PageLayerBase {
  kind: "group";
  expanded: boolean;
  children: PageLayerNode[];
}

export type PageLayerNode = PageObjectLayer | PageLayerGroup;

export interface DocumentModel {
  schemaVersion: 1;
  unit: DocumentUnit;
  title: string;
  pages: PageModel[];
}

export interface DocumentAsset {
  id: string;
  name: string;
  mimeType: string;
  source: string;
  kind: "image" | "svg" | "font" | "icc-profile";
  widthPx?: number;
  heightPx?: number;
  /** Stable id for reusable raster assets inserted from the built-in library. */
  libraryItemId?: string;
}

export interface ProjectFontFace {
  assetId: string;
  family: string;
  fontWeight: 400 | 700;
  fontStyle: "normal" | "italic";
}

export interface PublisherProfile {
  name: string;
  logoAssetId?: string;
  contactText?: string;
}

export interface PrintSettings {
  includeCropMarks: boolean;
  cropMarkLengthMm: number;
  cropMarkOffsetMm: number;
  bindingEdge?: "none" | "top" | "left" | "right";
  bindingSafeMm?: number;
  pdfStandard?: "PDF-1.7" | "PDF/X-4";
  colorProfile?: "sRGB" | "CMYK-custom";
  iccProfileAssetId?: string;
  outputConditionName?: string;
}

export interface MonasteryEvent {
  id: string;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  dateRule:
    | { type: "annual"; month: number; day: number }
    | { type: "once"; date: string };
  priority: number;
  styleToken?: string;
  iconAssetId?: string;
  notes?: string;
}

export interface ThemeStyleToken {
  id: string;
  label: string;
  numberColor?: string;
  textColor?: string;
  backgroundColor?: string;
  fontWeight?: number;
}

export interface StyleTheme {
  id: string;
  name: string;
  tokens: Record<string, ThemeStyleToken>;
}

export interface CalendarProject {
  schemaVersion: 1;
  /** Additive layout defaults migration, independent from the file schema. */
  layoutRevision?: number;
  id: string;
  name: string;
  publisherProfile: PublisherProfile;
  year: number;
  fastingProfileId?: "typikon-strict" | "parish";
  calendarData: unknown;
  monasteryEvents: MonasteryEvent[];
  styleTheme: StyleTheme;
  assets: DocumentAsset[];
  customFonts?: ProjectFontFace[];
  printSettings?: PrintSettings;
  foodMarkerPackId?: FoodMarkerPackId;
  foodMarkerAssets?: Partial<Record<
    | "no-fast"
    | "fast"
    | "fish"
    | "oil"
    | "boiled-no-oil"
    | "dry-eating"
    | "strict-fast"
    | "dairy-eggs"
    | "memorial",
    string
  >>;
  document: DocumentModel;
}
