import { expect, test } from "@playwright/test";

async function openEditor(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("orthodox-calendar-layout:verified-email-token", "e2e-local-token"));
  await page.goto("/");
  await page.getByTestId("welcome-create").click();
  await expect(page.locator(".workspace")).toBeVisible();
}

test("shows a readable mobile welcome page and keeps the editor on a large screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?shared=mobile-link-must-not-lock");

  await expect(page.getByRole("heading", { name: "Создайте православный календарь, готовый к печати" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Свято‑Георгиевский мужской монастырь" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ATAPIN.DE", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByLabel("Язык интерфейса").selectOption("de");
  await expect(page.getByRole("heading", { name: "Erstellen Sie einen druckfertigen orthodoxen Kalender" })).toBeVisible();
  await page.getByLabel("Sprache der Benutzeroberfläche").selectOption("ru");

  await page.getByTestId("welcome-create").click();
  const notice = page.getByRole("dialog", { name: "Для работы нужен большой экран" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Откройте, пожалуйста, эту же страницу или полученную ссылку на компьютере.");
  await expect(page.locator(".shared-lock-backdrop")).toHaveCount(0);
});

test("changes the interface language from File settings and remembers it locally", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-program-settings").click();

  const dialog = page.getByRole("dialog", { name: "Настройки программы" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("English").check();
  await dialog.getByRole("button", { name: "Применить" }).click();

  await expect(page.getByRole("button", { name: "File", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Properties" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("orthodox-calendar-layout:interface-language"))).toBe("en");

  await page.getByRole("button", { name: "Calendar templates" }).click();
  await page.getByRole("button", { name: "Create cover and 12 months" }).click();
  await page.getByRole("tab", { name: "Pages" }).click();
  await page.locator(".page-card").nth(1).click();
  await expect(page.locator(".page-element__calendar-weekday").first()).toContainText("Понедельник");

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTestId("menu-command-program-settings").click();
  await page.getByRole("dialog", { name: "Program settings" }).getByLabel("Українська").check();
  await page.getByRole("dialog", { name: "Program settings" }).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Редагування", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-program-settings").click();
  await page.getByRole("dialog", { name: "Налаштування програми" }).getByLabel("Deutsch").check();
  await page.getByRole("dialog", { name: "Налаштування програми" }).getByRole("button", { name: "Застосувати" }).click();
  await expect(page.getByRole("button", { name: "Bearbeiten", exact: true })).toBeVisible();
});

test("changes printed calendar language independently from the interface", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByText("XML: 3811", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Файл", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Шаблоны календаря" }).click();
  await page.getByRole("button", { name: "Создать обложку и 12 месяцев" }).click();
  await page.getByRole("tab", { name: "Страницы" }).click();
  await page.locator(".page-card").nth(1).click();
  await page.getByRole("tab", { name: "Свойства" }).click();
  await page.getByTestId("calendar-language-select").selectOption("pl");
  await expect(page.getByTestId("calendar-language-select")).toHaveValue("pl");

  await expect(page.locator(".page-element__calendar-weekday").first()).toContainText("Poniedziałek");
  await expect(page.locator('.page-element[data-element-type="text"]')).toContainText("Styczeń 2027");
  await expect(page.locator(".calendar-cell__event").filter({ hasText: "Narodzenie" }).first()).toBeVisible();
  await expect(page.locator(".calendar-cell__event").filter({ hasText: "Chrystusa" }).first()).toBeVisible();

  await page.getByTestId("calendar-language-select").selectOption("cu");
  await expect(page.locator(".page-element__calendar-weekday").last()).toContainText("недѣ́лѧ");
  await expect(page.locator('.page-element[data-element-type="text"]')).toContainText("і҆аннꙋарїй 2027");
});

test("inserts a print-ready transparent gold ornament from the objects library", async ({ page }) => {
  await openEditor(page);
  expect(await page.evaluate(async () => {
    const query = '18px "Monomakh Unicode"';
    await document.fonts.load(query, "ЯНВАРЬ");
    return document.fonts.check(query, "ЯНВАРЬ");
  })).toBe(true);
  await page.getByRole("tab", { name: "Элементы" }).click();
  await expect(page.getByTestId("decor-collection-gold")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".decor-library__summary")).toContainText("22 из 22");
  const ornament = page.locator(".decor-library__item").filter({ hasText: "Золотой православный крест" });
  await expect(ornament).toContainText("PNG · 300 dpi");
  await ornament.click();

  const inserted = page.locator('.page-element[data-element-type="image"].page-element--selected');
  await expect(inserted).toHaveCount(1);
  await expect(page.locator(".status-bar__notice")).toContainText("Золотой православный крест");
  await expect(page.locator(".status-bar__notice")).toContainText("300 dpi");

  await page.getByRole("tab", { name: "Страницы" }).click();
  await expect(page.getByRole("tab", { name: "Страницы" })).toHaveAttribute("aria-selected", "true");
  await inserted.click({ force: true });
  await expect(page.getByRole("tab", { name: "Свойства" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Заменить файл…" })).toBeVisible();
});

test("keeps the compulsory workshop logo immutable on the top layer", async ({ page }) => {
  await openEditor(page);
  const logo = page.locator('g.page-element[data-element-type="image"]').filter({
    has: page.locator('image[href="/brand/logo-kalendar.png"]'),
  });
  await expect(logo).toHaveCount(1);
  await page.getByRole("tab", { name: "Слои" }).click();
  const brandRow = page.locator(".layer-row").filter({ hasText: "Фирменный знак Календарной мастерской" });
  await expect(brandRow).toHaveCount(1);
  await brandRow.click();
  await expect(brandRow.locator("button").nth(0)).toBeDisabled();
  await expect(brandRow.locator("button").nth(1)).toBeDisabled();
  await expect(page.locator('.layers-toolbar button[title="Удалить выбранное (Delete)"]')).toBeDisabled();

  await page.getByRole("tab", { name: "Свойства" }).click();
  await expect(page.getByTestId("protected-brand-notice")).toContainText("самом верхнем слое");
  await expect(page.getByTestId("object-opacity")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Заменить файл…" })).toHaveCount(0);
  await expect(page.locator(".geometry-controls input")).toHaveCount(5);
  await expect(page.locator(".geometry-controls input:enabled")).toHaveCount(0);

  await page.getByRole("tab", { name: "Слои" }).click();
  await page.locator('.layers-toolbar button[title="Новый пустой слой"]').click();
  await expect(page.locator(".layer-row").first()).toContainText("Фирменный знак Календарной мастерской");
});

test("separates gold and SVG object collections", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Элементы" }).click();

  await expect(page.locator(".decor-library__item").filter({ hasText: "Золотой православный крест" })).toBeVisible();
  await expect(page.locator(".decor-library__item-meta").first()).toContainText("PNG · 300 dpi");

  await page.getByTestId("decor-collection-svg").click();
  await expect(page.getByTestId("decor-collection-svg")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".decor-library__summary")).toContainText("127 из 127");
  await expect(page.locator(".decor-library__item").filter({ hasText: "Золотой православный крест" })).toHaveCount(0);
  await expect(page.locator(".decor-library__item").first()).toBeVisible();
  await expect(page.locator(".decor-library__item-meta")).toHaveCount(0);
});

test("keeps opened calendar pages in lightweight closable tabs", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Шаблоны календаря" }).click();
  await page.getByRole("button", { name: "Создать обложку и 12 месяцев" }).click();
  await page.getByRole("tab", { name: "Страницы" }).click();

  const openTabs = page.getByRole("tablist", { name: "Открытые страницы" });
  await expect(openTabs.getByRole("tab")).toHaveCount(1);
  await page.locator(".page-card").nth(1).click();
  await page.locator(".page-card").nth(2).click();
  await expect(openTabs.getByRole("tab")).toHaveCount(3);
  await expect(openTabs.getByRole("tab", { name: /Февраль 2027/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Закрыть вкладку «Январь 2027»" }).click();
  await expect(openTabs.getByRole("tab")).toHaveCount(2);
  await expect(page.locator(".page-card")).toHaveCount(13);
  await page.getByRole("button", { name: "Закрыть вкладку «Февраль 2027»" }).click();
  await expect(openTabs.getByRole("tab", { name: /Обложка 2027/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Закрыть вкладку «Обложка 2027»" }).click();
  await expect(openTabs.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText("Все вкладки закрыты")).toBeVisible();
  await expect(page.locator(".page-card")).toHaveCount(13);
  await page.locator(".page-card").nth(1).click();
  await expect(openTabs.getByRole("tab", { name: /Январь 2027/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".workspace")).toBeVisible();
});

test("creates a full calendar safely and keeps cell geometry independent", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Шаблоны календаря" }).click();
  const createFull = page.getByRole("button", { name: "Создать обложку и 12 месяцев" });
  await createFull.click();
  await page.getByRole("tab", { name: "Страницы" }).click();
  await expect(page.locator(".page-card")).toHaveCount(13);

  await page.getByRole("button", { name: "Шаблоны календаря" }).click();
  let replacementWarning = "";
  page.once("dialog", async (dialog) => {
    replacementWarning = dialog.message();
    await dialog.dismiss();
  });
  await createFull.click();
  await expect.poll(() => replacementWarning).toContain("Изменённые страницы будут удалены");
  await page.getByRole("tab", { name: "Страницы" }).click();
  await expect(page.locator(".page-card")).toHaveCount(13);
  await expect(page.locator(".page-card .page-thumbnail")).toHaveCount(13);
  await expect(page.locator(".template-picker")).toHaveCount(0);

  await page.locator(".page-card").nth(2).click();
  const februaryLegendItems = page.locator(".legend-item");
  await expect(februaryLegendItems).toHaveCount(2);
  const legendFrameBox = await page.locator(".legend-frame").boundingBox();
  const firstLegendItemBox = await februaryLegendItems.first().boundingBox();
  const lastLegendItemBox = await februaryLegendItems.last().boundingBox();
  expect(firstLegendItemBox?.x ?? 0).toBeGreaterThan(
    (legendFrameBox?.x ?? 0) + (legendFrameBox?.width ?? 0) / 2,
  );
  expect(Math.abs(
    (legendFrameBox?.x ?? 0) + (legendFrameBox?.width ?? 0) -
    ((lastLegendItemBox?.x ?? 0) + (lastLegendItemBox?.width ?? 0)),
  )).toBeLessThan(10);

  await page.locator(".page-card").nth(1).click();
  await page.locator(".calendar-cell__number").first().click({ force: true });
  await expect(page.getByRole("tab", { name: "Свойства" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Шрифт заголовков").locator('option[value="Monomakh Unicode"]')).toHaveCount(1);

  const number = page.locator(".calendar-cell__number").first();
  const marker = page.locator(".food-marker").first();
  await expect(number).toBeVisible();
  await expect(marker).toBeVisible();
  const markerBefore = await marker.getAttribute("transform");
  const actualNumberSize = () => number.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));

  await page.getByTestId("food-marker-pack").click();
  const markerPackList = page.getByRole("listbox", { name: "Набор картинок" });
  await expect(markerPackList).toBeVisible();
  await expect(markerPackList.getByRole("option")).toHaveCount(16);
  await expect(markerPackList.getByRole("option").first().locator("img")).toHaveCount(3);
  await page.getByTestId("food-marker-pack-option-gold-photo").click();
  await expect(page.getByTestId("food-marker-pack")).toHaveAttribute("data-value", "gold-photo");
  await expect(marker.locator("image")).toHaveAttribute("href", /\/assets\/marker-previews\/gold-photo\//);

  await page.getByTestId("day-number-size").fill("6");
  await expect.poll(actualNumberSize).toBeCloseTo(6 * 25.4 / 72, 2);
  const smallSize = await actualNumberSize();
  const smallBox = await number.boundingBox();
  await page.getByTestId("day-number-size").fill("100");
  await expect.poll(actualNumberSize).toBeCloseTo(100 * 25.4 / 72, 2);
  const largeSize = await actualNumberSize();
  const largeBox = await number.boundingBox();
  expect(largeSize).toBeGreaterThan(smallSize * 10);
  expect(largeBox?.height ?? 0).toBeGreaterThan((smallBox?.height ?? 0) * 10);
  expect(await marker.getAttribute("transform")).toBe(markerBefore);

  const importantDay = page.locator('.calendar-cell__number[data-calendar-date="2027-01-03"]').locator("xpath=..");
  const eventText = importantDay.locator(".calendar-cell__event").first();
  const actualEventSize = () => eventText.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  await page.getByTestId("event-font-size").fill("30");
  await page.getByTestId("event-minimum-size").fill("30");
  await expect.poll(actualEventSize).toBeCloseTo(30 * 25.4 / 72, 2);
  await page.getByTestId("event-minimum-size").fill("5");
  await expect.poll(actualEventSize).toBeLessThan(30 * 25.4 / 72);

  await page.getByTestId("food-marker-size").fill("12");
  await page.getByTestId("food-marker-x").fill("3.5");
  await page.getByTestId("food-marker-y").fill("17");
  await expect(page.getByTestId("food-marker-x")).toHaveValue("3.5");
  await expect(page.getByTestId("food-marker-y")).toHaveValue("17");
  await expect(marker).toHaveAttribute("transform", /scale\(1\.2\)/);
  expect(await marker.getAttribute("transform")).not.toBe(markerBefore);

  await page.getByLabel("Включить знаки типикона").check();
  const typikonMarker = page.locator(".typikon-rank-marker").first();
  await expect(typikonMarker).toBeVisible();
  const typikonYBefore = await typikonMarker.getAttribute("y");
  await page.getByTestId("typikon-marker-size").fill("8");
  await page.getByTestId("typikon-marker-x").fill("4");
  await page.getByTestId("typikon-marker-y").fill("20");
  await expect(typikonMarker).toHaveAttribute("width", "8");
  expect(await typikonMarker.getAttribute("y")).not.toBe(typikonYBefore);

  const calendarGrid = page.locator('.page-element[data-element-type="calendar-grid"]');
  await page.getByTestId("weekday-gradient-enabled").check();
  await page.getByTestId("weekday-extrusion-enabled").check();
  await page.getByTestId("weekday-shadow-enabled").check();
  await expect(calendarGrid.locator('linearGradient[id*="-weekday"]')).toHaveCount(1);
  await expect(calendarGrid.locator('filter[id*="-weekday"]')).toHaveCount(1);
  await expect(calendarGrid.locator(".page-element__calendar-weekday.large-text-extrusion").first()).toBeVisible();

  await page.getByTestId("day-number-gradient-enabled").check();
  await page.getByTestId("day-number-extrusion-enabled").check();
  await page.getByTestId("day-number-shadow-enabled").check();
  await expect(calendarGrid.locator('linearGradient[id*="-day-number"]')).toHaveCount(1);
  await expect(calendarGrid.locator('filter[id*="-day-number"]')).toHaveCount(1);
  await expect(calendarGrid.locator(".calendar-cell__number.large-text-extrusion").first()).toBeVisible();

  const monthTitle = page.locator('.page-element[data-element-type="text"]').first();
  await monthTitle.click({ force: true });
  await page.getByTestId("title-gradient-enabled").check();
  await page.getByTestId("title-extrusion-enabled").check();
  await page.getByTestId("title-shadow-enabled").check();
  await expect(monthTitle.locator('linearGradient[id^="text-gradient-"]')).toHaveCount(1);
  await expect(monthTitle.locator('filter[id^="text-shadow-"]')).toHaveCount(1);
  await expect(monthTitle.locator(".large-text-extrusion").first()).toBeVisible();

  await calendarGrid.click({ force: true });
  await page.getByRole("button", { name: "Шаблоны календаря" }).click();
  page.once("dialog", async (dialog) => dialog.accept("Крупная сетка"));
  await page.getByRole("button", { name: "Сохранить выбранную сетку…" }).click();
  await expect(page.locator(".grid-template-row")).toContainText("Крупная сетка");
  await page.getByTitle("Применить ко всем месяцам").click();
  await expect(page.locator(".status-bar__notice")).toContainText("применён к 12 месяцам");
});

test("edits object opacity and a printable gold gradient", async ({ page }) => {
  await openEditor(page);
  await page.getByTitle("Прямоугольник (M)").click();
  const scene = page.locator(".page-scene");
  const sceneBox = await scene.boundingBox();
  if (!sceneBox) throw new Error("Page scene is not visible");
  await page.mouse.move(sceneBox.x + 140, sceneBox.y + 180);
  await page.mouse.down();
  await page.mouse.move(sceneBox.x + 310, sceneBox.y + 260);
  await page.mouse.up();

  await page.getByRole("tab", { name: "Свойства" }).click();
  const geometrySection = page.getByTestId("geometry-section");
  await geometrySection.locator("summary").click();
  await expect(geometrySection).not.toHaveAttribute("open", "");
  await geometrySection.locator("summary").click();
  await expect(geometrySection).toHaveAttribute("open", "");
  await page.getByTestId("object-opacity").fill("42");
  const shape = page.locator(".page-element--selected .page-element__shape");
  await expect(shape).toHaveAttribute("opacity", "0.42");

  await page.getByTestId("shape-fill-mode").selectOption("gradient");
  await expect(page.getByText("Начало", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Золотой металлический градиент" }).click();
  const stops = page.locator(".page-element--selected linearGradient stop");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(0)).toHaveAttribute("stop-color", "#7a4a00");
  await expect(stops.nth(1)).toHaveAttribute("stop-color", "#ffe7a0");
  await expect(stops.nth(2)).toHaveAttribute("stop-color", "#b7791f");
});

test("positions a cropped image manually and applies a layer mask from an element", async ({ page }) => {
  await openEditor(page);
  await page.getByTitle("Изображение (F)").click();
  const scene = page.locator(".page-scene");
  const sceneBox = await scene.boundingBox();
  if (!sceneBox) throw new Error("Page scene is not visible");
  await page.mouse.move(sceneBox.x + 180, sceneBox.y + 170);
  await page.mouse.down();
  await page.mouse.move(sceneBox.x + 350, sceneBox.y + 290);
  await page.mouse.up();
  await page.locator('input[type="file"][accept="image/*,.svg"]').setInputFiles("public/brand/share-card-preview.webp");

  await page.getByRole("tab", { name: "Свойства" }).click();
  await page.getByText("Заполнение", { exact: true }).locator("..").getByRole("combobox").selectOption("crop");
  await expect(page.getByTestId("crop-position-controls")).toBeVisible();
  const image = page.locator('.page-element--selected image[href^="data:image/"]');
  const centredX = Number(await image.getAttribute("x"));
  await page.getByTestId("crop-position-x").evaluate((input: HTMLInputElement) => {
    input.value = "100";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(async () => Number(await image.getAttribute("x"))).toBeLessThan(centredX);

  await page.getByTestId("corner-radius").fill("8");
  await expect(page.locator('.page-element--selected clipPath[id^="object-mask-frame-"] > rect')).toHaveAttribute("rx", "8");
  await page.getByTestId("corner-radius-link").click();
  await expect(page.getByTestId("corner-radius-top-left")).toBeVisible();
  await page.getByTestId("corner-radius-top-left").fill("12");
  await page.getByTestId("corner-radius-top-right").fill("2");
  await page.getByTestId("corner-radius-bottom-left").fill("4");
  await page.getByTestId("corner-radius-bottom-right").fill("6");
  await expect(page.locator('.page-element--selected clipPath[id^="object-mask-frame-"] > path')).toHaveAttribute("d", /Q/);
  await page.getByTestId("corner-radius-link").click();
  await expect(page.locator('.page-element--selected clipPath[id^="object-mask-frame-"] > rect')).toHaveAttribute("rx", "12");
  const targetElementId = await page.locator(".page-element--selected").getAttribute("data-element-id");
  if (!targetElementId) throw new Error("Target image id is missing");

  await page.getByRole("tab", { name: "Элементы" }).click();
  const existingElementIds = new Set(await page.locator(".page-element").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-element-id"))));
  await page.locator(".decor-library__item").filter({ hasText: "Золотой православный крест" }).click();
  await expect(page.locator(".page-element")).toHaveCount(existingElementIds.size + 1);
  const sourceElementId = (await page.locator(".page-element").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-element-id"))))
    .find((elementId) => elementId && !existingElementIds.has(elementId));
  if (!sourceElementId) throw new Error("Mask source element is missing");
  await page.locator(`.page-element[data-element-id="${targetElementId}"]`).dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  await expect(page.locator(".page-element--selected")).toHaveAttribute("data-element-id", targetElementId);
  await page.getByRole("tab", { name: "Слои" }).click();
  await expect(page.getByTestId("layer-mask-panel")).toBeVisible();
  await expect(page.getByTestId("layer-mask-source").locator(`option[value="${sourceElementId}"]`)).toContainText("Золотой православный крест");
  await page.getByTestId("layer-mask-source").selectOption(sourceElementId);
  await page.getByRole("button", { name: "Применить элемент как маску" }).click();

  await expect(page.getByTestId("layer-mask-enabled")).toBeChecked();
  await expect(page.locator(`.page-element[data-element-id="${targetElementId}"] mask image`)).toHaveAttribute("href", /^data:image\/png/);

  const [maskFileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Загрузить чёрно-белую маску…" }).click(),
  ]);
  await maskFileChooser.setFiles({
    name: "oval-mask.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="black"/><ellipse cx="100" cy="60" rx="86" ry="48" fill="white"/></svg>'),
  });
  await expect(page.locator(`.page-element[data-element-id="${targetElementId}"] mask image`)).toHaveAttribute("href", /^data:image\/svg\+xml/);
});

test("resizes the right inspector with the mouse and restores its width", async ({ page }) => {
  await openEditor(page);
  const inspector = page.locator(".inspector-panel");
  const resizer = page.getByTestId("inspector-resizer");
  await expect(inspector).toBeVisible();
  await expect(resizer).toBeVisible();

  const initialWidth = (await inspector.boundingBox())?.width ?? 0;
  const growHandle = await resizer.boundingBox();
  if (!growHandle) throw new Error("Inspector resize handle is not visible");
  await page.mouse.move(growHandle.x + growHandle.width / 2, growHandle.y + 80);
  await page.mouse.down();
  await page.mouse.move(growHandle.x - 110, growHandle.y + 80, { steps: 6 });
  await page.mouse.up();
  const grownWidth = (await inspector.boundingBox())?.width ?? 0;
  expect(grownWidth).toBeGreaterThan(initialWidth + 90);

  const shrinkHandle = await resizer.boundingBox();
  if (!shrinkHandle) throw new Error("Inspector resize handle is not visible");
  await page.mouse.move(shrinkHandle.x + shrinkHandle.width / 2, shrinkHandle.y + 80);
  await page.mouse.down();
  await page.mouse.move(shrinkHandle.x + 150, shrinkHandle.y + 80, { steps: 6 });
  await page.mouse.up();
  const narrowedWidth = (await inspector.boundingBox())?.width ?? 0;
  expect(narrowedWidth).toBeLessThan(grownWidth - 120);

  await page.reload();
  await expect.poll(async () => (await inspector.boundingBox())?.width ?? 0).toBeCloseTo(narrowedWidth, 0);
});

test("saves repeatedly to the chosen project file and provides complete help dialogs", async ({ page }) => {
  await page.addInitScript(() => {
    const saveState = { pickerCalls: 0, writes: 0 };
    Object.assign(window, { __calendarSaveTestState: saveState });
    const handle = {
      name: "Мой-календарь.kalendar",
      async getFile() {
        return new File([], this.name, { type: "application/json" });
      },
      async queryPermission() {
        return "granted" as PermissionState;
      },
      async createWritable() {
        return {
          async write() { saveState.writes += 1; },
          async close() {},
        };
      },
    };
    Object.assign(window, {
      showSaveFilePicker: async () => {
        saveState.pickerCalls += 1;
        return handle;
      },
    });
  });
  await openEditor(page);

  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-save-project").click();
  await expect(page.locator(".status-bar__notice")).toContainText("Мой-календарь.kalendar");
  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-save-project").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    __calendarSaveTestState: { pickerCalls: number; writes: number };
  }).__calendarSaveTestState)).toEqual({ pickerCalls: 1, writes: 2 });

  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-recovery").click();
  await expect(page.getByRole("dialog", { name: "Восстановление проекта" })).toContainText("Восстановить");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Помощь", exact: true }).click();
  await page.getByTestId("menu-command-help-guide").click();
  await expect(page.getByRole("dialog", { name: "Помощь" })).toContainText("Сохранить как…");
  await page.locator(".application-dialog__footer").getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Помощь", exact: true }).click();
  await page.getByTestId("menu-command-shortcuts").click();
  await expect(page.getByRole("dialog", { name: "Горячие клавиши" })).toContainText("Ctrl");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Помощь", exact: true }).click();
  await page.getByTestId("menu-command-about").click();
  const about = page.getByRole("dialog", { name: "О программе" });
  await expect(about).toContainText("Свято‑Георгиевский мужской монастырь");
  await expect(about.getByRole("link", { name: "georg-kloster.ru" })).toHaveAttribute("href", "https://georg-kloster.ru/");
  await expect(about.getByRole("link", { name: "ATAPIN.DE" })).toHaveAttribute("href", "https://atapin.de/");
  await expect(about.getByRole("link", { name: "+49 171 351 72 74" })).toHaveAttribute("href", "tel:+491713517274");
  await expect(about.getByRole("link", { name: "atapin@gmail.com" })).toHaveAttribute("href", "mailto:atapin@gmail.com");
});

test("verifies e-mail, shares one editable calendar and offers a copy to the second editor", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Создайте православный календарь, готовый к печати" })).toBeVisible();
  await page.getByTestId("welcome-create").click();
  const verification = page.getByRole("dialog", { name: "Подтверждение e-mail" });
  await verification.getByLabel("E-mail").fill(`e2e-${Date.now()}@example.com`);
  await verification.getByRole("button", { name: "Получить ссылку" }).click();
  await verification.getByRole("link", { name: "Открыть тестовую ссылку подтверждения" }).click();
  await expect(page.locator(".workspace")).toBeVisible();

  await page.getByRole("button", { name: "Файл", exact: true }).click();
  await page.getByTestId("menu-command-program-settings").click();
  await page.getByRole("dialog", { name: "Настройки программы" }).getByLabel("English").check();
  await page.getByRole("dialog", { name: "Настройки программы" }).getByRole("button", { name: "Применить" }).click();

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByTestId("menu-command-share-project").click();
  const linkDialog = page.getByRole("dialog", { name: "Calendar link" });
  const shareUrl = await linkDialog.getByLabel("Link").inputValue();
  await expect(shareUrl).toContain("?shared=");

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await second.goto(shareUrl.replace("5173", "4173"));
  const locked = second.getByRole("dialog", { name: "Collaboration" });
  await expect(locked).toContainText("The calendar is currently in use");
  await expect(second.locator("html")).toHaveAttribute("lang", "en");
  await locked.getByRole("button", { name: "Make a copy" }).click();
  await expect(second.getByRole("dialog", { name: "Calendar link" })).toContainText("independent copy");
  await secondContext.close();
});
