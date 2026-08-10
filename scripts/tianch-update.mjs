// 用 Halo 博客的真实发布时间更新本地教程文章的 published 日期
// 读取 scripts/tianch-posts.json，按标题匹配本地 tutorials/*/index.md
import fs from "node:fs";
import path from "node:path";

const POSTS_JSON = "d:/code-tianch/Firefly/scripts/tianch-posts.json";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

// 标题归一化：去空格、大小写、特殊字符，用于模糊匹配
function normalize(title) {
  return title
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s_\-—–·,，.。:：/\\]+/g, "")
    .trim();
}

const haloPosts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
// 用发布时间（无则创建时间），取日期部分
const haloByNorm = new Map();
for (const p of haloPosts) {
  const norm = normalize(p.title);
  const date = (p.published || p.created || "").slice(0, 10);
  if (norm && date && !haloByNorm.has(norm)) {
    haloByNorm.set(norm, { title: p.title, date, raw: p });
  }
}
console.log("Halo 可匹配文章:", haloByNorm.size, "/", haloPosts.length);

// 扫描本地教程文章
const localPosts = [];
for (const dir of fs.readdirSync(DEST_ROOT)) {
  const f = path.join(DEST_ROOT, dir, "index.md");
  if (!fs.existsSync(f)) continue;
  const md = fs.readFileSync(f, "utf8");
  const titleM = md.match(/^title:\s*"([^"]+)"/m);
  const pubM = md.match(/^published:\s*(\S+)/m);
  if (titleM) {
    localPosts.push({ dir, title: titleM[1], published: pubM ? pubM[1] : "" });
  }
}
console.log("本地教程文章:", localPosts.length);

// 匹配并更新
let matched = 0;
let updated = 0;
let unmatched = [];
for (const lp of localPosts) {
  const norm = normalize(lp.title);
  const hit = haloByNorm.get(norm);
  if (hit) {
    matched++;
    const f = path.join(DEST_ROOT, lp.dir, "index.md");
    let md = fs.readFileSync(f, "utf8");
    if (md.includes(`published: ${hit.date}`)) continue; // 已是最新
    if (/^published:\s*\d{4}-\d{2}-\d{2}/m.test(md)) {
      md = md.replace(/^published:\s*\d{4}-\d{2}-\d{2}/m, `published: ${hit.date}`);
    } else {
      md = md.replace(/^---\n/, `---\npublished: ${hit.date}\n`);
    }
    fs.writeFileSync(f, md, "utf8");
    updated++;
  } else {
    unmatched.push({ title: lp.title, current: lp.published });
  }
}

console.log(`\n=== 匹配 ${matched}/${localPosts.length}, 更新 ${updated} 篇 ===`);
console.log("\n--- 未匹配的本地文章（保持原日期） ---");
for (const u of unmatched) {
  console.log(`${u.current}  ${u.title.slice(0, 50)}`);
}
