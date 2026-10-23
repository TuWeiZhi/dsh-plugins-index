#!/usr/bin/env node
/**
 * 从 npm registry 生成插件市场索引（格式 1）。
 *
 * 用法：
 *   node scripts/build-index.mjs            # 只校验并打印摘要，不写文件
 *   node scripts/build-index.mjs --write    # 校验通过后写入 index.json
 *
 * 数据来源：packument（registry 的完整包文档）里的 versions 与 time，
 * 所以 publishTimestamp 是真实的发布秒数，不是构建时间。
 * 生成后用 DSH 自己的校验器（vendor/）验证，规则与 DSH 客户端完全一致。
 *
 * 环境变量：
 *   NPM_REGISTRY  默认 https://registry.npmjs.org
 *   INDEX_URL     index.json 将来对外暴露的绝对 URL（校验相对图标要用）
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import semver from "../vendor/node_modules/semver/index.js";
import { parseMarketIndex } from "../vendor/node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = (process.env.NPM_REGISTRY ?? "https://registry.npmjs.org").replace(/\/+$/u, "");
const INDEX_URL = process.env.INDEX_URL ?? "https://raw.githubusercontent.com/TuWeiZhi/dsh-plugins-index/main/index.json";
const WRITE = process.argv.includes("--write");

/** 索引里内联 data: 图标的解码上限，与 DSH 校验器一致。 */
const MAX_ICON_BYTES = 32 * 1024;
const MIME = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function main() {
  const manifest = JSON.parse(await readFile(join(ROOT, "plugins.json"), "utf8"));
  const plugins = [];

  for (const entry of manifest.plugins ?? []) {
    const name = entry.name;
    if (typeof name !== "string" || name === "") throw new Error("plugins.json: 每个插件都要有 name");

    const packument = await fetchPackument(name);
    const versions = versionEntries(packument, entry);
    if (versions.length === 0) throw new Error(`${name}: registry 上没有可用版本`);

    const title = entry.title ?? name;
    const description = entry.description ?? packument.description;
    const plugin = {
      name,
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      ...(entry.icon === undefined ? {} : { icon: await inlineIcon(entry.icon, name) }),
      ...(authorOf(packument) === undefined ? {} : { author: authorOf(packument) }),
      ...(homepageOf(packument) === undefined ? {} : { homepage: homepageOf(packument) }),
      ...(repositoryOf(packument) === undefined ? {} : { repository: repositoryOf(packument) }),
      metadata: entry.metadata ?? {},
      versions,
    };
    plugins.push(plugin);
    console.log(`✓ ${name}  ${versions.length} 个版本（最新 ${versions[0].version}）`);
  }

  // 置顶项在前，其余按包名字母序，保证每次生成结果稳定（避免无意义 diff）。
  plugins.sort((left, right) => {
    const pin = (right.metadata?.sortKeys?.pinned ?? 0) - (left.metadata?.sortKeys?.pinned ?? 0);
    return pin !== 0 ? pin : left.name.localeCompare(right.name);
  });

  const document = {
    format: 1,
    title: manifest.title,
    ...(manifest.description === undefined ? {} : { description: manifest.description }),
    metadata: manifest.metadata ?? {},
    plugins,
  };

  // 用 DSH 官方校验器过一遍：字段名写错、图标超限、id 未声明都会在这里报出精确的 JSON 路径。
  const validated = parseMarketIndex(document, INDEX_URL);
  summarize(validated);

  const text = `${JSON.stringify(validated, null, 2)}\n`;
  if (WRITE) {
    await writeFile(join(ROOT, "index.json"), text, "utf8");
    console.log(`\n已写入 index.json（${Buffer.byteLength(text)} B）`);
  } else {
    console.log("\n校验通过；加 --write 才会写入 index.json");
  }
}

async function fetchPackument(name) {
  const encoded = name.startsWith("@")
    ? `@${encodeURIComponent(name.slice(1))}`
    : encodeURIComponent(name);
  const response = await fetch(`${REGISTRY}/${encoded}`, {
    headers: { accept: "application/json", "user-agent": "dsh-plugins-index" },
  });
  if (!response.ok) throw new Error(`${name}: registry 返回 ${response.status} ${response.statusText}`);
  return response.json();
}

function versionEntries(packument, entry) {
  const entries = [];
  for (const [version, versionManifest] of Object.entries(packument.versions ?? {})) {
    if (!semver.valid(version)) continue;
    if (!entry.includePrerelease && semver.prerelease(version) !== null) continue;
    const published = packument.time?.[version];
    if (typeof published !== "string") continue;
    const publishTimestamp = Math.floor(Date.parse(published) / 1000);
    const dshRange = dshRangeOf(versionManifest);
    entries.push({
      version,
      publishTimestamp,
      source: { type: "npm" },
      ...(dshRange === undefined ? {} : { engines: { dsh: dshRange } }),
    });
  }
  entries.sort((left, right) => semver.rcompare(left.version, right.version));
  return entries;
}

/** 校验器拒绝 workspace: 范围，也要求是合法 SemVer 范围；官网 `engines.dsh` 常常只是 ">=0.2.1-alpha.1"。 */
function dshRangeOf(versionManifest) {
  const raw = versionManifest?.engines?.dsh;
  if (typeof raw !== "string") return undefined;
  const range = raw.trim();
  if (range === "" || range.startsWith("workspace:")) return undefined;
  return semver.validRange(range) === null ? undefined : range;
}

async function inlineIcon(relativePath, name) {
  const absolute = join(ROOT, relativePath);
  const mime = MIME[extname(absolute).toLowerCase()];
  if (mime === undefined) throw new Error(`${name}: 图标 ${relativePath} 必须是 svg/png/jpeg/webp`);
  const bytes = await readFile(absolute);
  if (bytes.length > MAX_ICON_BYTES) {
    throw new Error(
      `${name}: 图标 ${relativePath} 解码后 ${bytes.length} B，超过 ${MAX_ICON_BYTES} B 上限；先缩到 128×128 再内联`,
    );
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function authorOf(packument) {
  const author = packument.author;
  if (typeof author === "string" && author.trim() !== "") return author.trim();
  if (typeof author?.name === "string" && author.name.trim() !== "") return author.name.trim();
  return undefined;
}

/** homepage 允许带片段（npm 常写 #readme），校验器只要求 https/http 绝对 URL。 */
function homepageOf(packument) {
  const homepage = packument.homepage;
  return typeof homepage === "string" && URL.canParse(homepage) ? homepage : undefined;
}

/** 校验器要求 repository.url 无 query/fragment，且得是 http(s)；registry 里通常是 git+https://…​.git。 */
function repositoryOf(packument) {
  const raw = typeof packument.repository === "string" ? packument.repository : packument.repository?.url;
  if (typeof raw !== "string") return undefined;
  const url = raw
    .trim()
    .replace(/^git\+/u, "")
    .replace(/^git:\/\//u, "https://")
    .replace(/^ssh:\/\/git@/u, "https://")
    .replace(/^git@([^:]+):/u, "https://$1/")
    .replace(/\.git$/u, "")
    .replace(/\/+$/u, "");
  if (!URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
  parsed.search = "";
  parsed.hash = "";
  return { url: parsed.href.replace(/\/$/u, "") };
}

function summarize(index) {
  console.log(`\n索引标题：${typeof index.title === "string" ? index.title : index.title.en}`);
  console.log(`插件数：${index.plugins.length}`);
  for (const plugin of index.plugins) {
    const latest = plugin.versions[0];
    const engine = latest.engines?.dsh ?? "未声明";
    const icon = plugin.icon?.startsWith("data:") ? "内联" : (plugin.icon ?? "无");
    console.log(`  ${plugin.name}`);
    console.log(`    最新 ${latest.version}  ·  共 ${plugin.versions.length} 版  ·  需要 DSH ${engine}  ·  图标 ${icon}`);
  }
}

await main();
