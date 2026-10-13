import http from "node:http"; import { readFile } from "node:fs/promises"; import { extname, join, normalize } from "node:path";
const roots = [process.argv[2], "/home/user/Kerst-idee/dino/public"];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  for (const r of roots) { try { const b = await readFile(join(r, p)); res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" }); return res.end(b); } catch {} }
  res.writeHead(404); res.end();
}).listen(8791, () => console.log("ads 8791"));
