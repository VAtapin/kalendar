import { expect, test } from "@playwright/test";

test("creates a full calendar safely and keeps cell geometry independent", async ({ page }) => {
  await page.goto("/");
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
  await page.getByRole("tab", { name: "Свойства" }).click();

  const number = page.locator(".calendar-cell__number").first();
  const marker = page.locator(".food-marker").first();
  await expect(number).toBeVisible();
  await expect(marker).toBeVisible();
  const markerBefore = await marker.getAttribute("transform");
  const actualNumberSize = () => number.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));

  await page.getByTestId("food-marker-pack").selectOption("gold-photo");
  await expect(page.getByTestId("food-marker-pack")).toHaveValue("gold-photo");
  await expect(marker.locator("image")).toHaveAttribute("href", /\/assets\/markers\/gold-photo\//);

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
  await page.goto("/");
  await page.getByTitle("Прямоугольник (M)").click();
  const scene = page.locator(".page-scene");
  const sceneBox = await scene.boundingBox();
  if (!sceneBox) throw new Error("Page scene is not visible");
  await page.mouse.move(sceneBox.x + 140, sceneBox.y + 180);
  await page.mouse.down();
  await page.mouse.move(sceneBox.x + 310, sceneBox.y + 260);
  await page.mouse.up();

  await page.getByRole("tab", { name: "Свойства" }).click();
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

test("resizes the right inspector with the mouse and restores its width", async ({ page }) => {
  await page.goto("/");
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
  await page.goto("/");

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

  await page.getByRole("button", { name: "Справка", exact: true }).click();
  await page.getByTestId("menu-command-help-guide").click();
  await expect(page.getByRole("dialog", { name: "Справка по работе" })).toContainText("Сохранить как…");
  await page.locator(".application-dialog__footer").getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Справка", exact: true }).click();
  await page.getByTestId("menu-command-shortcuts").click();
  await expect(page.getByRole("dialog", { name: "Горячие клавиши" })).toContainText("Ctrl");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Справка", exact: true }).click();
  await page.getByTestId("menu-command-about").click();
  const about = page.getByRole("dialog", { name: "О программе" });
  await expect(about).toContainText("Свято‑Георгиевский мужской монастырь");
  await expect(about.getByRole("link", { name: "georg-kloster.ru" })).toHaveAttribute("href", "https://georg-kloster.ru/");
  await expect(about.getByRole("link", { name: "ATAPIN.DE" })).toHaveAttribute("href", "https://atapin.de/");
  await expect(about.getByRole("link", { name: "+49 171 351 72 74" })).toHaveAttribute("href", "tel:+491713517274");
  await expect(about.getByRole("link", { name: "atapin@gmail.com" })).toHaveAttribute("href", "mailto:atapin@gmail.com");
});
