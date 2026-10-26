# 统一门户与域名

主域名：`https://gamematerial.yzzwnw.asia/`。

| 路径 | 内容 |
| --- | --- |
| `/` | 游戏选择门户，支持游戏名、英文别名、角色名搜索 |
| `/genshin/` | 原神角色、台词、语音和音乐 |
| `/honor-of-kings/` | 王者荣耀英雄、皮肤、语音和音乐 |

`games.json` 的 `slug` 决定英文路径。新增游戏默认使用其 ID 作为 slug，构建时自动加入首页。游戏的 `game.config.json` 可用 `portal` 设置展示名称、英文名、入口插画、统计单位与搜索别名。

## 本地与构建

```sh
npm start                    # 统一门户 http://localhost:8090
npm run build                # 所有游戏整合到 portal-dist/
npm run deploy               # 构建并发布到现有 Cloudflare Pages 项目
npm run start:all            # 分别启动各游戏的独立开发服务
npm run start:game -- --game yuanshen
npm test
```

统一门户外观由 `portal.config.json` 和 `portal/` 管理。各游戏使用同一份 `engine/client/`。门户构建在 `.portal-cache/` 中生成带基础路径的入口，不覆盖各游戏的独立运行文件；部署产物只需要 `portal-dist/`。

首页使用现有游戏插画；概念图只作为布局与配色参考。原神的条目数标为「台词」，避免把无音频条目计作可播放原声。首页不启用背景音乐；进入游戏后使用各游戏原来的播放设置。

总入口采用星空画册布局，`portal.wordmark` 可选择游戏字标，其他游戏自动读取自己的标题字库。门户的马善政楷书与思源宋体以 WOFF2 子集本地发布，包含界面文字和当前角色名字。更新文字或角色后，可用 `tools/prepare-portal-assets.py` 重建字库（Pillow、fonttools、brotli）；字库许可证随网站发布。

参考图中的定制书法标题单独作为透明字稿使用。门户可配置 `sectionTitleArt`、`taglineArt`，游戏可配置 `portal.titleArt`，三者均包含 `text`、`src`、`width`、`height`。只有文案与 `text` 一致时才启用字稿，否则自动回到真实文字，避免更新文案后仍显示旧图。页面保留对应文字语义，强制对比度模式显示文字；王者游戏子页面仍使用其原有官方字库。

这组三处字稿的参考图、原始 PNG 与完整生成提示词位于 `portal/masters/lettering-v1/`。`py tools/prepare-portal-lettering.py` 可进行保留原始分辨率与透明通道的 WebP 编码，并更新尺寸和 SHA-256 记录；母版不发布到网站。

`portal.config.json` 的 `footerVideo` 配置页尾视频与海报。视频保留原始字节，接近页尾时才载入并静音循环播放，离开画面或后台时暂停；减少动态效果或省流量设置默认使用海报，用户可手动播放。素材母版、概念图、生成提示词和哈希记录保存在 `portal/masters/editorial-v1/`，不会部署。

## Cloudflare

`hosting.cloudflare.json` 保存账号 ID、现有项目名称、生产分支和域名，不包含凭据。继续使用原有 `genshin-voice-archive` Pages 项目，项目内部名称不影响新域名。`tools/cloudflare.mjs status` 可检查绑定状态；`remove-old-domain` 只会在新域名 active 且新门户验证通过后移除配置中的旧域名。

DNS 为 `gamematerial` 的 CNAME，指向 `genshin-voice-archive.pages.dev`，保留 Cloudflare 代理。原来的 `genshin.yzzwnw.asia` 在迁移完成后从 Pages 自定义域名与 DNS 中移除。

所有游戏统一在一个域名下。构建会处理媒体绝对路径、音乐 API、搜索 Worker、历史索引与音视频分片；各游戏的收藏和主题仍使用独立的存储键。

发布之前运行自动检查和实际浏览器回归。超过 25 MiB 的音视频保留原字节分片，根 Worker 按游戏前缀处理请求；源码、配置源文件、母版和构建缓存不会发布。

新增游戏建议使用官方英文 slug，例如 `honkai-star-rail`；即使采集脚本或目录继续使用中文拼音 ID，也可以单独修改 games.json 的 slug。
