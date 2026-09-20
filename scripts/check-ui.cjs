// Mocked API checks: no writes to the real database or external AI calls.
// Set PLAYWRIGHT_MODULE to an installed playwright module path if not a dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.UI_BASE_URL || "http://localhost:3011";
const output = "reports/ui";
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const result = { prediction: 0, bmi: 22.5, ai_prediction: { probability: .2, risk_level: "THẤP", message: "Kết quả kiểm thử giao diện." }, clinical_evaluation: { probability: .3, risk_level: "THẤP", message: "Dữ liệu giả lập." } };
    let saves = [];
    let rejectSave = true;
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      let data = {};
      if (url.pathname === "/information/me") data = { age: 52, sex: 0, height: 170, weight: 65, blood_pressure: 125, cholesterol: 190 };
      else if (url.pathname === "/predict") {
        assert.equal(route.request().postDataJSON().oldpeak, -2.6);
        data = result;
      } else if (url.pathname === "/prediction/history") {
        if (route.request().method() === "POST") {
          if (rejectSave) { rejectSave = false; return route.fulfill({ status: 503, headers, json: { detail: "Lưu tạm thời gián đoạn. Vui lòng thử lại." } }); }
          saves.push(route.request().postDataJSON()); data = { status: "success" };
        } else data = [{ id: 1, name_prediction: saves[0]?.name_prediction || "Đánh giá kiểm thử", prediction_result: 0, risk_level: "THẤP", timestamp: "2026-09-20T12:00:00" }];
      } else if (url.pathname === "/user/chat-status") data = { remaining: 5, limit: 5 };
      else if (url.pathname === "/chatbot/history") data = [];
      return route.fulfill({ headers, json: data });
    });
    async function noOverflow() {
      const overflow = await page.evaluate(() => ({
        width: innerWidth, actual: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className })),
      }));
      assert.ok(overflow.actual <= overflow.width, "Page must not overflow horizontally: " + JSON.stringify(overflow));
    }
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await noOverflow();
    }
    await page.screenshot({ path: output + "/home-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.getByRole("button", { name: "Mở menu", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Đóng menu", exact: true }).getAttribute("aria-expanded"), "true");
    await page.getByRole("button", { name: "Đóng menu", exact: true }).click();
    await page.screenshot({ path: output + "/home-mobile.png", fullPage: true });
    await page.goto(base + "/login");
    await page.getByLabel("Tên đăng nhập", { exact: true }).waitFor();
    await noOverflow();
    await page.screenshot({ path: output + "/login-mobile.png", fullPage: true });
    await context.addInitScript(() => {
      localStorage.setItem("token", "ui.test.signature");
      localStorage.setItem("username", "Người dùng kiểm thử");
      localStorage.setItem("language", "vi");
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/diagnosis");
    await page.locator("#age").fill("45");
    await page.getByRole("button", { name: "Lấy thông tin từ hồ sơ" }).click();
    await page.getByText("Đã đọc hồ sơ", { exact: false }).waitFor();
    assert.equal(await page.locator("#age").inputValue(), "45");
    assert.equal(await page.locator("#height").inputValue(), "170");
    assert.equal(await page.locator("#sex").inputValue(), "0");
    await page.locator("#block_name").fill("Phiếu thử ban đầu");
    await page.locator("#age").fill("0");
    await page.getByRole("button", { name: "Tiếp theo" }).click();
    await page.getByRole("alert").filter({ hasText: "Tuổi" }).waitFor();
    await page.locator("#age").fill("45");
    await page.getByRole("button", { name: "Tiếp theo" }).click();
    await page.locator("#thalch").fill("150");
    await page.locator("#oldpeak").fill("-2.6");
    await page.getByRole("button", { name: "Tiếp theo" }).click();
    await page.getByRole("button", { name: "Xem kết quả đánh giá" }).click();
    await page.getByRole("button", { name: "Lưu vào lịch sử" }).waitFor();
    await page.getByRole("button", { name: "Quay lại" }).click();
    await page.getByRole("button", { name: "Quay lại" }).click();
    await page.locator("#block_name").fill("Đã sửa sau khi gửi");
    await page.getByRole("button", { name: "Lưu vào lịch sử" }).click();
    await page.getByRole("alert").filter({ hasText: "Lưu tạm thời gián đoạn" }).waitFor();
    await page.getByRole("button", { name: "Lưu vào lịch sử" }).click();
    await page.getByRole("button", { name: "Đã lưu kết quả" }).waitFor();
    assert.equal(saves.length, 1);
    assert.equal(saves[0].name_prediction, "Phiếu thử ban đầu");
    assert.equal(saves[0].clinical_score, 3);
    assert.equal(await page.getByRole("button", { name: "Đã lưu kết quả" }).isDisabled(), true);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await noOverflow();
    }
    await page.screenshot({ path: output + "/assessment-desktop.png", fullPage: true });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".assessment-screen").isVisible(), false);
    assert.equal(await page.locator(".assessment-print").isVisible(), true);
    assert.match(await page.locator(".assessment-print").innerText(), /Phiếu thử ban đầu/);
    assert.doesNotMatch(await page.locator(".assessment-print").innerText(), /Đã sửa sau khi gửi/);
    await page.pdf({ path: output + "/assessment-sample.pdf", format: "A4" });
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.screenshot({ path: output + "/assessment-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Mở trò chuyện", exact: true }).click();
    await page.getByText("Trợ lý sức khỏe", { exact: true }).waitFor();
    await noOverflow();
    await page.screenshot({ path: output + "/chat-mobile.png" });
    await page.getByRole("button", { name: "Đóng trò chuyện", exact: true }).click();
    for (const route of ["/history", "/profile"]) {
      await page.goto(base + route);
      await page.getByText(route === "/history" ? "Phiếu thử ban đầu" : "Thông tin sức khỏe", { exact: true }).first().waitFor();
      await noOverflow();
      await page.screenshot({ path: output + route + "-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 320, height: 844 });
      await noOverflow();
      await page.setViewportSize({ width: 390, height: 844 });
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile, navigation, profile fill, validation, save failure/retry, snapshot, duplicate prevention, print/PDF, chatbot, history/profile; no page errors.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
