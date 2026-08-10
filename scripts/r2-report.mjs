// 最终报告：全部 422 个 URL 的图片来源分类 + 75 张无法获取图片的清单
import fs from "node:fs";

const audit = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/r2-audit-final.json", "utf8"),
);

const missing = audit.stillMissing;

// 分类
const downloadable = []; // tianch-blog（可下载）
const notDownloadable = []; // 其他
for (const url of missing) {
  if (url.includes("tianch-blog.oss-cn-beijing.aliyuncs.com")) {
    downloadable.push(url);
  } else {
    notDownloadable.push(url);
  }
}

// 不可下载的按域名
const byDomain = {};
for (const url of notDownloadable) {
  const host = new URL(url).host;
  if (!byDomain[host]) byDomain[host] = [];
  byDomain[host].push(url);
}

let report = `# R2 迁移图片审计报告\n\n`;
report += `## 总览\n\n`;
report += `| 分类 | 数量 | 说明 |\n|---|---|---|\n`;
report += `| 本地已有同名文件 | ${audit.exactFound.length} | 直接用本地文件上传 R2 |\n`;
report += `| 可从 OSS 下载 (tianch-blog) | ${downloadable.length} | 域名可访问，脚本下载 |\n`;
report += `| **无法获取（域名失效/403）** | **${notDownloadable.length}** | 需人工处理 |\n`;
report += `| 合计 | ${audit.total} | |\n\n`;

report += `## 无法获取的 ${notDownloadable.length} 张图片\n\n`;
for (const [host, urls] of Object.entries(byDomain)) {
  report += `### ${host}（${urls.length} 张）\n\n`;
  for (const u of urls) {
    report += `- \`${u}\`\n`;
  }
  report += `\n`;
}

fs.writeFileSync("d:/code-tianch/Firefly/scripts/r2-report.md", report, "utf8");
console.log("报告已生成: scripts/r2-report.md");
console.log(`本地已有: ${audit.exactFound.length}, 可下载: ${downloadable.length}, 无法获取: ${notDownloadable.length}`);
