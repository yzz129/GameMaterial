# 原神 · 提瓦特语录秘典

> 本站已迁移到统一架构。界面源码在上一级 `engine/client/`；品牌、主题、分类与素材入口在本目录 `game.config.json`。`app.js`、`styles.css` 等是生成文件，不要直接编辑。运行 `npm start` / `npm run build` 使用公共引擎。新增游戏见 [统一项目说明](../README.md) 与 [接入指南](../docs/ADDING_A_GAME.md)。下方旧组件复用、旧测试和旧发布记录保留作历史资料。


轻量的本地角色与台词图鉴。包含 96 位角色、7,166 条角色台词，以及纳西妲 1,790 条语音与 24 条铃声索引。

## 启动

双击「启动网站.bat」，或在本目录运行：

```sh
npm start
```

访问 http://localhost:8080 。同一局域网的手机可使用这台电脑的局域网 IP 加端口 8080 访问。

## 功能

- 本地 WebP 角色立绘与静态官方云海背景，统一界面图标和元素徽记。
- 星辉玻璃界面、金色衬线标题、典藏卡框；桌面悬停提供炫彩反光、3D 倾斜与投影。
- 通透云海背景、少量青金星尘与短线、点击光环；右上角星形按钮可关闭星尘和点击动效，并保存选择。
- 按地区、元素、星级、武器筛选，支持角色、声优和全量台词搜索。
- 角色详情、台词珍藏、复制、PNG 海报导出与连续朗读。
- 手机双列图鉴、全屏详情、滑动筛选、明暗主题与减少动态效果支持。
- 动效按需启用：卡片静止时恢复平面，手机取消实时倾斜与背景模糊。
- 星尘在手机端减少数量，滚动、隐藏页面或打开角色详情时暂停；系统要求减少动态时自动关闭。
- 浏览器朗读与角色原声下载明确区分。当前没有本地原声音频，原声包链接来自原数据库的第三方归档。
- 纳西妲独立索引页保留所有原条目，按分类搜索、分页浏览。

## 文件

| 文件 | 用途 |
| --- | --- |
| index.html / nahida_player.html | 首页与独立索引入口 |
| app.js / styles.css | 界面与交互，无运行时框架依赖 |
| search-worker.js | 按需启动的全文搜索 |
| data/catalog.json | 轻量角色目录 |
| data/characters/ | 按角色加载的完整台词 |
| assets/characters/ | 本地角色图片 |
| assets/manifest.json | 素材来源、尺寸与校验值 |
| server.js | 压缩、缓存、范围请求与本地静态服务 |
| OPTIMIZATION.md | 优化说明与验证范围 |

## 维护

```sh
npm install
npm run prepare:assets
npm run build
npm test
```

资源已在本地准备好，日常启动只需 npm start。修改源码后执行 npm run build 更新压缩副本；修改 server.js 后重启服务。

旧页面和数据未删除，页面备份保存在 _backups/2026-10-22/。原始大型数据库不再参与首屏加载。

游戏图片与角色资料版权归 HoYoverse 所有；界面图标采用 Phosphor（MIT，见 assets/icons/LICENSE）。本站为同人档案，与官方无隶属关系。

网站图标使用用户提供的派蒙图，源图保存在 `assets/masters/icons/`，由 `npm run prepare:favicon` 生成 ICO、浏览器 PNG 与 Apple touch icon。Cloudflare Pages 发布目录通过 `npm run build:cloudflare` 生成，只包含服务器白名单内的公开站点资源，不包含 masters、源数据和开发文件。Wrangler 登录后可运行 `npm run create:cloudflare`（首次创建 `genshin-voice-archive` 项目），之后用 `npm run deploy:cloudflare` 发布；统一入口现为 `https://gamematerial.yzzwnw.asia/genshin/`，旧域名已移除。

## 旅途星海动态场景与完整立绘（2026-10-22）

- 使用即梦生成的 8 秒星海遗迹循环视频作为桌面动态背景，原始视频无损保存在 `assets/masters/video/`，运行资源按原字节发布到 `assets/video/`；海报与手机静态背景保存在同目录。
- 96 位角色均加入透明全身祈愿立绘。打开详情后，人物由独立透明图层投影到玻璃展台上，包含轻量视差、金色星轨和柔和彩色轮廓；点击「欣赏立绘」可切换大图展示，详情内容区域可独立滚动。
- 视频在桌面与手机上按需加载；滚动、切换详情、页面隐藏或关闭场景效果时暂停。省流量、2G 网络、极低内存设备、减少动态模式或视频不可用时显示本地静态图与轻量星尘效果。
- 手机金卡用静态虹彩箔面、角色元素色辉光和立绘投影呈现层次；触摸按下时才启用短暂 3D 抬升，不为整张卡片列表常驻创建动画图层。
- 修改详情图片使用 `fullArt`、`fullArtWidth`、`fullArtHeight` 字段；资源来源、尺寸与校验值见 `assets/manifest.json`。背景视频的即梦任务信息见 `_jobs/dreamina-background.json`。

本轮验证包括项目构建、16 项自动检查、视频文件完整解码，以及 8080 页面、脚本、样式、海报、视频范围请求和全身立绘的本地 HTTP 检查。未进行实体手机测试。
