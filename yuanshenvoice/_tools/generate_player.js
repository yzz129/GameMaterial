const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice';

function generateHtml() {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>原神 - 纳西妲 (Nahida) 语音台词播放器</title>
    <style>
        :root {
            --primary: #2ea466;
            --primary-dark: #1b683f;
            --primary-light: #e8f5ec;
            --accent: #e5b045;
            --bg: #f5f9f6;
            --card-bg: #ffffff;
            --text-main: #233129;
            --text-muted: #6b7c72;
            --border: #e0e9e3;
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
            background: linear-gradient(135deg, #1f6b43 0%, #2ea466 60%, #44bf7e 100%);
            color: white;
            padding: 30px 20px 25px;
            box-shadow: 0 4px 15px rgba(35, 110, 68, 0.2);
            text-align: center;
            position: relative;
        }
        .header-title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .header-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }
        .container {
            max-width: 1000px;
            margin: 20px auto;
            padding: 0 20px;
            flex: 1;
            width: 100%;
        }
        .control-panel {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
            margin-bottom: 20px;
            border: 1px solid var(--border);
        }
        .search-box {
            flex: 1;
            min-width: 240px;
            position: relative;
        }
        .search-box input {
            width: 100%;
            padding: 10px 14px 10px 36px;
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .search-box input:focus {
            border-color: var(--primary);
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }
        .filter-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .tab-btn {
            padding: 8px 16px;
            border: 1px solid var(--border);
            background: white;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text-main);
            transition: all 0.2s;
        }
        .tab-btn.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
            font-weight: 600;
        }
        .stats-badge {
            font-size: 13px;
            color: var(--text-muted);
            margin-left: auto;
        }
        .voice-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 80px;
        }
        .voice-card {
            background: var(--card-bg);
            border-radius: 10px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 1px solid var(--border);
            transition: all 0.2s;
            cursor: pointer;
        }
        .voice-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(46, 164, 102, 0.12);
            border-color: var(--primary);
        }
        .voice-card.playing {
            border-color: var(--primary);
            background: var(--primary-light);
        }
        .play-btn {
            width: 40px;
            height: 40px;
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
            transform: scale(1.05);
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
            line-height: 1.4;
            word-break: break-word;
        }
        .voice-meta {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        .badge {
            background: #eef3f0;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            color: var(--primary-dark);
        }
        .audio-player-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 2px solid var(--primary);
            padding: 12px 20px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            z-index: 100;
        }
        .now-playing {
            flex: 1;
            max-width: 400px;
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
            max-width: 500px;
        }
        .empty-tip {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 15px;
        }
    </style>
</head>
<body>
    <header>
        <div class="header-title">
            <span>🌿</span> 原神 · 纳西妲 (Nahida) 全语音台词集
        </div>
        <div class="header-subtitle">
            布耶尔 / 小草神 / 须弥草之神 · 中文全量语音离线收录 (CV: 花玲)
        </div>
    </header>

    <div class="container">
        <div class="control-panel">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input type="text" id="searchInput" placeholder="搜索台词关键字，如：手拉手、知识、贤者、眨眼...">
            </div>
            <div class="filter-tabs">
                <button class="tab-btn active" data-filter="all">全部语音</button>
                <button class="tab-btn" data-filter="avatar">角色与战斗</button>
                <button class="tab-btn" data-filter="story">剧情对话</button>
            </div>
            <div class="stats-badge" id="statsCount">加载中...</div>
        </div>

        <div class="voice-list" id="voiceList"></div>
    </div>

    <div class="audio-player-bar" id="playerBar">
        <div class="now-playing" id="nowPlaying">当前播放: <span>未选择</span></div>
        <audio id="mainAudio" controls autoplay></audio>
    </div>

    <script>
        let allVoices = [];
        let currentFilter = 'all';
        let currentPlayingCard = null;

        const voiceList = document.getElementById('voiceList');
        const searchInput = document.getElementById('searchInput');
        const statsCount = document.getElementById('statsCount');
        const mainAudio = document.getElementById('mainAudio');
        const nowPlaying = document.getElementById('nowPlaying');

        fetch('nahida_voices_index.json')
            .then(res => res.json())
            .then(data => {
                allVoices = data;
                renderList();
            })
            .catch(err => {
                voiceList.innerHTML = '<div class="empty-tip">加载数据失败，请确认 nahida_voices_index.json 文件存在。</div>';
            });

        function filterData() {
            const query = searchInput.value.trim().toLowerCase();
            return allVoices.filter(v => {
                if (currentFilter === 'avatar' && !v.isAvatar) return false;
                if (currentFilter === 'story' && v.isAvatar) return false;
                if (!query) return true;
                return (v.text && v.text.toLowerCase().includes(query)) ||
                       (v.inGamePath && v.inGamePath.toLowerCase().includes(query));
            });
        }

        function renderList() {
            const list = filterData();
            statsCount.textContent = '共找到 ' + list.length + ' 条语音';
            if (list.length === 0) {
                voiceList.innerHTML = '<div class="empty-tip">未找到匹配的语音台词</div>';
                return;
            }

            // Render top 150 items to keep DOM super snappy
            const displayList = list.slice(0, 150);
            voiceList.innerHTML = displayList.map(v => {
                const text = v.text || '(无台词字幕或情绪拟音)';
                return \`
                    <div class="voice-card" data-file="raw/\${v.file}" data-text="\${encodeURIComponent(text)}">
                        <button class="play-btn">▶</button>
                        <div class="voice-info">
                            <div class="voice-text">\${text}</div>
                            <div class="voice-meta">
                                <span class="badge">\${v.isAvatar ? '角色动作/战斗' : '剧情名场面'}</span>
                                <span>\${v.file}</span>
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');

            if (list.length > 150) {
                const moreDiv = document.createElement('div');
                moreDiv.className = 'empty-tip';
                moreDiv.textContent = '已显示前 150 条结果。可通过上方搜索框精准搜索台词。';
                voiceList.appendChild(moreDiv);
            }

            attachCardEvents();
        }

        function attachCardEvents() {
            document.querySelectorAll('.voice-card').forEach(card => {
                card.onclick = () => {
                    const file = card.getAttribute('data-file');
                    const text = decodeURIComponent(card.getAttribute('data-text'));
                    playAudio(file, text, card);
                };
            });
        }

        function playAudio(file, text, card) {
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
    </script>
</body>
</html>`;
    fs.writeFileSync(path.join(rootDir, 'index.html'), html, 'utf8');
    console.log("Generated index.html successfully!");
}

generateHtml();
