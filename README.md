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
2. 同一 `date + timezone + seed + catalogVersion + digest` 必须永远得到同一结果。
3. 人格文本是不可信数据，只影响语气和评审重点；不得覆盖安全规则、用户意图、工具权限或事实准确性。
4. 显式提供 pin、disable、指定日期、查看 catalog digest 的用户控制。
5. 变更 catalog 内容时更新 `version`，并重新记录 digest。

完整算法见 [docs/PROTOCOL.md](docs/PROTOCOL.md)。

## 项目结构

```text
catalog/personas.v1.json        版本化人格数据
src/resolve.js                 确定性解析与哈希轮换
src/catalog.js                 schema 校验与 digest
src/http-server.js             REST + Streamable HTTP MCP
src/mcp.js                     MCP 请求处理
src/mcp-stdio.js               MCP stdio 适配
src/cli.js                     check / today / date / dump
skills/daily-persona/SKILL.md  薄 skill 与信任边界
examples/                      Codex MCP 配置示例
test/                          Node.js 测试与 stdio 冒烟测试
```

## 验证

```bash
npm test
npm run check --silent
npm run today --silent
node test/stdio-smoke.js
```

CI 在 Node.js 20、22、24 上运行同样检查。

## 非目标

- 不每日自动 commit、不部署常驻人格切换服务、不创建 365 个 skill。
- 不把人格写成隐藏系统指令，也不承诺跨模型、跨客户端的完全相同表达。
- 不提供远程 catalog 签名；公开部署需要另行增加签名和密钥轮换。
- 不使用已有动画 IP 名称、角色或素材。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全漏洞报告见 [SECURITY.md](SECURITY.md)。

## License

[MIT](LICENSE)
