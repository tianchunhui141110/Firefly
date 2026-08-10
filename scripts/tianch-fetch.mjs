// 从 Halo API 拉取全部文章（标题 + 发布时间），保存为 JSON
import fs from "node:fs";

const BASE = "http://152.136.165.52:8090";

async function main() {
  const all = [];
  let page = 1;
  const size = 100;
  for (;;) {
    const r = await fetch(
      `${BASE}/apis/api.content.halo.run/v1alpha1/posts?page=${page}&size=${size}&sort=metadata.creationTimestamp,desc`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    all.push(...data.items);
    console.log(
      `page ${page}: 获取 ${data.items.length} 篇, 总数 ${data.total}, 累计 ${all.length}`,
    );
    if (data.items.length === 0 || all.length >= data.total) break;
    page++;
  }

  // 提取 标题 + 创建时间 + 发布时间 + 状态
  const posts = all.map((p) => ({
    title: p.spec?.title || p.metadata?.name || "",
    slug: p.spec?.slug || "",
    created: p.metadata?.creationTimestamp || "",
    published: p.spec?.publishTime || p.metadata?.creationTimestamp || "",
    deleted: p.metadata?.deletionTimestamp || false,
  }));

  fs.writeFileSync(
    "d:/code-tianch/Firefly/scripts/tianch-posts.json",
    JSON.stringify(posts, null, 2),
    "utf8",
  );
  console.log("\n=== 保存", posts.length, "篇 ===");
  // 打印前 20 条
  for (const p of posts.slice(0, 20)) {
    console.log(
      `${(p.published || p.created || "").slice(0, 10)}  ${(p.created || "").slice(0, 10)}  ${p.title.slice(0, 45)}`,
    );
  }
}

main().catch((e) => console.error("ERR:", e.message));
