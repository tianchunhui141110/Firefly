// 深入分析：模糊匹配文件名变体 + 重新测试 oss.tianch.xyz 可访问性
import fs from "node:fs";
import path from "node:path";

const urls = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-migrate-urls.json", "utf8"),
);
const plan = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-migration-plan.json", "utf8"),
);

// 本地文件名集合（含去变体后的规范名）
const LOCAL_ROOTS = [
  "d:/code-tianch/Firefly/文档教程",
  "d:/code-tianch/Firefly/src/content/posts/tutorials",
];
const localNames = new Set();
const localVariants = new Map(); // 规范名(去变体) -> 实际文件
function indexDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      indexDir(p);
    } else if (/\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i.test(e.name)) {
      const name = e.name.toLowerCase();
      localNames.add(name);
      // 规范名：去掉 (1)、-1、_1 等变体后缀
      const norm = name
        .replace(/[\(（]\d+[\)）]/g, "")
        .replace(/[-_]\d+(?=\.[a-z]+$)/, "")
        .replace(/-\d{10,}(?=\.[a-z]+$)/, "");
      if (!localVariants.has(norm)) localVariants.set(norm, []);
      localVariants.get(norm).push(name);
    }
  }
}
for (const r of LOCAL_ROOTS) indexDir(r);

// 对"本地没有"的 URL 做变体匹配
const fuzzyFound = [];
const stillMissing = [];
for (const item of plan.needDownload) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(item.url).pathname);
  } catch {
    pathname = item.url.split("/").slice(3).join("/");
  }
  const fileName = path.basename(pathname).toLowerCase();
  // 去掉变体后缀后匹配
  const norm = fileName
    .replace(/[\(（]\d+[\)）]/g, "")
    .replace(/[-_]\d+(?=\.[a-z]+$)/, "")
    .replace(/-\d{10,}(?=\.[a-z]+$)/, "");
  const matches = localVariants.get(norm) || [];
  if (matches.length > 0) {
    fuzzyFound.push({ url: item.url, fileName, matchedLocal: matches });
  } else {
    stillMissing.push(item);
  }
}

console.log("=== 变体模糊匹配命中:", fuzzyFound.length, "===");
for (const f of fuzzyFound.slice(0, 10)) {
  console.log(`  ${f.fileName}  <-  本地: ${f.matchedLocal.join(",")}`);
}

console.log("\n=== 仍然缺失:", stillMissing.length, "===");
const byDomain = {};
for (const item of stillMissing) {
  const host = new URL(item.url).host;
  byDomain[host] = (byDomain[host] || 0) + 1;
}
for (const [host, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${host}`);
}

// 重新测试 oss.tianch.xyz 可访问性（更长超时 + https）
console.log("\n=== 重新测试 oss.tianch.xyz ===");
const testUrls = stillMissing
  .filter((i) => i.url.includes("oss.tianch.xyz"))
  .slice(0, 3);
for (const t of testUrls) {
  for (const u of [t.url, t.url.replace("http://", "https://").replace("https://", "https://")]) {
    try {
      const r = await fetch(u, { method: "HEAD", signal: AbortSignal.timeout(15000) });
      console.log(`  ${r.status} ${u.slice(0, 90)}`);
      if (r.ok) break;
    } catch (e) {
      console.log(`  ERR ${u.slice(0, 90)}: ${e.message.slice(0, 40)}`);
    }
  }
}

// 保存最终计划
fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-final-plan.json",
  JSON.stringify(
    {
      localFound: plan.localFound.length,
      fuzzyFound: fuzzyFound.map((f) => f.url),
      needDownload: stillMissing.map((s) => s.url),
    },
    null,
    2,
  ),
  "utf8",
);
