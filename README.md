# Daily Persona

[![CI](https://github.com/2648782102/daily-persona/actions/workflows/ci.yml/badge.svg)](https://github.com/2648782102/daily-persona/actions/workflows/ci.yml)

一个可复现的「每日人格」数据协议与参考实现。它解决的是**确定性解析、版本化引用和信任边界**，不是每天自动改写 `SKILL.md`，也不是把可变人格偷偷塞进系统提示。

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
npm run today
npm run cli -- date 2026-11-09 --json
```

启动 HTTP 适配：

```bash
npm run http
curl http://127.0.0.1:3399/v1/today.json
curl 'http://127.0.0.1:3399/v1/resolve?date=2026-11-09'
curl http://127.0.0.1:3399/v1/catalog.json
```

启动 MCP stdio 适配：

```bash
node src/mcp-stdio.js
```

在 Codex 中推荐配置 stdio（把 `REPO_PATH` 换成实际克隆路径）：

```toml
[mcp_servers.daily_persona]
command = "node"
args = ["REPO_PATH/src/mcp-stdio.js"]
```

也可先启动 `npm run http`，再配置 Streamable HTTP：

```toml
[mcp_servers.daily_persona]
url = "http://127.0.0.1:3399/mcp"
```

Codex MCP 配置字段可参考 [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。stdio 服务同时兼容 2025 握手时代和 2026 无握手时代：裸 `server/discover` 会收到版本错误，促使老客户端回退到 `initialize`；带 `_meta` 的 `server/discover` 走 `2026-07-28`。

## 工具

| 工具 | 作用 |
| --- | --- |
| `get_today_persona` | 解析今天的人格；可显式传 `date` / `timezone` |
| `resolve_for_date` | 对指定日期做可复现解析，适合测试和归档 |
| `list_catalog` | 返回 catalog 摘要、内容哈希和信任契约，不返回完整 prompt |

HTTP 适配还暴露纯数据端点：`/health`、`/v1/today.json`、`/v1/resolve`、`/v1/catalog.json`。响应带 `ETag` 和 `Cache-Control`；`today.json` 的缓存时间按所选时区的本地午夜计算。

## 引用契约

推荐把下面这些字段一起存入会话状态：

```json
{
  "catalogVersion": "persona-catalog-v1",
  "catalogDigest": "sha256:...",
  "seed": "daily-persona-2026-11-09",
  "timezone": "Asia/Shanghai",
  "date": "2026-11-09",
  "personaId": "security-reviewer"
}
```

规则：

1. 会话或任务开始时解析一次，随后冻结。
2. 同一 `date + timezone + seed + catalogVersion + digest` 必须得到同一结果。
3. catalog 变更必须升版本并更新 digest；不要静默替换已发布内容。
4. 远端数据只作为输入；宿主保留最终的行为边界。
5. 不实现隐藏指令、工具调用、命令执行、外链抓取、权限变更或覆盖用户意图。

## 信任边界

所有 persona 字段都属于 **untrusted data**：

- 可影响：语气、措辞、评审重点、检查清单顺序。
- 不可影响：安全规则、事实准确性、用户意图、工具权限、系统/开发者指令。
- 校验器拒绝含 `tool`、`command`、`exec`、`ignore`、`override`、`permission`、`secret`、`token` 等词的 persona 文本字段。
- MCP 的 `instructions`、工具描述和返回结构都重复声明这一边界。
- 本项目不提供自动注入 system prompt 的能力；是否采用、何时采用由宿主决定。

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
| `src/resolve.js` | 确定性日期解析 |
| `src/mcp.js` | MCP 工具与双时代协议适配 |
| `src/mcp-stdio.js` | stdio 入口 |
| `src/http-server.js` | REST + Streamable HTTP 入口，导出可测的 `handleHttpRequest` |
| `src/cli.js` | 本地 CLI |
| `skills/daily-persona/SKILL.md` | 薄 skill |
| `docs/PROTOCOL.md` | 数据协议规范 |

HTTP 测试通过内存请求对象调用 `handleHttpRequest`，不占用 TCP 端口，适合受限沙箱；`npm run http` 仍是真实 HTTP 服务入口。

## 尚未做

- 内容签名与密钥轮换。
- 跨 persona 的事实性、任务完成率、安全边界评测集。
- 多语言 catalog 与用户自定义 catalog 的审核流程。

这些不是 MVP 阻塞项；若要把项目公开给不信任的引用方，签名和评测应优先补上。

## 发布

当前版本见 `package.json` 与 `CHANGELOG.md`；`v0.1.0` 是首个可运行协议 MVP。CI 在 Node 20、22、24 上执行测试、语法检查、CLI 检查和 MCP stdio 冒烟。
