// 检查缺失图片是否在对应文章目录存在（文件名可能不同）
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);

// 找出缺失 URL 所在文章（在 tutorials 中查找）
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";
const urlToArticles = new Map();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "index.md") {
      const c = fs.readFileSync(p, "utf8");
      for (const m of c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
        if (!urlToArticles.has(m[1])) urlToArticles.set(m[1], []);
        urlToArticles.get(m[1]).push(path.basename(dir));
      }
    }
  }
}
walk(DEST_ROOT);

// 对缺失 URL：检查其所在文章的 images 目录是否有文件
const missing = audit.stillMissing;
let hasLocalDirImages = 0;
const needExternal = [];

for (const url of missing) {
  const articles = urlToArticles.get(url) || [];
  let foundLocal = false;
  for (const article of articles) {
    const imgDir = path.join(DEST_ROOT, article, "images");
    if (fs.existsSync(imgDir) && fs.readdirSync(imgDir).length > 0) {
      foundLocal = true;
      break;
    }
  }
  if (foundLocal) {
    hasLocalDirImages++;
    console.log(`文章目录有图: ${url.slice(0, 100)}  (文章: ${articles.join(",")})`);
  } else {
    needExternal.push(url);
  }
}

console.log(`\n缺失 URL 总数: ${missing.length}`);
console.log(`所在文章目录有 images 文件: ${hasLocalDirImages}`);
console.log(`需外部获取(下载/用户提供): ${needExternal.length}`);
