# vendor/ — 原样取出的 DSH 插件市场校验器

`build-index.mjs` / `validate-index.mjs` 用这里的代码校验索引，规则因此与 DSH 客户端**完全一致**，不存在"我们自己的近似实现和官方不一致"的风险。

## 来源

| 项 | 值 |
| --- | --- |
| 应用 | DeepSeek Harness（Windows 安装版） |
| 路径 | `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar` |
| 内路径 | `/dsh/node_modules/@deepseek-ai/dsh-plugin-market-index/`、`/dsh/node_modules/semver/` |
| 校验器源码 SHA-256 | `14bccdf32d0d5ff7300e7e99562f3ea24e4cddeb6b21ad7662f7813ede4b72a1` |
| 校验器大小 | 13,992 B（`lib/index.js`） |
| 文件数 | `dsh-plugin-market-index` 6 个 + `semver` 53 个 |

两个包都是 MIT，`LICENSE` 文件原样保留在其目录内。

## 为什么要连 `semver` 一起收

`dsh-plugin-market-index/lib/index.js` 只依赖一个包：`semver`（用于校验 `engines.dsh` 范围、按 SemVer 优先级排序版本）。在 DSH 的 asar 里它被提升到 `/dsh/node_modules/semver`，所以这里同样放在 `vendor/node_modules/semver`，让 `import semver from "semver"` 能正常解析。

## 什么时候需要重新取

升级 DSH 之后，如果插件市场索引格式有变化（例如 `MAX_INLINE_ICON_BYTES` 或新增字段），就从新版安装包里重新导出一次，并更新上面的 SHA-256。导出脚本的要点：asar 头部是 `UInt32LE(12)` 长度的 JSON，文件数据位置 = `8 + headerSize + entry.off`。

## 许可

这些文件不是本仓库的代码，请勿按本仓库的 MIT 条款再许可。见 `LICENSE` 末尾的第三方声明。
