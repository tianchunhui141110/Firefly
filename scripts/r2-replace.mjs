// R2 图片迁移后，批量替换文章中的图片 URL
// 用法: node scripts/r2-replace.mjs <R2公开域名>
// 示例: node scripts/r2-replace.mjs https://img.tianch.com.cn
// 说明: 会把旧 OSS 域名前缀替换为 R2 域名（保持原路径结构）
import fs from "node:fs";
import path from "node:path";

const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("用法: node scripts/r2-replace.mjs <R2公开域名>");
  console.error("示例: node scripts/r2-replace.mjs https://img.tianch.com.cn");
  process.exit(1);
}

const r2Base = args[0].replace(/\/+$/, "");

// 旧域名前缀（按优先级匹配）
const OLD_PREFIXES = [
  "https://tianch-blog.oss-cn-beijing.aliyuncs.com",
  "http://tianch-blog.oss-cn-beijing.aliyuncs.com",
  "https://oss.tianch.xyz",
  "http://oss.tianch.xyz",
  "https://my-blog-to-use.oss-cn-beijing.aliyuncs.com",
  "http://my-blog-to-use.oss-cn-beijing.aliyuncs.com",
];

let replaced = 0;
let filesChanged = 0;
const changedFiles = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "index.md") {
      let c = fs.readFileSync(p, "utf8");
      const orig = c;
      for (const prefix of OLD_PREFIXES) {
        // 替换 ![](prefix/path) 中的 URL
        c = c.replaceAll(`![](${prefix}`, `![](${r2Base}`);
        c = c.replaceAll(`![` , `![`); // no-op 占位
        // 处理带 alt 的图片
        c = c.replace(
          new RegExp(`(!\\[[^\\]]*\\]\\()${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"),
          `$1${r2Base}`,
        );
      }
      if (c !== orig) {
        fs.writeFileSync(p, c, "utf8");
        filesChanged++;
        changedFiles.push(path.relative(DEST_ROOT, p));
        // 统计替换数
        const oldUrls = orig.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g) || [];
        const newUrls = c.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g) || [];
        replaced += oldUrls.length - newUrls.length < 0 ? 0 : oldUrls.length;
      }
    }
  }
}
walk(DEST_ROOT);

console.log(`替换完成: ${replaced} 处 URL, 修改 ${filesChanged} 个文件`);
for (const f of changedFiles.slice(0, 10)) console.log("  ", f);
if (changedFiles.length > 10) console.log(`  ... 共 ${changedFiles.length} 个`);

// 验证是否还有残留旧域名
const urls = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-migrate-urls.json", "utf8"),
);
