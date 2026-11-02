# 自定义资源预设

预设分两类：**剪辑配置预设**（例如剪辑风格）负责一整套剪辑参数，并引用第二类预设；**资源预设**（语音字幕样式、固定文字样式、音色、背景音乐、视频背景、特效集、音效集）只提供某一项资源的具体样式。本文只讲资源预设，重点是语音字幕样式和固定文字样式；剪辑配置预设见 [剪辑指南](editing-guide.md) 第 3 节。网盘上传与分享见 [网盘与草稿](baidu-drive-and-drafts.md)，命令字段以 [本地 CLI](cli.md) 为准。

## 1. 资源预设的范围

| 资源预设 | 在任务里怎么用 | 当前创建方式 |
|---|---|---|
| 语音字幕样式 | `dialogue_subtitle_style` | 剪映草稿导入，本文 |
| 固定文字样式 | `enable_global_subtitle=true` 后用于 `global_subtitle_style_0` 至 `_4` | 剪映草稿导入，本文 |
| 背景音乐 | `enable_background_music=true` 后用 `background_music_path` 选目录中的音乐 | 百度网盘分享导入，第 5 节 |
| 配音音色 | 旁白 TTS 用 `tts_voice_preset_id`（或用 `tts_voice_name` 直接选单个音色） | 从当前项目可用的音色目录组合，第 6 节 |
| 视频背景、特效集、音效集 | 从 `editing.context` 的资源目录选择 | 使用目录中已有项；个人自助编辑入口未开放，如需专属定制见 [常见问题与官方服务](faq.md) |

剪辑风格属于剪辑配置预设，不在这里创建；它保存的是任务配置，并引用上面这些资源预设。系统预设只读。个人预设属于当前账号，可在自己的项目里选用；同名保存默认拒绝，必须明确覆盖。任何名称、ID 都应以保存后重读 `editing.context` 的资源目录为准，不要把展示名直接当参数值。

## 2. 字幕样式的工作原理

字幕样式不是截图，也不是用文字描述生成的。它只能从**剪映草稿里的文字片段**提取，提取的是字体、字号、颜色、粗体/斜体/下划线、对齐、描边、阴影、文字背景、花字、气泡、文本框、位置和缩放。草稿中的文字内容只用于让用户辨认这一项，不会成为成片字幕内容。

提取和随机规则：

1. 按文字片段的**开始时间**分组：同一个开始时间的所有文字层合成一个预设项（一个 YAML），不同开始时间各成一个预设项。
2. 同一开始时间内，每个文字层是一组风格。每组里第一个富文本样式是**普通文字**，后面的样式都是**强调样式**候选。
3. 每条视频随机选择一组风格；选定后，再从这组的强调样式里随机选一个，整条视频统一使用。组里没有强调样式时，就只用普通样式。
4. 强调样式只在字幕系统把某些字标成重点时才会用到。是否标注由 `enable_subtitle_markup_optimization` 和 `subtitle_markup_user_prompt` 决定；没有重点标注就不会出现强调样式。
5. 完全相同的样式定义只保留首次出现的一项。想让多个开始时间各自保留，必须让样式实际不同。

由此得到两种制作方式：

- **语音字幕**：多个文字层全部从 0 秒开始，一个文字层是一组可随机切换的整体风格。
- **固定文字**：每个文字层放在不同开始时间，让它们成为可以分别命名的独立预设项。

一个草稿只做一种用途。语音字幕草稿里不要混入固定文字，固定文字草稿里也不要放字幕样例；分享里也不要混入没有文字层的草稿，否则整次导入可能失败。

示例：0 秒开始放三个文字层——第一层白字黑描边、末尾强调是黄字；第二层同样白字黑描边、末尾强调换成红色花字；第三层是黄底黑字、没有强调样式。保存成一个语音字幕预设后，每条视频会在三组里随机选一组；选中前两组时，整条视频的重点字使用对应的黄字或红色花字，选中第三组时只显示普通样式。

## 3. 制作语音字幕预设

### 3.1 在剪映里准备草稿

1. 新建草稿，画幅与成片一致（例如竖屏 9:16）。位置和缩放是相对画布记录的，画幅不一致时位置会偏。
2. 草稿里只保留文字内容和草稿结构，不要为了样式预设额外放视频、音频或图片；原草稿如果本来就有媒体，保存后按第 7 步处理。导入会整份下载分享内容，控制在 500 MB 以内。
3. 添加多个文字层，**全部从 0 秒开始**。每个文字层代表一组风格，例如「白字黄关键词」「黄底黑字」「描边大字」。
4. 逐层摆好位置、大小和对齐，设好字体、颜色、描边、阴影、花字、气泡和文本框宽度。
5. 需要强调样式时，在同一个文字层里选中部分文字，单独改成另一种样式。从文字开头开始的第一个样式会被当作普通文字，后面的每个样式都会成为强调候选；所以先把开头部分保持普通样式，再选中后面的字改强调样式。强调片段建议一直延伸到文字末尾：如果只是中间一段强调、后面又回到普通样式，尾部的普通样式也会被当成一个强调候选。局部强调可以改字体、字号、颜色、粗体、描边、阴影和花字；气泡和文本框只属于普通样式，不能作为局部强调。
6. 组内需要多个强调候选时，可以把后面的多段文字分别设成不同强调样式，但每一段后续样式都会成为候选，不要留下普通样式的尾巴。更简单的做法是一个文字层只配一个强调样式，再用多个从 0 秒开始的文字层提供多组风格。每条视频只会选中一个风格组，再在组内随机选一个强调样式。
7. 保存并关闭剪映。**整个草稿结构都要保留**，包括草稿内容 JSON 和 `Timelines/` 子目录；只传截图、导出的视频或单个 JSON 都不行。提取只读取文字层和样式，不依赖媒体内容；草稿如果带了视频、音频或图片，先把草稿复制到临时目录（不要改动原草稿），删除这些媒体文件，只保留草稿结构，再打包上传；这样分享体积小，下载和解析都更快。处理好的草稿文件夹可以直接分享，也可以打包成 ZIP 后上传。

### 3.2 导入并命名

用百度网盘 Skill 上传处理好的草稿文件夹或 ZIP，并生成分享链接、提取码，然后：

```bash
node scripts/mycutbuddy.mjs preset.style.import.submit --project <项目 ID> --request-key <本次唯一键> \
  --input '{"preset_type":"dialogue_subtitle_style","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

- `--request-key` 每次新导入换一个唯一键；同一个键配相同输入会重放原导入，不要用它开始另一份草稿。
- 分享链接必须是 `pan.baidu.com` 的 `/s/` 或 `/e/` 链接。
- 提交是异步的，用下面命令等到 `completed`：

```bash
node scripts/mycutbuddy.mjs preset.style.import.get --project <项目 ID> --import <导入 ID>
```

分享里有多个草稿时，先按真实 `draft_id` 选择本次要用的草稿：

```bash
node scripts/mycutbuddy.mjs preset.style.import.select-draft --project <项目 ID> --import <导入 ID> --draft <草稿 ID>
```

再次读取导入详情，按服务端返回的 `items[].ordinal` 命名保存：

```bash
node scripts/mycutbuddy.mjs preset.style.import.save-items --project <项目 ID> --import <导入 ID> \
  --input '{"items":[{"ordinal":0,"name":"白字黄关键词-底部","description":"底部口播字幕，关键词强调"}]}'
```

- 每一项的 `text`、`start_seconds`、`summary` 用来辨认它来自哪个文字层；`summary` 包含字体、字号、颜色、描边、阴影、位置等关键信息。
- 语音字幕通常只有一项：所有从 0 秒开始的文字层已经合成一个预设，内部包含多组可随机选择的风格。不需要把每个文字层分别命名。
- 名称最多 80 字符，描述最多 500 字符。空名称不会保存。
- 同一批里名称不能重复。同名个人预设已存在时，确认覆盖后才在对应项带 `"overwrite":true`。
- 逐项检查返回的 `outcomes`；出现 `error` 的项没有保存，不能因为整体返回成功就宣布全部完成。
- 保存后重读 `editing.context`，从 `dialogue_subtitle_styles` 里找到真实 ID，填进 `dialogue_subtitle_style`。

## 4. 制作固定文字预设

固定文字的样式和文字内容分开：预设只提供字体、位置和视觉样式，任务里再用 `global_subtitle_text_0` 至 `_4` 填具体文字。

1. 新建与成片同画幅的剪映草稿，只放文字；草稿如果带了媒体，按第 3.1 节复制到临时目录、删除媒体后再上传。
2. 每个固定文字样式放一个文字层，并且**放在不同的开始时间**，例如 0 秒、1 秒、2 秒。开始时间不同才会成为不同的预设项，才能分别命名。
3. 逐层摆好位置，设置字体、字号、颜色、描边、阴影、花字和文本框。位置会随样式一起保存，所以这里要按成片位置摆。
4. 不要在同一个开始时间放多个固定文字层：它们会合成一个预设，每条视频随机选其中一组，无法固定对应到某个槽位。
5. 固定文字没有重点标注流程，局部强调样式不会用于固定文字，只保留每组的普通样式即可。
6. 用同样的流程导入，`preset_type` 改为 `global_subtitle_style`：

```bash
node scripts/mycutbuddy.mjs preset.style.import.submit --project <项目 ID> --request-key <本次唯一键> \
  --input '{"preset_type":"global_subtitle_style","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

7. 每一项按它的实际用途命名，例如「顶部标题-黄字」「左下角角标-白字」「底部行动引导-红底」，然后逐项 `save-items`。
8. 在任务里打开 `enable_global_subtitle`，把保存后的真实预设 ID 分别填入 `global_subtitle_style_0` 至 `_4`，文字内容填在对应的 `global_subtitle_text_0` 至 `_4`。内容留空的槽位不生效。

## 5. 背景音乐预设（个人音乐）

背景音乐预设是一条导入产出的**单条预设**：用户给这次导入起一个名字，分享里的音频全部发布在这条预设里。来源只能是百度网盘分享——这是唯一需要网盘的预设路径；本机文件不能直接变成音乐预设，也没有逐曲上传的入口。

### 5.1 什么时候用

- 用户想反复使用同一套 BGM、片头音乐或某个歌单，希望在多个任务里按名字选用。
- 用户手上已有网盘分享（自己上传或别人给的），且这些音频有可用授权。
- 用户没有网盘、或不愿为这一步开网盘：改用 `editing.context` 音乐目录里已有的音乐或系统预设，不要把「没有网盘」当成任务失败。

### 5.2 准备与提交

1. 分享里只放音频：支持 `.mp3`、`.wav`、`.m4a`、`.aac`、`.flac`、`.ogg`；其他文件由服务端列为排除项，不下载、不计费。按「一个主题 / 一套歌单」组织一次导入，一次导入就是一条预设。
2. 用业务语言和用户确认预设名称和这一步的大致费用，再提交：

```bash
node scripts/mycutbuddy.mjs preset.music.import.submit --project <项目 ID> --confirm-charge \
  --input '{"preset_name":"轻快开场","share_url":"https://pan.baidu.com/s/...","extraction_code":"..."}'
```

3. `preset_name` 就是发布后的预设名（最多 80 个字符），与已有活动预设同名会在受理前直接拒绝；换名称，或先归档旧预设。
4. 发布格式统一为 MP3：本身是合法 MP3 且标称码率不超过 192 kbps 的保留原字节，其余转码。同一预设内按去扩展名的文件名去重，撞名自动加 ` (2)`、` (3)`，不要自己改文件名。

### 5.3 费用与返还

- **受理即扣费**：费用在受理时按冻结事实结算，不等发布完成。受理门槛是不低于 1 积分的可用余额；不足时不会创建导入，也不会开始下载。
- 计费口径由服务端给出：D=下载音频数、S=新增来源数、C 恒为 0；CLI 只透出服务端事实，不报价、不预估。
- 已扣费后、开始处理前失败或用户取消：已扣积分**只退一次**。已经进入发布的导入若先完成发布，取消不会撤销这次扣费。
- 同一用户同时只有一个活动导入（跨项目共用）：另一个项目正在导入时，本项目的受理会被拒绝，`preset.music.import.list` 的 `active_import_elsewhere` 会指出是哪个项目。一次导入统一 12 小时截止。
- 导入进行期间（含「取消中」）不能改名或归档任何音乐预设，服务端会指出占用中的项目；不要重试或绕过。

### 5.4 跟踪与使用

```bash
node scripts/mycutbuddy.mjs preset.music.import.get --project <项目 ID> --operation <导入 ID>
node scripts/mycutbuddy.mjs preset.music.import.cancel --project <项目 ID> --operation <导入 ID>
node scripts/mycutbuddy.mjs preset.music.list --project <项目 ID>
node scripts/mycutbuddy.mjs preset.music.rename --project <项目 ID> --music-preset <预设 ID> --name <新名称>
node scripts/mycutbuddy.mjs preset.music.archive --project <项目 ID> --music-preset <预设 ID>
```

- 阶段依次为 `preparing`（扫描与下载）、`prepared`（按真实文件核算并扣费）、`publishing`（发布到预设），终态是 `completed`、`failed`、`cancelled`；取消后停在 `cancelling`，直到服务端确认清理完成。
- 只有 `completed` 才代表预设已发布；带 `preset_sync_pending=true` 说明服务端还在同步这份预设。`credit_cost`、`credit_status`、`refunded_credits`、`settlement_status` 是账本事实，退款义务还在处理时不要说成已退回。
- 发布后 `preset.music.list` 给出真实 `preset_id`；取用任务时用 `editing.context` 音乐目录里的稳定 ID 填 `background_music_path`（`enable_background_music=true` 时生效），不要用名称或本地路径。
- 归档后不能再用于新任务；本次归档释放的来源在下次导入时会重新算作新增来源。

## 6. 配音音色预设

音色预设是一份可复用的**配音音色组合**：只有旁白 TTS 会用到。它不改变字幕样式，也不是「克隆某人的声音」——成员只能来自当前项目真实可用的 TTS 音色目录。

1. 先读目录：

```bash
node scripts/mycutbuddy.mjs preset.voice.list --project <项目 ID>
```

返回的 `voices[].id` / `voices[].name` 是当前项目真实的音色目录，`tts_provider` 是唯一接受的提供方。目录之外的音色、显示名当 ID 用、空目录，都会被服务端拒绝，不要自己编造音色 ID。

2. 挑成员并定权重（正整数，成员不能重复；顺序就是保存后的顺序），新建：

```bash
node scripts/mycutbuddy.mjs preset.voice.create --project <项目 ID> \
  --input '{"name":"温柔女声","definition":{"tts_provider":"doubao_tts_1_0","voices":[{"voice_type":"<voices[].id>","weight":2}]}}'
```

`voice_type` 必须来自上一步的目录；`weight` 是相对权重，不是百分比，也不要自己换算成时长或音量。同名个人预设已存在时返回 409，用户确认覆盖后才在那次输入里带 `"overwrite":true`。

3. 编辑前先 `preset.voice.get` 读取原定义，再提交完整的名称与成员（不接受 `overwrite`）；改名撞上另一个预设会直接 409。删除用 `preset.voice.archive`，系统预设只读（403），已有任务不受影响。

4. 使用：旁白的 `public_config` 里用 `tts_voice_preset_id` 选这份组合（与 `tts_voice_name` 二选一），音色来源必须是 `tts`。想帮用户省事时，单个音色直接给 `tts_voice_name` 就够，不必先建组合。

## 7. 管理与排查

- 改名、归档用 `preset.subtitle.list`、`preset.subtitle.update`、`preset.subtitle.archive`；改名不改变预设 ID，也不会改写已有任务。
- 导入记录用 `preset.style.import.list` 查询；`preset.style.import.delete` 只软删终态导入记录，不删除已经保存的预设。
- 文字层很多但只得到一个 item：它们在同一个开始时间。语音字幕这是预期行为；固定文字需要把它们移到不同开始时间后重新导入。
- 多个开始时间却少了 item：样式定义完全相同，被去重；改出实际差异后再导入。
- 强调样式没有出现：字幕没有被标注为重点，或强调样式不在普通样式之后。
- 随机出来的强调有时像普通文字：强调片段后面又跟了一段普通样式，它也被当成强调候选；把强调放到文字末尾，或让一个文字层只保留一个强调片段。
- 字幕位置偏移：草稿画幅与成片画幅不一致。位置来自普通样式所在的文字层，重新按成片画幅摆好位置后再导入。
- 分享很大或导入很慢：草稿里带了媒体文件。复制到临时目录删除媒体，只保留草稿结构后重新打包上传。
- 不能从截图、字体文件或文字描述直接生成样式；也不要在 Skill 里手工编造样式定义。
