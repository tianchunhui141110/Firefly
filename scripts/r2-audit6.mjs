// 修正版：检查缺失 URL 对应文章在文档教程的源目录（中文名）内是否有图片
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pinyin } from "pinyin-pro";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);
const SRC_ROOT = "d:/code-tianch/Firefly/文档教程";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

// 1. 建立 源文件slug -> 源目录 映射（与转换脚本一致）
const norm = (n) => n.replace(/\((\d+)\)/g, "");
function toSlug(name) {
  const cleaned = name
    .replace(/^\d+\.\s*/, "")
    .replace(/^\d+/, "")
    .replace(/\(\d+\)/g, "")
    .replace(/\.md$/i, "")
    .trim();
  const segments = [];
  let buf = "";
  for (const ch of cleaned) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      if (buf) {
        segments.push(buf);
        buf = "";
      }
      segments.push(pinyin(ch, { toneType: "none", type: "array" })[0]);
    } else {
      buf += ch;
    }
  }
  if (buf) segments.push(buf);
  return segments
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// 扫描文档教程所有 md，记录 slug -> {源md路径, 源目录}
const srcFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) srcFiles.push(p);
  }
}
walk(SRC_ROOT);

const groups = {};
for (const f of srcFiles) {
  const key = norm(path.basename(f));
  const hash = crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");
  (groups[key] ||= []).push({ f, hash });
}
const slugToSrcDir = new Map(); // slug -> 源目录
const usedSlugs = new Set();
for (const [key, v] of Object.entries(groups)) {
  const byHash = new Map();
  for (const item of v) {
    if (
      !byHash.has(item.hash) ||
      fs.statSync(item.f).size > fs.statSync(byHash.get(item.hash).f).size
    ) {
      byHash.set(item.hash, item);
    }
  }
  const best = [...byHash.values()].sort(
    (a, b) => fs.statSync(b.f).size - fs.statSync(a.f).size,
  )[0];
  const fname = path.basename(best.f);
  let slug = toSlug(fname);
  if (!slug) {
    const h1 = fs.readFileSync(best.f, "utf8").split("\n").find((l) => l.startsWith("# "));
    slug = toSlug(h1 ? h1.replace(/^#\s+/, "").trim() : fname);
  }
  let finalSlug = slug;
  let n = 2;
  while (usedSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${n}`;
    n++;
  }
  usedSlugs.add(finalSlug);
  slugToSrcDir.set(finalSlug, path.dirname(best.f));
}
console.log("slug->源目录映射数:", slugToSrcDir.size);

// 2. URL -> 本地文章 slug（tutorials 目录名）
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

// 3. 对每个缺失 URL：找到源目录，列出其中的图片文件
const missing = audit.stillMissing;
const results = { sourceDirHasImages: [], sourceDirNoImages: [], noSource: [] };

for (const url of missing) {
  const slug = urlToSlug.get(url);
  const srcDir = slug ? slugToSrcDir.get(slug) : null;
  if (!srcDir) {
    results.noSource.push({ url, slug: slug || "(无)" });
    continue;
  }
  const imgs = [];
  const stack = [srcDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(png|jpe?g|gif|webp|avif)$/i.test(e.name)) imgs.push(e.name);
    }
  }
  if (imgs.length > 0) {
    results.sourceDirHasImages.push({ url, slug, srcDir: path.basename(srcDir), imgs: imgs.slice(0, 8) });
  } else {
    results.sourceDirNoImages.push({ url, slug, srcDir: path.basename(srcDir) });
  }
}

console.log(`\n=== 源目录有图片: ${results.sourceDirHasImages.length} ===`);
for (const r of results.sourceDirHasImages.slice(0, 20)) {
  console.log(`  [${r.slug}] 源目录: ${r.srcDir}`);
  console.log(`    URL: ${r.url.slice(0, 95)}`);
  console.log(`    图片: ${r.imgs.join(", ")}`);
}

console.log(`\n=== 源目录无图片: ${results.sourceDirNoImages.length} ===`);
console.log(`=== 无源目录: ${results.noSource.length} ===`);
for (const r of results.noSource.slice(0, 15)) {
  console.log(`  slug=${r.slug} | ${r.url.slice(0, 100)}`);
}

fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-audit6.json",
  JSON.stringify(results, null, 2),
  "utf8",
);
