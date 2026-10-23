#!/usr/bin/env node
/**
 * 用 DSH 自带的校验器检查 index.json，可选核对 registry 漂移。
 *
 * 用法：
 *   node scripts/validate-index.mjs                  # 只校验格式 1
 *   node scripts/validate-index.mjs --check-registry # 额外确认索引没有落后于 npm
 *
 * 退出码：0 通过；1 校验失败或发现漂移。
 * 环境变量：NPM_REGISTRY / INDEX_URL（同 build-index.mjs）。
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import semver from "../vendor/node_modules/semver/index.js";
import { parseMarketIndex } from "../vendor/node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = (process.env.NPM_REGISTRY ?? "https://registry.npmjs.org").replace(/\/+$/u, "");
const INDEX_URL = process.env.INDEX_URL ?? "https://raw.githubusercontent.com/TuWeiZhi/dsh-plugins-index/main/index.json";
const CHECK_REGISTRY = process.argv.includes("--check-registry");

const text = await readFile(join(ROOT, "index.json"), "utf8");
const index = parseMarketIndex(JSON.parse(text), INDEX_URL);

console.log(`✓ 格式 1 校验通过：${JSON.stringify(INDEX_URL)}`);
console.log(`  标题 ${typeof index.title === "string" ? index.title : index.title.en}`);
console.log(
  `  分类 ${Object.keys(index.metadata.categories).length} 个 · 标签 ${Object.keys(index.metadata.labels).length} 个 · 插件 ${index.plugins.length} 个`,
);
for (const plugin of index.plugins) {
  const latest = plugin.versions[0];
  console.log(`  · ${plugin.name}  最新 ${latest.version}  (${plugin.versions.length} 版)`);
  if (latest.engines?.dsh !== undefined) console.log(`      需要 DSH ${latest.engines.dsh}`);
}

if (!CHECK_REGISTRY) process.exit(0);

let drifted = 0;
for (const plugin of index.plugins) {
  const packument = await fetchPackument(plugin.name);
  const published = Object.keys(packument.versions ?? {})
    .filter((version) => semver.valid(version) !== null && semver.prerelease(version) === null)
    .sort(semver.rcompare);
  if (published.length === 0) {
    console.log(`! ${plugin.name}：registry 上没有正式版本`);
    drifted += 1;
    continue;
  }

  const listed = new Set(plugin.versions.map((version) => version.version));
  const missing = published.filter((version) => !listed.has(version));
  if (missing.length > 0) {
    console.log(`! ${plugin.name}：索引缺少 ${missing.join(", ")}，请重跑 build-index.mjs --write`);
    drifted += 1;
  }

  const unknown = [...listed].filter((version) => packument.versions?.[version] === undefined);
  if (unknown.length > 0) {
    console.log(`! ${plugin.name}：索引里有 registry 不存在的版本 ${unknown.join(", ")}`);
    drifted += 1;
  }
}

if (drifted > 0) {
  console.log(`\n发现 ${drifted} 处漂移`);
  process.exit(1);
}
console.log("\n✓ 索引与 registry 一致");

async function fetchPackument(name) {
  const encoded = name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
  const response = await fetch(`${REGISTRY}/${encoded}`, {
    headers: { accept: "application/json", "user-agent": "dsh-plugins-index" },
  });
  if (!response.ok) throw new Error(`${name}: registry 返回 ${response.status}`);
  return response.json();
}
