# 百度网盘、样式草稿与本地草稿安装

本文说明如何借助百度网盘 Skill 完成素材、剪映样式草稿的上传与分享，如何按任务下载草稿包，以及在具备本地文件权限时如何把草稿安装到剪映。账号授权见 [authentication.md](./authentication.md)，CLI 命令与业务规则见 [cli.md](./cli.md)，整体工作流见 [../SKILL.md](../SKILL.md)。所有剪搭子业务调用都使用 `node scripts/mycutbuddy.mjs <命令>`，本机需 Node ≥20。

## 1. 引用百度网盘 Skill，不重新实现

- 素材与草稿的网盘上传、分享、转存、下载**全部使用官方百度网盘 Skill**，按需从宿主加载 `baidu-drive` 的主文件及其 `reference/` 文档（支持内部 URI 的宿主可用 `skill://baidu-drive`）。不在本 Skill 内重新实现网盘客户端，也不内联它的命令细节。
- 官方来源：<https://github.com/baidu-netdisk/bdpan-storage>。其 README 当前给出的安装方式为 `npx skills add https://github.com/baidu-netdisk/bdpan-storage/skills --skill baidu-drive`；使用前请以官方 README 的最新说明为准。
- 网盘工具的安装、更新与首次登录由用户完成；登录未完成前不继续网盘操作。
- 网盘授权与剪搭子账号授权**相互独立**，两者不能互相替代。
- 网盘 Skill 的操作范围被限制在其自身目录 `/apps/bdpan/` 内，**不得承诺**能访问用户整个网盘或其他目录。
- **平台能力由运行宿主决定**：能否执行网盘命令、能否访问用户电脑本地文件，取决于用户当前的 Agent/Skill 平台。平台不支持时按第 5 节说明。

## 2. 素材上传并分享，再提交素材导入

1. 用百度网盘 Skill 把用户的本地素材上传到该 Skill 允许的目录。
2. 用它的分享能力生成分享链接（按用户需要选择有效期），取得分享链接与提取码。
3. 用 CLI 提交素材导入，服务端再按链接抓取素材：

```text
node scripts/mycutbuddy.mjs material.import.submit --project <项目 ID> --confirm-charge \
  --input '{"library_type":"primary","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

- `--input` 的完整字段以 `node scripts/mycutbuddy.mjs help material.import.submit` 为准。必须带目标的 `library_type`（`primary` | `talking_head` | `voiceover`）、真实分享链接与按需的提取码；链接自带 `pwd` 或分享文本中包含提取码时也可识别。
- 分享链接必须是 `pan.baidu.com` 的 `/s/` 或 `/e/` 链接。
- `--confirm-charge` 表示你已与用户约定本次费用；提示版本可省略，CLI 会读取当前版本。费用与提交状态按 [cli.md](./cli.md) 与 [billing.md](./billing.md) 处理。
- 上传成功、受理回执与 `prepared` 都不代表素材已入库；用 `request.watch` 与 `material.directory` 查询到真实终态。

## 3. 样式草稿上传并分享，再提取字幕样式

目标是让用户**已经做好的剪映样式草稿**被提取为可复用样式；截图和文字描述不能生成样式。怎么在剪映里摆放文字层、区分语音字幕和固定文字、控制随机强调样式，见 [自定义资源预设](custom-presets.md)；本节只说明上传与导入的操作顺序。

1. 让用户准备好样式草稿。上传时**保留草稿的完整结构**（整个草稿文件夹及其内容文件），因为提取依赖草稿内部的样式定义；只上传截图或导出的图片无法提取。
2. 用百度网盘 Skill 上传该草稿文件夹并生成分享链接、提取码。
3. 用 CLI 提交样式导入：

```text
node scripts/mycutbuddy.mjs preset.style.import.submit --project <项目 ID> --request-key <唯一键> \
  --input '{"preset_type":"dialogue_subtitle_style","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

- `preset_type` 为 `dialogue_subtitle_style`（语音字幕）或 `global_subtitle_style`（固定文字）；`--request-key` 是本次导入唯一键，同键同输入可重放。
- 字段结构以 `help preset.style.import.submit` 为准。

4. 用 `preset.style.import.get --project <项目 ID> --import <导入 ID>` 查询导入详情，直到进入可选择的完成状态；使用返回的 `drafts[].draft_id` 与 `draft_name` 选择实际草稿：

```text
node scripts/mycutbuddy.mjs preset.style.import.select-draft --project <项目 ID> --import <导入 ID> --draft <草稿 ID>
```

5. 选择完成后再次读取同一导入详情，查看 `items` 的真实 `ordinal`、文字摘要与支持情况；按真实 `ordinal` 命名并保存个人预设：

```text
node scripts/mycutbuddy.mjs preset.style.import.save-items --project <项目 ID> --import <导入 ID> \
  --input '{"items":[{"ordinal":0,"name":"用户确认的个人样式名称","description":"样式用途"}]}'
```

- `ordinal` 必须替换为当前草稿真实项，不按展示次序重新编号；空名称不保存，名称与描述的长度限制见 [cli.md](./cli.md)。
- 逐项检查返回的 `outcomes`；同名覆盖前先问用户。
- 提取结果以服务端返回的 `items` 为准；“上传成功”不等于“样式已提取成功”。

## 4. 按任务下载草稿包

任务完成后草稿包存放在网盘，交付信息来自服务端，不要猜测路径：

```text
node scripts/mycutbuddy.mjs delivery.info --project <项目 ID>
node scripts/mycutbuddy.mjs task.get --project <项目 ID> --task <任务 ID>
```

- `delivery.info` 返回项目固定分享入口，尚未生成时为空；任务列表与任务详情也可能携带交付信息。
- 任务交付信息包含草稿包的真实包名、成员、分享入口、提取码、上传时间与过期时间；单个包可能区分正式草稿 `jianying_draft` 与测试结果 `test_result`。
- 用分享入口与提取码交给百度网盘 Skill。项目分享中可能已有其他任务的包；先用官方 Skill 支持的分享浏览或选择性转存确认本任务实际包名，再下载对应包，不默认下载整个项目分享。宿主工具不能选择时说明限制，由用户决定是否保存整个分享，不擅自扩大范围。
- 注意过期时间：草稿包只保留一段时间，过期会被清理，应尽早保存到用户自己的网盘与电脑。

**下载成功不等于安装成功**：下面的本地安装是独立步骤。

## 5. 本地安装到剪映（仅当 Agent 有该电脑的本地文件权限）

纯云端 Agent 无法写入用户电脑；说明限制，并提供手动保存、解压和导入步骤。

具备本地文件访问能力时，优先使用 CLI 的安全交付命令：

```text
node scripts/mycutbuddy.mjs delivery.inspect --package <压缩包路径>
node scripts/mycutbuddy.mjs delivery.extract --package <压缩包路径> --target <目标目录>
node scripts/mycutbuddy.mjs delivery.install --package <压缩包路径> --drafts-dir <剪映草稿目录> [--name <草稿目录名>]
```

- `delivery.inspect` 在写入前预检加密条目、ZIP64、不支持的压缩方式、路径穿越、绝对路径、越界链接与超限体积；任一项不合格就停止，不尝试绕过。
- `delivery.extract` 只解压到不存在的新目录，失败时不留下部分产物；需要先检查内容时使用它。
- `delivery.install` 把包内每条草稿分别安装为剪映草稿目录，内部先安全解压到临时目录；批量包里的多条草稿会并排安装，不要自行再拆包或手工搬目录。安装结果按草稿逐条列出，任一草稿重名即整批拒绝而不是覆盖，也不留下部分安装；`--name` 只对单草稿包有效。不改写草稿 JSON 或 UUID。
- 草稿必须是**完整目录**（包含草稿内容文件），不是单个文件，也不是压缩包本身。
- 通常直接使用剪映默认草稿目录，不必每次让用户去设置里找路径：
  - Windows：`%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft`，即 `C:\Users\<用户名>\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft`。
  - macOS：`~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft`，即 `/Users/<用户名>/Movies/JianyingPro/User Data/Projects/com.lveditor.draft`。
  - 只有用户明确改过「全局设置 → 草稿位置」时，才使用用户提供的实际路径；默认目录不存在时再让用户确认路径。
- 安装前先关闭剪映，避免剪映同时占用或刷新草稿列表导致草稿异常。
- 安装后告诉用户：打开剪映，在首页按**今天的日期**（例如 `2026-10-20`）查找本批草稿，不要只说“已安装”而不给位置。
- 若打开草稿出现异常，关闭剪映后重新安装草稿，再重新打开剪映；若同名草稿阻止安装，先删除这次刚安装的异常草稿目录再重装。异常有时与安装时剪映正开着有关。
- 建议用户在剪映全局设置中关闭草稿自动备份。该功能会在后台持续打开新草稿，而新草稿首次打开又很慢，会导致剪映卡到不能动弹。
- 目标位置已有同名目录时**不得静默覆盖**；列出冲突，让用户决定改名或取消。
- 分别报告三段状态：`extracted`、`installed`、`jianying_recognition`。文件是否已放入草稿目录，和剪映是否能识别并打开这份草稿，是两件事；Agent 无法验证剪映打开时须明确说明，不得用“安装完成”暗示已被识别。
- 不要把改写草稿 JSON 或 UUID 作为默认兼容手段；也不要在没有真实验证的情况下提供用户侧安装脚本。

不要因为节点上报过 `local_demo`（节点本地演示）交付，就声称用户电脑上已经安装草稿。

## 6. 边界与禁止事项

- 不重新实现网盘客户端；不读取或输出网盘配置与令牌。
- 不绕过被引用 Skill 的授权与路径限制，不把操作范围扩展到 `/apps/bdpan/` 之外。
- 下载、解压、安装是三个独立步骤，任何一步的成功都不得被表述为后续步骤已完成。
