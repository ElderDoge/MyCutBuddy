# 百度网盘、样式草稿与本地草稿安装

本文说明如何借助百度网盘 Skill 完成素材、剪映样式草稿的上传与分享，如何按任务下载草稿包，以及在具备本地文件权限时如何把草稿安装到剪映。账号授权见 [authentication.md](./authentication.md)，CLI 命令与业务规则见 [cli.md](./cli.md)，整体工作流见 [../SKILL.md](../SKILL.md)。所有剪搭子业务调用都使用 `node scripts/mycutbuddy.mjs <命令>`，本机需 Node ≥20。

## 1. 引用百度网盘 Skill，不重新实现

- 素材与草稿的网盘上传、分享、转存、下载**全部使用官方百度网盘 Skill**，按需从宿主加载 `baidu-drive` 的主文件及其 `reference/` 文档（支持内部 URI 的宿主可用 `skill://baidu-drive`）。不在本 Skill 内重新实现网盘客户端，也不内联它的命令细节。
- 官方来源：<https://github.com/baidu-netdisk/bdpan-storage>。其 README 当前给出的安装方式为 `npx skills add https://github.com/baidu-netdisk/bdpan-storage/skills --skill baidu-drive`；使用前请以官方 README 的最新说明为准。
- **引用不等于自动安装**：是否安装、何时安装由用户决定，Agent 不得自动或静默安装、更新网盘工具。
- **首次登录必须由用户批准**：网盘登录会跳转用户自己的授权同意，Agent 不得代填、代点或跳过同意；登录未完成前不得继续网盘操作。
- 网盘授权与剪搭子账号授权**相互独立**，两者不能互相替代。
- 网盘 Skill 的操作范围被限制在其自身目录 `/apps/bdpan/` 内，**不得承诺**能访问用户整个网盘或其他目录。
- **平台能力由运行宿主决定**：能否执行网盘命令、能否访问用户电脑本地文件，取决于用户当前的 Agent/Skill 平台。本 Skill 不附带任何安装器、下载脚本或自动化代码；平台不支持时按第 5 节如实说明，不得假装完成。

## 2. 素材上传并分享，再提交素材导入

1. 用百度网盘 Skill 把用户的本地素材上传到该 Skill 允许的目录。
2. 用它的分享能力生成分享链接（按用户需要选择有效期），取得分享链接与提取码。
3. 用 CLI 提交素材导入，服务端再按链接抓取素材：

```text
node scripts/mycutbuddy.mjs material.import.submit --project <项目 ID> --confirm-charge \
  --input '{"library_type":"primary","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

- `--input` 的完整字段以 `node scripts/mycutbuddy.mjs help material.import.submit` 为准。必须带目标的 `library_type`（`primary` | `talking_head` | `voiceover`）、真实分享链接与按需的提取码；链接自带 `pwd` 或分享文本中包含提取码时也可识别。
- 分享链接必须是 `pan.baidu.com` 的 `/s/` 或 `/e/` 链接；不要提交其他站点或伪造链接。
- `--confirm-charge` 表示你已与用户约定本次费用；提示版本可省略，CLI 会读取当前版本。费用与提交状态按 [cli.md](./cli.md) 与 [billing.md](./billing.md) 处理，Agent 不得用上传成功的体积代替服务端计价事实。
- 上传成功、受理回执与 `prepared` 都不代表素材已入库；用 `request.watch` 与 `material.directory` 查询到真实终态。

## 3. 样式草稿上传并分享，再提取字幕样式

目标是让用户**已经做好的剪映样式草稿**被提取为可复用样式，而不是从截图或文字描述生成样式。

1. 让用户准备好样式草稿。上传时**保留草稿的完整结构**（整个草稿文件夹及其内容文件），因为提取依赖草稿内部的样式定义；不要裁剪、不要只上传截图或导出的图片，也不要改写草稿内容。
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
- 逐项检查返回的 `outcomes`，不因整体成功就宣布全部保存；同名覆盖前先问用户。
- 不要依赖节点内部的提取结果结构。不要用截图生成样式，不要把“上传成功”当成“样式已提取成功”。

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

纯云端 Agent 无法凭空写入用户电脑。此时必须如实说明，请用户自行保存、解压并导入，不要假称已安装。

具备本地文件访问能力时，优先使用 CLI 的安全交付命令：

```text
node scripts/mycutbuddy.mjs delivery.inspect --package <压缩包路径>
node scripts/mycutbuddy.mjs delivery.extract --package <压缩包路径> --target <目标目录>
node scripts/mycutbuddy.mjs delivery.install --package <压缩包路径> --drafts-dir <剪映草稿目录> [--name <草稿目录名>]
```

- `delivery.inspect` 在写入前预检加密条目、ZIP64、不支持的压缩方式、路径穿越、绝对路径、越界链接与超限体积；任一项不合格就停止，不尝试绕过。
- `delivery.extract` 只解压到不存在的新目录，失败时不留下部分产物；需要先检查内容时使用它。
- `delivery.install` 安装完整草稿目录，内部先安全解压到临时目录；同名草稿拒绝而不是覆盖，不改写草稿 JSON 或 UUID。
- 草稿必须是**完整目录**（包含草稿内容文件），不是单个文件，也不是压缩包本身。
- 使用用户真实的草稿根目录：向用户索取其剪映“全局设置 → 草稿位置”里的实际路径，不要猜固定路径，也不要写入别处。
- 目标位置已有同名目录时**不得静默覆盖**；列出冲突，让用户决定改名或取消。
- 分别报告三段状态：`extracted`、`installed`、`jianying_recognition`。文件是否已放入草稿目录，和剪映是否能识别并打开这份草稿，是两件事；Agent 无法验证剪映打开时须明确说明，不得用“安装完成”暗示已被识别。
- 不要把改写草稿 JSON 或 UUID 作为默认兼容手段；也不要在没有真实验证的情况下提供用户侧安装脚本。

不要因为节点上报过 `local_demo`（节点本地演示）交付，就声称用户电脑上已经安装草稿。

## 6. 边界与禁止事项

- 不重新实现网盘客户端；不自动安装或静默更新网盘工具；不读取或输出网盘配置与令牌。
- 不绕过被引用 Skill 的授权与路径限制，不把操作范围扩展到 `/apps/bdpan/` 之外。
- 不从截图或文字描述生成字幕/文字样式；不代替用户决定样式内容。
- 不自动删除用户的原始素材。
- 下载、解压、安装是三个独立步骤，任何一步的成功都不得被表述为后续步骤已完成。
