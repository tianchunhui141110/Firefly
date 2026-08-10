// 检查 Halo 文章页里图片的实际 URL（是否仍指向 oss.tianch.xyz 或已替换为 Halo 本地）
import fs from "node:fs";

const BASE = "http://152.136.165.52:8090";

// 找一篇含 oss.tianch.xyz 图片的文章
const posts = JSON.parse(
  fs.readFileSync("d:/code-tianch/Firefly/scripts/tianch-posts.json", "utf8"),
);
// 用 slug 构造 archives 链接
const samples = [
  { slug: "dubbo-fu-wu-ti-gong-zhe-wu-fa-bu-zhuo-zi-ding-yi-yi-chang-de-wen-ti-jie-jue", title: "dubbo" },
  { slug: "kubesphere-k8s-an-zhuang-rabbitmq-ji-qun-jing-xiang-mo-shi", title: "rabbitmq" },
  { slug: "idea-kong-zhi-tai-tomcat-luan-ma-de-wen-ti-jie-jue", title: "IDEA tomcat" },
];

async function main() {
  for (const s of samples) {
    const r = await fetch(`${BASE}/archives/${s.slug}`, { signal: AbortSignal.timeout(15000) });
    const html = await r.text();
    // 查找图片 URL
    const imgs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    const ossImgs = imgs.filter((u) => u.includes("oss.tianch.xyz"));
    const haloImgs = imgs.filter((u) => u.includes("/upload/") || u.includes("/apis/") || u.includes("halo"));
    console.log(`\n【${s.title}】`);
    console.log(`  图片总数: ${imgs.length}, oss.tianch.xyz: ${ossImgs.length}, Halo本地: ${haloImgs.length}`);
    console.log(`  前5张: ${imgs.slice(0, 5).join("\n         ")}`);
  }
}
main().catch((e) => console.error("ERR:", e.message));
