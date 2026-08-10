// 精确核对：缺失 URL 对应文章在 文档教程 里的目录，检查目录内是否有图片文件
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);
const SRC_ROOT = "d:/code-tianch/Firefly/文档教程";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

// 1. URL -> 所在本地文章（tutorials 目录名）
const urlToArticle = new Map();
function walkDest(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDest(p);
    else if (e.name === "index.md") {
      const c = fs.readFileSync(p, "utf8");
      for (const m of c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
        if (!urlToArticle.has(m[1])) urlToArticle.set(m[1], path.basename(dir));
      }
    }
  }
}
walkDest(DEST_ROOT);

// 2. 检查这些文章在文档教程里的目录是否有图片
const missing = audit.stillMissing;
const results = { withImages: [], withoutImages: [] };

for (const url of missing) {
  const articleDir = urlToArticle.get(url);
  if (!articleDir) {
    results.withoutImages.push({ url, article: "(无对应文章)", reason: "未找到文章" });
    continue;
  }
  // 在文档教程中查找同名目录（可能带编号前缀）
  let foundDir = null;
  if (fs.existsSync(path.join(SRC_ROOT, articleDir))) {
    foundDir = path.join(SRC_ROOT, articleDir);
  } else {
    for (const d of fs.readdirSync(SRC_ROOT)) {
      if (d.includes(articleDir) || articleDir.includes(d.replace(/^\d+\.\s*/, ""))) {
        const full = path.join(SRC_ROOT, d);
        if (fs.statSync(full).isDirectory()) {
          foundDir = full;
          break;
        }
      }
    }
  }
  if (!foundDir) {
    results.withoutImages.push({ url, article: articleDir, reason: "文档教程无此目录" });
    continue;
  }
  // 检查目录内是否有图片
  const imgs = [];
  const stack = [foundDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(png|jpe?g|gif|webp|avif)$/i.test(e.name)) imgs.push(path.relative(SRC_ROOT, p));
    }
  }
  if (imgs.length > 0) {
    results.withImages.push({ url, article: articleDir, imgs: imgs.slice(0, 5) });
  } else {
    results.withoutImages.push({ url, article: articleDir, reason: "目录内无图片" });
  }
}

console.log("=== 文章目录内有图片:", results.withImages.length, "===");
for (const r of results.withImages.slice(0, 15)) {
  console.log(`  ${r.url.slice(0, 80)}`);
  console.log(`    文章: ${r.article}, 图: ${r.imgs.join(", ")}`);
}

console.log(`\n=== 文章目录内无图片: ${results.withoutImages.length} ===`);
for (const r of results.withoutImages.slice(0, 25)) {
  console.log(`  ${r.reason} | ${r.url.slice(0, 90)} | 文章: ${r.article}`);
}

fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-audit5.json",
  JSON.stringify(results, null, 2),
  "utf8",
);
