// 用 D:\BaiduNetdiskDownload\文档教程 备份匹配缺失图片
import fs from "node:fs";
import path from "node:path";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);

// 备份目录图片索引（小写名 -> 路径）
const BACKUP_ROOT = "D:/BaiduNetdiskDownload/文档教程";
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
indexDir(BACKUP_ROOT);
console.log("备份目录图片文件总数:", fileByName.size);

// 对 208 个缺失 URL 匹配备份
const missing = audit.stillMissing;
const foundInBackup = [];
const stillMissing = [];

for (const url of missing) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    pathname = url.split("/").slice(3).join("/");
  }
  const fileName = path.basename(pathname).toLowerCase();
  const matches = fileByName.get(fileName);
  if (matches && matches.length > 0) {
    foundInBackup.push({ url, fileName, local: matches[0] });
  } else {
    stillMissing.push({ url, fileName });
  }
}

console.log(`\n=== 备份中找到: ${foundInBackup.length} ===`);
console.log(`=== 备份中也没有: ${stillMissing.length} ===`);

// 备份中没有的再按域名分类
const byDomain = {};
for (const item of stillMissing) {
  const host = new URL(item.url).host;
  byDomain[host] = (byDomain[host] || 0) + 1;
}
console.log("\n备份中也缺失的按域名:");
for (const [host, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${host}`);
}

console.log("\n=== 备份中也缺失的明细 ===");
for (const item of stillMissing) {
  console.log(`  ${item.fileName}  <-  ${item.url.slice(0, 100)}`);
}

fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-backup-match.json",
  JSON.stringify(
    {
      foundInBackup: foundInBackup.map((x) => ({ url: x.url, local: x.local })),
      stillMissing: stillMissing.map((x) => ({ url: x.url, fileName: x.fileName })),
    },
    null,
    2,
  ),
  "utf8",
);
console.log("\n结果已保存: scripts/r2-backup-match.json");
