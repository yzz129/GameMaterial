# 新增游戏指南

新游戏只提供主题配置、素材与标准格式的数据；共享页面、播放器、搜索和详情在根目录 `engine/` 维护。

## 建立目录

在 `D:\游戏素材` 运行：

```sh
npm run game:add -- xingqiong --name 星穹铁道
```

得到 `xingqiongvoice/`。ID 使用 2–40 个小写字母、数字或连字符，以字母开头。指定端口可追加 `--port 8085`。命令不覆盖已有目录。

## 设置品牌与主题

编辑新目录的 `game.config.json`：

| 字段 | 用途 |
| --- | --- |
| `brand` | 标题、站名、英文副标、世界名、版权与页脚 |
| `home.characterId` / `preferred` | 首页角色与推荐排序；角色 ID 必须在目录里 |
| `home.titleLines` / `tagline` | 首页标题与介绍 |
| `home.titleArt` | 可选标题图 `still` / `intro`；不设置就显示文字 |
| `home.artMode` | `cutout` 使用透明立绘，`illustration` 将竖版插画放在同一人物区域并柔化边缘；角色可用 `heroArtMode` 单独指定 |
| `assets.logo` / `favicon` / `font` | 标志、图标和字体 |
| `assets.fontBold` / `fontFallback` | 可选粗体字库和缺字补充字库；由共享主题生成器统一注册 |
| `assets.fontPatch.src` / `codepoints` | 可选小型 WOFF 补字及 Unicode 码点数组，优先覆盖常用界面缺字，避免首屏等待大字库 |
| `assets.scenes.pc` / `mobile` | 海报 `poster`，以及可选视频 `src` |
| `theme.dark` / `light` | 主题变量，如 `--bg`、`--gold`、`--text`、`--surface`、`--muted`、`--line` |
| `copy` | 图鉴、详情、台词分类、搜索和空状态文案 |
| `filters` | 地区、属性/职业、星级/状态、武器/阵营名称和选项 |
| `detail.metadata` / `voices` | 详情展示字段及声优语言标签 |
| `features.music` / `skins` / `rarity` | 音乐、皮肤选择、星级显示 |
| `music.tabs` | 本地、可播放、字段匹配或专辑关键词分类 |
| `music.autoplay` | 进入游戏时尝试播放背景音乐；浏览器拦截有声播放时，在首次真实触摸、点击或按键中重试 |
| `storage.namespace` / `favorites` | 游戏独立的设置与收藏名称；投入使用后不要随意改名 |
| `server.port` | 本地端口 |
| `build.directory` / `target` | 输出目录，以及 `static` 或 `cloudflare` 构建 |

大多数改动只需要 JSON 配色和素材路径。页头、导航、首页、卡片和播放器的排版统一在 `engine/client/` 维护；游戏的 `styles` 保持为 `["theme.css"]`，该文件只做主题装饰，不再加载旧游戏的布局覆盖文件。标志宽度可用 `--brand-logo-width`、`--brand-logo-mobile-width` 和 `--brand-logo-small-width` 主题变量设置。素材使用站内相对路径，例如 `assets/background.webp`，不要写磁盘绝对路径。原始大图与母版可保存在 `assets/masters/`，不会进入部署包。

## 角色与台词

`data/catalog.json` 是角色数组，脚手架包含完整示例。角色 ID 是稳定的正整数。关键字段：

- `name`、`enName`、`title`、`description`：姓名、别名、称号、简介。
- `region`、`element`、`roles`：地区、主属性/职业、多职业数组。
- `rarity`、`weapon`：主筛选数值、次筛选类别；显示名称由配置定义。
- `avatarImg`、`cardArt`、`splashArt`、`fullArt`：头像、卡片、海报、详情图；可用 `heroArt` 指定首页图。
- `fullArtWidth`、`fullArtHeight`：真实尺寸。透明图可设置 `fullArtTransparent: true`。
- `quoteCount`：详情两类台词的总数，校验会核对。
- `metadataSearch`：姓名、别名、属性、声优等关键词，使用小写。全文索引自动生成。
- `cv`：例如 `{ "chinese": "配音演员" }`；不需要时填 `{}`。

每个角色对应 `data/characters/<id>.json`，包含相同基础字段，并增加 `friendLines`、`actionLines`。下方仅展示新增部分，实际文件要保留脚手架中的基础字段：

```json
{
  "id": 1,
  "name": "示例角色",
  "friendLines": [
    {
      "key": "character-1-greeting",
      "title": "初次见面",
      "desc": "很高兴与你相遇。",
      "audioUrl": "assets/audio/character-1-greeting.mp3"
    }
  ],
  "actionLines": []
}
```

`key` 是同一角色内稳定、唯一的语音标识，关系到收藏和播放高亮。没有音频时省略 `audioUrl`，界面禁用原声按钮。

皮肤可在 `skins` 数组填写 `{ "id": "skin-1", "name": "皮肤名", "voiceCount": 1, "art": "assets/skins/skin-1.webp" }`；对应台词增加 `skinId: "skin-1"`。开启 `features.skins` 后自动显示选择器；没有独立语音的皮肤显示空状态。

## 音乐

新模板默认使用 `data/music.json`：

```json
{
  "tracks": [
    {
      "id": "theme-1",
      "title": "启程",
      "artist": "音乐作者",
      "album": "游戏原声",
      "category": "角色主题",
      "region": "示例地区",
      "cover": "assets/music/cover.webp",
      "localUrl": "assets/audio/theme-1.mp3",
      "isLocal": true,
      "playable": true,
      "duration": "02:30"
    }
  ]
}
```

有音乐后设置 `features.music: true`。只有平台歌曲页时，填写 `playable: false`、HTTPS `sourceUrl` 和可选 `sourceLabel`；界面会打开官方页，不把链接冒充站内音频。代理默认关闭；需要时用 `music.proxySources` 设置允许的 HTTPS `origin` 和 `pathPrefix`，请求仅能选择已收录歌曲 ID。

原神和王者目前开启 `music.autoplay`。共享的 `audio-autoplay.js` 在浏览器允许时直接开始播放，受限制时等待首次页面交互；手动暂停、静音和切换曲目会撤销待执行的自动启动，避免下一次点击又把音乐打开。试听角色台词时音乐降至设定音量的 20%，结束或关闭试听后恢复；离开页面暂停播放与手势监听，浏览器后退恢复页面时按原播放意图恢复。音乐盒继续控制曲目、暂停与音量，并保留已保存的音量偏好。

王者官网字库属于裁剪字库，缺少「循」「熟」「换」「停」等站内用字。补充字库使用本地 Ma Shan Zheng 原始字体生成，只收录官方字体缺少的字形，来源、OFL 许可证和哈希保存在 `wangzhevoice/assets/masters/brand/HOK_03_DATA_font-coverage_v2.manifest.json`。运行 `py -3.14 tools/prepare-honor-fonts.py` 可重新生成；运行时文件与许可证一同发布。

移动浏览器兼容修复另有 `py -3.14 tools/prepare-honor-ui.py`：将 62 个共享界面缺字打包为约 33 KB 的传统 WOFF，通过 `assets.fontPatch` 在主字体中优先注册；字体字重使用独立的 400／500／600／700 声明。首屏两行标题直接使用约 20 KB 的 SVG 字形轮廓，不依赖系统字体或网页字体是否加载，保留真实 H1 供辅助技术读取。标题仍通过统一的 `home.titleArt` 接口显示并播放一次柔和流光，素材来源和哈希在 `assets/masters/typography/HOK_04_DATA_ui-lettering_v3.manifest.json`。

## 检查与导出

```sh
node tools/game.mjs validate --game xingqiong
npm run start:game -- --game xingqiong
node tools/game.mjs build --game xingqiong
```

根目录 `npm run prepare`、`npm run validate`、`npm run build` 默认处理所有游戏。单游戏也可进入对应目录执行 `npm run prepare` / `npm run validate` / `npm run build`。

把 `dist/` 作为网站根目录上传即可。`cloudflare` 模式会对超过 25 MiB 的音视频分片，保留原始字节并生成支持范围请求的 Worker。构建不会自动发布。

游戏官网、接口、皮肤和歌曲平台若使用不同数据结构，需要在素材采集阶段转换成上述格式；不需要修改共享页面。原神、王者已有的抓取和来源校验脚本继续属于各自游戏。

公共功能只编辑 `engine/client/` 或 `engine/node/`，之后运行根目录 `npm run prepare` 和 `npm test`。游戏目录内的 `app.js`、`styles.css` 等是生成文件，会被覆盖。

新游戏会自动加入统一门户。`games.json` 的 `slug` 控制英文网址路径；游戏配置的 `portal` 控制入口展示。发布全部游戏使用根目录 `npm run deploy`，参见 [门户发布说明](PORTAL_DEPLOYMENT.md)。

门户的动态背景、角色局部动作和视频也通过主题配置复用，参见 [门户场景动效](PORTAL_MOTION.md)。
