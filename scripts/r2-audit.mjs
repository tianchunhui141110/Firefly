// 梳理 OSS 图片链接 vs 本地文件：找出本地已有 / 需要下载 / 两边都无
import fs from "node:fs";
import path from "node:path";

const urls = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-migrate-urls.json", "utf8"),
);

// 1. 建立本地文件索引：文件名 -> 完整路径（文档教程目录）
const LOCAL_ROOTS = [
  "d:/code-tianch/Firefly/文档教程",
  "d:/code-tianch/Firefly/src/content/posts/tutorials",
];

const fileByName = new Map(); // 小写文件名 -> [paths]
function indexDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      indexDir(p);
    } else if (/\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i.test(e.name)) {
      const key = e.name.toLowerCase();
      if (!fileByName.has(key)) fileByName.set(key, []);
      fileByName.get(key).push(p);
    }
  }
}
for (const r of LOCAL_ROOTS) indexDir(r);
console.log("本地图片文件总数:", fileByName.size);

// 2. 解析每个 URL 的文件名，匹配本地
const result = {
  localFound: [], // 本地有同名文件
  needDownload: [], // 本地无，需从 OSS 下载
  bothMissing: [], // 本地无且域名不可访问（无法获取）
};

for (const url of urls) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    pathname = url.split("/").slice(3).join("/");
  }
  const fileName = path.basename(pathname).toLowerCase();
  const localMatches = fileByName.get(fileName) || [];

  if (localMatches.length > 0) {
    result.localFound.push({ url, fileName, local: localMatches[0] });
  } else {
    result.needDownload.push({ url, fileName });
  }
}

console.log("\n=== 本地已找到同名文件:", result.localFound.length, "===");
console.log("=== 本地没有（需从 OSS 下载）:", result.needDownload.length, "===");

// 3. 对"本地没有"的再按域名分组（判断哪些域名可能可访问）
const byDomain = {};
for (const item of result.needDownload) {
  const host = new URL(item.url).host;
  byDomain[host] = (byDomain[host] || 0) + 1;
}
console.log("\n需下载图片按域名分布:");
for (const [host, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${host}`);
}

// 4. 检查本地文件是否与 URL 路径有可对应的（用文件名之外再对比 URL 中路径片段）
// 有些 URL 文件名可能带 -1 后缀或压缩变体
console.log("\n=== 本地找不到的 URL 示例 ===");
for (const item of result.needDownload.slice(0, 15)) {
  console.log(`  ${item.url.slice(0, 110)}`);
}

// 保存分析结果
fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-migration-plan.json",
  JSON.stringify(result, null, 2),
  "utf8",
);
console.log("\n分析结果已保存: scripts/r2-migration-plan.json");
