# 王者回响

> 本站已迁移到统一架构。界面源码在上一级 `engine/client/`；品牌、主题、分类与素材入口在本目录 `game.config.json`。`app.js`、`styles.css` 等是生成文件，不要直接编辑。运行 `npm start` / `npm run build` 使用公共引擎。新增游戏见 [统一项目说明](../README.md) 与 [接入指南](../docs/ADDING_A_GAME.md)。下方旧组件复用、旧测试和旧发布记录保留作历史资料。


王者荣耀英雄语音与歌曲档案，直接复用 `yuanshenvoice` 的页面和组件。项目实际位置为 `D:\游戏素材\wangzhevoice`，与 `D:\游戏素材\yuanshenvoice` 并列。

## 启动

双击「启动网站.bat」，或在本目录运行：

```sh
npm start
```

打开 http://localhost:8081 。日常浏览无需安装依赖，也不需要账号或接口密钥。

## 原神组件的直接复用

保留原站 `app.js`、`styles.css`、`search-worker.js` 的实现及 DOM 结构，沿用以下组件：

- 页面导航、首页英雄切换、每日语音。
- 金色角色卡片、倾斜与星尘效果、明暗主题。
- 搜索 Worker、地区/职业筛选、排序、分页。
- 角色详情弹窗、立绘展开、台词列表、珍藏、复制、PNG 海报、原声下载。
- 语音播放条、连续播放、拖动进度、音量、静音。
- 顶部音乐胶囊、唱片音乐盒、曲库搜索、分类、播放列表、循环模式、语音播放时降低音乐音量。
- 独立语音索引页、手机布局及减少动态效果支持。

`shared/teyvat-*` 保存原站源码快照，`scripts/reuse-teyvat.mjs` 从快照生成适配后的原组件和数据。角色详情直接使用 `shared/teyvat-dialog.css`：原神样式按原值限定到 `#characterDialog`，保留原来的字体、布局、台词卡片、按钮、动效和媒体查询，并重置此前的王者详情样式覆盖。`wangzhe-dialog.css` 最后加载，只额外将王者皮肤筛选放进原标题区。职业/阵营字段、王者素材、歌曲平台链接和稳定语音 ID 沿用原数据适配。不要另写一套详情 UI，也不要直接编辑生成后的 `app.js`。

适配脚本从同级 `../yuanshenvoice` 读取源站字体、桌面/手机动态背景、45 帧金色标题动画和静态海报；初次建立快照也从该目录读取组件。所有视频逐字节复制，保留原站画质、原始声音轨道、时长和循环节奏。源码、字体和动态素材随项目保留，部署后独立运行。复用清单与源码校验值见 `docs/reuse-provenance.json`，素材来源、生成记录和校验值见 `assets/motion-manifest.json`。

动态效果直接沿用原站四个控制器与原样 CSS：背景场景、星尘和按钮点击反馈，人物浮动与星轨，卡片倾斜与虹彩光泽，详情插画视差。王者插画的裁切与边缘衔接由 `wangzhe.css`、`wangzhe-dialog.css` 适配，不覆盖动画或变换。首次载入本次动效版本会开启场景效果，此后保留用户主动切换的设置；系统减少动态、页面隐藏、滚动和弹窗的暂停规则与原神站一致。

## 当前收录与边界

2026-10-23 同步结果：

| 内容 | 数量与状态 |
| --- | --- |
| 英雄/职业档案 | 133 份，元流之子不同职业分别建档 |
| 官方公开语音 | 18,159 条，覆盖 120 份档案、630 个有语音的皮肤分组 |
| 官方未公开可用语音的档案 | 13 份，页面保留英雄信息并显示暂无音源 |
| 音乐档案 | 1,349 首，按歌曲 ID 去重 |
| 站内可播放原声 | 48 首，使用腾讯公开 MP3 |
| QQ 音乐歌曲 | 1,301 首，提供官方歌曲页，标注「QQ音乐 ↗」 |

语音和皮肤目录来自腾讯官方英雄列表、王者世界观站公开数据。语音优先播放已缓存文件，其余播放官方 HTTPS 音源。部分皮肤没有单列语音，不能将同英雄基础音色伪装成该皮肤专属音频。

音乐收录范围包括官方世界观音乐馆，以及 QQ 音乐中「王者荣耀」「无限王者团」「王者荣耀同人局」三位歌手的公开歌曲目录。该范围不能保证覆盖仅署名其他歌手的联动歌、未公开音源或未来发行内容；未把平台链接标成可站内播放的完整音频。

## 数据维护

```sh
npm install
npm run sync:voices
npm run sync:music
npm run prepare:skins
npm run prepare:art
npm run prepare:ui
npm test
npm run build
```

仅重建现有数据适配和部署包：`npm run prepare:ui`、`npm run build`。产物位于 `dist/`，不含服务器、开发脚本、原始接口快照与旧 UI 备份。

本轮已完成本地构建；原先登记的 Sites 项目目前返回 `NOT_FOUND`，当前账号的站点列表为空，因此尚未完成线上发布。保留 `.openai/hosting.json` 中的原项目标识，未重复创建站点。

离线重建语音：`node scripts/sync-voices.mjs --cached`。离线重建音乐：`node scripts/sync-music.mjs --offline --skip-covers`。两者完成后都要运行 `npm run prepare:ui`。

可选 `--download-audio` 缓存全部公开语音，`--cache-audio` 缓存 48 首公开原声。当前仅缓存部分示例语音，避免默认下载数 GB 文件。

## 验证

`npm test` 检查目录/皮肤引用、语音唯一性、原组件数据适配、歌曲音源状态，以及 HTTP 音频范围请求和静态资源白名单。

`scripts/verify-reused-ui.cjs` 使用隔离的 Playwright Chromium 验证真实语音与音乐播放、进度拖动、皮肤筛选、收藏持久化、海报导出、歌曲来源跳转、独立索引和 320/390/768px 布局。运行时可通过 `PLAYWRIGHT_MODULE` 与 `PLAYWRIGHT_EXECUTABLE` 指定已有安装。结果与截图保存在 `docs/`。未进行实体手机测试。

`npm run test:motion` 对照原神与王者两个隔离测试页面，核对实际视频解码与帧数、人物/星轨动画周期、3D 卡片、详情视差、动效开关、手机竖屏与减少动态设置，结果见 `docs/motion-verification.json`。

2026-10-24 已完成全部 18,159 条语音与 1,349 首歌曲的官方源对应检查，以及 18,202 个独立音源的访问与文件头检查，未发现错配或失效。全部播放按钮也已在隔离浏览器中逐项检查路由。边界、缺口、复查命令与证据见 [全量音频检查报告](docs/AUDIO_AUDIT.md)，完整结果位于 `source-snapshots/audio-audit/report.json`。该结果不等于逐句人工听辨全部录音。

皮肤插画使用官方鉴赏接口的对应皮肤图，630 组图片及来源/尺寸/校验值保存在 `data/skin-art.json`；选择皮肤后同步插画与分类数量。`npm run test:views` 检查深浅主题、1440/768/390/320px 布局与皮肤画面。界面优化记录见 `docs/design-refinement.md`。

诸葛亮基础造型的详情展示使用原插画经 imagegen 去背景的透明人物层，登记在 `data/character-cutouts.json`，包含处理提示词、来源、尺寸、校验值及生成记录。原插画和生成 PNG 母版均保留；网页只加载 `assets/characters/` 中的 WebP。皮肤按独立 ID 匹配插画，使用原神详情组件的等比立绘展示与完整立绘视图。使用 `node scripts/prepare-cutout.mjs --hero ID --skin SKIN_ID --source PNG` 登记后，运行 `npm run prepare:ui` 更新详情。

全部 133 份英雄档案的卡片与详情使用官方原生尺寸立绘，运行文件在 `assets/hero-art/`；源图母版在 `source-snapshots/hero-art/`，来源、尺寸、版本和 SHA-256 记录在 `data/hero-art.json`。`npm run prepare:art` 保留源图、不放大低清图，生成每位英雄与 630 组皮肤各自的灯光配色。英雄卡片保留金色框饰、职业徽记与虹彩；详情恢复原神原有布局和台词卡片，复用同一套字体、视差、播放器与动效开关。图像与语音仍以原来的英雄、皮肤 ID 对应；未把全部原画伪装成透明抠图。

详情样式的源文件校验值与派生规则见 `docs/dialog-reuse-provenance.json`。仅在更新原神样式快照时运行 `npm run prepare:dialog`，然后运行 `npm run prepare:ui`；该可选生成命令使用与浏览器检查相同的 Playwright 环境变量。日常重建无需运行浏览器。

官方移动端图片可能采用同一幅双人构图。`data/hero-art-sources.json` 固定云中君、瑶各自的官方角色特写与基础皮肤横图，避免卡片、详情、头像和首页再次回退到相同构图。原素材保留，替换图使用新版本文件名。生成时同时检查感知指纹与归一化像素差，结果写入素材清单的 `visualAudit`；元流之子不同职业共用同一角色图作为明确例外保留。

全部 48 首站内音乐通过真实媒体元素读取实际时长，结果见 `data/music-media.json`。其中 5 首与官网标注相差超过 1 秒，页面显示实测值，原标注保留在 `data/music.json` 和适配记录的 `sourceDuration` 中。重新读取实际时长后运行 `npm run prepare:ui` 更新页面数据。

## 来源

- [官方英雄列表](https://pvp.qq.com/web201605/js/herolist.json)
- [官方英雄世界观](https://pvp.qq.com/story201904/)
- [官方音乐馆](https://pvp.qq.com/story201904/index.html#/music)
- 每条语音/歌曲的具体来源记录在 `data/` 对应 JSON 的 `sourceUrl`、`remoteUrl` 中。

游戏图片、音频及资料权利归腾讯及相关权利人。本站为同人档案；图标沿用原站的 Phosphor（MIT，见 `assets/icons/LICENSE`）。
