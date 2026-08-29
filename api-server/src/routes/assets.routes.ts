import { Router, Request, Response } from "express";
import { readFile } from "fs/promises";
import path from "path";
import { ASSETS, ZIP_FILE, APP_FILE, siteOrigin, humanSize } from "@/lib/assets";

const router = Router();

// GET /api/assets
router.get("/", (req: Request, res: Response) => {
  const origin = siteOrigin(req);
  const format = req.query.format as string | undefined;

  const items = ASSETS.map((a) => ({
    name: a.name,
    desc: a.desc,
    file: a.file,
    url: `${origin}${a.file}`,
    download: `${origin}/api/assets/download?file=${encodeURIComponent(a.file)}`,
    width: a.width,
    height: a.height,
    bytes: a.bytes,
    size: humanSize(a.bytes),
    type: a.type,
    usedIn: a.usedIn,
  }));

  const zip = {
    url: `${origin}${ZIP_FILE}`,
    download: `${origin}/api/assets/download?file=${encodeURIComponent(ZIP_FILE)}`,
  };

  const app = {
    url: `${origin}${APP_FILE}`,
    download: `${origin}/api/assets/download?file=${encodeURIComponent(APP_FILE)}`,
  };

  if (format === "txt") {
    const body = items.map((i) => i.url).join("\n") + `\n${zip.url}\n`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(body);
    return;
  }

  if (format === "md") {
    const rows = items
      .map((i) => `| ${i.name} | ${i.width}×${i.height} | ${i.size} | [${i.file}](${i.url}) |`)
      .join("\n");
    const body = `# V-POKER 图片素材\n\n| 名称 | 尺寸 | 大小 | 链接 |\n|---|---|---|---|\n${rows}\n\n打包下载：[vpoker-assets.zip](${zip.url})\n`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(body);
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    origin,
    count: items.length,
    totalBytes: ASSETS.reduce((a, b) => a + b.bytes, 0),
    totalSize: humanSize(ASSETS.reduce((a, b) => a + b.bytes, 0)),
    zip,
    app,
    assets: items,
  });
});

// GET /api/assets/download
router.get("/download", async (req: Request, res: Response) => {
  const ALLOWED = new Map<string, string>([
    ...ASSETS.map((a) => [a.file, a.type] as [string, string]),
    [ZIP_FILE, "application/zip"],
    [APP_FILE, "application/zip"],
  ]);

  const file = (req.query.file as string) || "";
  const type = ALLOWED.get(file);
  if (!type) {
    res.status(404).json({ error: "文件不存在", allowed: [...ALLOWED.keys()] });
    return;
  }

  try {
    const abs = path.join(process.cwd(), "public", file);
    const buf = await readFile(abs);
    const filename = path.basename(file);
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", String(buf.byteLength));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "读取失败" });
  }
});

export default router;
