import { expect, test } from "@playwright/test";

test("creates a full calendar safely and keeps cell geometry independent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Страницы" }).click();
  const createFull = page.getByRole("button", { name: "Создать обложку и 12 месяцев" });
  await createFull.click();
  await expect(page.locator(".page-card")).toHaveCount(13);

  let replacementWarning = "";
  page.once("dialog", async (dialog) => {
    replacementWarning = dialog.message();
    await dialog.dismiss();
  });
  await createFull.click();
  await expect.poll(() => replacementWarning).toContain("Изменённые страницы будут удалены");
  await expect(page.locator(".page-card")).toHaveCount(13);

  await page.locator(".page-card").nth(1).click();
  await page.locator(".calendar-cell__number").first().click({ force: true });
  await page.getByRole("tab", { name: "Свойства" }).click();

  const number = page.locator(".calendar-cell__number").first();
  const marker = page.locator(".food-marker").first();
  await expect(number).toBeVisible();
  await expect(marker).toBeVisible();
  const markerBefore = await marker.getAttribute("transform");
  const actualNumberSize = () => number.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));

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

  await page.getByRole("tab", { name: "Страницы" }).click();
  page.once("dialog", async (dialog) => dialog.accept("Крупная сетка"));
  await page.getByRole("button", { name: "Сохранить выбранную сетку…" }).click();
  await expect(page.locator(".grid-template-row")).toContainText("Крупная сетка");
  await page.getByTitle("Применить ко всем месяцам").click();
  await expect(page.locator(".status-bar__notice")).toContainText("применён к 12 месяцам");
});
