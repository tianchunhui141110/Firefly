// 根据图片文件名日期 + 修改时间，更新教程文章的 published 日期
// 用法: node scripts/update-post-dates.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pinyin } from "pinyin-pro";

const SRC_ROOT = "d:/code-tianch/Firefly/文档教程";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

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

// 从正文提取日期线索
function extractDates(content) {
  const dates = new Set();
  // image-YYYYMMDDHHMMSS 或 image_YYYYMMDD
  for (const m of content.matchAll(/image[-_]?(\d{8})/g)) {
    const y = m[1].slice(0, 4);
    const mo = m[1].slice(4, 6);
    const d = m[1].slice(6, 8);
    if (y >= "2015" && y <= "2026") dates.add(`${y}-${mo}-${d}`);
  }
  // 13 位毫秒时间戳
  for (const m of content.matchAll(/(\d{13})/g)) {
    const dt = new Date(Number(m[1]));
    if (!Number.isNaN(dt) && dt.getFullYear() >= 2015 && dt.getFullYear() <= 2026) {
      dates.add(dt.toISOString().slice(0, 10));
    }
  }
  return [...dates].sort();
}

// 收集源文件（去重逻辑与转换脚本一致）
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
}
walk(SRC_ROOT);

const groups = {};
for (const f of files) {
  const key = norm(path.basename(f));
  const hash = crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");
  (groups[key] ||= []).push({ f, hash });
}

const picks = [];
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
  picks.push({ key, file: best.f, size: fs.statSync(best.f).size });
}

// 生成 slug（与转换脚本相同，含冲突处理）
const usedSlugs = new Set();
function uniqueSlug(name, title) {
  let slug = toSlug(name);
  if (!slug) slug = toSlug(title) || `post-${crypto.randomBytes(4).toString("hex")}`;
  let finalSlug = slug;
  let n = 2;
  while (usedSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${n}`;
    n++;
  }
  usedSlugs.add(finalSlug);
  return finalSlug;
}

const updates = [];
let fromImage = 0;
let fromMtime = 0;
let skipped = 0;

for (const pick of picks.sort((a, b) => a.file.localeCompare(b.file))) {
  const fname = path.basename(pick.file);
  if (fname.startsWith(".~") || fname.startsWith("~$")) continue;
  const content = fs.readFileSync(pick.file, "utf8");
  if (content.trim().length === 0) continue;

  const h1 = content.split("\n").find((l) => l.startsWith("# "));
  const h1Title = h1 ? h1.replace(/^#\s+/, "").trim() : "";
  const fileNameTitle = fname
    .replace(/\.md$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\(\d+\)/g, "")
    .trim();
  const title = h1Title.length >= 4 ? h1Title : fileNameTitle;

  const slug = uniqueSlug(fname, title);
  const destDir = path.join(DEST_ROOT, slug);
  const destFile = path.join(destDir, "index.md");
  if (!fs.existsSync(destFile)) {
    skipped++;
    continue;
  }

  // 提取日期
  const dates = extractDates(content);
  let published;
  let source;
  if (dates.length > 0) {
    published = dates[0]; // 取最早日期
    source = `图片日期 ${dates.join(",")}`;
    fromImage++;
  } else {
    published = new Date(fs.statSync(pick.file).mtime).toISOString().slice(0, 10);
    source = `修改时间 ${published}`;
    fromMtime++;
  }

  // 更新 frontmatter 中的 published
  let md = fs.readFileSync(destFile, "utf8");
  if (/^published:\s*\d{4}-\d{2}-\d{2}/m.test(md)) {
    md = md.replace(/^published:\s*\d{4}-\d{2}-\d{2}/m, `published: ${published}`);
  } else {
    md = md.replace(/^---\n/, `---\npublished: ${published}\n`);
  }
  fs.writeFileSync(destFile, md, "utf8");

  updates.push({ slug, title, published, source });
}

console.log(`\n=== 更新完成: 图片日期 ${fromImage} 篇, 修改时间 ${fromMtime} 篇, 跳过 ${skipped} 篇 ===\n`);
for (const u of updates.sort((a, b) => a.published.localeCompare(b.published))) {
  console.log(`${u.published}  [${u.source.slice(0, 20)}] ${u.title.slice(0, 40)}`);
}
