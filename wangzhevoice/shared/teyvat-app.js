'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="assets/icons/ui.svg#${name}"></use></svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normal = value => String(value).normalize('NFKC').toLowerCase().trim();
  const celestialFxMarkup = cls => `<span class="celestial-fx ${cls || ''}" aria-hidden="true"><i class="celestial-ring celestial-ring-a"></i><i class="celestial-ring celestial-ring-b"></i><b class="celestial-star celestial-star-a">✦</b><b class="celestial-star celestial-star-b">✧</b><b class="celestial-star celestial-star-c">✦</b><b class="celestial-star celestial-star-d">✧</b></span>`;
  const celestialStyle = c => c.artEdition ? `--celestial-color:${c.artAccent};--celestial-secondary:${c.artAccentSecondary};` : '';
  const elementIds = { '风': 'anemo', '岩': 'geo', '雷': 'electro', '草': 'dendro', '水': 'hydro', '火': 'pyro', '冰': 'cryo' };
  const elementColors = { '风': '#447f755c', '岩': '#99724150', '雷': '#75619657', '草': '#5a815c57', '水': '#437f9b52', '火': '#9a5d4952', '冰': '#68949c50' };
  const emblem = el => elementIds[el] ? `<img src="assets/elements/${elementIds[el]}.webp" alt="" width="18" height="18">` : icon('compass');
  const oldIndexRoute = /\/nahida_player(?:\.html)?\/?$/.test(location.pathname);
  const isLegacyIndex = oldIndexRoute && new URLSearchParams(location.search).get('legacy') === '1';
  const isVoiceIndex = /\/voice_index(?:\.html)?\/?$/.test(location.pathname) || (oldIndexRoute && !isLegacyIndex);
  const isIndex = isLegacyIndex || isVoiceIndex;
  let indexLoading=isVoiceIndex, indexLoadFailed=false;
  let favorites = new Set();
  try { const saved = JSON.parse(localStorage.getItem('genshin_fav_quotes_v2') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(v => typeof v === 'string')); } catch {}
  const state = { region: 'all', element: 'all', rarity: 'all', weapon: 'all', search: '', favOnly: false, page: 1, sort: 'recommended', category: 'all' };
  let catalog = [], filtered = [], indexVoices = [], indexCharacter = null, activeCharacter, daily, lastFocus, quoteTab = 'friend', quoteQuery = '', quoteLimit = 20, modalToken = 0, currentQuotes = [], searchIds = null, searchPending = false, searchFailed = false, searchVersion = 0, worker, workerFailed = false;
  const detailsCache = new Map();
  let fallbackSearchIndex, cancelWorkerSearch;
  const preferred = ['派蒙', '纳西妲', '芙宁娜', '雷电将军', '钟离', '温迪', '胡桃', '枫原万叶', '那维莱特', '神里绫华', '魈', '妮露', '八重神子'];
  const pageSize = isIndex ? 36 : 24;
  $('app').innerHTML = `
    <a class="skip-link" href="#characters">跳到角色图鉴</a>
    <header class="site-header"><div class="header-inner">
      <a class="brand" href="index.html" aria-label="原神语录秘典首页"><img class="brand-logo" src="assets/typography/TEYVAT_04_FX_brand-gold_v1.webp" width="480" height="368" alt="" aria-hidden="true"><span class="brand-wordmark"><strong>语录秘典</strong><small>TEYVAT VOICE ARCHIVE</small></span></a>
      <nav class="primary-nav" aria-label="主导航"><a class="nav-link ${isIndex ? '' : 'active'}" href="${isIndex ? 'index.html#characters' : '#characters'}" id="charactersNav">角色图鉴</a><button class="nav-link" id="favoritesNav" aria-pressed="false">我的珍藏 <span class="nav-count" id="favCounter">0</span></button><a class="nav-link archive-nav ${isIndex ? 'active' : ''}" id="voiceIndexNav" href="voice_index.html" title="全角色语音索引 · 每 5 秒邂逅一位旅伴"><span id="voiceIndexNavLabel">全角色语音索引</span> ${icon('arrow-up-right')}</a></nav>
      <div class="header-actions"><div class="music-pill" id="musicBoxPill" role="region" aria-label="提瓦特留声八音盒"><button class="music-disc-btn" id="musicPillDisc" title="打开留声八音盒" aria-label="打开留声八音盒"><span class="music-disc-spin" id="musicPillDiscSpin" aria-hidden="true"><img id="musicPillCover" src="assets/audio/music/covers/cover_mondstadt.webp" alt="" width="26" height="26"></span><span class="music-wave-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button><div class="music-pill-meta" id="musicPillOpen" role="button" tabindex="0" title="打开留声八音盒"><span class="music-pill-title" id="musicPillTitle">晨曦酒庄</span><span class="music-pill-region" id="musicPillRegion">蒙德 · 无损原声</span></div><div class="music-pill-actions"><button class="music-pill-action" id="musicPrevBtn" title="上一首" aria-label="上一首">${icon('caret-left')}</button><button class="music-pill-action music-play-toggle" id="musicPlayBtn" title="播放/暂停" aria-label="播放或暂停">${icon('play')}</button><button class="music-pill-action" id="musicNextBtn" title="下一首" aria-label="下一首">${icon('caret-right')}</button></div></div><button class="icon-button effects-toggle" id="effectsToggle" aria-label="关闭星尘与点击动效" aria-pressed="true" title="关闭星尘与点击动效">${icon('star')}</button><button class="icon-button theme-toggle" id="themeToggle" aria-label="切换明暗主题"></button></div>
    </div></header>
    <main class="page-shell ${isIndex ? 'nahida-page' : ''}" id="mainContent">
      <section class="hero" aria-labelledby="heroTitle"><picture class="hero-scenery" aria-hidden="true"><source media="(orientation:portrait)" srcset="assets/video/TEYVAT_03_BG_windrise-mobile_poster_v1.webp"><img src="assets/video/TEYVAT_03_BG_windrise-pc_poster_v1.webp" alt="" width="1920" height="1080" fetchpriority="high"></picture><div class="hero-shade"></div><div class="hero-stardust" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="hero-astrolabe" aria-hidden="true"><span></span>${icon('compass')}</div>${celestialFxMarkup('hero-celestial-fx')}
        <button class="hero-float-arrow hero-float-prev" id="heroFloatPrev" aria-label="上一位旅伴" title="切换至上一位旅伴">${icon('caret-left')}</button>
        <button class="hero-float-arrow hero-float-next" id="heroFloatNext" aria-label="下一位旅伴" title="切换至下一位旅伴">${icon('caret-right')}</button>
        <div class="hero-copy"><div class="hero-eyebrow" id="heroEyebrow"><span class="hero-eyebrow-diamond" aria-hidden="true"></span><span class="hero-eyebrow-text" id="heroEyebrowText">${isLegacyIndex ? '智慧之主 · 白草净华' : '其他/异邦 · 最好的伙伴'}</span></div><h1 id="heroTitle" class="hero-art-title"><span class="hero-title-text">${isLegacyIndex ? '把须弥的故事<br>说给你听' : '循着星光<br>重逢熟悉的声音'}</span><img id="heroTitleArt" class="hero-title-art" src="assets/typography/TEYVAT_04_FX_title-${isLegacyIndex ? 'nahida' : 'main'}-still_v1.webp" data-intro="assets/typography/TEYVAT_04_FX_title-${isLegacyIndex ? 'nahida' : 'main'}-intro_v1.webp" alt="" aria-hidden="true" width="1480" height="500" decoding="async" fetchpriority="high"></h1><p class="hero-description" id="heroDescription">${isLegacyIndex ? '纳西妲的对白、故事与旅途片段<br>都在这里慢慢重温' : '97 位旅伴 · 7,342 条台词<br class="mobile-break">将旅途的回响 · 收进你的星辉典藏'}</p><div class="hero-actions"><a class="button button-gold" href="#characters"><span class="btn-holo-spark" aria-hidden="true">✦</span>${isIndex ? '浏览语音索引' : '探索角色'} ${icon('arrow-right')}</a><button class="button button-quiet" id="randomCharacter" title="随机邂逅一位旅伴">${icon(isIndex ? 'book-open' : 'shuffle')}${isVoiceIndex ? '查看角色图鉴' : isLegacyIndex ? '查看纳西妲图鉴' : '换一位旅伴'}</button><button class="button button-quiet hero-listen-btn" id="heroListenBtn" title="聆听当前展示旅伴原声">${icon('play')}聆听原声</button></div></div>
        <img class="hero-character" id="heroCharacterImg" src="${isLegacyIndex ? 'assets/characters/10000073-full.webp' : 'assets/characters/TEYVAT_05_CHAR_paimon-celestial-full_v1.webp'}" alt="${isLegacyIndex ? '纳西妲角色立绘' : '派蒙角色立绘'}" width="${isLegacyIndex ? '1284' : '900'}" height="${isLegacyIndex ? '1019' : '1200'}" fetchpriority="high" role="button" tabindex="0" title="点击查看${isLegacyIndex ? '纳西妲' : '派蒙'}全部台词与原声"><div class="hero-character-caption" id="heroCharCaption"><div class="hero-caption-meta" title="点击查看该角色全部台词"><span class="hero-char-title" id="heroCharTitle">${isLegacyIndex ? '白草净华' : '最好的伙伴'}</span><strong class="hero-char-name" id="heroCharName">${isLegacyIndex ? '纳西妲' : '派蒙'}</strong><i class="hero-caption-divider"></i><span class="hero-char-en" id="heroCharEn">${isLegacyIndex ? 'NAHIDA' : 'PAIMON'}</span></div><div class="hero-switcher-dock" id="heroSwitcherDock"><button class="hero-dock-btn" id="heroPrevChar" aria-label="上一位旅伴" title="上一位旅伴">${icon('caret-left')}</button><div class="hero-dock-select-wrap" title="切换展示角色"><span class="hero-dock-label" id="heroDockLabel">${isLegacyIndex ? '纳西妲' : '派蒙'}</span><select class="hero-dock-select" id="heroCharSelect" aria-label="选择提瓦特旅伴"></select>${icon('caret-down')}</div><button class="hero-dock-btn" id="heroNextChar" aria-label="下一位旅伴" title="下一位旅伴">${icon('caret-right')}</button><button class="hero-dock-btn hero-dock-random" id="heroRandomBtn" aria-label="随机邂逅旅伴" title="随机邂逅旅伴">${icon('shuffle')}</button></div></div>
      </section>
      <section class="daily-quote" aria-label="今日留声"><span class="daily-label">${icon('headphones')}今日留声</span><button class="daily-content" id="dailyOpen"><span id="dailyQuote">「初次见面，我已经关注你很久了」</span><span class="daily-author" id="dailyAuthor">纳西妲 · 初次见面</span></button><div class="daily-actions"><button class="icon-button" id="dailyRead" aria-label="播放台词原声" title="播放角色官方原声">${icon('play')}</button><button class="icon-button" id="dailyDownloadBtn" aria-label="下载这句原声" title="下载这句原声音频">${icon('download-simple')}</button><button class="icon-button muted" id="dailyShuffle" aria-label="换一句台词" title="换一句台词">${icon('arrows-clockwise')}</button></div></section>
      <section class="archive-section" id="characters" aria-labelledby="archiveTitle"><div class="archive-heading"><div><h2 id="archiveTitle"><span id="archiveHeadingText">${isVoiceIndex ? '全角色 · 声音档案' : isLegacyIndex ? '纳西妲 · 声音档案' : '旅伴图鉴'}</span> <span class="heading-count" id="resultCount">${isLegacyIndex ? '1,814' : isVoiceIndex ? '…' : '97'}</span></h2><p id="resultDescription">${isIndex ? '故事里没有说完的话，留在这里' : '每一位旅伴，都有值得记住的故事'}</p></div><span class="archive-heading-mark" aria-hidden="true">${isIndex ? 'VOICE ARCHIVE' : 'CHARACTERS'}</span></div>
        ${isLegacyIndex ? '<p class="index-notice">收录 1,790 条语音索引与 24 条铃声索引，当前目录没有对应音频文件，可使用浏览器朗读台词，或在角色详情下载原声包</p>' : ''}
        <div class="archive-controls"><div class="search-toolbar"><div class="search-field">${icon('magnifying-glass')}<label class="sr-only" for="masterSearchInput">${isVoiceIndex ? '搜索当前角色台词' : isLegacyIndex ? '搜索纳西妲台词' : '搜索角色、声优或台词'}</label><input id="masterSearchInput" type="search" autocomplete="off" enterkeyhint="search" placeholder="${isVoiceIndex ? '搜索当前角色的台词、故事或战斗语音…' : isLegacyIndex ? '搜索一句纳西妲的台词或故事…' : '搜索角色、声优，或一句熟悉的台词…'}"><kbd aria-hidden="true">/</kbd><button class="icon-button search-clear" id="clearSearch" aria-label="清空搜索" hidden>${icon('x')}</button></div><button class="button filter-toggle" id="filterToggle" aria-expanded="false" aria-controls="advancedFilters">${icon('sliders-horizontal')}<span>筛选</span><b id="filterCount" hidden>0</b></button><label class="sort-field"><span class="sr-only">角色排序</span><select id="sortSelect"><option value="recommended">推荐顺序</option><option value="name">角色名称</option><option value="quotes">台词数量</option><option value="rarity">星级优先</option></select>${icon('caret-down')}</label></div>
          <div class="realm-nav" id="realmsNavContainer" role="group" aria-label="${isIndex ? '语音分类' : '按地区筛选'}"></div><div class="element-toolbar" ${isIndex ? 'hidden' : ''}><div class="element-group" id="elementGroup" role="group" aria-label="按元素筛选"></div><button class="reset-button" id="resetFilters" hidden>${icon('arrow-counter-clockwise')}重置</button></div>
          <div class="advanced-filters" id="advancedFilters" hidden><label ${isIndex ? 'hidden' : ''}>星级<select id="raritySelect"><option value="all">全部星级</option><option value="5">五星角色</option><option value="4">四星角色</option></select></label><label ${isIndex ? 'hidden' : ''}>武器<select id="weaponSelect"><option value="all">全部武器</option><option>单手剑</option><option>双手剑</option><option>长柄武器</option><option>法器</option><option>弓</option></select></label><button class="button favorites-filter" id="favFilterBtn" aria-pressed="false">${icon('heart')}仅看已珍藏${isIndex ? '台词' : '角色'}</button></div>
        </div><div class="results-meta" id="resultsMeta" role="status" aria-live="polite">正在整理图鉴…</div><div class="${isIndex ? 'voice-index-list' : 'character-grid'}" id="charConstellationGrid" aria-label="${isIndex ? '台词列表' : '角色列表'}" aria-busy="true"><div class="loading-state">正在打开图鉴…</div></div><nav class="pagination" id="pagination" aria-label="列表分页"></nav>
      </section><footer class="site-footer"><span>愿此行，终抵群星</span><p>原神同人语录档案 · 游戏与角色素材版权归 HoYoverse 所有</p></footer>
    </main>
    <dialog class="character-dialog" id="characterDialog" aria-labelledby="modalHeroName"><button class="icon-button dialog-close" id="modalExitCross" aria-label="关闭角色详情">${icon('x')}</button><div class="detail-layout" id="detailLayout"></div><div id="detailPlayerSlot"></div></dialog>
    <dialog class="music-box-dialog" id="musicBoxDialog" aria-labelledby="musicBoxTitle">
      <div class="music-prism" aria-hidden="true"><i></i><i></i></div>
      <div class="music-box-container">
        <header class="music-box-header">
          <div class="music-box-badge"><span class="music-badge-spark" aria-hidden="true">✦</span><h2 id="musicBoxTitle">提瓦特 · 留声八音盒</h2><span class="music-badge-tag">HOYO-MiX 原声大典</span></div>
          <button class="icon-button dialog-close" id="musicBoxClose" aria-label="关闭音乐盒">${icon('x')}</button>
        </header>
        <div class="music-box-body">
          <section class="music-now-playing" aria-label="当前播放">
            <div class="music-turntable-stage">
              <div class="music-vinyl-wrap" id="musicVinylWrap">
                <span class="music-orbit music-orbit-outer" aria-hidden="true"></span><span class="music-orbit music-orbit-inner" aria-hidden="true"></span><span class="music-disc-prism" aria-hidden="true"></span>
                <div class="music-vinyl-grooves"><div class="music-vinyl-cover-wrap"><img id="musicBoxCover" src="assets/audio/music/covers/cover_mondstadt.webp" alt="专辑封面" class="music-vinyl-cover"><div class="music-vinyl-center-pin"></div></div></div>
                <span class="music-tonearm" aria-hidden="true"></span>
              </div>
              <div class="music-current-info">
                <div class="music-info-tags"><span class="music-region-pill" id="musicBoxRegion">蒙德</span><span class="music-quality-pill" id="musicBoxQuality">24-bit / 48kHz FLAC 无损母带</span></div>
                <h3 class="music-track-title" id="musicBoxTrackTitle">晨曦酒庄 Dawn Winery Theme</h3>
                <p class="music-track-album" id="musicBoxAlbum">《风与牧歌之城 City of Winds and Idylls》 · 陈致逸 / HOYO-MiX</p>
                <p class="music-track-desc" id="musicBoxDesc">晨曦初破，微风轻拂过千风原野与晨曦酒庄的葡萄藤架</p>
              </div>
            </div>
            <div class="music-controls-panel">
              <div class="music-progress-wrap"><span class="music-time" id="musicCurTime">00:00</span><div class="music-progress-bar-container" id="musicProgressContainer"><input type="range" class="music-seek-bar" id="musicSeekBar" min="0" max="100" value="0" step="0.1" aria-label="曲目进度调节"><div class="music-progress-fill" id="musicProgressFill"></div></div><span class="music-time" id="musicTotalTime">01:07</span></div>
              <div class="music-control-buttons">
                <button class="music-ctrl-btn music-loop-btn" id="musicLoopModeBtn" title="切换循环模式" aria-label="切换循环模式">${icon('repeat')}<span class="music-mode-text" id="musicModeText">列表循环</span></button>
                <button class="music-ctrl-btn music-skip-btn" id="musicModalPrev" title="上一首" aria-label="上一首">${icon('skip-back')}</button>
                <button class="music-ctrl-btn music-main-play" id="musicModalPlay" title="播放或暂停" aria-label="播放或暂停">${icon('play')}</button>
                <button class="music-ctrl-btn music-skip-btn" id="musicModalNext" title="下一首" aria-label="下一首">${icon('skip-forward')}</button>
                <div class="music-volume-group"><button class="music-ctrl-btn music-mute-btn" id="musicMuteBtn" title="静音切换" aria-label="静音切换">${icon('speaker-high')}</button><input type="range" class="music-vol-slider" id="musicVolSlider" min="0" max="100" value="65" aria-label="八音盒音量调节"></div>
              </div>
              <div class="music-playback-footer">
                <div class="music-playback-state" role="status" aria-live="polite"><span class="music-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span id="musicAutoplayState">留声机已静候等待</span></div>
                <button type="button" class="music-download-btn" id="musicDownloadBtn" disabled aria-label="下载当前曲目原声">${icon('download-simple')}<span id="musicDownloadLabel">下载原声</span><span class="music-download-format" id="musicDownloadFormat"></span></button>
              </div>
            </div>
          </section>
          <section class="music-playlist-section" aria-label="原声曲库">
            <div class="music-playlist-heading">
              <div class="music-playlist-title-wrap"><h4>原声音轨大典 <span id="musicTotalCountBadge">正在连接曲库…</span></h4><button class="text-button" id="musicCatalogRetry" hidden>重试连接曲库</button><span class="music-library-mark" aria-hidden="true">✧</span></div>
              <div class="music-search-box"><span class="music-search-icon">${icon('magnifying-glass')}</span><input type="search" class="music-search-input" id="musicSearchInput" placeholder="搜索曲名、角色、地区…" aria-label="全曲库极速搜索"></div>
              <div class="music-filter-tabs" id="musicFilterTabs" role="group" aria-label="曲库分类"><button class="music-tab-btn active" data-tab="all" aria-pressed="true">全部 (1105)</button><button class="music-tab-btn" data-tab="local" aria-pressed="false">精选母带 (16)</button><button class="music-tab-btn" data-tab="character" aria-pressed="false">角色主题 (90)</button><button class="music-tab-btn" data-tab="mondstadt" aria-pressed="false">蒙德</button><button class="music-tab-btn" data-tab="liyue" aria-pressed="false">璃月</button><button class="music-tab-btn" data-tab="inazuma" aria-pressed="false">稻妻</button><button class="music-tab-btn" data-tab="sumeru" aria-pressed="false">须弥</button><button class="music-tab-btn" data-tab="fontaine" aria-pressed="false">枫丹</button><button class="music-tab-btn" data-tab="special" aria-pressed="false">珍珠之歌</button></div>
            </div>
            <div class="music-track-list" id="musicTrackList" role="group" aria-label="可选曲目"></div>
            <div class="music-library-footer"><span id="musicResultCount" role="status" aria-live="polite"></span><span>随旋律，漫游提瓦特 <span aria-hidden="true">✦</span></span></div>
          </section>
        </div>
      </div>
    </dialog>
    <section class="audio-player" id="audioPlayer" aria-label="台词播放器" hidden><div class="player-track"><img id="dockAvatar" width="44" height="44" alt=""><div class="player-track-text"><strong id="dockTitle">选择一句台词</strong><span id="dockSnippet">浏览器朗读</span></div></div><div class="player-controls"><button class="icon-button" id="prevQuoteBtn" aria-label="上一条台词">${icon('skip-back')}</button><button class="icon-button player-play" id="masterPlayToggleBtn" aria-label="暂停朗读">${icon('pause')}</button><button class="icon-button" id="nextQuoteBtn" aria-label="下一条台词">${icon('skip-forward')}</button></div><div class="player-timeline"><span id="curTimeText">00:00</span><input id="progressRange" type="range" min="0" max="100" step="0.1" value="0" aria-label="播放进度" disabled><span id="totalTimeText">--:--</span></div><div class="player-extras"><span class="playback-mode" id="playbackMode">浏览器朗读</span><button class="icon-button" id="dockDownloadBtn" aria-label="下载当前播放的原声" title="下载当前播放的原声">${icon('download-simple')}</button><button class="icon-button" id="volMuteBtn" aria-label="静音">${icon('speaker-high')}</button><input id="volSlider" class="volume-range" type="range" min="0" max="1" step="0.05" value="1" aria-label="音量"><button class="icon-button" id="closePlayer" aria-label="关闭播放器">${icon('x')}</button></div><audio id="masterAudio" preload="none"></audio></section>
    <div class="toast" id="celestialToast" role="status" aria-live="polite"></div>`;

  let toastTimer;
  function toast(text) {
    const box = $('celestialToast');
    if ($('characterDialog').open) $('characterDialog').append(box); else document.body.append(box);
    const clean = String(text || '')
      .replace(/^[✨✦★⭐\s]+/, '')
      .replace(/[。！!，,\s]+$/g, '')
      .replace(/，/g, ' · ')
      .replace(/,/g, ' · ');
    box.innerHTML = `<span class="toast-spark" aria-hidden="true">✦</span><span class="toast-text">${clean}</span>`;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3500);
  }
  function saveFavorites() { try { localStorage.setItem('genshin_fav_quotes_v2', JSON.stringify([...favorites])); } catch { toast('当前浏览器无法保存珍藏，关闭页面后可能丢失'); } $('favCounter').textContent = favorites.size; }
  function updateTheme() { const light = document.documentElement.dataset.theme === 'light'; $('themeToggle').innerHTML = icon(light ? 'moon' : 'sun'); $('themeToggle').setAttribute('aria-label', `切换为${light ? '深' : '浅'}色模式`); }
  $('themeToggle').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; try { localStorage.setItem('teyvat_theme', document.documentElement.dataset.theme); } catch {} updateTheme(); };
  saveFavorites(); updateTheme();
  const realms = [['all', '提瓦特全境', '提瓦特全境'], ['蒙德', '蒙德', '自由之风 · 蒙德'], ['璃月', '璃月', '黄金契约 · 璃月'], ['稻妻', '稻妻', '鸣神永恒 · 稻妻'], ['须弥', '须弥', '虚空智慧 · 须弥'], ['枫丹', '枫丹', '律法裁决 · 枫丹'], ['纳塔', '纳塔', '圣火还魂 · 纳塔'], ['至冬', '至冬', '凛冬雪国 · 至冬'], ['其他/异邦', '异邦', '星海旅者 · 异邦']];
  const categories = [['all','全部台词'],['friendship','角色好感'],['gameplay','战斗探索'],['archon','魔神主线'],['legend','传说任务'],['homestead','尘歌壶'],['other','活动语音'],['ringtone','精选铃声']];
  $('realmsNavContainer').innerHTML = (isIndex ? (isVoiceIndex ? categories.slice(0,3) : categories).map(([id,label]) => `<button class="realm-button" data-category="${id}" aria-pressed="${id === 'all'}">${label}</button>`) : realms.map(([id, short, long]) => `<button class="realm-button" data-region="${id}" aria-label="${long}" aria-pressed="${id === 'all'}">${id === 'all' ? icon('globe-hemisphere-west') : ''}<span class="realm-short">${short}</span><span class="realm-long">${long}</span></button>`)).join('');
  $('elementGroup').innerHTML = `<button class="element-button" data-element="all" aria-pressed="true">全部元素</button>` + Object.keys(elementIds).map(el => `<button class="element-button" data-element="${el}" aria-pressed="false" aria-label="${el}元素">${emblem(el)}${el}</button>`).join('');
  if (isIndex) $('sortSelect').parentElement.hidden = true;
  $('filterToggle').setAttribute('aria-label', isIndex ? '筛选台词' : '筛选角色');
  const cardMotion = createCardMotion($('charConstellationGrid'));
  const atmosphere = createAtmosphere();
  const projectionMotion = createProjectionMotion($('characterDialog'));
  const celestialMotion = createCelestialMotion();
  document.querySelector('.hero').addEventListener('animationend',event=>{
    if(event.animationName==='chapter-arrival')event.target.classList.add('has-arrived');
  },{passive:true});

  // One decoder, with separate reviewed landscape/portrait sources.
  // The matching first frame remains available while media loads or is disabled.
  function createAtmosphere() {
    const scene = document.createElement('div'), video = document.createElement('video');
    scene.className = 'world-scene'; scene.setAttribute('aria-hidden','true');
    video.className = 'world-video'; video.muted = true; video.defaultMuted = true;
    video.loop = true; video.playsInline = true; video.preload = 'none';
    video.setAttribute('muted',''); video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline',''); video.setAttribute('aria-hidden','true');
    video.disablePictureInPicture = true; video.tabIndex = -1;
    scene.append(video); document.body.prepend(scene);
    const canvas = document.createElement('canvas');
    canvas.className = 'ambient-particles'; canvas.setAttribute('aria-hidden','true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d', { alpha:true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const compact = matchMedia('(max-width:767px), (pointer:coarse)');
    const portrait = matchMedia('(orientation:portrait)');
    const scenes = {
      pc: { src:'assets/video/TEYVAT_03_VID_windrise-pc_jimeng-2k_v1.mp4', poster:'assets/video/TEYVAT_03_BG_windrise-pc_poster_v1.webp' },
      mobile: { src:'assets/video/TEYVAT_03_VID_windrise-mobile_jimeng-2k_v1.mp4', poster:'assets/video/TEYVAT_03_BG_windrise-mobile_poster_v1.webp' }
    };
    const lifecycle = new AbortController(), options = { passive:true, signal:lifecycle.signal };
    const title = $('heroTitle'), titleArt = $('heroTitleArt');
    const titleStill = titleArt.getAttribute('src'), titleIntro = titleArt.dataset.intro;
    let titleAttempted = false, titleTimer = 0;
    const points = new Float32Array(36*7), toggle = $('effectsToggle');
    const flashes = Array.from({length:4},() => {
      const clip = document.createElement('span'), ring = document.createElement('i');
      clip.className = 'control-flare'; clip.setAttribute('aria-hidden','true');
      ring.className = 'press-ring'; clip.append(ring);
      return {clip,ring,animation:null};
    });
    let preferred = true, suspended = false, scrolling = false, width = 0, height = 0;
    let count = 0, interval = 50, linkLimit = 7, timer = 0, frame = 0, scrollTimer = 0, last = 0, cursor = 0;
    let cyan = '#a7dce8', gold = '#f1d6a0', playPending = false, videoFailed = false;
    let autoplayBlocked = false, sceneReady = document.readyState === 'complete';
    let selectedScene = '', switchingVideo = false, playbackEpoch = 0;
    const pressDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--press-duration')) || 440;
    try { preferred = localStorage.getItem('teyvat_atmosphere') !== 'off'; } catch {}
    const effectsAllowed = () => !reduced.matches && !navigator.connection?.saveData;
    const modalOpen = () => $('characterDialog').open || $('musicBoxDialog').open;
    const mayRun = () => preferred && effectsAllowed() && !suspended && !scrolling && !document.hidden && !modalOpen();
    const lowPower = () => (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    // The AE render is a one-shot transparent image, with no second video decoder.
    // Keep real heading text available when images fail or motion is disabled.
    function settleTitle() {
      clearTimeout(titleTimer); titleTimer = 0;
      title.dataset.motion = 'settled';
      if (titleArt.getAttribute('src') !== titleStill) titleArt.src = titleStill;
    }
    function syncTitle(active) {
      if (!active || suspended || document.hidden || scrolling || modalOpen()) {
        if (titleAttempted) settleTitle();
        return;
      }
      if (!sceneReady || lowPower() || titleAttempted) return;
      titleAttempted = true; title.dataset.motion = 'loading'; titleArt.src = titleIntro;
    }
    titleArt.addEventListener('load', () => {
      title.classList.add('has-art');
      if (titleArt.getAttribute('src') === titleIntro) {
        title.dataset.motion = 'playing';
        clearTimeout(titleTimer); titleTimer = setTimeout(settleTitle, 3000);
      }
    }, options);
    titleArt.addEventListener('error', () => {
      if (titleArt.getAttribute('src') !== titleStill) settleTitle();
      else { title.classList.remove('has-art'); title.dataset.motion = 'fallback'; }
    }, options);
    if (titleArt.complete && titleArt.naturalWidth) title.classList.add('has-art');
    const videoLowMemory = () => navigator.deviceMemory && navigator.deviceMemory <= 1;
    const mayPlayVideo = () => sceneReady && mayRun() && !videoLowMemory() && !videoFailed && !autoplayBlocked && !/^(slow-)?2g$/.test(navigator.connection?.effectiveType || '');
    const mayDraw = () => !!ctx && mayRun() && video.paused;
    function clearVideo() {
      if (!video.getAttribute('src')) return;
      switchingVideo = true; playbackEpoch++; playPending = false;
      video.pause(); video.removeAttribute('src'); video.load();
      scene.classList.remove('is-ready'); switchingVideo = false;
    }
    function syncVideo() {
      if (switchingVideo) return;
      const channel = portrait.matches ? 'mobile' : 'pc', profile = scenes[channel];
      if (selectedScene !== channel) {
        selectedScene = channel; clearVideo(); videoFailed = false; autoplayBlocked = false;
        video.setAttribute('poster',profile.poster); scene.dataset.scene = channel;
      }
      if (!preferred || !effectsAllowed() || videoLowMemory() || suspended || document.hidden || modalOpen()) { clearVideo(); return; }
      if (!mayPlayVideo()) { if (!video.paused) video.pause(); return; }
      if (!video.getAttribute('src')) video.src = profile.src;
      if (video.paused && !playPending) {
        const epoch = playbackEpoch; playPending = true;
        video.play().catch(error => {
          if (epoch !== playbackEpoch) return;
          if (error.name === 'NotAllowedError') autoplayBlocked = true;
          else if (error.name !== 'AbortError') videoFailed = true;
        }).finally(() => { if (epoch === playbackEpoch) { playPending = false; sync(); } });
      }
    }
    function release(slot) {
      const host = slot.clip.parentElement;
      slot.animation?.cancel(); slot.animation = null; slot.clip.remove();
      if (host && !host.querySelector('.control-flare')) host.classList.remove('feedback-host');
    }
    function clearFlashes() { flashes.forEach(release); }
    function stop() { clearTimeout(timer); timer=0; cancelAnimationFrame(frame); frame=0; last=0; }
    function palette() {
      const light = document.documentElement.dataset.theme === 'light';
      cyan = light ? '#326c8f' : '#a7dce8'; gold = light ? '#9b7131' : '#f1d6a0';
    }
    function measure() {
      stop();
      width = document.documentElement.clientWidth; height = innerHeight;
      const low = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      const mobile = compact.matches;
      count = low ? 10 : mobile ? 14 : 36;
      interval = low ? 100 : mobile ? 1000/12 : 50; linkLimit = mobile || low ? 3 : 7;
      const ratio = Math.min(devicePixelRatio || 1, mobile || low ? 1 : 1.25, Math.sqrt(2600000/Math.max(1,width*height)));
      canvas.width = Math.max(1,Math.round(width*ratio)); canvas.height = Math.max(1,Math.round(height*ratio));
      ctx?.setTransform(ratio,0,0,ratio,0,0);
      canvas.dataset.particleCount = count; canvas.dataset.frameRate = Math.round(1000/interval);
      let seed = 0x71e4a9;
      const random = () => { seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return (seed>>>0)/4294967296; };
      for (let i=0;i<count;i++) {
        const p=i*7;
        points[p]=random()*width; points[p+1]=random()*height;
        points[p+2]=(random()-.5)*4; points[p+3]=-(2+random()*4);
        points[p+4]=.8+random()*.9; points[p+5]=random()*Math.PI*2; points[p+6]=random();
      }
      sync();
    }
    function draw(dt) {
      ctx.clearRect(0,0,width,height);
      for (let i=0;i<count;i++) {
        const p=i*7;
        points[p]+=points[p+2]*dt; points[p+1]+=points[p+3]*dt; points[p+5]+=dt*.6;
        if(points[p]<-12)points[p]=width+12; else if(points[p]>width+12)points[p]=-12;
        if(points[p+1]<-12)points[p+1]=height+12;
      }
      let links=0;
      ctx.lineWidth=.65; ctx.strokeStyle=cyan;
      for(let i=0;i<count && links<linkLimit;i++) for(let j=i+1;j<count && links<linkLimit;j++) {
        const a=i*7,b=j*7,dx=points[a]-points[b],dy=points[a+1]-points[b+1],distance=dx*dx+dy*dy;
        if(distance>170*170 || distance<18*18)continue;
        ctx.globalAlpha=.18*(1-distance/(170*170)); ctx.beginPath();
        ctx.moveTo(points[a],points[a+1]); ctx.lineTo(points[b],points[b+1]); ctx.stroke(); links++;
      }
      for(let i=0;i<count;i++) {
        const p=i*7,x=points[p],y=points[p+1],r=points[p+4];
        ctx.globalAlpha=.32+.2*Math.sin(points[p+5]); ctx.fillStyle=i%3===0?gold:cyan;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        if(i%6===0) {
          ctx.strokeStyle=ctx.fillStyle; ctx.globalAlpha*=.65; ctx.lineWidth=.7;
          ctx.beginPath(); ctx.moveTo(x-5,y); ctx.lineTo(x-2.5,y); ctx.moveTo(x+2.5,y); ctx.lineTo(x+5,y);
          ctx.moveTo(x,y-5); ctx.lineTo(x,y-2.5); ctx.moveTo(x,y+2.5); ctx.lineTo(x,y+5); ctx.stroke();
        } else if(points[p+6]>.82) {
          ctx.strokeStyle=ctx.fillStyle; ctx.globalAlpha*=.6; ctx.strokeRect(x-3.5,y-3.5,7,7);
        }
      }
      ctx.globalAlpha=1;
    }
    function tick(now) {
      frame=0;
      if(!mayDraw()){stop();return}
      const dt=last?Math.min(.15,(now-last)/1000):0; last=now; draw(dt);
      timer=setTimeout(()=>{timer=0;if(mayDraw())frame=requestAnimationFrame(tick)},interval);
    }
    function sync() {
      const permitted = effectsAllowed(), active = preferred && permitted;
      toggle.disabled=!permitted; toggle.setAttribute('aria-pressed',String(active));
      const label=!permitted?'系统已减少动态效果':`${active?'关闭':'开启'}场景动效`;
      toggle.setAttribute('aria-label',label); toggle.title=label;
      document.documentElement.dataset.effects = active ? 'on' : 'off';
      syncTitle(active);
      syncVideo();
      canvas.hidden=!mayDraw();
      if(!active || document.hidden || suspended)clearFlashes();
      if(!mayDraw()){stop();return}
      if(!timer&&!frame)frame=requestAnimationFrame(tick);
    }
    function feedback(event,keyboard=false) {
      if(!preferred || !effectsAllowed() || suspended || document.hidden || !Element.prototype.animate)return;
      if(!keyboard && (event.button!==0 || event.isPrimary===false))return;
      const host=event.target.closest?.('button,a.button,a.nav-link');
      if(!host || host.disabled || host.getAttribute('aria-disabled')==='true')return;
      const rect=host.getBoundingClientRect(),slot=flashes[cursor++%flashes.length];
      release(slot);
      // Fixed/absolute controls must keep their position throughout the press.
      if(getComputedStyle(host).position==='static')host.classList.add('feedback-host');
      slot.ring.style.left=`${keyboard?rect.width/2:event.clientX-rect.left}px`;
      slot.ring.style.top=`${keyboard?rect.height/2:event.clientY-rect.top}px`;
      const size=Math.min(150,Math.max(66,rect.width*.75));
      slot.ring.style.width=slot.ring.style.height=`${size}px`; host.append(slot.clip);
      const animation=slot.ring.animate([
        {transform:'translate(-50%,-50%) scale(.12)',opacity:0},
        {opacity:.75,offset:.16},
        {transform:'translate(-50%,-50%) scale(1)',opacity:0}
      ],{duration:pressDuration,easing:'cubic-bezier(.16,.7,.3,1)'});
      slot.animation=animation;
      animation.onfinish=()=>{if(slot.animation===animation)release(slot)};
    }
    toggle.addEventListener('click',()=>{
      preferred=!preferred;
      if(preferred){autoplayBlocked=false;videoFailed=false}
      try{localStorage.setItem('teyvat_atmosphere',preferred?'on':'off')}catch{}
      sync();
    },{signal:lifecycle.signal});
    document.addEventListener('pointerdown',feedback,{...options,capture:true});
    const retryAutoplay = event => { if(event.isTrusted && autoplayBlocked){autoplayBlocked=false;sync()} };
    document.addEventListener('pointerdown',retryAutoplay,options);
    document.addEventListener('keydown',retryAutoplay,options);
    document.addEventListener('click',event=>{if(event.isTrusted && event.detail===0)feedback(event,true)},{...options,capture:true});
    document.addEventListener('pointercancel',clearFlashes,options);
    document.addEventListener('visibilitychange',sync,options);
    document.addEventListener('scroll',()=>{
      if(!preferred || !effectsAllowed() || document.hidden || modalOpen())return;
      scrolling=true; stop(); if(!video.paused)video.pause(); clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>{scrolling=false;sync()},160);
    },{...options,capture:true});
    window.addEventListener('resize',measure,options);
    reduced.addEventListener('change',sync,options); compact.addEventListener('change',measure,options);
    portrait.addEventListener('change',sync,options);
    navigator.connection?.addEventListener('change',sync,options);
    window.addEventListener('load',()=>{sceneReady=true;sync()},options);
    video.addEventListener('playing',()=>{scene.classList.add('is-ready');sync()},options);
    video.addEventListener('pause',sync,options);
    video.addEventListener('error',()=>{if(video.error&&video.getAttribute('src')){videoFailed=true;scene.classList.remove('is-ready');sync()}},options);
    const observer=new MutationObserver(()=>{palette();sync()});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    observer.observe($('characterDialog'),{attributes:true,attributeFilter:['open']});
    observer.observe($('musicBoxDialog'),{attributes:true,attributeFilter:['open']});
    const sizeObserver='ResizeObserver' in window?new ResizeObserver(()=>{
      if(width!==document.documentElement.clientWidth || height!==innerHeight)measure();
    }):null;
    sizeObserver?.observe(document.documentElement);
    palette();measure();
    return {
      suspend(){suspended=true;clearTimeout(scrollTimer);scrolling=false;sync()},
      resume(){suspended=false;measure()},
      destroy(){suspended=true;stop();settleTitle();clearTimeout(scrollTimer);clearFlashes();observer.disconnect();sizeObserver?.disconnect();lifecycle.abort();video.pause();video.removeAttribute('src');video.load();scene.remove();canvas.width=canvas.height=1;canvas.remove()}
    };
  }

  // CSS owns the sparse star/orbit motion. This owner only changes play state;
  // there is no particle RAF loop or work for offscreen/hidden illustrations.
  function createCelestialMotion() {
    const lifecycle = new AbortController(), options = {passive:true,signal:lifecycle.signal};
    const root = document.documentElement, hero = $('heroCharacterImg').closest('.hero');
    const dialog = $('characterDialog'), musicDialog = $('musicBoxDialog');
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    let suspended = false, visible = true;
    function sync() {
      const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      root.dataset.celestialQuality = lowPower ? 'static' : 'full';
      const active = !suspended && !document.hidden && !lowPower && !reduced.matches && !navigator.connection?.saveData && root.dataset.effects !== 'off';
      hero.dataset.celestialRunning = String(active && visible && !dialog.open && !musicDialog.open);
      dialog.dataset.celestialRunning = String(active && dialog.open);
    }
    const observer = new MutationObserver(sync);
    observer.observe(root,{attributes:true,attributeFilter:['data-effects']});
    observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    observer.observe(musicDialog,{attributes:true,attributeFilter:['open']});
    const visibility = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false; sync();
    },{threshold:.05}) : null;
    visibility?.observe(hero);
    document.addEventListener('visibilitychange',sync,options);
    reduced.addEventListener('change',sync,options);
    navigator.connection?.addEventListener?.('change',sync,options);
    sync();
    return {
      suspend(){suspended=true;sync()},
      resume(){suspended=false;sync()},
      destroy(){suspended=true;sync();observer.disconnect();visibility?.disconnect();lifecycle.abort()}
    };
  }

  // One illustration, four depth planes; request a frame only on pointer input.
  function createProjectionMotion(dialog) {
    const controller = new AbortController(), options = {passive:true,signal:controller.signal};
    const reduced = matchMedia('(prefers-reduced-motion:reduce)'), fine = matchMedia('(hover:hover) and (pointer:fine)');
    let stage = null, rect = null, frame = 0, x = 0, y = 0;
    function reset() {
      cancelAnimationFrame(frame); frame=0;
      if(stage){stage.classList.remove('is-projecting');for(const name of ['--projection-x','--projection-y','--projection-rx','--projection-ry'])stage.style.removeProperty(name)}
      stage=null;rect=null;
    }
    function move(event) {
      if(!fine.matches || reduced.matches || document.hidden || document.documentElement.dataset.effects==='off')return reset();
      const next=event.target.closest('.detail-art');
      if(!next)return reset();
      if(next!==stage){reset();stage=next;rect=stage.getBoundingClientRect();stage.classList.add('is-projecting')}
      x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
      y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
      if(!frame)frame=requestAnimationFrame(()=>{
        frame=0;if(!stage)return;
        stage.style.setProperty('--projection-x',`${x*9}px`);stage.style.setProperty('--projection-y',`${y*5}px`);
        stage.style.setProperty('--projection-rx',`${-y*3}deg`);stage.style.setProperty('--projection-ry',`${x*5}deg`);
      });
    }
    dialog.addEventListener('pointermove',move,options);dialog.addEventListener('pointerleave',reset,options);
    dialog.addEventListener('close',reset,options);dialog.addEventListener('scroll',reset,{...options,capture:true});
    window.addEventListener('resize',reset,options);document.addEventListener('visibilitychange',reset,options);
    reduced.addEventListener('change',reset,options);fine.addEventListener('change',reset,options);
    $('effectsToggle').addEventListener('click',reset,options);
    return {reset,destroy(){reset();controller.abort()}};
  }

  // One event owner for the whole grid. A frame is requested only after pointer input;
  // there is no animation loop, device-orientation listener, or per-card timer.
  function createCardMotion(grid) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const lifecycle = new AbortController();
    const options = { passive: true, signal: lifecycle.signal };
    const enabled = () => !reduced.matches && !navigator.connection?.saveData;
    let active, bounds, pointer, frame = 0, observer, releaseTimer;
    const variables = ['--tilt-x','--tilt-y','--shine-x','--shine-y','--shine-angle','--light-x','--light-y','--shadow-x'];
    function reset() {
      cancelAnimationFrame(frame); frame = 0;
      clearTimeout(releaseTimer);
      if (active) {
        active.classList.remove('is-tilting');
        variables.forEach(name => active.style.removeProperty(name));
      }
      active = bounds = pointer = null;
    }
    function paint() {
      frame = 0;
      if (!active?.isConnected || !pointer || !bounds || !enabled()) { reset(); return; }
      const x = Math.max(-1, Math.min(1, (pointer.x-bounds.left)/bounds.width*2-1));
      const y = Math.max(-1, Math.min(1, (pointer.y-bounds.top)/bounds.height*2-1));
      const values = [
        `${(-y*11).toFixed(2)}deg`,
        `${(x*13).toFixed(2)}deg`,
        `${(x*52).toFixed(1)}px`,
        `${(y*62).toFixed(1)}px`,
        `${(x*16-y*8).toFixed(1)}deg`,
        `${(x*bounds.width*.4).toFixed(1)}px`,
        `${(y*bounds.height*.38).toFixed(1)}px`,
        `${(-x*16).toFixed(1)}px`
      ];
      variables.forEach((name,i) => active.style.setProperty(name, values[i]));
    }
    function handlePointer(event) {
      if (!enabled()) return;
      clearTimeout(releaseTimer);
      const clientX = event.clientX ?? event.touches?.[0]?.clientX;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;
      const card = event.target.closest?.('.character-card');
      if (!card) { if (active && event.pointerType !== 'touch') reset(); return; }
      if (card !== active) {
        if (active) {
          active.classList.remove('is-tilting');
          variables.forEach(name => active.style.removeProperty(name));
        }
        active = card;
        bounds = card.getBoundingClientRect();
        card.classList.remove('is-revealing');
        card.classList.add('is-tilting');
      }
      pointer = { x: clientX, y: clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function handleRelease(event) {
      if (event.pointerType === 'touch' || matchMedia('(pointer:coarse)').matches) {
        releaseTimer = setTimeout(reset, 280);
      } else {
        reset();
      }
    }
    grid.addEventListener('pointerdown', handlePointer, options);
    grid.addEventListener('pointermove', handlePointer, options);
    grid.addEventListener('pointerover', handlePointer, options);
    grid.addEventListener('pointerup', handleRelease, options);
    grid.addEventListener('pointerleave', reset, options);
    grid.addEventListener('pointercancel', reset, options);
    grid.addEventListener('wheel', reset, options);
    document.addEventListener('scroll', reset, { ...options, capture: true });
    grid.addEventListener('animationend', event => {
      if (event.animationName === 'card-arrival') event.target.classList.remove('is-revealing');
    }, options);
    window.addEventListener('resize', reset, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, options);
    reduced.addEventListener('change', () => { reset(); refresh(); }, options);
    function refresh() {
      reset(); observer?.disconnect();
      const cards = [...grid.querySelectorAll('.character-card')];
      if (reduced.matches || navigator.connection?.saveData || !('IntersectionObserver' in window) || document.hidden || $('characterDialog').open) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const card = entry.target;
          if (card.isConnected && card!==active && !reduced.matches && !document.hidden) card.classList.add('is-revealing');
          observer.unobserve(card);
        }
      },{ threshold:.08, rootMargin:'0px 0px 30px 0px' });
      cards.forEach((card,i) => { card.style.setProperty('--arrival-delay',`${(i%6)*32}ms`); observer.observe(card); });
    }
    return {reset,refresh,suspend(){reset();observer?.disconnect()},destroy(){reset();observer?.disconnect();lifecycle.abort()}};
  }
  function detail(id) { if (!detailsCache.has(id)) detailsCache.set(id, fetch(`data/characters/${id}.json`).then(r => { if (!r.ok) throw Error('角色档案加载失败'); return r.json(); }).catch(e => { detailsCache.delete(id); throw e; })); return detailsCache.get(id); }
  function hasFavorite(c) { return [...favorites].some(key => key.startsWith(`${c.name}_`)); }
  function updateControls() {
    for (const [field, attr] of [['region','data-region'],['element','data-element'],['category','data-category']]) document.querySelectorAll(`[${attr}]`).forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute(attr) === state[field])));
    $('favFilterBtn').setAttribute('aria-pressed', String(state.favOnly)); $('favoritesNav').setAttribute('aria-pressed', String(state.favOnly)); $('favoritesNav').classList.toggle('active', state.favOnly); $('charactersNav').classList.toggle('active', !isIndex && !state.favOnly);
    const count = ['region','element','rarity','weapon'].filter(k => state[k] !== 'all').length + Number(state.favOnly);
    $('filterCount').hidden = !count; $('filterCount').textContent = count; $('resetFilters').hidden = !count && !state.search;
    $('clearSearch').hidden = !state.search; $('raritySelect').value = state.rarity; $('weaponSelect').value = state.weapon;
  }
  function render() {
    cardMotion.reset();
    updateControls();
    if(isVoiceIndex && (indexLoading || indexLoadFailed)) {
      $('resultCount').textContent='…';
      $('resultsMeta').textContent=indexLoading?'正在载入角色语音…':'角色语音暂时未能加载';
      $('charConstellationGrid').setAttribute('aria-busy',String(indexLoading));
      $('charConstellationGrid').innerHTML=indexLoading?'<div class="loading-state">正在打开声音档案…</div>':'<div class="empty-state"><h3>声音档案暂未连接</h3><p>请检查网络后重试，也可以切换另一位旅伴</p><button class="button" data-action="retry-character-index">重试加载</button></div>';
      $('pagination').innerHTML='';
      return;
    }
    if (isIndex) filtered = indexVoices.filter(q => (state.category === 'all' || q.category === state.category) && (!state.favOnly || favorites.has(quoteKey(indexCharacter || {name:'纳西妲'},indexQuote(q)))) && (!state.search || normal(q.text + ' ' + q.catName).includes(normal(state.search))));
    else {
      filtered = catalog.filter(c => (state.region === 'all' || c.region === state.region) && (state.element === 'all' || c.element === state.element) && (state.rarity === 'all' || String(c.rarity) === state.rarity) && (state.weapon === 'all' || c.weapon === state.weapon) && (!state.favOnly || hasFavorite(c)) && (!state.search || (searchIds ? searchIds.has(c.id) : c.metadataSearch.includes(normal(state.search)))));
      filtered.sort((a,b) => state.sort === 'name' ? a.name.localeCompare(b.name,'zh-CN') : state.sort === 'quotes' ? b.quoteCount-a.quoteCount : state.sort === 'rarity' ? b.rarity-a.rarity : ((preferred.indexOf(a.name)+1 || 999) - (preferred.indexOf(b.name)+1 || 999)));
    }
    const pages = Math.max(1, Math.ceil(filtered.length/pageSize)); state.page = Math.max(1, Math.min(state.page, pages));
    const start = (state.page-1)*pageSize, rows = filtered.slice(start,start+pageSize);
    $('resultCount').textContent = filtered.length.toLocaleString();
    $('resultDescription').textContent = state.favOnly ? '把喜欢的对白，留给下次重逢' : isIndex ? '故事里没有说完的话，留在这里' : '每一位旅伴，都有值得记住的故事';
    $('resultsMeta').innerHTML = searchPending ? '正在搜索全部台词…' : searchFailed ? `台词索引暂时无法加载，当前仅显示角色信息匹配 <button data-action="retry-search" class="text-button">重试全文搜索</button>` : `<span>找到 <strong>${filtered.length}</strong> ${isIndex ? '条台词' : '位旅伴'}${!isIndex ? ` · ${filtered.reduce((n,c)=>n+c.quoteCount,0).toLocaleString()} 条台词` : ''}</span><span class="results-range">${rows.length ? `${start+1}–${start+rows.length}` : '0'} / ${filtered.length}</span>`;
    $('charConstellationGrid').setAttribute('aria-busy', String(searchPending));
    if (!rows.length) $('charConstellationGrid').innerHTML = `<div class="empty-state">${icon(state.favOnly ? 'heart' : 'magnifying-glass')}<h3>${state.favOnly ? '这里还没有珍藏' : '暂时没有找到这位旅伴'}</h3><p>${state.favOnly ? '在角色台词旁点击爱心，就能在这里再次找到' : '试试更短的关键词，或清除筛选条件'}</p><button class="button" data-action="reset">${state.favOnly ? '返回全部' : '清除筛选'}</button></div>`;
    else if (isIndex) $('charConstellationGrid').innerHTML = rows.map((q,i) => `<article class="index-voice"><span>${String(start+i+1).padStart(3,'0')}</span><div class="index-voice-body"><span>${esc(q.catName)}${q.category === 'ringtone' ? ' · 铃声索引' : ''}</span><p>${highlight(q.text,state.search)}</p></div><div class="quote-actions">${quoteButtons(indexQuote(q),start+i,'index')}</div></article>`).join('');
    else $('charConstellationGrid').innerHTML = rows.map(renderCharacterCard).join('');
    $('pagination').innerHTML = filtered.length <= pageSize ? '' : `<button class="page-button" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">${icon('caret-left')}</button>${Array.from({length:pages},(_,i)=>`<button class="page-button" data-page="${i+1}" ${state.page===i+1?'aria-current="page"':''} aria-label="第${i+1}页">${i+1}</button>`).join('')}<button class="page-button" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="下一页">${icon('caret-right')}</button>`;
    if (pages > 9) { const buttons = [...$('pagination').querySelectorAll('[data-page]')]; buttons.slice(1,-1).forEach(button => { const p = Number(button.dataset.page); if (p !== 1 && p !== pages && Math.abs(p-state.page)>1) button.hidden = true; }); }
    cardMotion.refresh();
  }
  function renderCharacterCard(c) {
    return `<article class="character-card ${c.artEdition ? 'art-edition' : ''}" data-rarity="${c.rarity}" style="${celestialStyle(c)}--element-glow:${c.artAccent ? c.artAccent+'44' : elementColors[c.element] || '#52728555'}">
      <button class="character-open" data-character="${c.id}" aria-label="查看${esc(c.name)}的立绘与${c.quoteCount}条台词">
        <span class="card-underlay" aria-hidden="true"></span>
        <div class="character-art-stage"><span class="card-sigil" aria-hidden="true">${emblem(c.element)}</span>${c.artEdition ? celestialFxMarkup('card-celestial-fx') : ''}<img class="character-art" src="${c.cardArt}" alt="${esc(c.name)}${c.artEdition ? '星辉重绘' : '角色'}立绘" width="480" height="580" loading="lazy" decoding="async">${c.artEdition ? '<span class="card-edition-mark" aria-label="星辉同人重绘">✧ 星辉</span>' : ''}<span class="card-open-hint" aria-hidden="true">${icon('book-open')}启封绘卷</span></div>
        <div class="card-info"><div class="card-name-line"><h3>${esc(c.name)}</h3><span class="card-rarity" aria-label="${c.rarity}星">${'★'.repeat(c.rarity)}</span></div><p class="card-epithet">${esc(c.title)}</p><div class="card-footer"><span class="card-element">${emblem(c.element)}${esc(c.region)}</span><span class="card-quote-count">${icon('headphones')}${c.quoteCount} 条台词</span></div></div>
        <span class="card-hologram" aria-hidden="true"><i class="card-spectrum"></i><i class="card-gloss"></i></span><span class="card-frame" aria-hidden="true"></span>
      </button>${hasFavorite(c) ? `<span class="card-favorite-dot" aria-label="有已珍藏台词">${icon('heart')}</span>` : ''}
    </article>`;
  }
  function highlight(text, query) { const value=String(text||''), needle=String(query||'').trim(); if (!needle) return esc(value); const at=normal(value).indexOf(normal(needle)); return at<0 ? esc(value) : esc(value.slice(0,at))+`<mark>${esc(value.slice(at,at+needle.length))}</mark>`+esc(value.slice(at+needle.length)); }
  async function searchOnMainThread(query) {
    fallbackSearchIndex ||= fetch('data/search-index.json').then(response=>{if(!response.ok)throw Error('搜索索引加载失败');return response.json()}).catch(error=>{fallbackSearchIndex=null;throw error});
    const index=await fallbackSearchIndex, words=normal(query).split(/\s+/).filter(Boolean);
    return index.filter(row=>words.every(word=>row.text.includes(word))).map(row=>row.id);
  }
  async function runSearch() {
    const id=++searchVersion; searchFailed=false; state.page=1;
    cancelWorkerSearch?.();
    if (isIndex || !state.search.trim()) { searchIds=null; searchPending=false; render(); return; }
    const query=state.search;
    searchPending=true; render();
    try {
      let ids;
      if ('Worker' in window && !workerFailed) {
        try {
          worker ||= new Worker('search-worker.js');
          const searchWorker=worker;
          ids = await new Promise((resolve,reject) => {
            const cleanup=()=>{clearTimeout(timer);searchWorker.removeEventListener('message',onMessage);searchWorker.removeEventListener('error',onError);if(cancelWorkerSearch===cancel)cancelWorkerSearch=null};
            const cancel=()=>{cleanup();reject(Error('搜索已取消'))};
            const timer=setTimeout(()=>{cleanup();reject(Error('搜索超时'))},15000);
            const onMessage=e=>{if(e.data.id===id){cleanup();e.data.error?reject(Error(e.data.error)):resolve(e.data.ids)}};
            const onError=()=>{cleanup();reject(Error('全文搜索未能启动'))};
            cancelWorkerSearch=cancel;
            searchWorker.addEventListener('message',onMessage);searchWorker.addEventListener('error',onError);searchWorker.postMessage({id,query});
          });
        } catch(error) {
          if(id!==searchVersion)return;
          worker?.terminate();worker=null;workerFailed=true;
          ids=await searchOnMainThread(query);
        }
      } else ids=await searchOnMainThread(query);
      if(id!==searchVersion)return;searchIds=new Set(ids);
    } catch { if(id!==searchVersion)return;searchFailed=true;searchIds=null; }
    searchPending=false;render();
  }
  let searchTimer;
  $('masterSearchInput').addEventListener('input',e=>{clearTimeout(searchTimer);state.search=e.target.value;$('clearSearch').hidden=!state.search;searchTimer=setTimeout(runSearch,100)});
  $('clearSearch').onclick=()=>{clearTimeout(searchTimer);state.search='';$('masterSearchInput').value='';runSearch();$('masterSearchInput').focus()};
  function reset() { clearTimeout(searchTimer); Object.assign(state,{region:'all',element:'all',rarity:'all',weapon:'all',search:'',favOnly:false,page:1,category:'all'});$('masterSearchInput').value='';searchIds=null;searchPending=false;searchFailed=false;searchVersion++;cancelWorkerSearch?.();render(); }
  $('resetFilters').onclick=reset;
  $('filterToggle').onclick=()=>{const open=$('advancedFilters').hidden;$('advancedFilters').hidden=!open;$('filterToggle').setAttribute('aria-expanded',String(open));$('advancedFilters').closest('.archive-controls').classList.toggle('filters-open',open)};
  $('raritySelect').onchange=e=>{state.rarity=e.target.value;state.page=1;render()};$('weaponSelect').onchange=e=>{state.weapon=e.target.value;state.page=1;render()};$('sortSelect').onchange=e=>{state.sort=e.target.value;state.page=1;render()};
  function toggleFavorites(resetOther) { const next=!state.favOnly;if(resetOther)reset();state.favOnly=next;state.page=1;render();$('characters').scrollIntoView({block:'start'}) }
  $('favoritesNav').onclick=()=>toggleFavorites(true);$('favFilterBtn').onclick=()=>toggleFavorites(false);
  if(!isIndex)$('charactersNav').addEventListener('click',()=>{state.favOnly=false;state.page=1;render()});
  let currentHeroChar = null;
  let voiceNavCharacter = null, voiceNavTimer = null;

  function initVoiceIndexNav() {
    const link=$('voiceIndexNav'),label=$('voiceIndexNavLabel');
    if (!link || !catalog.length) return;
    const rotate=()=>{
      if (document.hidden || $('characterDialog').open || $('musicBoxDialog').open || link.matches(':hover,:focus-within')) return;
      const pool=catalog.filter(c=>c.id!==voiceNavCharacter?.id);
      voiceNavCharacter=pool[Math.floor(Math.random()*pool.length)] || catalog[0];
      label.textContent=`${voiceNavCharacter.name}语音索引`;
      link.href=`voice_index.html?character=${voiceNavCharacter.id}`;
      link.dataset.characterId=String(voiceNavCharacter.id);
      link.setAttribute('aria-label',`打开${voiceNavCharacter.name}语音索引；全角色每5秒随机轮换`);
    };
    const schedule=()=>{
      clearInterval(voiceNavTimer);
      if (!document.hidden) voiceNavTimer=setInterval(rotate,5000);
    };
    rotate();schedule();
    document.addEventListener('visibilitychange',schedule);
    window.addEventListener('pagehide',()=>clearInterval(voiceNavTimer));
    window.addEventListener('pageshow',event=>{if(event.persisted)schedule()});
  }

  function updateCharacterVoiceIndex(character) {
    indexLoading=false;indexLoadFailed=false;
    clearTimeout(searchTimer);searchVersion++;cancelWorkerSearch?.();
    indexCharacter=character;
    indexVoices=[...character.friendLines.map((q,i)=>({id:`friend-${i}`,category:'friendship',catName:`角色故事 · ${q.title}`,text:q.desc || '（角色动作 / 拟音）',voiceQuote:q})),...character.actionLines.map((q,i)=>({id:`action-${i}`,category:'gameplay',catName:`战斗探索 · ${q.title}`,text:q.desc || '（角色动作 / 拟音）',voiceQuote:q}))];
    state.category='all';state.search='';state.page=1;
    $('masterSearchInput').value='';
    $('archiveHeadingText').textContent=`${character.name} · 声音档案`;
    $('heroDescription').textContent=`${character.name}的对白、故事与战斗原声 · 共 ${indexVoices.length} 条，切换旅伴即可浏览全部角色`;
    $('randomCharacter').innerHTML=`${icon('book-open')}查看${esc(character.name)}图鉴`;
    $('mainContent').dataset.indexCharacter=String(character.id);
    document.title=`原神 · ${character.name}语音索引 | Teyvat Voice Archive`;
    const url=new URL(location.href);
    url.searchParams.set('character',String(character.id));
    history.replaceState(null,'',url);
    render();
  }

  function populateHeroSelect() {
    const sel = $('heroCharSelect');
    if (!sel || !catalog.length) return;
    const regions = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬', '其他/异邦'];
    let html = '';
    for (const reg of regions) {
      const chars = catalog.filter(c => c.region === reg);
      if (!chars.length) continue;
      html += `<optgroup label="—— ${reg} ——">`;
      for (const c of chars) {
        html += `<option value="${c.id}">${c.name} · ${c.title || ''}</option>`;
      }
      html += `</optgroup>`;
    }
    sel.innerHTML = html;
  }

  async function setHeroCharacter(charOrId, { syncQuote = true, playSound = false } = {}) {
    if (!catalog || !catalog.length) return;
    const c = typeof charOrId === 'object' && charOrId ? charOrId : (catalog.find(x => x.id === Number(charOrId)) || catalog[0]);
    if (!c) return;
    currentHeroChar = c;
    if (syncQuote) {
      daily=null; $('heroListenBtn').disabled=true;
      if(isVoiceIndex){indexLoading=true;indexLoadFailed=false;indexVoices=[];indexCharacter=null;$('archiveHeadingText').textContent=`${c.name} · 声音档案`;render();}
    }
    const hero = $('heroCharacterImg')?.closest('.hero');
    if (hero) {
      hero.dataset.artEdition = c.artEdition || '';
      hero.style.setProperty('--celestial-color', c.artAccent || '#95cfff');
      hero.style.setProperty('--celestial-secondary', c.artAccentSecondary || '#f4d494');
    }
    try { localStorage.setItem('teyvat_hero_char_id', String(c.id)); } catch {}

    const img = $('heroCharacterImg');
    if (img) {
      img.classList.add('switching');
      const newSrc = c.fullArt || c.splashArt || c.cardArt;
      const preload = new Image();
      let applied = false;
      const applyImg = () => {
        if (applied || (currentHeroChar && currentHeroChar.id !== c.id)) return;
        applied = true;
        img.src = newSrc;
        img.alt = `${c.name}角色立绘`;
        img.title = `点击查看「${c.name}」全部台词与原声`;
        const naturalW = preload.naturalWidth || img.naturalWidth || c.fullArtWidth || 1024;
        const naturalH = preload.naturalHeight || img.naturalHeight || c.fullArtHeight || 1024;
        const ratio = naturalW / naturalH;
        const isMobile = window.innerWidth <= 767;
        const bannerH = isMobile ? 336 : 368;
        const targetBodyX = isMobile ? Math.min(118, window.innerWidth * 0.3) : Math.min(300, window.innerWidth * 0.22);
        const imgW = bannerH * ratio;
        const rightOffset = Math.round(targetBodyX - (imgW / 2));
        img.style.setProperty('--char-right', `${rightOffset}px`);
        img.style.removeProperty('--char-scale');
        img.classList.remove('switching');
      };
      preload.onload = applyImg;
      preload.onerror = applyImg;
      preload.src = newSrc;
      if (preload.complete && preload.naturalWidth) {
        applyImg();
      }
    }

    if ($('heroCharTitle')) $('heroCharTitle').textContent = c.title || '';
    if ($('heroCharName')) $('heroCharName').textContent = c.name;
    if ($('heroCharEn')) $('heroCharEn').textContent = (c.enName || '').toUpperCase();
    if ($('heroEyebrowText') && !isLegacyIndex) {
      $('heroEyebrowText').textContent = `${c.region} · ${c.title || '旅伴'}`;
    }
    if ($('heroCharSelect')) {
      $('heroCharSelect').value = String(c.id);
    }
    if ($('heroDockLabel')) {
      $('heroDockLabel').textContent = c.name;
    }

    if (syncQuote) {
      try {
        const full = await detail(c.id);
        if (currentHeroChar?.id !== c.id) return;
        if (isVoiceIndex) updateCharacterVoiceIndex(full);
        const list = full.friendLines.filter(q => q.desc && q.desc.length < 110);
        const q = list.find(q => q.audioUrl && q.title.includes('初次见面')) || list.find(q => q.audioUrl) || (full.actionLines && full.actionLines.find(q => q.audioUrl)) || list[0] || { title: '介绍', desc: c.preview, audioUrl: null };
        daily = { char: full, quote: q };
        $('dailyQuote').textContent = `「${(q.desc || '').replace(/。+$/, '')}」`;
        $('dailyAuthor').textContent = `${c.name} · ${q.title}`;
        $('dailyOpen').setAttribute('aria-label', `查看${c.name}的台词`);
        if (playSound) {
          playQuote(full, q, [q], 0);
        }
      } catch {
        if (currentHeroChar?.id !== c.id) return;
        if(isVoiceIndex){indexLoading=false;indexLoadFailed=true;render();}
        $('dailyQuote').textContent = `「${(c.preview || '愿此行，终抵群星').replace(/。+$/, '')}」`;
        $('dailyAuthor').textContent = `${c.name} · ${c.title}`;
      } finally {
        if (currentHeroChar?.id === c.id) $('heroListenBtn').disabled = !daily || !readable(daily.quote);
      }
    }
  }

  function updateHeroOffset() {
    const img = $('heroCharacterImg');
    if (!img || !currentHeroChar) return;
    const naturalW = img.naturalWidth || currentHeroChar.fullArtWidth || 1024;
    const naturalH = img.naturalHeight || currentHeroChar.fullArtHeight || 1024;
    const ratio = naturalW / naturalH;
    const isMobile = window.innerWidth <= 767;
    const bannerH = isMobile ? 336 : 368;
    const targetBodyX = isMobile ? Math.min(118, window.innerWidth * 0.3) : Math.min(300, window.innerWidth * 0.22);
    const imgW = bannerH * ratio;
    const rightOffset = Math.round(targetBodyX - (imgW / 2));
    img.style.setProperty('--char-right', `${rightOffset}px`);
  }
  window.addEventListener('resize', updateHeroOffset, { passive: true });

  function stepHeroCharacter(offset) {
    if (!catalog.length) return;
    const currentId = currentHeroChar ? currentHeroChar.id : 10000073;
    const idx = catalog.findIndex(c => c.id === currentId);
    const nextIdx = (idx + offset + catalog.length) % catalog.length;
    const nextChar = catalog[nextIdx];
    setHeroCharacter(nextChar, { syncQuote: true });
    toast(`已切换至【${nextChar.name} · ${nextChar.title}】`);
  }

  async function initHeroSwitcher() {
    populateHeroSelect();
    let initialId = isLegacyIndex ? 10000073 : 10000001;
    try {
      const saved = Number(localStorage.getItem('teyvat_hero_char_id'));
      if (saved && saved !== 10000073 && catalog.some(c => c.id === saved)) initialId = saved;
    } catch {}
    if (isLegacyIndex) initialId = 10000073;
    if (isVoiceIndex) {
      const requested=Number(new URLSearchParams(location.search).get('character'));
      initialId=catalog.some(c=>c.id===requested) ? requested : catalog[Math.floor(Math.random()*catalog.length)].id;
    }
    if ($('heroPrevChar')) $('heroPrevChar').onclick = () => stepHeroCharacter(-1);
    if ($('heroNextChar')) $('heroNextChar').onclick = () => stepHeroCharacter(1);
    if ($('heroFloatPrev')) $('heroFloatPrev').onclick = () => stepHeroCharacter(-1);
    if ($('heroFloatNext')) $('heroFloatNext').onclick = () => stepHeroCharacter(1);

    if ($('heroCharSelect')) {
      $('heroCharSelect').onchange = e => {
        const char = catalog.find(c => c.id === Number(e.target.value));
        if (char) {
          setHeroCharacter(char, { syncQuote: true });
          toast(`已切换至【${char.name} · ${char.title}】`);
        }
      };
    }

    const randomPick = () => {
      if (!catalog.length) return;
      const candidates = catalog.filter(c => c.id !== currentHeroChar?.id);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || catalog[0];
      setHeroCharacter(chosen, { syncQuote: true });
      toast(`星辉指引 · 邂逅【${chosen.name}】`);
    };

    if ($('heroRandomBtn')) $('heroRandomBtn').onclick = randomPick;
    if ($('randomCharacter')) $('randomCharacter').onclick = isVoiceIndex ? () => currentHeroChar && openCharacter(currentHeroChar.id) : isLegacyIndex ? () => openCharacter(10000073) : randomPick;

    if ($('heroListenBtn')) {
      $('heroListenBtn').onclick = () => {
        if (daily?.char && daily?.quote) {
          playQuote(daily.char, daily.quote, [daily.quote], 0);
        } else if (currentHeroChar) {
          setHeroCharacter(currentHeroChar, { syncQuote: true, playSound: true });
        }
      };
    }

    const heroImg = $('heroCharacterImg');
    if (heroImg) {
      heroImg.onclick = () => { if (currentHeroChar) openCharacter(currentHeroChar.id); };
      heroImg.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (currentHeroChar) openCharacter(currentHeroChar.id);
        }
      };
    }

    const meta = document.querySelector('.hero-caption-meta');
    if (meta) {
      meta.onclick = () => { if (currentHeroChar) openCharacter(currentHeroChar.id); };
    }
    await setHeroCharacter(initialId, { syncQuote: true });
  }

  async function rollDaily(first=false) {
    const heroId=currentHeroChar?.id;
    if (currentHeroChar && !first) {
      try {
        const full = await detail(currentHeroChar.id);
        if(currentHeroChar?.id!==heroId)return;
        const list = [...full.friendLines, ...full.actionLines].filter(q => q.audioUrl && q.desc && q.desc.length < 120);
        if (list.length > 1) {
          let q = list[Math.floor(Math.random() * list.length)];
          if (q.title === daily?.quote?.title && list.length > 1) {
            q = list[(list.indexOf(q) + 1) % list.length];
          }
          daily = { char: full, quote: q };
          $('dailyQuote').textContent = `「${q.desc}」`;
          $('dailyAuthor').textContent = `${full.name} · ${q.title}`;
          $('dailyOpen').setAttribute('aria-label', `查看${full.name}的台词`);
          toast(`已换一句【${full.name}】的台词`);
          return;
        }
      } catch {}
    }
    try {
      const candidates = catalog.filter(c => preferred.includes(c.name));
      const c = await detail(first ? (isIndex ? 10000073 : 10000001) : candidates[Math.floor(Math.random() * candidates.length)].id);
      if(currentHeroChar?.id!==heroId)return;
      const list = c.friendLines.filter(q => q.audioUrl && q.desc && q.desc.length < 110);
      const q = first ? list.find(q => q.title.includes('初次见面')) || list[0] : list[Math.floor(Math.random() * list.length)] || c.friendLines[0];
      daily = { char: c, quote: q };
      $('dailyQuote').textContent = `「${(q.desc || '').replace(/。+$/, '')}」`;
      $('dailyAuthor').textContent = `${c.name} · ${q.title}`;
      $('dailyOpen').setAttribute('aria-label', `查看${c.name}的今日台词`);
    } catch {
      toast('今日台词暂未加载，请稍后重试');
    }
  }

  $('dailyShuffle').onclick = () => rollDaily();
  $('dailyOpen').onclick = () => (daily?.char?.id ? openCharacter(daily.char.id) : (currentHeroChar && openCharacter(currentHeroChar.id)));
  $('dailyRead').onclick = () => daily && playQuote(daily.char, daily.quote, [daily.quote], 0);
  if ($('dailyDownloadBtn')) {
    $('dailyDownloadBtn').onclick = () => {
      if (daily?.char && daily?.quote) downloadVoice(daily.char, daily.quote);
      else toast('暂无可下载音频');
    };
  }

  function quoteKey(char,q){return `${char.name}_${q.key||q.title}`}
  function indexQuote(q){if(q.voiceQuote)return q.voiceQuote;return {key:`${q.catName} · ${q.id}`,title:`${q.catName} · ${q.text.slice(0,14)}${q.text.length>14?'…':''}`,desc:q.text,localAudio:q.localAudio,audioUrl:q.audioUrl}}
  function readable(q){return Boolean(q.audioUrl||q.localAudio)}
  function quoteButtons(q,index,source='detail') { const name=source==='index'?(indexCharacter?.name || '纳西妲'):activeCharacter.name, fav=favorites.has(`${name}_${q.key||q.title}`), hasAudio=Boolean(q.audioUrl||q.localAudio); return `<button class="quote-read" data-quote-action="read" data-source="${source}" data-index="${index}" title="${hasAudio?'播放官方角色原声':'暂无原声音频'}" ${hasAudio?'':'disabled'}>${icon('play')}原声</button><button class="quote-action" aria-label="下载${esc(q.title)}原声音频" title="${hasAudio?'下载当前原声音频':'暂无独立原声文件'}" data-quote-action="download" data-source="${source}" data-index="${index}" ${hasAudio?'':'disabled'}>${icon('download-simple')}</button><button class="quote-action ${fav?'favorited':''}" aria-label="${fav?'取消珍藏':'珍藏'}${esc(q.title)}" aria-pressed="${fav}" data-quote-action="favorite" data-source="${source}" data-index="${index}" title="${fav?'取消珍藏':'珍藏台词'}">${icon('heart')}</button><button class="quote-action" aria-label="复制${esc(q.title)}台词" title="复制台词" data-quote-action="copy" data-source="${source}" data-index="${index}">${icon('copy')}</button><button class="quote-action" aria-label="生成${esc(q.title)}海报" title="生成台词海报" data-quote-action="poster" data-source="${source}" data-index="${index}">${icon('image-square')}</button>`; }
  function profileMarkup(c) {
    const fullArt = c.fullArt || c.splashArt;
    return `<aside class="detail-profile ${c.artEdition ? 'art-edition' : ''}" style="${celestialStyle(c)}--element-glow:${c.artAccent ? c.artAccent+'33' : elementColors[c.element]||'#52728555'}">
      <div class="profile-mast"><span>${icon('compass')}${c.artEdition ? '星辉重绘' : '星辉典藏'} · 角色档案</span><span class="profile-stars" aria-label="${c.rarity}星">${'✦'.repeat(c.rarity)}</span></div>
      <div class="detail-art">
        <span class="projection-aura" aria-hidden="true"></span><span class="projection-orbit" aria-hidden="true"><i></i><b></b></span>
        <span class="projection-sigil" aria-hidden="true">${emblem(c.element)}</span><span class="projection-plinth" aria-hidden="true"></span>
        ${c.artEdition ? celestialFxMarkup('projection-celestial-fx') : ''}<div class="detail-sculpture"><img src="${esc(fullArt)}" alt="${esc(c.name)}${c.artEdition ? '完整星辉重绘立绘' : c.fullArt?'完整祈愿立绘':'角色立绘'}" width="${c.fullArtWidth||900}" height="${c.fullArtHeight||1100}" decoding="async"></div>
        <button class="artwork-toggle" id="artworkToggle" aria-expanded="false" aria-controls="detailLayout">${icon('image-square')}欣赏立绘</button>
      </div>
      <div class="detail-dossier"><div class="detail-region">${emblem(c.element)}${esc(c.region)}<span>·</span>${esc(c.element)}元素</div>
        <h2 id="modalHeroName">${esc(c.name)}</h2><p class="detail-title">${esc(c.title)}</p><p class="detail-lore">${esc(c.description)}</p>${c.artCredit ? `<p class="art-edition-credit">${esc(c.artCredit)}</p>` : ''}
        <div class="detail-metadata"><span>${esc(c.weapon)}</span><span>生日 ${esc(c.birthday)}</span><span>${esc(c.constellation)}</span></div>
        <dl class="detail-voices"><dt>中配</dt><dd>${esc(c.cv.chinese)}</dd><dt>日配</dt><dd>${esc(c.cv.japanese)}</dd><dt>英配</dt><dd>${esc(c.cv.english)}</dd></dl>
      </div></aside>`;
  }
  function toggleArtworkView(expanded) {
    projectionMotion.reset();
    const dialog=$('characterDialog'), button=$('artworkToggle');
    if(!button)return;
    expanded ??= !dialog.classList.contains('art-expanded');
    dialog.classList.toggle('art-expanded',expanded);button.setAttribute('aria-expanded',String(expanded));
    button.innerHTML=icon(expanded?'arrow-left':'image-square')+(expanded?'返回台词':'欣赏立绘');
    $('detailLayout').scrollTop=0;
  }
  async function openCharacter(id) {
    cardMotion.reset();projectionMotion.reset();$('characterDialog').classList.remove('art-expanded');
    const token=++modalToken, c=catalog.find(c=>c.id===id);if(!c)return;
    lastFocus=document.activeElement;activeCharacter=c;quoteTab='friend';quoteQuery=!isIndex&&state.search&&!c.metadataSearch.includes(normal(state.search))?state.search:'';quoteLimit=20;
    $('detailLayout').innerHTML=`<div class="loading-state" style="grid-column:1/-1"><h2 id="modalHeroName">${esc(c.name)}</h2><p>正在打开角色档案…</p></div>`;
    document.body.classList.add('dialog-open');$('detailPlayerSlot').append($('audioPlayer'));if(!$('characterDialog').open)$('characterDialog').showModal();
    try { const full=await detail(id);if(token!==modalToken||!$('characterDialog').open)return;activeCharacter=full;
      if(quoteQuery&&!full.friendLines.some(q=>normal(q.title+' '+q.desc).includes(normal(quoteQuery)))&&full.actionLines.some(q=>normal(q.title+' '+q.desc).includes(normal(quoteQuery))))quoteTab='action';
      $('detailLayout').innerHTML=`${profileMarkup(c)}<section class="detail-content"><div class="detail-topbar"><span class="detail-kicker">VOICE MEMORIES · 旅途留声</span><h3>旅途中的声音</h3><p>珍藏一句对白，重温一段回忆</p></div>${c.voicePackageUrl?`<div class="detail-download">${icon('music-notes')}<div class="detail-download-text"><strong>${esc(c.name)} · 中文原声包</strong><span>第三方语音归档 · 下载收听角色原声</span></div><a class="button" href="${esc(c.voicePackageUrl)}" target="_blank" rel="noopener noreferrer" aria-label="下载${esc(c.name)}中文原声包">${icon('download-simple')}下载</a></div>`:''}<label class="detail-search">${icon('magnifying-glass')}<span class="sr-only">搜索当前角色台词</span><input id="quoteSearch" type="search" placeholder="搜索这个角色的台词…" value="${esc(quoteQuery)}" autocomplete="off"></label><div class="detail-tabs" role="tablist" aria-label="台词分类"><button class="detail-tab" data-quote-tab="friend" role="tab" aria-selected="true" aria-controls="modalQuotesStream">角色故事 <span>${full.friendLines.length}</span></button><button class="detail-tab" data-quote-tab="action" role="tab" aria-selected="false" aria-controls="modalQuotesStream">战斗探索 <span>${full.actionLines.length}</span></button><button class="detail-tab" data-quote-tab="favorites" role="tab" aria-selected="false" aria-controls="modalQuotesStream">珍藏</button><button class="icon-button continuous-toggle" id="autoplayToggleBtn" aria-label="连续播放" aria-pressed="${player.continuous}" title="连续播放">${icon('repeat')}</button></div><div class="quote-list" id="modalQuotesStream" role="tabpanel" aria-label="角色台词"></div></section>`;
      $('artworkToggle').onclick=()=>toggleArtworkView();
      document.querySelectorAll('[data-quote-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.quoteTab===quoteTab)));
      $('quoteSearch').addEventListener('input',e=>{quoteQuery=e.target.value;quoteLimit=20;renderQuotes()});$('autoplayToggleBtn').onclick=()=>{player.continuous=!player.continuous;$('autoplayToggleBtn').setAttribute('aria-pressed',String(player.continuous));toast(player.continuous?'已开启连续播放':'已关闭连续播放')};renderQuotes();$('modalExitCross').focus();
    }catch{if(token!==modalToken)return;$('detailLayout').innerHTML=`<div class="empty-state"><h2 id="modalHeroName">档案未能加载</h2><p>请检查本地服务后重试</p><button class="button" data-character="${id}">重新加载</button></div>`}
  }
  function renderQuotes() {
    if(!activeCharacter?.friendLines)return;
    let list=quoteTab==='action'?activeCharacter.actionLines:quoteTab==='favorites'?[...activeCharacter.friendLines,...activeCharacter.actionLines].filter(q=>favorites.has(quoteKey(activeCharacter,q))):activeCharacter.friendLines;
    const q=normal(quoteQuery);currentQuotes=q?list.filter(line=>normal(line.title+' '+line.desc).includes(q)):list;
    const root=$('modalQuotesStream');root.innerHTML=currentQuotes.length?currentQuotes.slice(0,quoteLimit).map((line,i)=>`<article class="quote-card ${player.char?.id===activeCharacter.id&&player.quote?.title===line.title?'playing':''}" data-quote-row="${i}"><div class="quote-heading"><span class="quote-number">${String(i+1).padStart(2,'0')}</span><h4>${highlight(line.title,quoteQuery)}</h4></div><p class="quote-text">${highlight(line.desc||'（角色动作 / 拟音，无台词文本）',quoteQuery)}</p><div class="quote-actions">${quoteButtons(line,i)}</div></article>`).join('')+(currentQuotes.length>quoteLimit?`<div class="quote-load-more"><button class="button" data-action="more-quotes">再显示 ${Math.min(20,currentQuotes.length-quoteLimit)} 条台词 ${icon('caret-down')}</button></div>`:''):`<div class="empty-state"><h3>${quoteTab==='favorites'?'还没有珍藏这位旅伴的台词':'没有找到这句台词'}</h3><p>${quoteTab==='favorites'?'点击台词旁的爱心，即可保存':'试试其他关键词，或切换台词分类'}</p></div>`;
    if(activeCharacter.name==='纳西妲'&&!isLegacyIndex)root.insertAdjacentHTML('beforeend',`<a class="special-link" href="nahida_player.html?legacy=1">浏览纳西妲 1,814 条完整语音与铃声索引 ${icon('arrow-up-right')}</a>`);
  }
  function afterClose(){modalToken++;document.body.classList.remove('dialog-open');document.body.append($('audioPlayer'));document.body.append($('celestialToast'));const restore=lastFocus?.isConnected?lastFocus:document.querySelector(`[data-character="${activeCharacter?.id}"]`);restore?.focus({preventScroll:true})}
  $('modalExitCross').onclick=()=>$('characterDialog').close();$('characterDialog').addEventListener('close',afterClose);
  $('characterDialog').addEventListener('cancel',event=>{if($('characterDialog').classList.contains('art-expanded')){event.preventDefault();toggleArtworkView(false);$('artworkToggle').focus()}});
  $('characterDialog').addEventListener('click',e=>{if(e.target===$('characterDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
  async function copy(text) { try{await navigator.clipboard.writeText(text);toast('台词已复制')}catch{toast('复制未成功，可直接长按或选中台词复制')} }
  async function poster(char,q) {
    toast('正在生成台词海报…');
    try { const image=new Image();image.src=char.splashArt;await image.decode();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=900;ctx.font='26px "Microsoft YaHei",sans-serif';const lines=[];let current='';for(const ch of q.desc||'（角色动作 / 拟音）'){if(ctx.measureText(current+ch).width>710){lines.push(current);current=ch}else current+=ch}if(current)lines.push(current);canvas.height=Math.max(1150,760+lines.length*45);ctx.fillStyle='#142331';ctx.fillRect(0,0,900,canvas.height);ctx.strokeStyle='#d9c49a';ctx.lineWidth=2;ctx.strokeRect(32,32,836,canvas.height-64);ctx.textAlign='center';ctx.fillStyle='#d9c49a';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText('提 瓦 特 语 录 秘 典',450,87);const ratio=Math.min(650/image.naturalWidth,420/image.naturalHeight);ctx.drawImage(image,(900-image.naturalWidth*ratio)/2,122,image.naturalWidth*ratio,image.naturalHeight*ratio);ctx.fillStyle='#eef2f5';ctx.font='38px "Microsoft YaHei",sans-serif';ctx.fillText(char.name,450,590);ctx.fillStyle='#d9c49a';ctx.font='19px "Microsoft YaHei",sans-serif';ctx.fillText(q.title,450,635,730);ctx.fillStyle='#e5ebef';ctx.textAlign='left';ctx.font='26px "Microsoft YaHei",sans-serif';lines.forEach((line,i)=>ctx.fillText(line,95,715+i*45));ctx.textAlign='center';ctx.fillStyle='#9cabb8';ctx.font='14px sans-serif';ctx.fillText('愿此行，终抵群星 · 原神同人语录档案',450,canvas.height-65);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图片导出失败');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${char.name}_${q.title.replace(/[\\/:*?"<>|]/g,'_')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('台词海报已生成并下载') }catch{toast('海报生成失败，请稍后重试')}
  }
  async function downloadVoice(char,q) {
    const audioSrc = q.audioUrl || q.localAudio;
    if(!audioSrc){ toast('此条对白暂无独立音频可供下载，可下载上方角色全量原声包'); return; }
    toast(`正在准备下载【${char.name} · ${q.title}】…`);
    try {
      const ext = audioSrc.endsWith('.ogg') ? '.ogg' : (audioSrc.endsWith('.wav') ? '.wav' : '.mp3');
      const filename = `[${char.name}]_${q.title.replace(/[\\/:*?"<>|]/g, '_')}${ext}`;
      const res = await fetch(audioSrc);
      if(!res.ok) throw Error('网络请求未成功');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      toast(`已成功开始下载：${filename}`);
    } catch(e) {
      const a = document.createElement('a');
      a.href = audioSrc;
      a.target = '_blank';
      a.download = `[${char.name}]_${q.title}.mp3`;
      a.click();
      toast('已在新标签页打开音频下载通道');
    }
  }

  const audio=$('masterAudio'),player={char:null,quote:null,queue:[],index:0,mode:'speech',status:'idle',continuous:false,token:0,volume:1,muted:false,timer:null};
  function formatTime(n){return Number.isFinite(n)?`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`:'--:--'}
  function setStatus(status){player.status=status;const playing=status==='playing'||status==='loading';playing?musicBox.duck():musicBox.unduck();$('masterPlayToggleBtn').innerHTML=icon(playing?'pause':'play');$('masterPlayToggleBtn').setAttribute('aria-label',playing?'暂停播放':'继续播放');$('playbackMode').textContent=status==='loading'?'准备官方原声…':status==='error'?'播放未成功':'官方角色原声';$('dockSnippet').textContent='官方角色原声 · '+(player.quote?.desc||'');}
  async function startVoicePlayback(token) {
    setStatus('loading');
    try {
      await audio.play();
      if (token===player.token && !audio.paused) setStatus('playing');
    } catch(error) {
      if (token!==player.token) return;
      setStatus(error.name==='NotAllowedError'?'paused':'error');
      toast(error.name==='NotAllowedError'?'点击播放，继续聆听原声':'官方原声加载失败，请检查网络或使用原声包下载');
    }
  }
  function cancelPlayback(){player.token++;clearTimeout(player.timer);audio.pause();audio.removeAttribute('src');audio.load();if(typeof musicBox!=='undefined'&&musicBox.unduck)musicBox.unduck()}
  function finish(token){if(token!==player.token)return;if(typeof musicBox!=='undefined'&&musicBox.unduck)musicBox.unduck();setStatus('ended');$('progressRange').value=100;if(player.continuous){let next=player.index+1;while(next<player.queue.length&&!readable(player.queue[next]))next++;if(next<player.queue.length)player.timer=setTimeout(()=>playQuote(player.char,player.queue[next],player.queue,next),500)}}
  async function playQuote(char,q,queue,index) {
    const audioSrc = q.audioUrl || q.localAudio;
    if(!audioSrc){toast(`【${char.name} · ${q.title}】暂无独立官方原声文件，可下载上方原声包收听`);return}
    cancelPlayback();if(typeof musicBox!=='undefined'&&musicBox.duck)musicBox.duck();Object.assign(player,{char,quote:q,queue:[...queue],index,mode:'audio'});const token=player.token;
    $('audioPlayer').hidden=false;document.body.classList.add('has-player');$('dockAvatar').src=char.avatarImg;$('dockAvatar').alt=char.name;$('dockTitle').textContent=`${char.name} · ${q.title}`;$('curTimeText').textContent='00:00';$('totalTimeText').textContent='--:--';$('progressRange').value=0;$('progressRange').disabled=false;$('progressRange').title='拖动调整进度';setStatus('loading');
    document.querySelectorAll('.quote-card.playing').forEach(row=>row.classList.remove('playing'));if(activeCharacter?.id===char.id){const i=currentQuotes.findIndex(line=>line.title===q.title);document.querySelector(`[data-quote-row="${i}"]`)?.classList.add('playing')}
    audio.src=audioSrc;audio.volume=player.volume;audio.muted=player.muted;
    await startVoicePlayback(token);
  }
  audio.addEventListener('timeupdate',()=>{if(player.mode!=='audio')return;$('curTimeText').textContent=formatTime(audio.currentTime);$('totalTimeText').textContent=formatTime(audio.duration);if(audio.duration)$('progressRange').value=audio.currentTime/audio.duration*100});
  audio.addEventListener('ended',()=>{if(player.mode==='audio'&&audio.ended&&(player.status==='playing'||player.status==='loading'))finish(player.token)});audio.addEventListener('error',()=>{if(player.mode==='audio'&&audio.error&&audio.getAttribute('src')){setStatus('error');toast('原声文件加载失败，请使用原声包下载')}});
  $('masterPlayToggleBtn').onclick=()=>{if(!player.quote)return;if(player.status==='playing'||player.status==='loading'){player.token++;clearTimeout(player.timer);audio.pause();setStatus('paused')}else if(player.status==='paused'&&audio.getAttribute('src')){startVoicePlayback(++player.token)}else playQuote(player.char,player.quote,player.queue,player.index)};
  function moveTrack(direction){if(!player.queue.length)return;let idx=player.index;for(let n=0;n<player.queue.length;n++){idx=(idx+direction+player.queue.length)%player.queue.length;if(readable(player.queue[idx])){playQuote(player.char,player.queue[idx],player.queue,idx);return}}}
  $('prevQuoteBtn').onclick=()=>moveTrack(-1);$('nextQuoteBtn').onclick=()=>moveTrack(1);
  $('progressRange').oninput=e=>{if(player.mode==='audio'&&Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration};
  $('volSlider').oninput=e=>{player.volume=Number(e.target.value);audio.volume=player.volume};
  $('volMuteBtn').onclick=()=>{player.muted=!player.muted;audio.muted=player.muted;$('volMuteBtn').innerHTML=icon(player.muted?'speaker-slash':'speaker-high');$('volMuteBtn').setAttribute('aria-label',player.muted?'恢复声音':'静音');};
  $('dockDownloadBtn').onclick=()=>{if(player.char&&player.quote)downloadVoice(player.char,player.quote);else toast('请先选择或播放一条台词');};
  $('closePlayer').onclick=()=>{cancelPlayback();setStatus('idle');$('audioPlayer').hidden=true;document.body.classList.remove('has-player')};
  document.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.character){openCharacter(Number(button.dataset.character));return}
    if(button.dataset.region){state.region=button.dataset.region;state.page=1;render();return}
    if(button.dataset.element){state.element=button.dataset.element;state.page=1;render();return}
    if(button.dataset.category){state.category=button.dataset.category;state.page=1;render();return}
    if(button.dataset.page){state.page=Number(button.dataset.page);render();$('archiveTitle').scrollIntoView({block:'start'});return}
    if(button.dataset.quoteTab){quoteTab=button.dataset.quoteTab;quoteLimit=20;document.querySelectorAll('[data-quote-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));renderQuotes();$('modalQuotesStream').scrollTop=0;return}
    if(button.dataset.action==='reset'){reset();return}if(button.dataset.action==='retry-search'){runSearch();return}if(button.dataset.action==='retry-character-index'){setHeroCharacter(currentHeroChar,{syncQuote:true});return}if(button.dataset.action==='more-quotes'){quoteLimit+=20;renderQuotes();return}
    if(button.dataset.quoteAction){const source=button.dataset.source,i=Number(button.dataset.index),char=source==='index'?(indexCharacter || await detail(10000073)):activeCharacter,queue=source==='index'?filtered.map(indexQuote):currentQuotes,q=queue[i];if(!q)return;
      const action=button.dataset.quoteAction;if(action==='read')playQuote(char,q,queue,i);if(action==='download')downloadVoice(char,q);if(action==='copy')copy(q.desc);if(action==='poster')poster(char,q);if(action==='favorite'){const key=quoteKey(char,q),adding=!favorites.has(key);adding?favorites.add(key):favorites.delete(key);saveFavorites();if(source==='index')render();else if(quoteTab==='favorites')renderQuotes();else{button.classList.toggle('favorited',adding);button.setAttribute('aria-pressed',String(adding));button.setAttribute('aria-label',`${adding?'取消珍藏':'珍藏'}${q.title}`);button.title=adding?'取消珍藏':'珍藏台词'}if(!isIndex)render();toast(adding?'已珍藏这句台词':'已取消珍藏')}
    }
  });
  document.addEventListener('keydown',e=>{const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);if(e.key==='/'&&!editing&&!$('characterDialog').open){e.preventDefault();$('masterSearchInput').focus()}if(e.key==='Escape'&&!$('characterDialog').open&&document.activeElement===$('masterSearchInput')){$('clearSearch').click();$('masterSearchInput').blur()}});
  window.addEventListener('pagehide',event=>{searchVersion++;clearTimeout(searchTimer);cancelWorkerSearch?.();cancelPlayback();setStatus(player.quote?'paused':'idle');musicBox.suspend();worker?.terminate();worker=null;projectionMotion.reset();if(event.persisted){cardMotion.suspend();atmosphere.suspend();celestialMotion.suspend()}else{cardMotion.destroy();atmosphere.destroy();projectionMotion.destroy();celestialMotion.destroy()}});
  window.addEventListener('pageshow',event=>{if(event.persisted){cardMotion.refresh();atmosphere.resume();celestialMotion.resume();musicBox.resume();if(state.search&&!isIndex)runSearch()}});
  
  // ==================== TEYVAT MUSIC BOX ====================
  const musicTracks = [
    {
      id: 'dawn-winery',
      name: '晨曦酒庄',
      title: '晨曦酒庄 Dawn Winery Theme',
      album: '风与牧歌之城 City of Winds and Idylls',
      region: '蒙德',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_mondstadt.webp',
      src: 'assets/audio/music/01_dawn_winery.flac',
      srcFallback: 'assets/audio/music/01_dawn_winery.mp3',
      quality: '24-bit / 48kHz FLAC 无损母带',
      duration: '01:07',
      isLocal: true,
      desc: '晨曦初破，微风轻拂过千风原野与晨曦酒庄的葡萄藤架'
    },
    {
      id: 'twilight-serenity',
      name: '宁静的黄昏',
      title: '宁静的黄昏 Twilight Serenity',
      album: '风与牧歌之城 City of Winds and Idylls',
      region: '蒙德',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_mondstadt.webp',
      src: 'assets/audio/music/02_twilight_serenity.flac',
      srcFallback: 'assets/audio/music/02_twilight_serenity.mp3',
      quality: '24-bit / 48kHz FLAC 无损母带',
      duration: '01:40',
      isLocal: true,
      desc: '原神主题曲变奏，风车在暮色中慢转，星辰随晚霞悄然升起'
    },
    {
      id: 'moon-in-ones-cup',
      name: '杯中明月',
      title: '杯中明月 Moon in One\'s Cup',
      album: '皎月云间之梦 Jade Moon Upon a Sea of Clouds',
      region: '璃月',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_liyue.webp',
      src: 'assets/audio/music/03_moon_in_ones_cup.flac',
      srcFallback: 'assets/audio/music/03_moon_in_ones_cup.mp3',
      quality: '24-bit / 48kHz FLAC 无损母带',
      duration: '01:54',
      isLocal: true,
      desc: '月涌大江流，千帆过尽，璃月港万家灯火与古琴交织成梦'
    },
    {
      id: 'inazuma',
      name: '稻妻',
      title: '稻妻 Inazuma',
      album: '寂远与恒常之歌 Realm of Tranquil Eternity',
      region: '稻妻',
      artist: '陈致逸 / 东京爱乐乐团 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_inazuma.webp',
      src: 'assets/audio/music/04_inazuma.flac',
      srcFallback: 'assets/audio/music/04_inazuma.mp3',
      quality: '24-bit / 48kHz FLAC 无损母带',
      duration: '04:18',
      isLocal: true,
      desc: '雷鸣与紫樱之下，三味线与管弦乐谱写永恒与刹那的史诗'
    },
    {
      id: 'fontaine',
      name: '枫丹',
      title: '枫丹 Fontaine',
      album: '白露澈明之泉 Fountain of Belleau',
      region: '枫丹',
      artist: '苑迪萌 / 伦敦交响乐团 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_fontaine.webp',
      src: 'assets/audio/music/05_fontaine.flac',
      srcFallback: 'assets/audio/music/05_fontaine.mp3',
      quality: '24-bit / 48kHz FLAC 无损母带',
      duration: '03:49',
      isLocal: true,
      desc: '优雅宏大的水之交响，巡轨船与欧庇克莱歌剧院的律典之音'
    },
    {
      id: 'main-theme',
      name: '原神主题曲',
      title: '原神主题曲 Genshin Impact Main Theme',
      album: '风与异乡人 The Wind and the Star Traveler',
      region: '提瓦特',
      artist: '陈致逸 / 伦敦爱乐乐团 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_main_theme.webp',
      src: 'assets/audio/music/06_main_theme.mp3',
      srcFallback: 'assets/audio/music/06_main_theme.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '01:46',
      isLocal: true,
      desc: '推开浮空岛星辉之门，旅者迈向七国无垠星空的壮丽开篇'
    },
    {
      id: 'sumeru',
      name: '须弥',
      title: '须弥 Sumeru',
      album: '智睿与欢跃的境界 Forest of Jñāna and Vidyā',
      region: '须弥',
      artist: '陈致逸 / 伦敦爱乐乐团 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_sumeru.webp',
      src: 'assets/audio/music/07_sumeru.mp3',
      srcFallback: 'assets/audio/music/07_sumeru.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '04:45',
      isLocal: true,
      desc: '雨林葱茏，智慧之叶翩跹轻舞，奥摩斯港的号角回荡在绿茵之间'
    },
    {
      id: 'la-vaguelette',
      name: '轻涟',
      title: '轻涟 (芙宁娜) La vaguelette',
      album: '轻涟 La vaguelette',
      region: '枫丹',
      artist: 'Cécilia Cara / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_fontaine.webp',
      src: 'assets/audio/music/08_la_vaguelette.mp3',
      srcFallback: 'assets/audio/music/08_la_vaguelette.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '04:40',
      isLocal: true,
      desc: '水仙的誓言与歌剧院的独舞，芙宁娜跨越五百年的清澈咏叹'
    },
    {
      id: 'rex-incognito',
      name: '岩壑之崩',
      title: '岩壑之崩 (钟离) Rex Incognito',
      album: '闪耀的群星 Vol. 1',
      region: '角色主题',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_liyue.webp',
      src: 'assets/audio/music/09_rex_incognito.mp3',
      srcFallback: 'assets/audio/music/09_rex_incognito.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '01:52',
      isLocal: true,
      desc: '天动万象，磐石如磐，岩王帝君俯瞰千秋璃月之华美篇章'
    },
    {
      id: 'termination-of-desires',
      name: '斩破断绝的无想',
      title: '斩破断绝的无想 (雷电将军) Termination of Desires',
      album: '闪耀的群星 Vol. 2',
      region: '角色主题',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_inazuma.webp',
      src: 'assets/audio/music/10_termination_of_desires.mp3',
      srcFallback: 'assets/audio/music/10_termination_of_desires.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '02:40',
      isLocal: true,
      desc: '鸣雷裁决，无想一刀破开万千虚妄，一心净土唯此永恒'
    },
    {
      id: 'surasthana-fantasia',
      name: '净善的遐想',
      title: '净善的遐想 (纳西妲) Surasthāna Fantasia',
      album: '闪耀的群星 Vol. 3',
      region: '角色主题',
      artist: 'HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_sumeru.webp',
      src: 'assets/audio/music/11_surasthana_fantasia.mp3',
      srcFallback: 'assets/audio/music/11_surasthana_fantasia.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '02:18',
      isLocal: true,
      desc: '摇曳的梦之秋千，草之神纯真眼眸中映照出的绿茵奇迹'
    },
    {
      id: 'parousia-diluvi',
      name: '沉降的启示',
      title: '沉降的启示 (那维莱特) Parousia Diluvi',
      album: '闪耀的群星 Vol. 4',
      region: '角色主题',
      artist: 'HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_fontaine.webp',
      src: 'assets/audio/music/12_parousia_diluvi.mp3',
      srcFallback: 'assets/audio/music/12_parousia_diluvi.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '02:59',
      isLocal: true,
      desc: '古龙的审判与潮汐的叹息，大审判官法杖之下众生平等'
    },
    {
      id: 'devastation-and-redemption',
      name: '神女劈观·唤情',
      title: '神女劈观·唤情 (云堇 / 申鹤) Devastation and Redemption',
      album: '飞彩镌流年 Fleeting Colors in Flight',
      region: '璃月',
      artist: '杨扬 / 陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_liyue.webp',
      src: 'assets/audio/music/13_devastation_and_redemption.mp3',
      srcFallback: 'assets/audio/music/13_devastation_and_redemption.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '02:40',
      isLocal: true,
      desc: '曲高未必人不识，自有知音和清词，戏腔惊艳四海'
    },
    {
      id: 'emberfire',
      name: '烬火',
      title: '烬火 (阿蕾奇诺) Emberfire',
      album: '烬火 Emberfire',
      region: '枫丹',
      artist: 'HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_fontaine.webp',
      src: 'assets/audio/music/14_emberfire.mp3',
      srcFallback: 'assets/audio/music/14_emberfire.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '02:52',
      isLocal: true,
      desc: '赤月当空，壁炉之家的暗影与烈焰交织的命运终曲'
    },
    {
      id: 'path-of-yaksha',
      name: '靖妖降魔',
      title: '靖妖降魔 (魈) Path of Yaksha',
      album: '闪耀的群星 Vol. 2',
      region: '角色主题',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_liyue.webp',
      src: 'assets/audio/music/15_path_of_yaksha.mp3',
      srcFallback: 'assets/audio/music/15_path_of_yaksha.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '01:43',
      isLocal: true,
      desc: '傩面戴起，夜叉纵横千岩，以孤勇斩断世间怨怼'
    },
    {
      id: 'broker-betwixt-life-and-death',
      name: '生老病死',
      title: '生老病死 (胡桃) Broker Betwixt Life and Death',
      album: '闪耀的群星 Vol. 2',
      region: '角色主题',
      artist: '陈致逸 / HOYO-MiX',
      cover: 'assets/audio/music/covers/cover_liyue.webp',
      src: 'assets/audio/music/16_broker_betwixt_life_and_death.mp3',
      srcFallback: 'assets/audio/music/16_broker_betwixt_life_and_death.mp3',
      quality: '320kbps 殿堂级母带',
      duration: '01:23',
      isLocal: true,
      desc: '往生堂第七十七代堂主，幽蝶起舞戏弄尘世悲欢'
    }
  ];

  let musicAudio = null;
  const musicBox = {
    index: 0,
    currentTrack: null,
    playing: false,
    volume: 0.65,
    muted: false,
    lastAudibleVolume: 0.65,
    loopMode: 'list',
    ducked: false,
    fadeTimer: null,
    fullCatalog: null,
    catalogLoading: false,
    catalogError: false,
    activeTab: 'all',
    searchKeyword: '',
    visibleTracks: [],
    renderLimit: 80,
    searchDebounceTimer: null,
    closingAnimation: null,
    trackAnimations: [],
    renderedTrackId: null,
    downloading: false,
    playToken: 0,
    wantsPlayback: false,
    loading: false,
    playbackStatus: 'paused',
    sources: [],
    sourceIndex: 0,
    loadTimer: null,
    resumeTime: 0,
    recoveryAttempts: 0,
    failedTracks: new Set(),
    history: [],

    canAnimate() {
      return !document.hidden && document.documentElement.dataset.effects !== 'off'
        && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;
    },

    closeDialog() {
      const dialog = $('musicBoxDialog');
      if (!dialog?.open || this.closingAnimation) return;
      if (!this.canAnimate() || !dialog.animate) { dialog.close(); return; }
      const animation = dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(8px)'}], {duration:180,easing:'ease-in',fill:'forwards'});
      this.closingAnimation = animation;
      animation.finished.then(() => { if (dialog.open) dialog.close(); }).catch(() => {}).finally(() => {
        animation.cancel();
        if (this.closingAnimation === animation) this.closingAnimation = null;
      });
    },

    getActiveTrackId() {
      if (!this.currentTrack) return null;
      const tracks = this.fullCatalog || musicTracks;
      const audioRef = track => (track.localUrl || track.src || track.streamUrl || '').replace(/^\/+/, '');
      return (tracks.find(track => track.id === this.currentTrack.id)
        || tracks.find(track => audioRef(track) && audioRef(track) === audioRef(this.currentTrack))
        || tracks.find(track => track.title === this.currentTrack.title))?.id;
    },
    
    init() {
      try {
        const savedVol = localStorage.getItem('teyvat_music_vol');
        if (savedVol !== null && Number.isFinite(Number(savedVol))) this.volume = Math.max(0, Math.min(1, Number(savedVol)));
        this.muted = this.volume === 0;
        if (this.volume > 0) this.lastAudibleVolume = this.volume;
        const savedIdx = localStorage.getItem('teyvat_music_idx');
        if (savedIdx !== null && musicTracks[Number(savedIdx)]) this.index = Number(savedIdx);
        const savedMode = localStorage.getItem('teyvat_music_mode');
        if (savedMode && ['list', 'single', 'random'].includes(savedMode)) this.loopMode = savedMode;
      } catch {}
      this.updateLoopModeUI();

      try {
        musicAudio = new Audio();
        musicAudio.preload = 'none';
        musicAudio.volume = this.volume;
        musicAudio.muted = this.muted;
      } catch(e) {
        musicAudio = { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {}, canPlayType: () => '' };
      }

      this.currentTrack = musicTracks[this.index] || musicTracks[0];
      this.updateCatalogUI();
      this.filterAndRender();
      this.updateTrackUI();

      // Background loading of full 1105-track master catalog
      if (typeof window !== 'undefined' && !window.happyDOM) {
        this.loadCatalog();
      }
      $('musicCatalogRetry').onclick=()=>this.loadCatalog();

      if (musicAudio && musicAudio.addEventListener) {
        musicAudio.addEventListener('timeupdate', () => this.onTimeUpdate());
        musicAudio.addEventListener('ended', () => { if (musicAudio.ended && this.wantsPlayback) this.onEnded(); });
        musicAudio.addEventListener('playing', () => { if (this.wantsPlayback && !musicAudio.paused && musicAudio.readyState >= 2) this.setPlaying(true); });
        musicAudio.addEventListener('pause', () => {
          if (musicAudio.paused && !this.loading && !musicAudio.ended) { this.wantsPlayback = false; this.setPlaying(false); }
        });
        musicAudio.addEventListener('loadedmetadata', () => {
          if (this.resumeTime && Number.isFinite(musicAudio.duration)) musicAudio.currentTime = Math.min(this.resumeTime, Math.max(0,musicAudio.duration-.1));
          this.resumeTime = 0;
          this.onTimeUpdate();
        });
        musicAudio.addEventListener('waiting', () => {
          if (this.wantsPlayback) { this.setPlaybackState('loading'); this.armLoadTimer(this.playToken); }
        });
        musicAudio.addEventListener('error', () => { if (this.wantsPlayback && musicAudio.error) this.failSource(this.playToken); });
      }

      const openDialog = () => {
        const dlg = $('musicBoxDialog');
        if (dlg && !dlg.open && dlg.showModal) {
          document.documentElement.classList.add('music-dialog-open');
          document.body.classList.add('music-dialog-open');
          dlg.dataset.resting = String(document.hidden);
          dlg.showModal();
        }
      };
      if ($('musicPillDisc')) $('musicPillDisc').onclick = openDialog;
      if ($('musicPillOpen')) {
        $('musicPillOpen').onclick = openDialog;
        $('musicPillOpen').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDialog(); } };
      }
      if ($('musicBoxClose')) $('musicBoxClose').onclick = () => this.closeDialog();
      if ($('musicBoxDialog')) {
        $('musicBoxDialog').addEventListener('click', e => {
          if (e.target === $('musicBoxDialog')) this.closeDialog();
        });
        $('musicBoxDialog').addEventListener('cancel', e => { e.preventDefault(); this.closeDialog(); });
        $('musicBoxDialog').addEventListener('close', () => {
          document.documentElement.classList.remove('music-dialog-open');
          document.body.classList.remove('music-dialog-open');
          this.trackAnimations.forEach(animation => animation.cancel());
          this.trackAnimations = [];
        });
        document.addEventListener('visibilitychange', () => {
          $('musicBoxDialog').dataset.resting = String(document.hidden);
        });
      }

      if ($('musicPlayBtn')) $('musicPlayBtn').onclick = (e) => { e.stopPropagation(); this.toggle(); };
      if ($('musicPrevBtn')) $('musicPrevBtn').onclick = (e) => { e.stopPropagation(); this.prev(); };
      if ($('musicNextBtn')) $('musicNextBtn').onclick = (e) => { e.stopPropagation(); this.next(); };

      if ($('musicModalPlay')) $('musicModalPlay').onclick = () => this.toggle();
      if ($('musicModalPrev')) $('musicModalPrev').onclick = () => this.prev();
      if ($('musicModalNext')) $('musicModalNext').onclick = () => this.next();
      if ($('musicDownloadBtn')) $('musicDownloadBtn').onclick = () => this.downloadCurrentTrack();
      if ($('musicLoopModeBtn')) $('musicLoopModeBtn').onclick = () => this.cycleLoopMode();

      // Search input binding
      if ($('musicSearchInput')) {
        $('musicSearchInput').oninput = e => {
          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = setTimeout(() => {
            this.searchKeyword = e.target.value.trim();
            this.renderLimit = 80;
            this.filterAndRender();
          }, 120);
        };
      }

      // Filter tabs binding
      if ($('musicFilterTabs')) {
        $('musicFilterTabs').querySelectorAll('.music-tab-btn').forEach(btn => {
          btn.onclick = () => {
            $('musicFilterTabs').querySelectorAll('.music-tab-btn').forEach(b => {
              b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            this.activeTab = btn.dataset.tab || 'all';
            this.renderLimit = 80;
            this.filterAndRender();
          };
        });
      }

      if ($('musicSeekBar')) {
        $('musicSeekBar').oninput = e => {
          if (musicAudio && Number.isFinite(musicAudio.duration)) {
            musicAudio.currentTime = (Number(e.target.value) / 100) * musicAudio.duration;
            this.onTimeUpdate();
          }
        };
      }

      if ($('musicVolSlider')) {
        $('musicVolSlider').value = Math.round(this.volume * 100);
        $('musicVolSlider').oninput = e => {
          const val = Number(e.target.value) / 100;
          this.setVolume(val);
        };
      }
      if ($('musicMuteBtn')) {
        $('musicMuteBtn').onclick = () => this.toggleMute();
      }
      this.updateVolumeUI();

      this.playTrack(this.currentTrack, false);
      this.attemptAutoplay();
    },

    async loadCatalog() {
      if(this.catalogLoading)return;
      this.catalogLoading=true;this.catalogError=false;this.updateCatalogUI();
      try {
        const response=await fetch('assets/audio/music/music_catalog.json');
        if(!response.ok)throw Error('曲库连接失败');
        const data=await response.json();
        if(!Array.isArray(data?.tracks)||!data.tracks.length)throw Error('曲库为空');
        this.fullCatalog=data.tracks;
        this.filterAndRender();
      } catch { this.catalogError=true; }
      finally { this.catalogLoading=false;this.updateCatalogUI(); }
    },

    updateCatalogUI() {
      const source=this.fullCatalog||musicTracks;
      $('musicTotalCountBadge').textContent=`${source.length} 首${this.fullCatalog?'全本收录':this.catalogError?'精选 · 全曲库暂未连接':'精选'}`;
      $('musicCatalogRetry').hidden=!this.catalogError;
      for(const [tab,label] of [['all','全部'],['local','精选母带'],['character','角色主题']]){
        const button=document.querySelector(`.music-tab-btn[data-tab="${tab}"]`);
        if(button)button.textContent=`${label} (${this.getEffectiveList(tab,'').length})`;
      }
    },

    getEffectiveList(tab=this.activeTab, keyword=this.searchKeyword) {
      const source = this.fullCatalog || musicTracks;
      let list = source;
      const kw = (keyword || '').toLowerCase();

      if (tab === 'local') {
        list = list.filter(t => t.isLocal || (t.src && !t.src.startsWith('http')));
      } else if (tab === 'character') {
        list = list.filter(t => t.region === '角色主题' || t.category === '角色主题' || (t.album && t.album.includes('群星')) || (t.albumZh && t.albumZh.includes('群星')));
      } else if (tab === 'mondstadt') {
        list = list.filter(t => t.region === '蒙德');
      } else if (tab === 'liyue') {
        list = list.filter(t => t.region === '璃月');
      } else if (tab === 'inazuma') {
        list = list.filter(t => t.region === '稻妻');
      } else if (tab === 'sumeru') {
        list = list.filter(t => t.region === '须弥');
      } else if (tab === 'fontaine') {
        list = list.filter(t => t.region === '枫丹');
      } else if (tab === 'special') {
        list = list.filter(t => t.region === '特典精选' || t.category === '珍珠之歌' || t.category === '特别单曲');
      }

      if (kw) {
        list = list.filter(t => {
          const title = (t.title || t.name || '').toLowerCase();
          const titleZh = (t.titleZh || '').toLowerCase();
          const titleEn = (t.titleEn || '').toLowerCase();
          const alb = (t.album || t.albumZh || t.albumEn || '').toLowerCase();
          const art = (t.artist || '').toLowerCase();
          const reg = (t.region || '').toLowerCase();
          return title.includes(kw) || titleZh.includes(kw) || titleEn.includes(kw) || alb.includes(kw) || art.includes(kw) || reg.includes(kw);
        });
      }
      return list;
    },

    filterAndRender() {
      this.visibleTracks = this.getEffectiveList();
      this.renderPlaylist();
      if ($('musicTrackList')) $('musicTrackList').scrollTop = 0;
    },

    attemptAutoplay() {
      if (typeof window !== 'undefined' && window.happyDOM) return;
      if (navigator.connection?.saveData) return;
      this.startPlayback(this.playToken);
    },

    streamSource(track) {
      return /^ost-\d+$/.test(track.id || '') && track.streamUrl ? `/api/music-stream?id=${encodeURIComponent(track.id)}` : track.streamUrl;
    },

    getTrackSources(track) {
      const local = track.localUrl || track.src;
      const original = musicTracks.find(item => item.src === local?.replace(/^\//,''));
      const canFlac = Boolean(musicAudio?.canPlayType?.('audio/flac'));
      const candidates = [track.flacUrl,local,track.srcFallback,original?.srcFallback];
      const sources = candidates.filter(Boolean).filter(source => canFlac || !/\.flac(?:\?|$)/i.test(source));
      if (track.streamUrl) sources.push(this.streamSource(track),track.streamUrl);
      if (!sources.length) sources.push(...candidates.filter(Boolean));
      return [...new Set(sources)];
    },

    armLoadTimer(token) {
      clearTimeout(this.loadTimer);
      this.loadTimer = setTimeout(() => this.failSource(token), 20000);
    },

    startPlayback(token) {
      if (!musicAudio?.play || token !== this.playToken) return;
      this.wantsPlayback = true;
      this.setPlaybackState('loading');
      this.armLoadTimer(token);
      let playPromise;
      try { playPromise = musicAudio.play(); } catch (error) { playPromise = Promise.reject(error); }
      Promise.resolve(playPromise).then(() => {
        if (token === this.playToken && this.wantsPlayback && !musicAudio.paused) this.setPlaying(true);
      }).catch(error => {
        if (token !== this.playToken || !this.wantsPlayback) return;
        if (error.name === 'NotAllowedError') {
          clearTimeout(this.loadTimer);
          this.wantsPlayback = false;
          this.setPlaybackState('paused','点击播放，继续聆听原声');
        } else this.failSource(token);
      });
    },

    loadCurrentSource() {
      clearTimeout(this.loadTimer);
      const token = ++this.playToken;
      const shouldPlay = this.wantsPlayback;
      this.setPlaybackState(shouldPlay ? 'loading' : 'paused');
      musicAudio.src = this.sources[this.sourceIndex] || '';
      musicAudio.load?.();
      if (shouldPlay) this.startPlayback(token);
    },

    failSource(token) {
      if (token !== this.playToken || !this.wantsPlayback) return;
      clearTimeout(this.loadTimer);
      this.resumeTime = Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
      if (++this.sourceIndex < this.sources.length) {
        this.loadCurrentSource();
        this.setPlaybackState('loading','正在连接备用音源…');
        return;
      }
      this.failedTracks.add(this.currentTrack?.id);
      const available = (this.visibleTracks.length ? this.visibleTracks : this.fullCatalog || musicTracks).filter(track=>!this.failedTracks.has(track.id));
      const local = available.filter(track=>track.isLocal || track.localUrl || (track.src && !/^https?:/i.test(track.src)));
      const pool = local.length ? local : available;
      if (++this.recoveryAttempts <= 3 && pool.length) {
        const next = pool[Math.floor(Math.random()*pool.length)];
        this.playTrack(next,true,{recovering:true});
        toast(`音源暂不可用，已切换至【${next.titleZh || next.name || next.title}】`);
      } else {
        ++this.playToken;
        this.wantsPlayback = false;
        this.setPlaybackState('error','音源连接失败，点击播放重试或切换曲目');
        toast('音源暂时无法连接，可重试或选择精选母带');
      }
    },

    playTrack(track, autoPlay = true, {recovering=false,recordHistory=true} = {}) {
      if (!track || !musicAudio) return;
      if (recordHistory && this.currentTrack && this.currentTrack.id !== track.id) {
        this.history.push(this.currentTrack);
        if (this.history.length > 50) this.history.shift();
      }
      this.currentTrack = track;
      if (!recovering) { this.recoveryAttempts=0; this.failedTracks.clear(); }
      this.sources = this.getTrackSources(track);
      this.sourceIndex = 0;
      this.resumeTime = 0;
      this.wantsPlayback = autoPlay;
      if ($('musicCurTime')) $('musicCurTime').textContent='00:00';
      if ($('musicTotalTime')) $('musicTotalTime').textContent=track.duration || '--:--';
      if ($('musicSeekBar')) $('musicSeekBar').value=0;
      if ($('musicProgressFill')) $('musicProgressFill').style.width='0%';
      this.updateTrackUI();
      this.loadCurrentSource();
    },

    loadTrack(idx, autoPlay = true) {
      const list = this.visibleTracks.length > 0 ? this.visibleTracks : (this.fullCatalog || musicTracks);
      this.index = (idx + list.length) % list.length;
      try { localStorage.setItem('teyvat_music_idx', String(this.index)); } catch {}
      const track = list[this.index];
      this.playTrack(track, autoPlay);
    },

    toggle() {
      if (!musicAudio) return;
      if (this.playing || this.loading) {
        ++this.playToken;
        clearTimeout(this.loadTimer);
        this.wantsPlayback = false;
        musicAudio.pause();
        this.setPlaying(false);
      } else if (this.playbackStatus === 'error') this.playTrack(this.currentTrack,true);
      else this.startPlayback(++this.playToken);
    },

    next() {
      const list = this.visibleTracks.length > 0 ? this.visibleTracks : (this.fullCatalog || musicTracks);
      if (list.length === 0) return;
      let nextIdx;
      const activeId = this.getActiveTrackId();
      const curIdx = list.findIndex(t => t.id === activeId);
      if (this.loopMode === 'random') {
        const candidates=list.map((track,index)=>index).filter(index=>index!==curIdx);
        nextIdx=candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : 0;
      } else {
        nextIdx = (curIdx + 1) % list.length;
      }
      const nextTrack = list[nextIdx] || list[0];
      this.playTrack(nextTrack, true);
      toast(`已切歌【${nextTrack.titleZh || nextTrack.name || nextTrack.title}】`);
    },

    prev() {
      const list = this.visibleTracks.length > 0 ? this.visibleTracks : (this.fullCatalog || musicTracks);
      if (list.length === 0) return;
      if (this.loopMode === 'random') {
        const previous=this.history.pop();
        if (previous) { this.playTrack(previous,true,{recordHistory:false}); toast(`已返回【${previous.titleZh || previous.name || previous.title}】`); }
        else this.next();
        return;
      }
      if (musicAudio && musicAudio.currentTime > 3) {
        musicAudio.currentTime = 0;
        this.onTimeUpdate();
        this.startPlayback(++this.playToken);
      } else {
        const activeId = this.getActiveTrackId();
        const curIdx = list.findIndex(t => t.id === activeId);
        const prevIdx = ((curIdx < 0 ? 0 : curIdx) - 1 + list.length) % list.length;
        const prevTrack = list[prevIdx] || list[0];
        this.playTrack(prevTrack, true);
        toast(`已切歌【${prevTrack.titleZh || prevTrack.name || prevTrack.title}】`);
      }
    },

    cycleLoopMode() {
      const modes = ['list', 'single', 'random'];
      this.loopMode = modes[(modes.indexOf(this.loopMode) + 1) % modes.length];
      try { localStorage.setItem('teyvat_music_mode', this.loopMode); } catch {}
      this.updateLoopModeUI();
      toast(`音乐盒切换为【${$('musicModeText').textContent}】`);
    },

    updateLoopModeUI() {
      const labels = { 'list': '列表循环', 'single': '单曲循环', 'random': '随机播放' };
      const icons = { 'list': 'repeat', 'single': 'arrow-counter-clockwise', 'random': 'shuffle' };
      if ($('musicLoopModeBtn')) {
        $('musicLoopModeBtn').innerHTML = `${icon(icons[this.loopMode])} <span class="music-mode-text" id="musicModeText">${labels[this.loopMode]}</span>`;
      }
    },

    onEnded() {
      if (this.loopMode === 'single') {
        if (musicAudio) {
          musicAudio.currentTime = 0;
          this.startPlayback(++this.playToken);
        }
      } else {
        this.next();
      }
    },

    setPlaying(state) {
      if (state) { clearTimeout(this.loadTimer); this.recoveryAttempts=0; }
      this.setPlaybackState(state ? 'playing' : 'paused');
    },

    setPlaybackState(status,message) {
      const state = status === 'playing';
      this.playing = state;
      this.loading = status === 'loading';
      this.playbackStatus = status;
      const pill = $('musicBoxPill');
      const dialog = $('musicBoxDialog');
      if (pill) pill.classList.toggle('music-playing', state);
      if (dialog) { dialog.classList.toggle('music-playing', state); dialog.dataset.playback=status; }
      
      const playIcon = this.loading ? icon('arrows-clockwise') : state ? icon('pause') : icon('play');
      if ($('musicPlayBtn')) $('musicPlayBtn').innerHTML = playIcon;
      if ($('musicModalPlay')) {
        $('musicModalPlay').innerHTML = playIcon;
        $('musicModalPlay').setAttribute('aria-label',this.loading?'正在加载，点击暂停':state?'暂停原声':status==='error'?'重试播放':'播放原声');
      }
      if ($('musicAutoplayState')) {
        $('musicAutoplayState').textContent = message || (this.loading ? '正在连接提瓦特原声…' : state ? '正在演奏提瓦特原声' : '留声机已静候等待');
      }
    },

    onTimeUpdate() {
      if (!musicAudio || !Number.isFinite(musicAudio.duration)) return;
      const cur = musicAudio.currentTime;
      const dur = musicAudio.duration;
      if ($('musicCurTime')) $('musicCurTime').textContent = this.formatTime(cur);
      if ($('musicTotalTime')) $('musicTotalTime').textContent = this.formatTime(dur);
      const pct = (cur / dur) * 100;
      if ($('musicProgressFill')) $('musicProgressFill').style.width = `${pct}%`;
      if ($('musicSeekBar') && !$('musicSeekBar').matches(':active')) {
        $('musicSeekBar').value = pct;
      }
    },

    formatTime(sec) {
      if (!sec || isNaN(sec)) return '00:00';
      const s = Math.floor(sec);
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    },

    setVolume(val) {
      if (!Number.isFinite(val)) return;
      this.volume = Math.max(0, Math.min(1, val));
      this.muted = this.volume === 0;
      if (this.volume > 0) this.lastAudibleVolume = this.volume;
      this.applyVolume();
      try { localStorage.setItem('teyvat_music_vol', String(this.volume)); } catch {}
      this.updateVolumeUI();
    },

    toggleMute() {
      if (this.muted) {
        this.muted = false;
        if (!this.volume) this.volume = this.lastAudibleVolume;
      } else {
        this.muted = true;
      }
      this.applyVolume();
      this.updateVolumeUI();
      toast(this.muted ? '音乐盒已静音' : '已恢复音乐盒声音');
    },

    updateVolumeUI() {
      if ($('musicVolSlider')) $('musicVolSlider').value = this.muted ? 0 : Math.round(this.volume * 100);
      if ($('musicMuteBtn')) {
        $('musicMuteBtn').innerHTML = icon(this.muted ? 'speaker-slash' : 'speaker-high');
        $('musicMuteBtn').setAttribute('aria-label', this.muted ? '取消静音' : '静音');
        $('musicMuteBtn').setAttribute('aria-pressed', String(this.muted));
      }
    },

    effectiveVolume() { return this.muted ? 0 : this.volume * (this.ducked ? 0.2 : 1); },

    applyVolume() {
      clearInterval(this.fadeTimer);
      if (musicAudio) { musicAudio.muted=this.muted; musicAudio.volume=this.effectiveVolume(); }
    },

    duck() {
      if (!musicAudio || this.ducked) return;
      this.ducked = true;
      this.fadeTo(this.effectiveVolume(), 300);
    },

    unduck() {
      if (!musicAudio || !this.ducked) return;
      this.ducked = false;
      this.fadeTo(this.effectiveVolume(), 500);
    },

    fadeTo(target, duration) {
      if (!musicAudio) return;
      clearInterval(this.fadeTimer);
      if (this.muted) { this.applyVolume(); return; }
      const start = musicAudio.volume || 0;
      const diff = target - start;
      const steps = 15;
      const stepTime = duration / steps;
      let count = 0;
      this.fadeTimer = setInterval(() => {
        count++;
        const current = start + (diff * (count / steps));
        if (musicAudio) musicAudio.volume = Math.max(0, Math.min(1, current));
        if (count >= steps) clearInterval(this.fadeTimer);
      }, stepTime);
    },

    getDownloadInfo() {
      const track = this.currentTrack;
      const source = track?.flacUrl || track?.localUrl || track?.src || track?.srcFallback || track?.streamUrl;
      if (!source) return null;
      try {
        const url = new URL(source, window.location.href);
        const extension = /\.(flac|mp3|ogg|wav|m4a|aac)$/i.exec(url.pathname)?.[1].toLowerCase();
        if (!['http:', 'https:'].includes(url.protocol) || !extension) return null;
        const title = (track.title || track.titleZh || track.name || '提瓦特原声').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').slice(0, 140) || '提瓦特原声';
        const target = url.origin !== window.location.origin && source === track.streamUrl ? new URL(this.streamSource(track),window.location.href) : url;
        return { url: target.href, remote: target.origin !== window.location.origin, format: extension.toUpperCase(), filename: `${title}.${extension}` };
      } catch { return null; }
    },

    suspend() {
      this.resumeAfterRestore=this.wantsPlayback;
      this.wantsPlayback=false;
      ++this.playToken;
      clearTimeout(this.loadTimer);clearInterval(this.fadeTimer);
      this.ducked=false;this.applyVolume();
      musicAudio?.pause();this.setPlaying(false);
    },

    resume() {
      if(this.resumeAfterRestore){this.resumeAfterRestore=false;this.startPlayback(++this.playToken);}
    },

    updateDownloadUI() {
      const button = $('musicDownloadBtn');
      if (!button) return;
      const download = this.getDownloadInfo();
      button.disabled = this.downloading || !download;
      button.setAttribute('aria-busy', String(this.downloading));
      button.setAttribute('aria-label', download ? `下载${download.filename}原声` : '暂无可下载的原声');
      button.title = download ? `下载原始 ${download.format} 文件 · ${download.filename}` : '暂无可下载的原声';
      $('musicDownloadLabel').textContent = this.downloading ? '准备中…' : '下载原声';
      $('musicDownloadFormat').textContent = download?.format || '';
    },

    async downloadCurrentTrack() {
      if (this.downloading) return;
      const download = this.getDownloadInfo();
      if (!download) { toast('这首曲目暂无可下载的原声'); return; }
      const saveFile = href => {
        const link = document.createElement('a');
        link.href = href;
        link.download = download.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      };
      // Same-origin media streams directly to the browser download manager,
      // including large FLAC files, without buffering another copy in memory.
      if (!download.remote) {
        saveFile(download.url);
        toast(`已开始下载：${download.filename}`);
        return;
      }
      this.downloading = true;
      this.updateDownloadUI();
      toast(`正在准备下载：${download.filename}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        // A blob retains the filename for cross-origin tracks, where browsers
        // otherwise ignore the download attribute and open an audio player.
        const response = await fetch(download.url, { credentials: 'omit', signal: controller.signal });
        if (!response.ok || /(?:text\/|application\/json)/i.test(response.headers.get('content-type') || '')) throw Error('Audio unavailable');
        const blob = await response.blob();
        if (!blob.size) throw Error('Empty audio');
        const objectUrl = URL.createObjectURL(blob);
        try { saveFile(objectUrl); } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); }
        toast(`已开始下载：${download.filename}`);
      } catch {
        toast('原声下载暂时失败，请检查网络后重试');
      } finally {
        clearTimeout(timeout);
        this.downloading = false;
        this.updateDownloadUI();
      }
    },

    updateTrackUI() {
      const track = this.currentTrack;
      if (!track) return;
      const trackChanged = this.renderedTrackId !== track.id;
      this.renderedTrackId = track.id;

      const title = track.titleZh || track.name || track.title;
      const displayTitle = track.title || title;
      const album = track.albumZh || track.album || '';
      const artist = track.artist || 'HOYO-MiX';
      const region = track.region || '提瓦特';
      if ($('musicBoxDialog')) $('musicBoxDialog').dataset.musicRegion = region;
      const quality = track.quality || '320kbps 殿堂级母带';
      const desc = track.desc || `${album} · 官方原声音轨`;

      if ($('musicPillCover')) $('musicPillCover').src = track.cover;
      if ($('musicPillTitle')) $('musicPillTitle').textContent = title;
      if ($('musicPillRegion')) $('musicPillRegion').textContent = `${region} · 原声大典`;

      if ($('musicBoxCover')) $('musicBoxCover').src = track.cover;
      if ($('musicBoxRegion')) $('musicBoxRegion').textContent = region;
      if ($('musicBoxQuality')) $('musicBoxQuality').textContent = quality;
      if ($('musicBoxTrackTitle')) $('musicBoxTrackTitle').textContent = displayTitle;
      if ($('musicBoxAlbum')) $('musicBoxAlbum').textContent = `《${album}》 · ${artist}`;
      if ($('musicBoxDesc')) $('musicBoxDesc').textContent = desc;
      this.updateDownloadUI();

      const activeTrackId = this.getActiveTrackId();
      document.querySelectorAll('.music-track-item').forEach(item => {
        const isActive = item.dataset.trackId === activeTrackId;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      this.trackAnimations.forEach(animation => animation.cancel());
      this.trackAnimations = [];
      if (trackChanged && $('musicBoxDialog')?.open && this.canAnimate()) {
        const info = document.querySelector('.music-current-info');
        const record = $('musicVinylWrap');
        if (info?.animate) this.trackAnimations.push(info.animate([{opacity:.3,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}], {duration:360,easing:'cubic-bezier(.2,.75,.2,1)'}));
        if (record?.animate) this.trackAnimations.push(record.animate([{transform:'scale(.96)'},{transform:'scale(1)'}], {duration:500,easing:'cubic-bezier(.2,.75,.2,1)'}));
      }
    },

    renderPlaylist() {
      const container = $('musicTrackList');
      if (!container) return;
      const list = this.visibleTracks;
      if ($('musicResultCount')) $('musicResultCount').textContent = `共 ${list.length} 首 · 已展示 ${Math.min(list.length, this.renderLimit)} 首`;
      if (list.length === 0) {
        container.innerHTML = '<div class="music-empty-state"><p>未找到符合条件的提瓦特曲目</p></div>';
        return;
      }
      const slice = list.slice(0, this.renderLimit);
      const activeTrackId = this.getActiveTrackId();
      container.innerHTML = slice.map((t, i) => {
        const isActive = t.id === activeTrackId;
        const isLossless = t.quality && t.quality.includes('FLAC');
        const displayTitle = t.title || t.name;
        const albumName = t.albumZh || t.album || '';
        return `
          <button class="music-track-item ${isActive ? 'active' : ''}" data-track-id="${t.id}" data-title="${esc(t.title)}" aria-pressed="${isActive}" style="--music-order:${Math.min(i, 7)}">
            <span class="track-item-idx">${String(i + 1).padStart(2, '0')}</span>
            <img class="track-item-cover" src="${esc(t.cover)}" alt="" width="38" height="38" loading="lazy">
            <span class="track-item-info">
              <strong class="track-item-title">${esc(displayTitle)}</strong>
              <span class="track-item-sub">${esc(t.artist || 'HOYO-MiX')} · 《${esc(albumName)}》</span>
            </span>
            <span class="track-item-tags">
              <span class="track-tag-region">${esc(t.region || '提瓦特')}</span>
              <span class="track-tag-flac">${isLossless ? 'FLAC' : '320K'}</span>
              <span class="track-item-duration">${t.duration || ''}</span>
            </span>
          </button>
        `;
      }).join('');

      if (list.length > this.renderLimit) {
        container.insertAdjacentHTML('beforeend', `
          <button class="music-more-btn" id="musicLoadMoreBtn">加载更多曲目（剩余 ${list.length - this.renderLimit} 首）</button>
        `);
        const moreBtn = $('musicLoadMoreBtn');
        if (moreBtn) {
          moreBtn.onclick = () => {
            const scrollPosition = container.scrollTop;
            const firstNewIndex = this.renderLimit;
            this.renderLimit += 80;
            this.renderPlaylist();
            container.scrollTop = scrollPosition;
            container.querySelectorAll('.music-track-item')[firstNewIndex]?.focus({preventScroll:true});
          };
        }
      }

      container.querySelectorAll('.music-track-item').forEach(item => {
        item.onclick = () => {
          const trackId = item.dataset.trackId;
          const target = list.find(t => t.id === trackId);
          if (target) {
            this.playTrack(target, true);
            toast(`正在播放【${target.titleZh || target.name || target.title}】`);
          }
        };
      });
    }
  };
  window.musicBox = musicBox;


  async function init(){try{const response=await fetch('data/catalog.json');if(!response.ok)throw Error('图鉴加载失败');catalog=await response.json();if(isLegacyIndex){const response=await fetch('data/nahida-index.json');if(!response.ok)throw Error('索引加载失败');indexVoices=await response.json()}initVoiceIndexNav();musicBox.init();if(!isVoiceIndex)render();await initHeroSwitcher();if(!isVoiceIndex)render();}catch{$('resultsMeta').textContent='图鉴暂时无法加载';$('charConstellationGrid').innerHTML=`<div class="empty-state"><h3>图鉴还没有准备好</h3><p>请检查网络连接，刷新页面后重试</p><a class="button" href="${location.pathname+location.search}">重新加载</a></div>`;$('charConstellationGrid').setAttribute('aria-busy','false')}}
  init();
})();

