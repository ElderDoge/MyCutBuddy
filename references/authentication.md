# 剪搭子 Agent 授权与凭据

本文说明 Agent 如何为用户取得剪搭子账号授权，以及如何安全保存和使用得到的凭据。所有业务调用都通过随 Skill 分发的本地 CLI 完成，命令与退出码见 [cli.md](./cli.md)，整体工作流见 [../SKILL.md](../SKILL.md)。

## 1. 适用前提

- CLI 位于 Skill 根目录的 `scripts/mycutbuddy.mjs`，统一用 `node scripts/mycutbuddy.mjs <命令>` 调用，要求用户电脑 Node ≥20。授权只通过 CLI 完成。
- 默认连接 `https://test.jiandazi.com`（2026 年 10 月内测站）。正式站开放后优先使用 `https://www.jiandazi.com`，可用 `--site <站点地址>` 或环境变量 `MYCUTBUDDY_SITE` 指定。
- 站点地址必须是 `https://`；只有本机联调可用 `http://127.0.0.1:<port>`。
- 能否运行 CLI、能否写入本地凭据目录，取决于用户当前的 Agent/Skill 平台。平台不满足要求时按第 5 节停止并说明。
- 站点未提供 Agent 授权能力时，如实报告“站点暂不支持该能力”。
- 账号授权不等于收费授权。收费前仍须与用户明确约定，见 [billing.md](./billing.md)。

## 2. 使用 `auth.login --wait` 完成设备授权

授权与网站登录状态无关，也不需要用户提供任何令牌。推荐始终带 `--wait`：

```text
node scripts/mycutbuddy.mjs auth.login --name <Agent 名称> [--site <站点地址>] --wait
```

1. CLI 申请设备授权，取得 8 位展示验证码与浏览器验证链接。
2. 带 `--wait` 时，CLI 在开始等待前向标准错误写一行进度 JSON：`event: "awaiting_approval"`，并带 `user_code`、`verification_uri`、`verification_uri_complete`、`expires_in` 与 `interval`。标准输出仍然只有最终一个 JSON 信封。
3. 读到这行进度后，立即把验证链接和验证码展示给用户，请用户在自己的浏览器中打开、核对账号与请求方名称，并明确允许或拒绝。**打开链接或登录本身不算批准**；Agent 不代点、不代填。
4. CLI 会自动等待用户批准，验证链接约 10 分钟内有效。用户尚未批准时继续等待，不要重复发起授权。
5. 批准成功后，CLI 把访问凭据写入本机，并在标准输出返回站点、验证码、`status: "authorized"` 与凭据事实（不含令牌）。不要索取或展示令牌。
6. 若未带 `--wait`，本次调用可能在用户批准前返回 `status: "pending"`，不能稍后继续兑换；此后应重新运行 `auth.login --wait`，或先完成批准再用 `auth.status --probe` 确认。

稳定失败码与处置：

| `error.code` | 含义与处置 |
| --- | --- |
| `access_denied` | 用户明确拒绝。停止授权，说明结果，不自动重试。 |
| `expired_token` | 授权已过期（约 10 分钟）。重新发起 `auth.login --wait`。 |
| `invalid_grant` | 授权码未知、不匹配或已经用掉。不要重复尝试同一次授权；按第 6 节处理一次性交付丢失。 |
| `authentication_required` / `invalid_credential` / `credential_expired` / `credential_revoked` | 凭据缺失、无效、已过 30 天有效期或已被用户撤销。按第 4 节重新授权。 |
| `agent_route_forbidden` | 该凭据无权执行这个动作。 |

## 3. 凭据保存与站点隔离

- 默认凭据目录为 `~/.mycutbuddy`；可用 `MYCUTBUDDY_CLI_HOME` 指定其他位置。CLI 以仅本人可读写的权限创建目录与凭据文件。
- 凭据按站点隔离保存；同一台机器可以保存多个站点的授权，互不覆盖。`auth.list` 只列出站点与凭据事实，不含令牌；切换或删除某个站点的本机凭据用 `auth.logout --site <站点地址>`，不影响其他站点。
- `auth.status` 读取本机凭据事实；加 `--probe` 会执行一次允许的只读业务调用，确认站点是否仍接受该凭据。
- 凭据有效期固定 30 天，从授权成功时起算，不能刷新、不会滑动续期。到期后重新执行 `auth.login --wait`。
- `auth.logout` 只删除本机保存的凭据，不撤销网站上的授权；网站上的授权在到期或被用户撤销前仍然有效。需要真正撤销时，请用户到网站“Agent 授权”列表操作（`/zh/dashboard?tab=agent-authorizations`，仅接受浏览器登录，Agent 无法代替）。
- 撤销只阻止后续请求，不会取消已经受理的任务；用户退出网站也不会自动撤销凭据。

## 4. 失效与撤销处置

- 业务命令返回退出码 4（认证失败）时，先运行 `node scripts/mycutbuddy.mjs auth.status [--site <站点地址>] [--probe]` 判断是本地凭据缺失、过期，还是站点拒绝。
- 过期或无效：重新运行 `auth.login --wait`，让用户批准新凭据。
- 已撤销：说明用户已在网站撤销该授权，重新授权需要用户再次明确批准。
- 站点不匹配或误用其他站点凭据时，明确当前 `--site`，让用户确认目标站点。
- 任何授权失败都不是业务失败：不要把它当作任务被拒绝，也不要为了“继续”而重复提交收费操作。

## 5. 凭据保密

- 令牌只在本地由 CLI 处理；不进入聊天、日志、标准输出、截图、命令行参数、Skill 文件或工单。
- 不让用户把令牌粘进聊天，也不让用户在网页里粘贴令牌。需要凭据时只运行 `auth.login`，由 CLI 完成兑换与保存。
- 排障只用 `auth.status` 与 `auth.list` 返回的事实，不读取凭据文件。
- 不把秘密作为命令行参数传递，也不通过 shell 变量展开到命令中。
- 宿主无法运行 CLI 或无法安全写入本地凭据目录时，停下来向用户说明缺项，不降级为明文文件或明文命令行。

## 6. 一次性交付丢失与重新授权

一次授权只能成功兑换一次，凭据只在成功时写入本地：

- 若用户在浏览器批准后、CLI 写入凭据前进程中断或响应丢失，这次授权已经用掉，再次运行会得到 `invalid_grant`，无法取回。
- 此时请用户先到网站“Agent 授权”列表撤销那条已有凭据，再重新运行 `auth.login --wait` 完成一次新的设备授权；不要重复尝试这次授权。
- 重新授权后重读项目、任务与素材状态；不要假设旧凭据下的进行中任务已被取消。
