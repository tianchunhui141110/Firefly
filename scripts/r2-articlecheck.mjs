// 查看 oss.tianch.xyz 66 个 URL 对应文章的源目录内容
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);
const SRC_ROOT = "d:/code-tianch/Firefly/文档教程";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

const ossUrls = audit.stillMissing.filter((u) => u.includes("oss.tianch.xyz"));

// URL -> 文章 slug（tutorials 目录名）
const urlToSlug = new Map();
function walkDest(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDest(p);
    else if (e.name === "index.md") {
      const c = fs.readFileSync(p, "utf8");
      for (const m of c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
        if (!urlToSlug.has(m[1])) urlToSlug.set(m[1], path.basename(dir));
      }
    }
  }
}
walkDest(DEST_ROOT);

// 按文章分组
const byArticle = new Map();
for (const url of ossUrls) {
  const slug = urlToSlug.get(url) || "(无)";
  if (!byArticle.has(slug)) byArticle.set(slug, []);
  byArticle.get(slug).push(url);
}

console.log("=== oss.tianch.xyz 缺失图按文章分组 ===");
for (const [slug, urls] of byArticle) {
  console.log(`\n【${slug}】${urls.length} 张`);
  // 该文章在文档教程的源目录
  let srcDir = null;
  for (const d of fs.readdirSync(SRC_ROOT)) {
    const full = path.join(SRC_ROOT, d);
    if (!fs.statSync(full).isDirectory()) continue;
    // 中文目录名可能包含 slug 拼音的一部分，先列出所有目录让用户看
  }
  for (const u of urls.slice(0, 6)) {
    const fname = path.basename(new URL(u).pathname);
    console.log(`    ${fname}`);
  }
  if (urls.length > 6) console.log(`    ... 共 ${urls.length} 张`);
}

// 列出文档教程所有含图片的目录（供对照）
console.log("\n=== 文档教程中含图片文件的目录 ===");
for (const d of fs.readdirSync(SRC_ROOT)) {
  const full = path.join(SRC_ROOT, d);
  if (!fs.statSync(full).isDirectory()) continue;
  const imgs = [];
  const stack = [full];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(png|jpe?g|gif|webp|avif)$/i.test(e.name)) imgs.push(e.name);
    }
  }
  if (imgs.length > 0) {
    console.log(`  ${d} (${imgs.length} 张): ${imgs.slice(0, 5).join(", ")}${imgs.length > 5 ? "..." : ""}`);
  }
}
