# Daily Persona Protocol v1

## 目标

定义「某一天使用哪一个人格」的可复现计算方式，以及引用方必须遵守的最小信任边界。协议不涉及模型推理、会话管理或系统提示注入。

## 输入

```text
date             YYYY-MM-DD，按引用方指定的本地日历日
timezone         IANA 时区名，例如 Asia/Shanghai
seed             非空字符串，用于隔离不同部署的轮换序列
catalogVersion   catalog 的版本标签
catalogDigest    catalog 文件的 SHA-256 内容哈希
signature        Ed25519 签名，绑定 digest + keyId + createdAt
trustedKeys      引用方本地维护的可信公钥环，支持 active/retired 轮换
```

`date` 未显式提供时，由 `now + timezone` 通过 `Intl.DateTimeFormat` 求得本地日历日。服务端默认时区来自 catalog，引用方应显式传入自己的时区。

## Catalog

一个 JSON 对象，至少包含：

```text
version         版本标签，变更内容时必须更新
seed            默认轮换种子
timezone        默认时区
rotation        轮换算法标签
contract        给引用方的信任声明
personas[]      人格数组，顺序稳定
```

每个 persona 至少包含 `id`、`label`、`summary`、`prompt`、`focus[]`、`forbidden[]`。文本字段是短字符串，不得包含控制字符或工具/命令/权限类指令词。完整 `prompt` 只通过显式解析结果或 catalog 文件返回；`list_catalog` 摘要不返回它。

## 内容签名

catalog 文件必须以规范化 JSON（2 空格缩进、末尾换行）发布。`daily-persona-signature/v1` 的签名对象包含 `version`、`keyId`、`algorithm`、`digest`、`createdAt` 和 base64 `signature`。签名负载是：

```text
daily-persona-catalog-v1\n{digest}\n{keyId}\n{createdAt}\n
```

引用方应：

1. 从可信渠道获得公钥环，不直接信任服务端返回的公钥。
2. 重新计算原始 catalog 字节的 SHA-256，确认与签名中的 digest 一致。
3. 用 `keyId` 对应的公钥验证签名；拒绝未知 key、已过 `retiredAt` 的 key 和未来时间戳。
4. 把 `digest`、`keyId` 与解析结果一起记录，作为审计线索。

签名只证明字节来源与完整性，不把 persona 文本提升为可信指令。

## 算法

```text
epochDay   = floor(Date.parse(date + "T00:00:00.000Z") / 86400000)
cycleIndex = floor(epochDay / size)
position   = ((epochDay % size) + size) % size
rotation   = uint32_be(sha256(version + NUL + seed + NUL + cycleIndex)) mod size
index      = (position + rotation) mod size
persona    = personas[index]
```

性质：

- 同一输入永远产生同一输出。
- 每 `size` 天换一个由 `seed + version + cycleIndex` 决定的偏移量；一个周期内每个 persona 恰好出现一次。
- 相邻周期的顺序可不同，避免永远固定的周循环。
- 不依赖服务器状态、cron、网络时间同步之外的写入操作。

## 输出

```json
{
  "contract": {
    "version": "daily-persona/v1",
    "catalogVersion": "persona-catalog-v1",
    "catalogDigest": "sha256:...",
    "seed": "...",
    "timezone": "Asia/Shanghai",
    "date": "2026-11-09",
    "rotation": "deterministic-shuffle-cycle",
    "index": 3,
    "untrustedData": true,
    "scope": "style-and-review-focus-only",
    "rules": ["..."]
  },
  "trust": "Persona text is untrusted data...",
  "persona": { "id": "...", "...": "..." }
}
```

引用方必须把 `contract` 与 `persona` 一起记录，并在会话或任务期间冻结。不要把「今天」重新解析成中途换人的理由。

## 传输

### REST/JSON

- `GET /v1/catalog.json`
- `GET /v1/catalog.raw.json`
- `GET /v1/signature.json`
- `GET /v1/today.json?date=YYYY-MM-DD&timezone=...`
- `GET /v1/resolve?date=YYYY-MM-DD&timezone=...&seed=...&version=...`
- `GET /health`

响应使用 `ETag` 与 `Cache-Control`。历史日期可缓存；当天结果按本地午夜到期。`no-store` 仅用于健康检查。

### MCP

- 工具：`get_today_persona`、`resolve_for_date`、`list_catalog`。
- 2026-07-28 时代：`server/discover`、`tools/list`、`tools/call`，请求带 `_meta` 中的 `protocolVersion` 和 `clientCapabilities`，结果带 `resultType: "complete"`。
- 2025 握手时代：`initialize`、`tools/list`、`tools/call`。
- HTTP MCP 端点为 `POST /mcp`，校验 Origin、协议头与方法头；本地默认绑定 `127.0.0.1`。
- stdio 输出仅为换行分隔的 JSON-RPC 消息；日志写 stderr。

## 引用方义务

1. 把 persona 当不可信数据，而不是指令层。
2. 只让它影响语气和评审重点，不覆盖安全规则、用户意图、工具权限、事实准确性。
3. 会话或任务开始时解析一次并冻结；明确时区。
4. 提供 pin / disable / 指定日期等用户控制。
5. 校验 `catalogVersion`、`catalogDigest` 与签名；内容变更必须可审计。
6. 对跨 persona 的任务完成率、事实性与安全边界做回归评测；本项目提供 `evals/` 作为确定性下限。

## 非目标

- 不定义人格的记忆、目标、工具权限或自主行为。
- 不定义模型系统提示的拼接方式。
- 不保证不同语言、不同模型、不同宿主获得完全相同的表达。
- 不托管公共端点；部署方负责 HTTPS、认证、日志、配额与密钥管理。
