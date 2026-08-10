// 精确审计：OSS URL vs 本地文件（严谨匹配，无正则误伤）
import fs from "node:fs";
import path from "node:path";

const urls = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-migrate-urls.json", "utf8"),
);

// 本地文件索引：完整文件名 -> 路径列表
const LOCAL_ROOTS = [
  "d:/code-tianch/Firefly/文档教程",
  "d:/code-tianch/Firefly/src/content/posts/tutorials",
];
const fileByName = new Map();
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

// 变体匹配规则（只针对括号副本，不碰时间戳）
// URL: image-xxx.png  ->  本地可能叫 image-xxx(1).png / image-xxx(1)(1).png
// URL: image-xxx(1).png -> 本地可能叫 image-xxx.png
function variantMatches(urlFileName) {
  const base = urlFileName.replace(/\.([a-z]+)$/i, "");
  const ext = urlFileName.match(/\.([a-z]+)$/i)[1];
  const results = [];
  // 情况1: URL 是基础名，本地有带 (n) 的副本
  for (const key of fileByName.keys()) {
    if (key.startsWith(`${base}(`) && key.endsWith(`.${ext}`)) {
      results.push(key);
    }
  }
  // 情况2: URL 带 (n)，本地有基础名
  if (/\(\d+\)/.test(base)) {
    const pureBase = base.replace(/[\(（]\d+[\)）]/g, "");
    const key = `${pureBase}.${ext}`;
    if (fileByName.has(key)) results.push(key);
  }
  return results;
}

const exactFound = []; // 完全同名
const variantFound = []; // 变体匹配
const stillMissing = []; // 仍缺失

for (const url of urls) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    pathname = url.split("/").slice(3).join("/");
  }
  const fileName = path.basename(pathname).toLowerCase();

  if (fileByName.has(fileName)) {
    exactFound.push({ url, fileName, local: fileByName.get(fileName)[0] });
  } else {
    const variants = variantMatches(fileName);
    if (variants.length > 0) {
      variantFound.push({ url, fileName, localVariants: variants.slice(0, 5) });
    } else {
      stillMissing.push({ url, fileName });
    }
  }
}

console.log("URL 总数:", urls.length);
console.log("完全同名命中:", exactFound.length);
console.log("变体匹配命中:", variantFound.length);
console.log("仍然缺失:", stillMissing.length);

// 缺失按域名分组
const byDomain = {};
for (const item of stillMissing) {
  const host = new URL(item.url).host;
  byDomain[host] = (byDomain[host] || 0) + 1;
}
console.log("\n缺失图片按域名分布:");
for (const [host, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${host}`);
}

// 缺失图片按文章分组（找出哪些文章受影响）
const byArticle = {};
for (const item of stillMissing) {
  // 在文章中找到引用该 URL 的位置
  const url = item.url;
  byArticle[url] = { url, count: 1 };
}
console.log("\n=== 缺失 URL 明细 ===");
for (const item of stillMissing) {
  console.log(`  ${item.fileName}  <-  ${item.url.slice(0, 100)}`);
}

fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-audit-final.json",
  JSON.stringify(
    {
      total: urls.length,
      exactFound: exactFound.map((x) => ({ url: x.url, local: x.local })),
      variantFound: variantFound.map((x) => ({ url: x.url, variants: x.localVariants })),
      stillMissing: stillMissing.map((x) => x.url),
    },
    null,
    2,
  ),
  "utf8",
);
console.log("\n结果已保存: scripts/r2-audit-final.json");
