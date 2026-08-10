// 将 文档教程 目录下的 md 教程批量转换为 Firefly 博客文章
// 用法: node scripts/tutorial-convert.mjs
// 输出: src/content/posts/tutorials/<slug>/index.md + images/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pinyin } from "pinyin-pro";

const SRC_ROOT = "d:/code-tianch/Firefly/文档教程";
const DEST_ROOT = "d:/code-tianch/Firefly/src/content/posts/tutorials";

// ---------- 工具 ----------
const norm = (n) => n.replace(/\((\d+)\)/g, "");

// 中文转拼音 slug（参考 scripts/new-post.js）
function toSlug(name) {
  const cleaned = name
    .replace(/^\d+\.\s*/, "") // 去编号前缀
    .replace(/^\d+/, "")
    .replace(/\(\d+\)/g, "") // 去重复副本后缀
    .replace(/\.md$/i, "")
    .trim();
  const segments = [];
  let buf = "";
  for (const ch of cleaned) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      if (buf) {
        segments.push(buf);
        buf = "";
      }
      segments.push(pinyin(ch, { toneType: "none", type: "array" })[0]);
    } else {
      buf += ch;
    }
  }
  if (buf) segments.push(buf);
  return segments
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanTitle(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\(\d+\)/g, "")
    .trim();
}

// YAML 安全字符串
const yamlStr = (s) => JSON.stringify(String(s ?? ""));

// 从文件/目录名推断分类
function guessCategory(dirName, fileName) {
  const text = `${dirName} ${fileName}`;
  if (/Apollo|nacos|RabbitMQ|skywalking|ActiveMQ|Elasticsearch|ELK|logstash/.test(text)) return "中间件";
  if (/Kubernetes|k8s|KubeSphere|KubeKey|Containerd|kubectl|Pod|Ingress|DaemonSet|StatefulSet|ConfigMap|HPA|CRD|RBAC|Prometheus/.test(text)) return "Kubernetes";
  if (/Docker|docker|镜像|Harbor|容器/.test(text)) return "Docker";
  if (/MySQL|SQL/.test(text)) return "MySQL";
  if (/Redis/.test(text)) return "Redis";
  if (/Nginx|OpenResty/.test(text)) return "Nginx";
  if (/Java|Spring|dubbo|MDC|IDEA|tomcat/.test(text)) return "Java";
  if (/Linux|CentOS|Xshell|挂载|定时任务|vsftp|yum|fail2ban|ssh/.test(text)) return "Linux";
  return "其他";
}

// 提取 tags
function guessTags(dirName, fileName) {
  const tags = new Set();
  const text = `${dirName} ${fileName}`;
  const rules = [
    /Kubernetes|k8s|KubeSphere|KubeKey|Containerd/g,
    /Docker|docker/g,
    /MySQL/g,
    /Redis/g,
    /Nginx|OpenResty/g,
    /Spring|SpringBoot|Springboot/g,
    /Java|JAVA|dubbo/g,
    /Linux|CentOS/g,
    /Apollo/g,
    /nacos/g,
    /RabbitMQ/g,
    /skywalking/g,
    /ActiveMQ/g,
    /Elasticsearch/g,
    /MDC/g,
    /集群/g,
    /日志/g,
    /分布式/g,
  ];
  for (const re of rules) {
    const m = text.match(re);
    if (m) tags.add(m[0].toLowerCase() === "java" ? "Java" : m[0]);
  }
  if (tags.size === 0) tags.add("运维");
  return [...tags].slice(0, 4);
}

// 提取正文描述（第一段非空正文文本）
function extractDescription(body) {
  const lines = body.split("\n");
  let inCode = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (!t) continue;
    if (t.startsWith("#")) continue;
    if (t.startsWith("![")) continue;
    if (/^[-*+]\s/.test(t) || /^\d+[.、)]/.test(t)) continue; // 跳过列表项
    // 去掉 markdown 链接语法但保留文本
    const plain = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_>]/g, "").trim();
    if (plain.length > 5) return plain.slice(0, 120);
  }
  return "";
}

// ---------- 图片处理 ----------
// 解析 markdown 图片引用并返回 { alt, src, title }
// 注意：路径可能含空格（如盘符路径），不能使用 [^)\s]+ 限制
function parseImgRefs(body) {
  const refs = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const m of body.matchAll(re)) {
    let src = m[2].trim();
    let title = "";
    // 分离尾部 "title"
    const titleMatch = src.match(/^(.*?)\s+"([^"]*)"$/);
    if (titleMatch) {
      src = titleMatch[1];
      title = titleMatch[2];
    }
    refs.push({ alt: m[1], src, title });
  }
  return refs;
}

// 在文档教程全目录按文件名搜索（处理盘符路径丢失情况）
const fileIndex = new Map();
function buildFileIndex() {
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else fileIndex.set(e.name.toLowerCase(), p);
    }
  }
  walk(SRC_ROOT);
}

// 解析本地图片源文件路径
function resolveLocalImage(ref, mdDir) {
  let p = ref.replace(/^[<"]|[">]$/g, "");
  // 盘符绝对路径
  if (/^[A-Za-z]:[\\/]/.test(p)) {
    const idx = p.indexOf("文档教程");
    if (idx >= 0) {
      p = p.slice(idx + "文档教程".length);
    } else {
      const base = path.basename(p);
      return fileIndex.get(base.toLowerCase()) || null;
    }
  }
  // 以 / 或 \ 开头的相对路径（相对 md 所在目录）
  if (p.startsWith("/") || p.startsWith("\\")) {
    p = p.replace(/^[/\\]+/, "");
  }
  const resolved = path.resolve(mdDir, p);
  if (fs.existsSync(resolved)) return resolved;
  // 兜底：按文件名搜索
  const base = path.basename(p);
  return fileIndex.get(base.toLowerCase()) || null;
}

// 复制图片并返回新文件名（冲突时加序号）
function copyImage(srcFile, destDir) {
  const ext = path.extname(srcFile);
  let base = path.basename(srcFile, ext).replace(/[^\w.-]/g, "_") || "img";
  let name = `${base}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(destDir, name))) {
    if (crypto.createHash("md5").update(fs.readFileSync(srcFile)).digest("hex") ===
        crypto.createHash("md5").update(fs.readFileSync(path.join(destDir, name))).digest("hex")) {
      return name; // 内容相同直接复用
    }
    name = `${base}-${counter}${ext}`;
    counter++;
  }
  fs.copyFileSync(srcFile, path.join(destDir, name));
  return name;
}

// ---------- 主流程 ----------
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
}
walk(SRC_ROOT);
buildFileIndex();

// 1. 分组去重：规范化文件名 -> 组内按内容哈希去重 -> 选最长
const groups = {};
for (const f of files) {
  const key = norm(path.basename(f));
  const hash = crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");
  (groups[key] ||= []).push({ f, hash });
}

const picks = [];
for (const [key, v] of Object.entries(groups)) {
  const byHash = new Map();
  for (const item of v) {
    if (!byHash.has(item.hash) || fs.statSync(item.f).size > fs.statSync(byHash.get(item.hash).f).size) {
      byHash.set(item.hash, item);
    }
  }
  const candidates = [...byHash.values()];
  const best = candidates.sort((a, b) => fs.statSync(b.f).size - fs.statSync(a.f).size)[0];
  picks.push({ key, file: best.f, size: fs.statSync(best.f).size });
}

// 2. 逐篇转换
const skipped = [];
const converted = [];
const usedSlugs = new Set();

for (const pick of picks.sort((a, b) => a.file.localeCompare(b.file))) {
  const { file } = pick;
  const fname = path.basename(file);
  // 跳过临时文件
  if (fname.startsWith(".~") || fname.startsWith("~$")) {
    skipped.push({ file: path.relative(SRC_ROOT, file), reason: "临时文件" });
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  if (content.trim().length === 0) {
    skipped.push({ file: path.relative(SRC_ROOT, file), reason: "空文件" });
    continue;
  }

  const mdDir = path.dirname(file);
  const dirName = path.basename(mdDir);
  const lines = content.split("\n");

  // 提取标题：正文第一个 H1，否则用文件名；H1 过短（<4 字）用文件名
  const h1 = lines.find((l) => l.startsWith("# "));
  const h1Title = h1 ? h1.replace(/^#\s+/, "").trim() : "";
  const fileNameTitle = cleanTitle(fname);
  const title = h1Title.length >= 4 ? h1Title : fileNameTitle;
  if (!title || title.length < 2) {
    skipped.push({ file: path.relative(SRC_ROOT, file), reason: `无有效标题: ${fname}` });
    continue;
  }

  // 跳过无实际正文内容的文件（仅图片/代码块）
  const bodyTextLen = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>`*_\-\s]/g, "").length;
  if (bodyTextLen < 3) {
    skipped.push({ file: path.relative(SRC_ROOT, file), reason: `内容过短(${bodyTextLen}字): ${fname}` });
    continue;
  }

  // slug 生成 + 冲突处理
  let slug = toSlug(fname);
  if (!slug) {
    slug = toSlug(title) || `post-${crypto.randomBytes(4).toString("hex")}`;
  }
  let finalSlug = slug;
  let n = 2;
  while (usedSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${n}`;
    n++;
  }
  usedSlugs.add(finalSlug);

  const destDir = path.join(DEST_ROOT, finalSlug);
  const imgDir = path.join(destDir, "images");
  fs.mkdirSync(imgDir, { recursive: true });

  // 处理正文：移除第一个 H1，改写图片引用
  let body = content;
  if (h1) {
    body = body.replace(h1, "");
  }

  const imgRefs = parseImgRefs(body);
  const imgMap = new Map(); // 原始 src -> 新相对路径
  let missingImgs = 0;
  for (const ref of imgRefs) {
    if (/^https?:\/\//.test(ref.src)) continue;
    if (imgMap.has(ref.src)) continue;
    const srcFile = resolveLocalImage(ref.src, mdDir);
    if (!srcFile) {
      missingImgs++;
      imgMap.set(ref.src, null);
      continue;
    }
    const newName = copyImage(srcFile, imgDir);
    imgMap.set(ref.src, `./images/${newName}`);
  }

  // 重写正文中的图片引用（路径可能含空格，用宽松匹配）
  body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, srcRaw) => {
    let src = srcRaw.trim();
    let title = "";
    const titleMatch = src.match(/^(.*?)\s+"([^"]*)"$/);
    if (titleMatch) {
      src = titleMatch[1];
      title = titleMatch[2];
    }
    const mapped = imgMap.get(src);
    if (mapped === undefined || mapped === null) return m;
    return `![${alt}](${mapped}${title ? ` "${title}"` : ""})`;
  });

  // 生成 frontmatter
  const published = new Date(fs.statSync(file).mtime).toISOString().slice(0, 10);
  const description = extractDescription(body);
  const category = guessCategory(dirName, fname);
  const tags = guessTags(dirName, fname);

  const fm = [
    "---",
    `title: ${yamlStr(title)}`,
    `published: ${published}`,
    `description: ${yamlStr(description)}`,
    `tags: ${JSON.stringify(tags)}`,
    `category: ${yamlStr(category)}`,
    "draft: false",
    "lang: zh_CN",
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(destDir, "index.md"), `${fm}\n${body.replace(/^\n+/, "")}\n`, "utf8");

  converted.push({
    slug: finalSlug,
    title,
    src: path.relative(SRC_ROOT, file),
    imgs: imgRefs.length,
    missing: missingImgs,
    category,
  });
}

// 3. 报告
console.log(`\n=== 转换完成: 成功 ${converted.length} 篇, 跳过 ${skipped.length} 篇 ===\n`);
for (const s of skipped) console.log(`SKIP: [${s.reason}] ${s.file}`);
console.log("\n--- 转换明细 ---");
for (const c of converted) {
  console.log(`${c.slug}\t[${c.category}] ${c.title}\t图片${c.imgs}${c.missing ? `(缺${c.missing})` : ""}\t<- ${c.src}`);
}
const totalMissing = converted.reduce((a, c) => a + c.missing, 0);
console.log(`\n缺失图片总数: ${totalMissing}`);
