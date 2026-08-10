// 深入对比：oss.tianch.xyz 的 URL 文件名 vs 本地文件名（数字核心匹配）
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);

// 本地全部图片文件名（含大小写原始名）
const LOCAL_ROOTS = [
  "d:/code-tianch/Firefly/文档教程",
  "d:/code-tianch/Firefly/src/content/posts/tutorials",
];
const localNames = new Set(); // 原始文件名
const localLower = new Map(); // 小写名
function indexDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      indexDir(p);
    } else if (/\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i.test(e.name)) {
      localNames.add(e.name);
      localLower.set(e.name.toLowerCase(), p);
    }
  }
}
for (const r of LOCAL_ROOTS) indexDir(r);
console.log("本地图片文件总数:", localNames.size);

// 取出 oss.tianch.xyz 的缺失 URL
const ossUrls = audit.stillMissing.filter((u) => u.includes("oss.tianch.xyz"));
console.log("oss.tianch.xyz 缺失 URL:", ossUrls.length);

// 对每个 URL 文件名，尝试多种匹配策略
function extractCore(fileName) {
  // 去掉扩展名
  const base = fileName.replace(/\.([a-z]+)$/i, "");
  // 提取所有数字序列（时间戳）
  const nums = base.match(/\d+/g) || [];
  return { base, nums };
}

let matched = 0;
const unmatched = [];
for (const url of ossUrls) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    pathname = url;
  }
  const fileName = path.basename(pathname);
  const lower = fileName.toLowerCase();

  // 策略1: 完全同名
  if (localLower.has(lower)) {
    matched++;
    console.log(`[1同名] ${fileName} -> ${localLower.get(lower)}`);
    continue;
  }

  // 策略2: 提取数字核心（如 20211216143614030），在本地文件名中查找包含该数字的
  const { nums } = extractCore(fileName);
  const longNum = nums.filter((n) => n.length >= 12); // 时间戳
  let found = null;
  for (const n of longNum) {
    for (const lname of localNames) {
      if (lname.includes(n)) {
        found = lname;
        break;
      }
    }
    if (found) break;
  }
  if (found) {
    matched++;
    console.log(`[2数字] ${fileName} -> 本地: ${found}`);
    continue;
  }

  // 策略3: 短数字（8位日期）
  const shortNums = nums.filter((n) => n.length === 8);
  for (const n of shortNums) {
    for (const lname of localNames) {
      if (lname.includes(n)) {
        found = lname;
        break;
      }
    }
    if (found) break;
  }
  if (found) {
    matched++;
    console.log(`[3日期] ${fileName} -> 本地: ${found}`);
    continue;
  }

  unmatched.push({ url, fileName });
}

console.log(`\n=== 匹配成功: ${matched}, 仍未匹配: ${unmatched.length} ===`);
console.log("\n=== 仍未匹配明细 ===");
for (const u of unmatched) {
  console.log(`  ${u.fileName}  <-  ${u.url.slice(0, 100)}`);
}
