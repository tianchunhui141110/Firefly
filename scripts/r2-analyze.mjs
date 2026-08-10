// 统计所有文章中的远程图片引用（OSS 等外部域名）
import fs from "node:fs";
import path from "node:path";

const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

const domainCount = {};
const urls = new Set();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "index.md") {
      const c = fs.readFileSync(p, "utf8");
      for (const m of c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
        const url = m[1];
        try {
          const host = new URL(url).host;
          domainCount[host] = (domainCount[host] || 0) + 1;
          urls.add(url);
        } catch {
          /* ignore */
        }
      }
    }
  }
}
walk(DEST_ROOT);

console.log("=== 远程图片域名统计 ===");
for (const [host, count] of Object.entries(domainCount).sort((a, b) => b[1] - a[1])) {
  console.log(`${count}\t${host}`);
}
console.log("\n远程图片 URL 去重总数:", urls.size);

// 保存 URL 列表
fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-migrate-urls.json",
  JSON.stringify([...urls], null, 2),
  "utf8",
);
