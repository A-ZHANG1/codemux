import { test, expect, type WebSocketRoute } from "@playwright/test";
import { navigateToChat, selectSession, typeAndSend } from "../setup/test-helpers";
import type { ToolPart } from "../../../src/types/unified";

test.describe("Pixel crew workspace", () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test("defaults to lavender and preserves panel visibility after reload", async ({ page }) => {
    await navigateToChat(page);
    await expect(page.locator("html")).toHaveClass(/lavender/);
    const room = page.getByRole("complementary", { name: "Pixel crew" });
    await expect(room).toBeVisible();
    const roomBox = await room.boundingBox();
    const chatBox = await page.locator(".workspace-chat").boundingBox();
    expect(roomBox!.x).toBeGreaterThanOrEqual(chatBox!.x + chatBox!.width);
    expect(chatBox!.width).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Hide pixel crew", exact: true }).click();
    await expect(room).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Toggle pixel crew", exact: true })).toBeVisible();
    await expect(room).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle pixel crew", exact: true }).click();
    await expect(room).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/lavender/);
  });

  test("shows a real delegated task departing and returning without replacing its sprite", async ({ page }) => {
    let client: WebSocketRoute | undefined;
    let requestId = "";
    const task: ToolPart = {
      id: "pixel-task",
      messageId: "pixel-assistant",
      sessionId: "session-oc-2",
      type: "tool",
      callId: "explore-task",
      normalizedTool: "task",
      originalTool: "task",
      title: "Explore",
      kind: "other",
      state: { status: "running", input: {}, time: { start: Date.now() } },
    };
    const sendPart = () => client!.send(JSON.stringify({
      type: "message.part.updated",
      payload: { sessionId: task.sessionId, part: task },
    }));
    await page.routeWebSocket(/\/ws/, (socket) => {
      client = socket;
      const server = socket.connectToServer();
      socket.onMessage((raw) => {
        const request = JSON.parse(String(raw));
        if (request.type === "message.send") {
          requestId = request.requestId;
          sendPart();
        } else {
          server.send(raw);
        }
      });
    });
    await navigateToChat(page);
    await selectSession(page, "Add unit tests");
    await typeAndSend(page, "Explore the project");

    const agent = page.locator('#agent-room article[data-agent-id$=":task:explore-task"]');
    await expect(agent).toHaveAttribute("data-status", "working");
    await expect(agent.getByRole("heading", { name: "Explore" })).toBeVisible();
    const sprite = agent.locator("svg");
    const originalSprite = await sprite.elementHandle();
    await expect.poll(async () => {
      const box = await sprite.boundingBox();
      const card = await agent.boundingBox();
      return box!.x - card!.x;
    }).toBeGreaterThan(150);

    task.state = {
      status: "completed", input: {}, output: "Exploration complete",
      time: { start: 1, end: 2, duration: 1 },
    };
    sendPart();
    await expect(agent).toHaveAttribute("data-status", "completed");
    await expect(agent.getByText("Back home")).toBeVisible();
    expect(await sprite.evaluate((node, original) => node === original, originalSprite)).toBe(true);
    await expect.poll(async () => {
      const box = await sprite.boundingBox();
      const card = await agent.boundingBox();
      return box!.x - card!.x;
    }).toBeLessThan(30);

    client!.send(JSON.stringify({
      type: "message.updated",
      payload: {
        sessionId: task.sessionId,
        message: {
          id: task.messageId, sessionId: task.sessionId, role: "assistant",
          time: { created: 1, completed: 2 }, parts: [task],
        },
      },
    }));
    client!.send(JSON.stringify({ type: "response", requestId, payload: {} }));
    await expect(page.locator('#agent-room article[data-agent-id$=":lead"]')).toHaveAttribute("data-status", "completed");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(agent.locator('[class*="traveler"]')).toHaveCSS("transition-duration", "0s");
    await page.screenshot({ path: test.info().outputPath("pixel-crew.png"), fullPage: true });
    await selectSession(page, "Fix authentication bug");
    await expect(agent).toHaveCount(0);
  });

  test("keeps mobile chat full-width and opens the crew on demand", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateToChat(page);
    const room = page.getByRole("complementary", { name: "Pixel crew" });
    await expect(room).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle pixel crew", exact: true }).click();
    await expect(room).toBeVisible();
    const box = await room.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await expect(page.locator(".workspace-chat")).toHaveCSS("width", "390px");
    await page.getByRole("button", { name: "Hide pixel crew", exact: true }).click();
    await expect(room).toHaveCount(0);
  });
});
