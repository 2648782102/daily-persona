# Daily Persona

[![CI](https://github.com/2648782102/daily-persona/actions/workflows/ci.yml/badge.svg)](https://github.com/2648782102/daily-persona/actions/workflows/ci.yml)

一个可复现的「每日人格」数据协议与参考实现。它解决的是**确定性解析、版本化引用和信任边界**，不是每天自动改写 `SKILL.md`，也不是把可变人格偷偷塞进系统提示。

> 上架状态：仓库提供可提交候选包与发布清单；CI、Pages 策略页和本地 Codex CLI stdio 宿主评测已通过，但仍未部署公共 HTTPS MCP 端点、未完成域名验证、未通过 OpenAI Platform 的 Scan Tools / 审核 / 发布。不要把这些外部步骤视为已完成。运行 `npm run readiness` 查看逐项状态。

## 为什么这样做

- **确定性优先**：`resolve(date, timezone, seed, catalogVersion) -> persona`。不需要 cron、不需要每日 commit，也不需要客户端同步文件。
- **数据而不是常驻提示**：远端人格是可变 prompt 数据。本项目把它标成不可信数据，只准影响语气与评审重点。
- **会话内冻结**：一个任务或对话开始时取一次结果，跨午夜不换；用户可以 pin、disable 或指定日期。
- **不是一个 skill 集合**：只提供一个薄 skill，教模型何时调用解析工具；人格 catalog 是数据。
- **名字独立**：没有使用「百变马丁」这一已有动画 IP 的名称、角色或素材。

## 快速开始

要求 Node.js 20+，无第三方依赖。

```bash
git clone https://github.com/2648782102/daily-persona.git
cd daily-persona
npm test
npm run check
npm run verify
npm run evals
npm run today
npm run cli -- date 2026-11-09 --json
npm run package:check
npm run readiness
npm run pack:check
npm run workers:build
npm run workers:check
CODEX_BIN=/absolute/path/to/codex npm run host:eval -- --run
npm run host:rubric
```

也可以作为 npm 包安装后直接运行 CLI、HTTP 或官方 SDK MCP stdio 入口：

```bash
npx daily-persona check
npx daily-persona-http
npx daily-persona-mcp
```

启动 HTTP 适配：

```bash
npm run http
curl http://127.0.0.1:3399/v1/today.json
curl 'http://127.0.0.1:3399/v1/resolve?date=2026-11-09'
curl http://127.0.0.1:3399/v1/catalog.json
curl http://127.0.0.1:3399/v1/signature.json
curl http://127.0.0.1:3399/v1/catalog.raw.json
```

启动官方 SDK MCP stdio 适配：

```bash
node src/mcp-stdio-sdk.js
```

兼容旧手写 2026/2025 双时代协议适配仍保留在 `node src/mcp-stdio.js`；发布端点默认使用官方 SDK 的 Streamable HTTP。

在 Codex 中推荐配置 stdio（把 `REPO_PATH` 换成实际克隆路径）：

```toml
[mcp_servers.daily_persona]
command = "node"
args = ["REPO_PATH/src/mcp-stdio-sdk.js"]
```

首次安装依赖：

```bash
npm ci
```

也可先启动 `npm run http`，再配置 Streamable HTTP：

```toml
[mcp_servers.daily_persona]
url = "http://127.0.0.1:3399/mcp"
```

Codex MCP 配置字段可参考 [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。stdio 服务同时兼容 2025 握手时代和 2026 无握手时代：裸 `server/discover` 会收到版本错误，促使老客户端回退到 `initialize`；带 `_meta` 的 `server/discover` 走 `2026-07-28`。

更完整的本地 STDIO、远程 Streamable HTTP、skill 安装和宿主验收清单见 [`docs/HOSTS.md`](docs/HOSTS.md)。

## 工具

| 工具 | 作用 |
| --- | --- |
| `get_today_persona` | 解析今天的人格；可显式传 `date` / `timezone` |
| `resolve_for_date` | 对指定日期做可复现解析，适合测试和归档 |
| `list_catalog` | 返回 catalog 摘要、内容哈希和信任契约，不返回完整 prompt |

HTTP 适配还暴露纯数据端点：`/health`、`/v1/today.json`、`/v1/resolve`、`/v1/catalog.json`。响应带 `ETag` 和 `Cache-Control`；`today.json` 的缓存时间按所选时区的本地午夜计算。

签名端点：`/v1/signature.json` 返回验签后的签名摘要与公钥，`/v1/catalog.raw.json` 返回用于独立验签的原始 catalog 字节。`npm run verify` 会用本地可信公钥环验证这些字节；失败时 `/health` 返回 500，拒绝带病启动。带外信任与轮换见 [`docs/KEY-TRUST.md`](docs/KEY-TRUST.md)。

## 引用契约

推荐把下面这些字段一起存入会话状态：

```json
{
  "catalogVersion": "persona-catalog-v1",
  "catalogDigest": "sha256:7adfcff3d69f191cd46dfe14833fb3831abd70bc7be730a4f1d5afb02d5cd82b",
  "seed": "daily-persona-2026-11-09",
  "timezone": "Asia/Shanghai",
  "date": "2026-11-09",
  "personaId": "editorial-reviewer"
}
```

规则：

1. 会话或任务开始时解析一次，随后冻结。
2. 同一 `date + timezone + seed + catalogVersion + digest` 必须得到同一结果。
3. catalog 变更必须升版本、重签名并更新 digest；不要静默替换已发布内容。
4. 远端数据只作为输入；宿主保留最终的行为边界。
5. 不实现隐藏指令、工具调用、命令执行、外链抓取、权限变更或覆盖用户意图。

## 信任边界

所有 persona 字段都属于 **untrusted data**：

- 可影响：语气、措辞、评审重点、检查清单顺序。
- 不可影响：安全规则、事实准确性、用户意图、工具权限、系统/开发者指令。
- 校验器拒绝含 `tool`、`command`、`exec`、`ignore`、`override`、`permission`、`secret`、`token` 等词的 persona 文本字段。
- MCP 的 `instructions`、工具描述和返回结构都重复声明这一边界。
- 签名只证明 catalog 字节来自持有私钥的一方，不证明人格文本在语义上安全；宿主仍必须执行上面的信任边界。
- 本项目不提供自动注入 system prompt 的能力；是否采用、何时采用由宿主决定。

## 内容签名

`catalog/personas.v1.json` 现在是规范化 JSON；`catalog/personas.v1.sig.json` 是 Ed25519 签名，`catalog/trusted-keys.json` 是本地可信公钥环。签名负载绑定 `digest + keyId + createdAt`，支持多 key、active/retired 状态和 `retiredAt` 轮换截止点。

```bash
npm run verify
node src/sign-cli.js keygen /private/key/dir
node src/sign-cli.js sign /private/key/dir/private-key.pem "$(cat /private/key/dir/key-id.txt)"
```

私钥不进仓库；`*.pem` 已加入 `.gitignore`。详细轮换流程见 [`deploy/README.md`](deploy/README.md)。

## 评测

`evals/` 提供 15 个确定性回归用例，覆盖触发、安全边界、事实谨慎、任务完成和风格；`npm run evals` 生成 `prompts.csv` 与 `results.json`。它不假装能证明所有模型表现一致；真实宿主应结合 `codex exec --json` trace 与结构化 rubric。见 [`evals/README.md`](evals/README.md)。

`npm run host:eval` 默认是就绪检查；加 `--run` 后使用单命令临时 MCP 配置捕获四个真实 `codex exec --json` trace，并把脱敏摘要写入 `evals/host-report.json`；`npm run host:rubric` 从报告中派生结构化评分。已记录一次 6/6 通过的本地 Codex CLI stdio 验收，但这不覆盖公共 HTTPS 插件、ChatGPT 安装态或门户 Scan Tools。`npm run rotation:drill` 用临时密钥演练 active/retired 轮换。

## 设计取舍

- 不做 365 个 skill：OpenAI Docs 说明 skills 是可复用工作流，靠 `name/description` 触发，初始列表还有上下文预算；不适合塞人格库。见 [Build skills](https://learn.chatgpt.com/docs/build-skills)。
- 不用每日 GitHub commit：那会产生历史噪声，而且客户端何时拉取仍不可控。
- MCP 是适配层，不是合同本身：REST/JSON、CLI、库函数可独立使用。
- 本项目仍只是**风格 persona**，不是拥有独立记忆、目标、权限的 character 或 agent。

## 文件

| 路径 | 作用 |
| --- | --- |
| `catalog/personas.v1.json` | 版本化人格数据 |
| `src/catalog.js` | 加载、校验、内容哈希 |
| `src/signing.js` | Ed25519 签名、验签与密钥轮换 |
| `src/resolve.js` | 确定性日期解析 |
| `src/mcp.js` | MCP 工具与双时代协议适配 |
| `src/mcp-stdio.js` | stdio 入口 |
| `src/http-server.js` | REST + Streamable HTTP 入口，导出可测的 `handleHttpRequest` |
| `src/cli.js` | 本地 CLI |
| `skills/daily-persona/SKILL.md` | 薄 skill |
| `docs/PROTOCOL.md` | 数据协议规范 |
| `docs/HOSTS.md` | Codex 与其他宿主接入说明 |
| `evals/` | 小型确定性评测集与 rubric |
| `Dockerfile` / `fly.toml` / `deploy/` | 可部署端点配置 |
| `deploy/workers/` | Cloudflare Workers/Web Standard MCP 部署入口 |
| `plugin/` | 便携式插件包、图标和审核用例 |
| `site/` | GitHub Pages 产品、支持、隐私与条款页面 |
| `docs/SUBMISSION.md` | 官方上架要求、完成项与外部阻塞项 |
| `docs/OPERATIONS.md` | 部署、外部验收、监控、回滚和演示录制运行手册 |

HTTP 测试通过内存请求对象调用 `handleHttpRequest`，不占用 TCP 端口，适合受限沙箱；`npm run http` 仍是真实 HTTP 服务入口。

## 上架候选

`v0.3.0` 增加官方 SDK MCP 服务、显式只读工具注解、域名挑战路由、插件包、5+3 审核用例、已部署的策略页、密钥治理、本地真实宿主 trace/rubric、部署运行手册与发布就绪检查。它不是「已上架」声明：真实托管端点、门户工具扫描、视频演示、开发者身份验证、已安装插件的宿主验收、提交审核与发布仍需外部条件和用户确认。逐项清单见 [`docs/SUBMISSION.md`](docs/SUBMISSION.md) 与 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)。

## 尚未做

- 已提供签名验证、确定性评测与一次本地 Codex CLI stdio 真实 trace，但尚未执行已安装 ChatGPT 插件的大规模 A/B 运行。
- 尚未发布一个由本项目维护者持续运营的公共托管端点；仓库只提供可部署配置。
- 尚未通过 OpenAI Platform 上传插件 ZIP、连接 MCP、Scan Tools、提交审核或发布。
- 多语言 catalog 与用户自定义 catalog 的审核流程。

这些不是协议正确性的阻塞项；若要把项目公开给不信任的引用方，应先用 `/v1/catalog.raw.json` 与本地可信公钥环独立验签，再决定缓存和引用。

## 发布

当前版本见 `package.json` 与 `CHANGELOG.md`；`v0.1.0` 是首个可运行协议 MVP，`v0.2.0` 增加签名、评测、宿主接入文档与可部署容器配置，`v0.3.0` 是面向插件目录审核的发布候选。CI 在 Node 20、22、24 上执行依赖安装与审计、测试、语法检查、catalog 检查、签名验证、评测、CLI 检查、双 MCP stdio 冒烟、插件校验、npm 包内容校验、就绪检查和容器构建。
