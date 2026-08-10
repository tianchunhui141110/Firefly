// 全面检查配置是否被 Revert 恢复
import fs from "node:fs";

const checks = [
  ["commentConfig.type", "src/config/commentConfig.ts", /type:\s*"(\w+)"/],
  ["siteConfig.title", "src/config/siteConfig.ts", /title:\s*"([^"]+)"/],
  ["siteConfig.subtitle", "src/config/siteConfig.ts", /subtitle:\s*"([^"]+)"/],
  ["siteConfig.site_url", "src/config/siteConfig.ts", /site_url:\s*"([^"]+)"/],
  ["profileConfig.name", "src/config/profileConfig.ts", /name:\s*"([^"]+)"/],
  ["profileConfig.bio", "src/config/profileConfig.ts", /bio:\s*"([^"]+)"/],
  ["backgroundWallpaper.mode", "src/config/backgroundWallpaper.ts", /mode:\s*"(\w+)"/],
  ["wallpaperModeSwitchable", "src/config/displaySettingsConfig.ts", /wallpaperModeSwitchable:\s*(\w+)/],
  ["pages.anime", "src/config/siteConfig.ts", /anime:\s*(\w+)/],
  ["pages.bangumi", "src/config/siteConfig.ts", /bangumi:\s*(\w+)/],
  ["pages.dynamic", "src/config/siteConfig.ts", /dynamic:\s*(\w+)/],
  ["pages.gallery", "src/config/siteConfig.ts", /gallery:\s*(\w+)/],
  ["pages.friends", "src/config/siteConfig.ts", /friends:\s*(\w+)/],
  ["navBar-社交", "src/config/navBarConfig.ts", /name:\s*"社交"/],
  ["navBar-追番", "src/config/navBarConfig.ts", /name:\s*"追番"/],
  ["tags-tag-off", "src/pages/tags/index.astro", /tag-off/],
  ["about-throw", "src/pages/about.astro", /throw new Error/],
  ["gallery-流萤", "src/config/galleryConfig.ts", /流萤/],
  ["rss-old-domain", "src/pages/rss.xml.ts", /firefly\.cuteleaf\.cn/],
  ["music-local", "src/config/musicConfig.ts", /使一颗心免于哀伤/],
  ["music-meting-id", "src/config/musicConfig.ts", /id:\s*"(\d+)"/],
  ["friends-友链", "src/config/friendsConfig.ts", /夏夜流萤/],
  ["sponsor-打赏", "src/config/sponsorConfig.ts", /支付宝/],
  ["announcement-公告", "src/config/announcementConfig.ts", /示例公告/],
  ["booknav-数据", "src/config/booknavConfig.ts", /Firefly Docs/],
  ["wrangler-name", "wrangler.jsonc", /"name":\s*"([^"]+)"/],
  ["posts自带文章", "src/content/posts/firefly.md", null],
  ["spec-about", "src/content/spec/about.md", null],
  ["dynamic-数据", "src/content/dynamic/2026-07-15-010756.md", null],
  ["public-gallery", "public/gallery", null],
  ["public-pio", "public/pio", null],
];

for (const [label, file, re] of checks) {
  if (re === null) {
    console.log(`${label}: ${fs.existsSync(file)}`);
    continue;
  }
  if (!fs.existsSync(file)) {
    console.log(`${label}: FILE MISSING`);
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  const m = content.match(re);
  console.log(`${label}: ${m ? JSON.stringify(m[1] ?? m[0]) : "NOT FOUND"}`);
}
