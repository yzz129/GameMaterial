const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice';
const indexJsonPath = path.join(rootDir, 'nahida_voices_index.json');
const indexData = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8'));

// Also scan the MP3 ringtone folder to include them as a special filter!
const mp3Dir = path.join(rootDir, '纳西妲语音全集(分类整理)', '00_精选热门MP3(推荐手机铃声_通知铃声)');
const mp3Files = fs.readdirSync(mp3Dir).filter(f => f.endsWith('.mp3')).map((f, i) => {
    return {
        id: `mp3_${i+1}`,
        category: 'ringtone',
        catName: '精选MP3铃声',
        text: f.replace(/^\d+_\[纳西妲\]_/, '').replace(/\.mp3$/, ''),
        inGame: 'Official / Curated MP3',
        relativeWav: `纳西妲语音全集(分类整理)/00_精选热门MP3(推荐手机铃声_通知铃声)/${encodeURIComponent(f)}`,
        organizedPath: `纳西妲语音全集(分类整理)/00_精选热门MP3(推荐手机铃声_通知铃声)/${encodeURIComponent(f)}`
    };
});

// Update indexData so relativeWav points to organizedPath or properly encoded URL
for (const item of indexData) {
    if (item.organizedPath) {
        // encode URI components for paths with chinese characters
        const parts = item.organizedPath.split('/');
        item.webUrl = parts.map(p => encodeURIComponent(p)).join('/');
    } else {
        item.webUrl = item.relativeWav;
    }
}

const combinedList = [...mp3Files, ...indexData];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>原神 · 纳西妲 (Nahida / 小草神) 中文语音播放台</title>
    <style>
        :root {
            --primary: #2ea466;
            --primary-dark: #1b683f;
            --primary-light: #e8f5ec;
            --accent: #e5b045;
            --bg: #f4f8f5;
            --card-bg: #ffffff;
            --text-main: #203126;
            --text-muted: #62756a;
            --border: #dbe7df;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            background: linear-gradient(135deg, #1b613c 0%, #29995e 55%, #46bd80 100%);
            color: white;
            padding: 28px 20px 22px;
            box-shadow: 0 4px 18px rgba(27, 97, 60, 0.25);
            text-align: center;
        }
        .header-title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .header-subtitle {
            font-size: 14px;
            opacity: 0.95;
            font-weight: 400;
        }
        .container {
            max-width: 1060px;
            margin: 20px auto;
            padding: 0 20px;
            flex: 1;
            width: 100%;
        }
        .control-panel {
            background: var(--card-bg);
            border-radius: 14px;
            padding: 18px 22px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 20px;
            border: 1px solid var(--border);
        }
        .search-row {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        .search-box {
            flex: 1;
            position: relative;
        }
        .search-box input {
            width: 100%;
            padding: 11px 16px 11px 38px;
            border: 1.5px solid var(--border);
            border-radius: 22px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
            background: #fafdfb;
        }
        .search-box input:focus {
            border-color: var(--primary);
            background: #fff;
            box-shadow: 0 0 0 3px rgba(46, 164, 102, 0.15);
        }
        .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }
        .stats-badge {
            font-size: 13px;
            color: var(--text-muted);
            white-space: nowrap;
            font-weight: 500;
        }
        .filter-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .tab-btn {
            padding: 7px 15px;
            border: 1px solid var(--border);
            background: white;
            border-radius: 18px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text-main);
            transition: all 0.2s;
            user-select: none;
        }
        .tab-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        .tab-btn.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(46, 164, 102, 0.3);
        }
        .tab-btn.special-tab {
            background: #fff7e6;
            border-color: #ffd591;
            color: #d46b08;
            font-weight: 600;
        }
        .tab-btn.special-tab.active {
            background: #fa8c16;
            color: white;
            border-color: #fa8c16;
            box-shadow: 0 2px 6px rgba(250, 140, 22, 0.35);
        }
        .voice-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 95px;
        }
        .voice-card {
            background: var(--card-bg);
            border-radius: 10px;
            padding: 12px 18px;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 1px solid var(--border);
            transition: all 0.2s;
            cursor: pointer;
        }
        .voice-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 14px rgba(46, 164, 102, 0.12);
            border-color: var(--primary);
        }
        .voice-card.playing {
            border-color: var(--primary);
            background: var(--primary-light);
            box-shadow: 0 0 0 2px var(--primary);
        }
        .play-btn {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 14px;
            transition: transform 0.15s, background 0.2s;
        }
        .play-btn:hover {
            transform: scale(1.08);
            background: var(--primary-dark);
        }
        .voice-card.playing .play-btn {
            background: var(--primary-dark);
        }
        .voice-info {
            flex: 1;
            min-width: 0;
        }
        .voice-text {
            font-size: 15px;
            font-weight: 500;
            color: var(--text-main);
            margin-bottom: 4px;
            line-height: 1.45;
            word-break: break-word;
        }
        .voice-meta {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .badge {
            background: #eef5f1;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            color: var(--primary-dark);
            font-weight: 600;
        }
        .badge-ringtone {
            background: #fff7e6;
            color: #d46b08;
        }
        /* Download button on cards */
        .card-download-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            background: #f0f7f3;
            color: var(--primary-dark);
            border: 1px solid #c7e3d2;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        .card-download-btn:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
            box-shadow: 0 2px 6px rgba(46, 164, 102, 0.25);
            transform: scale(1.04);
        }
        .card-download-btn svg {
            width: 14px;
            height: 14px;
        }
        /* Bottom player bar */
        .audio-player-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 2px solid var(--primary);
            padding: 12px 24px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            z-index: 100;
        }
        .now-playing {
            flex: 1;
            max-width: 380px;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .now-playing span {
            color: var(--primary);
            font-weight: 600;
        }
        audio {
            height: 38px;
            outline: none;
            flex: 1;
            max-width: 420px;
        }
        .player-download-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 9px 18px;
            background: linear-gradient(135deg, var(--primary) 0%, #258f58 100%);
            color: white;
            border: none;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(46, 164, 102, 0.3);
            transition: all 0.2s;
        }
        .player-download-btn:hover:not(.disabled) {
            background: linear-gradient(135deg, #258f58 0%, var(--primary-dark) 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(46, 164, 102, 0.4);
        }
        .player-download-btn.disabled {
            background: #d8e2dc;
            color: #8fa397;
            cursor: not-allowed;
            box-shadow: none;
            pointer-events: none;
        }
        .player-download-btn svg {
            width: 16px;
            height: 16px;
        }
        .empty-tip {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 15px;
            background: white;
            border-radius: 10px;
            border: 1px dashed var(--border);
        }
    </style>
</head>
<body>
    <header>
        <div class="header-title">
            <span>🌿</span> 原神 · 纳西妲 (Nahida / 小草神) 官方中文语音全集
        </div>
        <div class="header-subtitle">
            布耶尔 / 智慧之神 · 1,790 条官方高品质无损原声语音 · CV: 花玲
        </div>
    </header>

    <div class="container">
        <div class="control-panel">
            <div class="search-row">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchInput" placeholder="搜索台词，如：手拉手、知识与你分享、好奇心、最初的贤者、晚安、初次见面...">
                </div>
                <div class="stats-badge" id="statsCount">加载中...</div>
            </div>
            <div class="filter-tabs">
                <button class="tab-btn active" data-filter="all">全部 (${combinedList.length})</button>
                <button class="tab-btn special-tab" data-filter="ringtone">⭐ 精选热门MP3 (${mp3Files.length})</button>
                <button class="tab-btn" data-filter="friendship">角色面板 (${indexData.filter(x=>x.category==='friendship').length})</button>
                <button class="tab-btn" data-filter="gameplay">战斗与探索 (${indexData.filter(x=>x.category==='gameplay').length})</button>
                <button class="tab-btn" data-filter="homestead">尘歌壶对话 (${indexData.filter(x=>x.category==='homestead').length})</button>
                <button class="tab-btn" data-filter="legend">传说任务 (${indexData.filter(x=>x.category==='legend').length})</button>
                <button class="tab-btn" data-filter="archon">魔神主线 (${indexData.filter(x=>x.category==='archon').length})</button>
                <button class="tab-btn" data-filter="other">活动特殊 (${indexData.filter(x=>x.category==='other').length})</button>
            </div>
        </div>

        <div class="voice-list" id="voiceList"></div>
    </div>

    <div class="audio-player-bar" id="playerBar">
        <div class="now-playing" id="nowPlaying">当前播放: <span>请在上方点击任意台词进行试听</span></div>
        <audio id="mainAudio" controls autoplay></audio>
        <a id="downloadCurrentBtn" class="player-download-btn disabled" href="#" download="" title="下载当前正在播放的音频文件">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>下载当前语音</span>
        </a>
    </div>

    <script>
        const allVoices = ${JSON.stringify(combinedList)};
        let currentFilter = 'all';
        let currentPlayingCard = null;

        const voiceList = document.getElementById('voiceList');
        const searchInput = document.getElementById('searchInput');
        const statsCount = document.getElementById('statsCount');
        const mainAudio = document.getElementById('mainAudio');
        const nowPlaying = document.getElementById('nowPlaying');
        const downloadCurrentBtn = document.getElementById('downloadCurrentBtn');

        function cleanDownloadName(text, ext) {
            const clean = (text || '纳西妲语音').replace(/[\\\\/:*?"<>|\\r\\n]/g, '_').trim().slice(0, 32);
            return \`[纳西妲]_\${clean}\${ext}\`;
        }

        function filterData() {
            const query = searchInput.value.trim().toLowerCase();
            return allVoices.filter(v => {
                if (currentFilter !== 'all' && v.category !== currentFilter) return false;
                if (!query) return true;
                return (v.text && v.text.toLowerCase().includes(query)) ||
                       (v.inGame && v.inGame.toLowerCase().includes(query));
            });
        }

        function renderList() {
            const list = filterData();
            statsCount.textContent = '共 ' + list.length + ' 条台词';
            if (list.length === 0) {
                voiceList.innerHTML = '<div class="empty-tip">未找到匹配的台词</div>';
                return;
            }

            const displayList = list.slice(0, 100);
            voiceList.innerHTML = displayList.map(v => {
                const text = v.text || '(无台词字幕或情绪拟音)';
                const badgeClass = v.category === 'ringtone' ? 'badge badge-ringtone' : 'badge';
                const audioFile = v.webUrl || v.organizedPath || v.relativeWav;
                const ext = audioFile.endsWith('.mp3') ? '.mp3' : '.wav';
                const downloadName = cleanDownloadName(text, ext);

                return \`
                    <div class="voice-card" data-file="\${audioFile}" data-text="\${encodeURIComponent(text)}" data-ext="\${ext}">
                        <button class="play-btn" title="播放 / 暂停">▶</button>
                        <div class="voice-info">
                            <div class="voice-text">\${text}</div>
                            <div class="voice-meta">
                                <span class="\${badgeClass}">\${v.catName}</span>
                                <span>\${v.inGame}</span>
                            </div>
                        </div>
                        <a class="card-download-btn" href="\${audioFile}" download="\${downloadName}" title="下载此语音文件" onclick="event.stopPropagation()">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                            <span>下载</span>
                        </a>
                    </div>
                \`;
            }).join('');

            if (list.length > 100) {
                const moreDiv = document.createElement('div');
                moreDiv.className = 'empty-tip';
                moreDiv.textContent = '已显示前 100 条。请在上方输入台词关键字进行精准检索。';
                voiceList.appendChild(moreDiv);
            }

            attachCardEvents();
        }

        function attachCardEvents() {
            document.querySelectorAll('.voice-card').forEach(card => {
                card.onclick = () => {
                    const file = card.getAttribute('data-file');
                    const text = decodeURIComponent(card.getAttribute('data-text'));
                    const ext = card.getAttribute('data-ext') || '.wav';
                    playAudio(file, text, ext, card);
                };
            });
        }

        function playAudio(file, text, ext, card) {
            if (currentPlayingCard) {
                currentPlayingCard.classList.remove('playing');
                const btn = currentPlayingCard.querySelector('.play-btn');
                if (btn) btn.textContent = '▶';
            }
            currentPlayingCard = card;
            card.classList.add('playing');
            const playBtn = card.querySelector('.play-btn');
            if (playBtn) playBtn.textContent = '⏸';

            nowPlaying.innerHTML = '正在播放: <span>' + text + '</span>';
            mainAudio.src = file;
            mainAudio.play();

            // Update bottom bar download button
            downloadCurrentBtn.classList.remove('disabled');
            downloadCurrentBtn.href = file;
            downloadCurrentBtn.download = cleanDownloadName(text, ext);
        }

        mainAudio.onended = () => {
            if (currentPlayingCard) {
                currentPlayingCard.classList.remove('playing');
                const btn = currentPlayingCard.querySelector('.play-btn');
                if (btn) btn.textContent = '▶';
            }
        };

        searchInput.addEventListener('input', renderList);

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter');
                renderList();
            };
        });

        // Initial render
        renderList();
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(rootDir, 'index.html'), html, 'utf8');
console.log("Updated index.html with download buttons successfully!");
