// 在用户电脑常见备份位置搜索缺失图片（按文件名）
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);
const missing = audit.stillMissing; // 208 个缺失 URL
const targetNames = new Set();
for (const url of missing) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    pathname = url;
  }
  targetNames.add(path.basename(pathname).toLowerCase());
}
console.log("目标文件名数:", targetNames.size);

// 搜索位置（只列存在的）
const SEARCH_ROOTS = [
  "D:/BaiduNetdiskDownload",
  "D:/Downloads",
  "D:/下载",
  "D:/Users",
  "C:/Users/Administrator/Downloads",
  "C:/Users/Administrator/Pictures",
  "C:/Users/Administrator/Desktop",
  "E:/",
  "F:/",
];

function walk(dir, depth) {
  if (depth > 6) return;
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // 跳过无关目录
      if (/node_modules|\.git|Windows|Program Files/i.test(e.name)) continue;
      results = results.concat(walk(p, depth + 1));
    } else if (/\.(png|jpe?g|gif|webp|avif)$/i.test(e.name)) {
      if (targetNames.has(e.name.toLowerCase())) {
        results.push(p);
      }
    }
  }
  return results;
}

const found = [];
for (const root of SEARCH_ROOTS) {
  if (!fs.existsSync(root)) {
    console.log("跳过(不存在):", root);
    continue;
  }
  console.log("搜索:", root, "...");
  const hits = walk(root, 0);
  if (hits.length > 0) {
    console.log(`  命中 ${hits.length} 个`);
    found.push(...hits);
  }
}

console.log(`\n=== 搜索完成，共找到 ${found.length} 个缺失图片 ===`);
for (const f of found.slice(0, 30)) console.log("  ", f);
