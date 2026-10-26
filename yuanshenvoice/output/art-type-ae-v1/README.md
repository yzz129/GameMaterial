# 原神语录秘典 · AE 艺术字 v1

用户提供的「原神」星芒字形用于导航品牌；首页与纳西妲索引的大标题使用宋体字骨、香槟金渐变、四芒星与细线装饰。文字内容保持原文：

- 首页：循着星光 / 重逢熟悉的声音
- 索引：把须弥的故事 / 说给你听

## 可编辑来源与真实渲染

`TEYVAT_04_FX_art-type_v1.aep` 由 Adobe After Effects 2026 26.5x89 创建。文字、参考图遮罩、渐变、CC Light Sweep、星芒与星尘均保留为可编辑图层。原始标识保存在 `assets/masters/typography/TEYVAT_04_FG_genshin-logo-reference_v1.png`。

工程使用本机 SimSun 字体渲染，不分发字体文件。参考标识的权利归 HoYoverse。

规格：16 bpc、sRGB、24 fps、3 秒；两套标题 1480×500，品牌 600×440。渲染队列输出 16 位 Straight Alpha PNG 序列，使用 Mercury 软件渲染。`render-status.txt` 记录实际 AE 渲染结果；`render-manifest.json` 保存源帧与运行素材的 SHA-256。

## 动效与网页行为

字形从首帧起完整可读，0.25–1.9 秒扫光，0.12–1.8 秒星尘聚合，之后停在完整字形。网页使用从 AE 序列打包的透明 WebP，只播放一次，3 秒后释放为静态图。手机端按容器缩放。

减少动态效果、节省流量、低配置设备及场景动效关闭时使用静态图。切到后台、打开详情或滚动时结束片头，返回后不重复播放。图片加载失败时保留真实 HTML 标题。

## 重建

在独立 AE 实例中创建工程（不影响用户当前打开的工程）：

```powershell
& 'D:\AE\Adobe After Effects 2026\Support Files\AfterFX.exe' -m -noui -r 'D:\yuanshenvoice\_tools\build-art-type.jsx'
```

`render-mode.txt` 写入 `full` 后，在独立实例执行真正的 AE 渲染队列：

```powershell
& 'D:\AE\Adobe After Effects 2026\Support Files\AfterFX.exe' -m -noui -r 'D:\yuanshenvoice\_tools\render-art-type.jsx'
```

渲染完成后执行 `npm run prepare:art-type`、`npm run build:cloudflare` 和 `npm test`。AE PNG 母版保留在 `frames/`，网页运行图保存在 `assets/typography/`。

## 本次线上版本

发布地址：https://genshin.yzzwnw.asia/ 。部署：https://9032eaee.genshin-voice-archive.pages.dev 。

制作期间工作区另有八音盒功能并行变更。此次发布以 `_backups/2026-10-23-art-type-v1` 的开工快照为基础，只合入品牌艺术字、两版标题和媒体生命周期；共享工作区的八音盒源码与音频原样保留。`_tools/build-art-type-release.cjs` 只修改生成的 `cloudflare-dist/app.js` 和 `styles.css`，不会覆盖工作区源码。完整构建后运行此脚本可复现此次范围，再进行发布。不要把这份特定版本的发布脚本作为后续所有功能的默认构建。

`scoped-bundle.json` 保存发布包校验和，`production-verification.json` 保存线上 SHA-256 与背景视频 Range 核验结果。工作区 28 项自动检查、发布包 15 项回归均通过，正式域名另完成桌面与手机视口、角色详情、索引路由和减少动态效果验证。手机为浏览器模拟，未在实体 iOS 设备上验证。
