// 最终梳理：208 个缺失 URL 分类（可下载 / 不可下载 / Halo新文章）
import fs from "node:fs";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);
const audit6 = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit6.json", "utf8"),
);
const missing = audit.stillMissing;

// 分类
const downloadable = []; // tianch-blog（可访问）
const haloNewArticles = []; // 从 Halo 拉取的新文章（oss.tianch.xyz / my-blog-to-use 等 403）
const other = [];

for (const url of missing) {
  if (url.includes("tianch-blog.oss-cn-beijing.aliyuncs.com")) {
    downloadable.push(url);
  } else {
    haloNewArticles.push(url);
  }
}

console.log("=== 缺失 URL 最终分类 ===");
console.log(`A. tianch-blog 可下载: ${downloadable.length}`);
console.log(`B. 其他域名(403/不可访问): ${haloNewArticles.length}`);
console.log(`   - oss.tianch.xyz: ${haloNewArticles.filter((u) => u.includes("oss.tianch.xyz")).length}`);
console.log(`   - my-blog-to-use: ${haloNewArticles.filter((u) => u.includes("my-blog-to-use")).length}`);
console.log(`   - 其他图床: ${haloNewArticles.filter((u) => !u.includes("oss.tianch.xyz") && !u.includes("my-blog-to-use")).length}`);

// 检查这些 URL 对应的文章是否是 Halo 新增的（不在文档教程）
const noSourceUrls = new Set(audit6.noSource.map((r) => r.url));
const inNoSource = haloNewArticles.filter((u) => noSourceUrls.has(u));
const notInNoSource = haloNewArticles.filter((u) => !noSourceUrls.has(u));
console.log(`\nB 类中属于 Halo 新文章(本地无源目录): ${inNoSource.length}`);
console.log(`B 类中源目录存在但无对应图: ${notInNoSource.length}`);

// 打印 B 类明细
console.log("\n=== B 类（403 不可下载）明细 ===");
for (const u of haloNewArticles) {
  console.log(`  ${u.slice(0, 115)}`);
}

// 保存分类结果
fs.writeFileSync(
  "d:/code-tianch/Firefly/scripts/r2-classified.json",
  JSON.stringify(
    {
      localFound: audit.exactFound.length,
      downloadable: downloadable,
      notDownloadable: haloNewArticles,
      totalMissing: missing.length,
    },
    null,
    2,
  ),
  "utf8",
);
