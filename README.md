# DSH 插件索引 · TuWeiZhi's DSH Plugins

一份 DeepSeek Harness（DSH）**插件市场索引**，格式 1。把它加到 DSH 的「发现」标签页后，就能在图形界面里安装、查看下面这三个插件。

```text
https://raw.githubusercontent.com/TuWeiZhi/dsh-plugins-index/main/index.json
```

## 先说清楚：DSH 没有「官方插件市场」

DSH 的插件页里有一个「发现」标签页，但它**不连任何中央商店**——它只列出**你自己添加的索引源**。DSH 自带文档的原话是：

> 此可选组合包（bundle）挂载自定义插件市场……随包配置默认禁用。
> 已知限制：目前没有官方插件市场；发现标签页只列出用户添加的索引源。

所以「上架」这件事在 DSH 里等价于两件事：

1. 把插件发布到 npm（本仓库的三个包都已在 npm 上）；
2. 发布一份符合**格式 1** 的索引 JSON，并把它放在一个**稳定的、不重定向的** URL 上，让用户把它添加为索引源。

本仓库就是第 2 步。它没有任何服务端、没有数据库、不需要 token——本质是一个由 CI 定时重新生成的静态 JSON。

## 安装这三个插件（装哪个都只需前两步）

**第 1 步 · 打开市场功能**（只需一次）

侧栏 → **插件** → 找到「实验性插件」→ 点**更多** → 启用**自定义插件市场**。
它背后是 DSH 自带的可选组合包 `@deepseek-ai/dsh-experimental-plugin-market-bundle`，默认不启用；启用后插件页才会出现「已安装 / 发现」两个标签页。

**第 2 步 · 添加索引源**

**发现** → **索引源** → 添加下面这个 URL：

```text
https://raw.githubusercontent.com/TuWeiZhi/dsh-plugins-index/main/index.json
```

**第 3 步 · 安装**

在「发现」里选中插件 → 安装。DSH 会在你的 profile 里以 pnpm 安装对应的 npm 包，然后按该包声明的 `dsh.bundle.patch` 挂载。

> 想换成自己的镜像或本地文件也可以：索引源就是一份 JSON，`file://` 之外的绝对 URL 都行，但**不能经过 302 跳转**（市场服务拒绝重定向），也建议 URL 里不带 `?` / `#`。

## 本索引收录的插件

| 插件 | 说明 | 要求 DSH |
| --- | --- | --- |
| [`@tuweizhi/dsh-whale-widget`](https://github.com/TuWeiZhi/dsh-whale-widget) | 右下角 DeepSeek 余额小鲸鱼挂件：余额 / 今日已用 / 峰谷定价、可自定义气泡点击序列、悬浮快捷编辑、音效与每轮消耗 | 见索引 |
| [`@tuweizhi/dsh-translator`](https://github.com/TuWeiZhi/dsh-translator) | 划词翻译：划选文本即现悬浮按钮，默认走免 Key 的公共翻译接口，也可切到 harness 自带大模型 | `>=0.2.1-alpha.1` |
| [`@tuweizhi/dsh-pet`](https://github.com/TuWeiZhi/dsh-pet) | 桌面宠物：住在窗口角落里的小家伙，可拖拽、会自己碎碎念（全本地语句池、不烧 token）、会扔东西发脾气，并跟着你的工作状态换动作 | 未声明（任意版本） |

三个包都是 MIT 代码 + 明确的 fork 说明；鲸鱼挂件的 `assets/**` 与 `icon.png` 沿用上游 **as-is** 声明（不随 MIT 再许可），详见该仓库的 `PROVENANCE.md`；桌面宠物是 `PC2005-cloud/dsh-pet` 0.3.8 的增强 fork，素材版权同样归上游，详见该仓库的 `NOTICE.md`。

本索引里三个插件的图标是**内联 `data:` 图**（鲸鱼缩到 128×128 后 8.3 KB，翻译是 0.5 KB 的 SVG，宠物缩到 128×128 后 26 KB），所以添加索引源时不会因为你浏览市场而向第三方暴露 IP。

## 想把自己的插件也放进来

索引由 [`plugins.json`](./plugins.json)（人写的清单）+ npm registry（自动抓版本）生成。加一个插件：

1. 在 `plugins.json` 的 `plugins` 里加一项，至少写 `name`（必须是已发布的 npm 包名，且该包声明了 `dsh.bundle`）；
2. 需要图标就放 `icons/` 下，并在该项写 `"icon": "icons/xxx.png"`（png/svg/jpeg/webp，解码后必须 ≤ 32 KiB）；
3. 分类/标签只能用 `metadata` 里已声明的 id（校验器会报 `references undeclared id`）；
4. 本地跑一遍：

```bash
node scripts/build-index.mjs --write
node scripts/validate-index.mjs --check-registry
```

5. 提 PR。CI 会用**DSH 自己的校验器**（`vendor/`，从 DSH 应用安装包原样取出）验证，并把 `index.json` 的 diff 展示出来。

不想提 PR 也完全没问题：fork 这个仓库改 `plugins.json`，把你自己那份 `index.json` 的 URL 分发出去即可——**索引源天然是多份并存的**，DSH 允许用户同时添加多个索引源。

## 索引格式 1 的关键约束

`index.json` 由 DSH 的 `@deepseek-ai/dsh-plugin-market-index` 校验；本仓库把该校验器（及其唯一依赖 `semver`）原样收进 [`vendor/`](./vendor/README.md)，所以**本地校验规则与 DSH 客户端完全一致**。摘要：

| 位置 | 约束 |
| --- | --- |
| 根 | `format` 必须是 `1`；`title` 必填；`plugins` 不能为空且包名不能重复 |
| 多语言文本 | 字符串，或 `{ "en": "…", "zh": "…" }` 这样的小写语言 id 对象；**只要写成对象就必须含 `en`** |
| `plugins[].name` | 合法 npm 包名（可带 scope），≤ 214 字符 |
| `plugins[].icon` | `data:` 内联（svg/png/jpeg/webp，解码 ≤ 32 KiB），或解析后为 https / 与索引同源的 URL |
| `plugins[].homepage` | http(s) 绝对 URL，允许带 `#readme` |
| `plugins[].repository.url` | http(s) 绝对 URL，**禁止**带 query/fragment，也不能含用户名密码 |
| `plugins[].metadata.category` / `labels` | 必须引用根 `metadata.categories` / `metadata.labels` 里声明过的 id；`labels` 不能重复 |
| `plugins[].versions[]` | 非空、同一插件内版本不重复；由校验器按 SemVer 优先级降序排好 |
| `versions[].version` | 精确 SemVer（不要 `^`/`>=`） |
| `versions[].publishTimestamp` | **Unix 秒**（整数，`[0, 10^11)`）——注意不是毫秒 |
| `versions[].source` | `{ "type": "npm" }`（可带 `registry`）或 `{ "type": "git", "url", "commit": 40 位小写 SHA, "path"? }` |
| `versions[].engines.dsh` | 可选的 SemVer 范围；不能是 `workspace:` 范围 |

几个容易踩的坑：

- **时间戳单位**：写毫秒会被直接拒（`must be an integer number of Unix seconds`）。
- **`repository.url` 不能是 `git+https://…​.git`**：校验器要求规范 http(s) URL，所以生成器会把 `git+`、`.git`、ssh 形式统一归一化。
- **图标超 32 KiB 就不能内联**：要么缩图，要么换成 https URL（但远程图标会让用户的请求带上 IP）。
- **市场不校验内容真伪**：索引里写什么版本，市场就按 `name@version` 去装；实际装到什么由该 npm 包的 manifest 决定。索引本身**没有签名**。

## 用户侧的两个已知限制

- **没有「升级」按钮**：市场只做安装，更新需要先卸载再安装（DSH 当前实现如此）。
- **兼容性靠 `engines.dsh`**：声明了范围时，市场默认挑**最高兼容的非预发布版**；不声明就当作「任意 DSH 版本都能装」。

## 仓库结构

```text
plugins.json                 # 人写的清单：标题、分类、标签、图标、关键词
icons/                       # 图标源文件（会被内联成 data: 写进 index.json）
index.json                   # 生成物（提交进 Git，就是市场读的那份）
scripts/build-index.mjs      # 抓 registry → 生成 → 用官方校验器验证
scripts/validate-index.mjs   # 只验证；--check-registry 还比对 npm 上有没有更新版本
vendor/                      # 从 DSH 安装包原样取出的官方校验器 + semver
.github/workflows/refresh-index.yml
```

常用命令（只需 Node 22+，无第三方依赖）：

```bash
node scripts/build-index.mjs             # 校验并打印摘要，不写文件
node scripts/build-index.mjs --write     # 写入 index.json
node scripts/validate-index.mjs --check-registry
```

CI 每 6 小时跑一次，也会在手动触发时跑；发现 npm 上有新版本就重新生成并提交 `index.json`。

国内网络下 node 的 `fetch` 不走系统代理，跑生成脚本时可以显式给代理（Node 24 起支持 `--use-env-proxy`）：

```powershell
$env:NODE_USE_ENV_PROXY = "1"; $env:HTTPS_PROXY = "http://127.0.0.1:7890"
node scripts/build-index.mjs --write
```

## 许可

本仓库内容（清单、脚本、生成的索引）为 MIT，见 [LICENSE](./LICENSE)。
`vendor/` 下的校验器与 `semver` 归各自作者，均为 MIT，原样保留其 LICENSE。
三个插件图标的美术版权归原作者，沿用其仓库的 as-is 声明——本索引只是把它们缩放到更适合图标位显示。
