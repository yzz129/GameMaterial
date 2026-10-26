# 星空艺术字与 AE 渲染

文字为「每个世界，都有回响」，没有句号。手机竖屏按「每个世界，／都有回响」分成两行。图像是定制的位图艺术字，不是可安装的字体文件；网页始终保留真实 H1 文本。

`PORTAL_02_TYPE_title-source_v1.png` 是 Image Gen 生成的透明字形原稿。生成提示词、原始来源、版本、各文件 SHA-256 和运行时规格见 `PORTAL_02_FG_title_v1.manifest.json`。

`ae/PORTAL_02_TYPE_title_v1.aepx` 是可继续编辑和渲染的 AE 原生工程，包含横排与两行合成、独立字形预合成、CC Light Sweep、发光、字尖星芒和禁用的原文校对文字层。`ae/PORTAL_02_TYPE_title-rendered_v1.aepx` 保存了本次原生渲染队列的完成状态。

本次用 After Effects 26.5x89 的独立实例执行 `ae/build-title.jsx` 建立工程，再执行 `ae/render-title.jsx` 进行原生队列渲染。脚本只处理空白的独立实例。源帧在 `renders/desktop/` 和 `renders/mobile/`，各 48 帧 RGBA TIFF，4 秒、12fps；保留原始输出。扫光在 0–2.7 秒经过字面，随后稳定保持；字形始终可读，4 秒循环衔接。

网页静态图使用完整分辨率 1800×300 与 960×540。播放版本是从渲染帧生成的透明动态 WebP：4 秒、8fps、32 帧，桌面 1200×200，手机 640×360。只发布 `portal.config.json` 中指定的四个 WebP，不发布本目录的工程、原稿、元数据和 TIFF 序列。

手机竖屏使用两行版，横屏与桌面使用横排版。减少动态效果、节省流量、低性能设备、后台和标题离开视口时使用静态图；加载失败显示真实标题。以后修改标题时，只有 `titleArt.text` 与 `heading` 一致才显示对应艺术字。
