import { attachElementToLayer, createEmptyLayer } from "../document/layer-operations";
import type {
  LayoutElementNode,
  PageLayerNode,
  PageModel,
  PageObjectLayer,
  TextTypography,
} from "../document/types";
import type { EditorTool } from "./types";
import { applyDefaultCalendarCellGeometry } from "../templates/calendar-cell-defaults";

export interface ElementFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  lineDirection?: "down" | "up";
}

export interface CreatedElement {
  layer: PageObjectLayer;
  element: LayoutElementNode;
}

export type ElementIdFactory = () => string;

export interface CreateElementOptions {
  idFactory?: ElementIdFactory;
  fillColor?: string;
  strokeColor?: string;
}

const DEFAULT_TYPOGRAPHY: TextTypography = {
  fontFamily: "Cormorant Garamond",
  fontSizePt: 12,
  lineHeight: 1.2,
  letterSpacingPt: 0,
  color: "#17201d",
  fontWeight: 400,
  fontStyle: "normal",
  align: "left",
  verticalAlign: "top",
  paddingMm: 2,
};

const OBJECT_LABELS: Partial<Record<EditorTool, string>> = {
  text: "Текст",
  image: "Изображение",
  rectangle: "Прямоугольник",
  ellipse: "Эллипс",
  line: "Линия",
  svg: "SVG-декор",
  "calendar-grid": "Календарная сетка",
};

export function createElementOnOwnLayer(
  page: PageModel,
  tool: EditorTool,
  frame: ElementFrame,
  options: CreateElementOptions = {},
): CreatedElement {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const label = OBJECT_LABELS[tool];
  if (!label) throw new Error(`Инструмент ${tool} не создаёт печатные объекты`);

  const layer = createEmptyLayer(page, `layer-object-${idFactory()}`, label);
  const common = {
    id: `element-${idFactory()}`,
    layerId: layer.id,
    x: frame.x,
    y: frame.y,
    width: Math.max(frame.width, tool === "line" ? 1 : 5),
    height: Math.max(frame.height, tool === "line" ? 0.2 : 5),
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    overflow: "none" as const,
  };

  let element: LayoutElementNode;
  switch (tool) {
    case "text":
      element = {
        ...common,
        type: "text",
        content: { title: "Новый текст" },
        typography: { ...DEFAULT_TYPOGRAPHY, color: options.fillColor ?? DEFAULT_TYPOGRAPHY.color },
      };
      break;
    case "image":
      element = { ...common, type: "image", assetId: "", fit: "crop", opacity: 1 };
      break;
    case "rectangle":
    case "ellipse":
      element = {
        ...common,
        type: "shape",
        shape: tool,
        fillToken: "paper",
        strokeToken: "ordinary-day",
        strokeWidthMm: 0.35,
        fillColor: options.fillColor ?? "#f4f1e8",
        strokeColor: options.strokeColor ?? "#17201d",
      };
      break;
    case "line":
      element = {
        ...common,
        type: "shape",
        shape: "line",
        strokeToken: "ordinary-day",
        strokeWidthMm: 0.35,
        strokeColor: options.strokeColor ?? "#17201d",
        lineDirection: frame.lineDirection ?? "down",
      };
      break;
    case "svg":
      element = { ...common, type: "svg", assetId: "", preserveAspectRatio: true };
      break;
    case "calendar-grid":
      element = {
        ...common,
        type: "calendar-grid",
        month: 1,
        columns: 7,
        weekRows: 6,
        showOverflowWarnings: true,
        showWeekdayHeader: true,
        weekdayLabelMode: "full",
        showOldStyleDate: false,
        maxVisibleEvents: 3,
        showFoodIcons: true,
        showFeastColors: true,
        showTypikonIcons: false,
        showFastingText: false,
        showMarriageRules: false,
        showScriptureReadings: false,
        commemorationDetail: "standard",
        commemorationFilter: {
          "pascha-and-twelve": true,
          great: true,
          medium: true,
          memorial: true,
        },
        minorCommemorationFallback: 2,
        dayNumberFontFamily: "Yeseva One",
        eventFontFamily: "Cormorant Garamond",
        dayNumberFontSizePt: 30,
        eventFontSizePt: 10,
        autoFitText: true,
        minimumEventFontSizePt: 9,
        eventLineSpacingPt: 0.8,
        eventGapPt: 1,
        cellPaddingMm: 1.5,
        gridStyle: "editorial",
        weekdayFontFamily: "Ruslan Display",
        weekdayFontSizePt: 18,
      };
      applyDefaultCalendarCellGeometry(element);
      break;
    default:
      throw new Error(`Инструмент ${tool} не поддерживается`);
  }

  attachElementToLayer(page, layer.id, element);
  return { layer, element };
}

export function duplicateElementOnOwnLayer(
  page: PageModel,
  elementId: string,
  options: CreateElementOptions = {},
): CreatedElement | undefined {
  const source = page.elements.find((element) => element.id === elementId);
  if (!source) return undefined;
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const sourceLayer = flattenLayers(page.layers).find((layer) => layer.id === source.layerId);
  const layer = createEmptyLayer(
    page,
    `layer-object-${idFactory()}`,
    `${sourceLayer?.name ?? "Объект"} — копия`,
  );
  const element = JSON.parse(JSON.stringify(source)) as LayoutElementNode;
  element.id = `element-${idFactory()}`;
  element.layerId = layer.id;
  element.x += 5;
  element.y += 5;
  attachElementToLayer(page, layer.id, element);
  return { layer, element };
}

function flattenLayers(nodes: PageLayerNode[]): PageObjectLayer[] {
  return nodes.flatMap((node) =>
    node.kind === "group" ? flattenLayers(node.children) : [node],
  );
}
