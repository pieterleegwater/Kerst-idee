// Neemt een advertentie beeld voor beeld op (deterministisch) en maakt er een MP4 van.
const { chromium } = require(process.env.PLAYWRIGHT || "playwright"); const { execSync } = require("child_process"); const fs = require("fs");
const [, , ad, outDir, fps = "30"] = process.argv;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const still = ad === "feed" || ad === "story";
  const p = await (await b.newContext({ viewport: { width: 540, height: ad === "feed" ? 675 : 960 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(`http://localhost:8791/ads.html?ad=${ad}`, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.AD_READY, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  if (still) { await p.screenshot({ path: `${outDir}/dinorijk-${ad}.png` }); console.log(ad, "plaatje klaar", errs); return b.close(); }
  const total = await p.evaluate(() => window.AD_TOTAL);
  const dir = `${outDir}/frames-${ad}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const n = Math.round((total / 1000) * Number(fps));
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => window.seek(t), (i * 1000) / Number(fps));
    await p.screenshot({ path: `${dir}/${String(i).padStart(5, "0")}.png` });
  }
  await b.close();
  execSync(`ffmpeg -y -loglevel error -framerate ${fps} -i ${dir}/%05d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart ${outDir}/dinorijk-ad-${ad}.mp4`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(ad, `video klaar: ${n} beelden, ${(total / 1000).toFixed(1)}s`, errs);
})();
