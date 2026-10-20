# 剪搭子（MyCutBuddy）Agent Skill

安装后可直接用自然语言完成：项目与三类素材库管理、百度网盘素材导入与索引、风格与字幕样式预设、单条或批量旁白/口播剪辑、积分解释、任务查询与取消，以及草稿下载和剪映本地安装。

## 安装

要求 Node ≥20。

```bash
npx skills add ElderDoge/MyCutBuddy
```

也可以把本仓库克隆到 Agent 的 skills 目录。安装后 CLI 位于 Skill 根目录的 `scripts/mycutbuddy.mjs`，全部能力通过 `node scripts/mycutbuddy.mjs <命令>` 调用，命令清单以 `help` 输出为准。

## 首次使用

1. 让 Agent 发起账号授权，按提示在浏览器中核对请求方并亲自批准。凭据只保存在本机 `~/.mycutbuddy`，有效期 30 天。
2. 收费操作会先估算费用，经你确认后才提交；余额与退款以服务端账本为准。
3. 下载的草稿包会先安全解压，再安装到你实际配置的剪映草稿目录，同名不会静默覆盖。

## 边界

- 只调用剪搭子公开的用户接口，不包含管理员操作、节点控制或其他账号的授权管理。
- 百度网盘操作需要另装官方 `baidu-drive` Skill，本 Skill 不复制网盘客户端。
- 本地草稿安装需要 Agent 具备这台电脑的文件访问权限；纯云端环境只能提供下载信息与手动安装步骤。

站点：<https://www.jiandazi.com>
