const fs = require('fs');
const path = require('path');

const appPath = 'D:/yuanshenvoice/app.js';
const content = fs.readFileSync(appPath, 'utf8');

const markerStart = '  // ==================== TEYVAT MUSIC BOX ====================';
const markerEnd = '  window.musicBox = musicBox;';

const startIdx = content.indexOf(markerStart);
const endIdx = content.indexOf(markerEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!', { startIdx, endIdx });
  process.exit(1);
}

const replacement = `  // ==================== TEYVAT MUSIC BOX ====================
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
      title: '杯中明月 Moon in One\\'s Cup',
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
    loopMode: 'list',
    ducked: false,
    fadeTimer: null,
    fullCatalog: null,
    activeTab: 'all',
    searchKeyword: '',
    visibleTracks: [],
    renderLimit: 80,
    searchDebounceTimer: null,
    
    init() {
      try {
        const savedVol = localStorage.getItem('teyvat_music_vol');
        if (savedVol !== null) this.volume = Math.max(0, Math.min(1, Number(savedVol)));
        const savedIdx = localStorage.getItem('teyvat_music_idx');
        if (savedIdx !== null && musicTracks[Number(savedIdx)]) this.index = Number(savedIdx);
        const savedMode = localStorage.getItem('teyvat_music_mode');
        if (savedMode && ['list', 'single', 'random'].includes(savedMode)) this.loopMode = savedMode;
      } catch {}

      try {
        musicAudio = new Audio();
        musicAudio.preload = 'auto';
        musicAudio.volume = this.volume;
      } catch(e) {
        musicAudio = { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {}, canPlayType: () => '' };
      }

      this.currentTrack = musicTracks[this.index] || musicTracks[0];
      this.filterAndRender();
      this.updateTrackUI();

      // Background loading of full 1105-track master catalog
      if (typeof window !== 'undefined' && !window.happyDOM) {
        fetch('assets/audio/music/music_catalog.json')
          .then(res => res.json())
          .then(data => {
            if (data && data.tracks && data.tracks.length > 0) {
              this.fullCatalog = data.tracks;
              if ($('musicTotalCountBadge')) {
                $('musicTotalCountBadge').textContent = \`\${data.totalTracks} 首全本收录\`;
              }
              this.filterAndRender();
            }
          })
          .catch(() => {});
      }

      if (musicAudio && musicAudio.addEventListener) {
        musicAudio.addEventListener('timeupdate', () => this.onTimeUpdate());
        musicAudio.addEventListener('ended', () => this.onEnded());
        musicAudio.addEventListener('play', () => this.setPlaying(true));
        musicAudio.addEventListener('pause', () => this.setPlaying(false));
        musicAudio.addEventListener('error', () => {
          const cur = this.currentTrack;
          if (cur && musicAudio.src && musicAudio.src.endsWith('.flac') && cur.srcFallback) {
            musicAudio.src = cur.srcFallback;
            musicAudio.play().catch(() => {});
          }
        });
      }

      const openDialog = () => {
        const dlg = $('musicBoxDialog');
        if (dlg && !dlg.open && dlg.showModal) dlg.showModal();
      };
      if ($('musicPillDisc')) $('musicPillDisc').onclick = openDialog;
      if ($('musicPillOpen')) $('musicPillOpen').onclick = openDialog;
      if ($('musicBoxClose')) $('musicBoxClose').onclick = () => $('musicBoxDialog')?.close();
      if ($('musicBoxDialog')) {
        $('musicBoxDialog').addEventListener('click', e => {
          if (e.target === $('musicBoxDialog')) $('musicBoxDialog').close();
        });
      }

      if ($('musicPlayBtn')) $('musicPlayBtn').onclick = (e) => { e.stopPropagation(); this.toggle(); };
      if ($('musicPrevBtn')) $('musicPrevBtn').onclick = (e) => { e.stopPropagation(); this.prev(); };
      if ($('musicNextBtn')) $('musicNextBtn').onclick = (e) => { e.stopPropagation(); this.next(); };

      if ($('musicModalPlay')) $('musicModalPlay').onclick = () => this.toggle();
      if ($('musicModalPrev')) $('musicModalPrev').onclick = () => this.prev();
      if ($('musicModalNext')) $('musicModalNext').onclick = () => this.next();
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
            $('musicFilterTabs').querySelectorAll('.music-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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

      this.playTrack(this.currentTrack, false);
      this.attemptAutoplay();
    },

    getEffectiveList() {
      const source = this.fullCatalog || musicTracks;
      let list = source;
      const kw = (this.searchKeyword || '').toLowerCase();
      const tab = this.activeTab;

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
    },

    attemptAutoplay() {
      if (typeof window !== 'undefined' && window.happyDOM) return;
      if (navigator.connection?.saveData) return;
      if (!musicAudio || !musicAudio.play) return;
      const playPromise = musicAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.setPlaying(true);
        }).catch(() => {
          this.setPlaying(false);
          const startOnInteraction = () => {
            if (musicAudio && musicAudio.play) {
              musicAudio.play().then(() => this.setPlaying(true)).catch(() => {});
            }
            ['click', 'pointerdown', 'keydown', 'touchstart'].forEach(evt => {
              window.removeEventListener(evt, startOnInteraction, { passive: true });
            });
          };
          ['click', 'pointerdown', 'keydown', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, startOnInteraction, { once: true, passive: true });
          });
        });
      }
    },

    playTrack(track, autoPlay = true) {
      if (!track || !musicAudio) return;
      this.currentTrack = track;
      const canFlac = Boolean(musicAudio.canPlayType && musicAudio.canPlayType('audio/flac'));
      
      let audioSrc = track.localUrl || track.src;
      if (canFlac && (track.flacUrl || (track.src && track.src.endsWith('.flac')))) {
        audioSrc = track.flacUrl || track.src;
      } else if (track.srcFallback) {
        audioSrc = track.srcFallback;
      } else if (!audioSrc && track.streamUrl) {
        audioSrc = track.streamUrl;
      }
      
      musicAudio.src = audioSrc || '';
      if (musicAudio.load) musicAudio.load();
      this.updateTrackUI();
      if (autoPlay && musicAudio.play) {
        musicAudio.play().then(() => this.setPlaying(true)).catch(() => this.setPlaying(false));
      }
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
      if (this.playing) {
        musicAudio.pause();
        this.setPlaying(false);
      } else if (musicAudio.play) {
        musicAudio.play().then(() => this.setPlaying(true)).catch(() => {});
      }
    },

    next() {
      const list = this.visibleTracks.length > 0 ? this.visibleTracks : (this.fullCatalog || musicTracks);
      if (list.length === 0) return;
      let nextIdx;
      const curIdx = list.findIndex(t => t.id === this.currentTrack?.id || t.title === this.currentTrack?.title);
      if (this.loopMode === 'random') {
        do {
          nextIdx = Math.floor(Math.random() * list.length);
        } while (nextIdx === curIdx && list.length > 1);
      } else {
        nextIdx = (curIdx + 1) % list.length;
      }
      const nextTrack = list[nextIdx] || list[0];
      this.playTrack(nextTrack, true);
      toast(\`已切歌【\${nextTrack.titleZh || nextTrack.name || nextTrack.title}】\`);
    },

    prev() {
      const list = this.visibleTracks.length > 0 ? this.visibleTracks : (this.fullCatalog || musicTracks);
      if (list.length === 0) return;
      if (musicAudio && musicAudio.currentTime > 3) {
        musicAudio.currentTime = 0;
      } else {
        const curIdx = list.findIndex(t => t.id === this.currentTrack?.id || t.title === this.currentTrack?.title);
        const prevIdx = (curIdx - 1 + list.length) % list.length;
        const prevTrack = list[prevIdx] || list[0];
        this.playTrack(prevTrack, true);
        toast(\`已切歌【\${prevTrack.titleZh || prevTrack.name || prevTrack.title}】\`);
      }
    },

    cycleLoopMode() {
      const modes = ['list', 'single', 'random'];
      const labels = { 'list': '列表循环', 'single': '单曲循环', 'random': '随机播放' };
      const icons = { 'list': 'repeat', 'single': 'arrow-counter-clockwise', 'random': 'shuffle' };
      const nextMode = modes[(modes.indexOf(this.loopMode) + 1) % modes.length];
      this.loopMode = nextMode;
      try { localStorage.setItem('teyvat_music_mode', nextMode); } catch {}
      if ($('musicModeText')) $('musicModeText').textContent = labels[nextMode];
      if ($('musicLoopModeBtn')) {
        $('musicLoopModeBtn').innerHTML = \`\${icon(icons[nextMode])} <span class="music-mode-text" id="musicModeText">\${labels[nextMode]}</span>\`;
      }
      toast(\`音乐盒切换为【\${labels[nextMode]}】\`);
    },

    onEnded() {
      if (this.loopMode === 'single') {
        if (musicAudio) {
          musicAudio.currentTime = 0;
          musicAudio.play().catch(() => {});
        }
      } else {
        this.next();
      }
    },

    setPlaying(state) {
      this.playing = state;
      const pill = $('musicBoxPill');
      const dialog = $('musicBoxDialog');
      if (pill) pill.classList.toggle('music-playing', state);
      if (dialog) dialog.classList.toggle('music-playing', state);
      
      const playIcon = state ? icon('pause') : icon('play');
      if ($('musicPlayBtn')) $('musicPlayBtn').innerHTML = playIcon;
      if ($('musicModalPlay')) $('musicModalPlay').innerHTML = playIcon;
      if ($('musicAutoplayState')) {
        $('musicAutoplayState').textContent = state ? '正在演奏提瓦特原声' : '留声机已静候等待';
      }
    },

    onTimeUpdate() {
      if (!musicAudio || !Number.isFinite(musicAudio.duration)) return;
      const cur = musicAudio.currentTime;
      const dur = musicAudio.duration;
      if ($('musicCurTime')) $('musicCurTime').textContent = this.formatTime(cur);
      if ($('musicTotalTime')) $('musicTotalTime').textContent = this.formatTime(dur);
      const pct = (cur / dur) * 100;
      if ($('musicProgressFill')) $('musicProgressFill').style.width = \`\${pct}%\`;
      if ($('musicSeekBar') && !$('musicSeekBar').matches(':active')) {
        $('musicSeekBar').value = pct;
      }
    },

    formatTime(sec) {
      if (!sec || isNaN(sec)) return '00:00';
      const s = Math.floor(sec);
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return \`\${String(m).padStart(2, '0')}:\${String(rem).padStart(2, '0')}\`;
    },

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      if (!this.ducked && musicAudio) {
        musicAudio.volume = this.volume;
      }
      this.muted = this.volume === 0;
      try { localStorage.setItem('teyvat_music_vol', String(this.volume)); } catch {}
      this.updateVolumeUI();
    },

    toggleMute() {
      if (this.muted) {
        this.muted = false;
        if (musicAudio) musicAudio.volume = this.volume || 0.65;
      } else {
        this.muted = true;
        if (musicAudio) musicAudio.volume = 0;
      }
      this.updateVolumeUI();
      toast(this.muted ? '音乐盒已静音' : '已恢复音乐盒声音');
    },

    updateVolumeUI() {
      if ($('musicVolSlider')) $('musicVolSlider').value = this.muted ? 0 : Math.round(this.volume * 100);
      if ($('musicMuteBtn')) {
        $('musicMuteBtn').innerHTML = icon(this.muted ? 'speaker-slash' : 'speaker-high');
        $('musicMuteBtn').setAttribute('aria-label', this.muted ? '取消静音' : '静音');
      }
    },

    duck() {
      if (!musicAudio || this.ducked) return;
      this.ducked = true;
      this.fadeTo(this.volume * 0.2, 300);
    },

    unduck() {
      if (!musicAudio || !this.ducked) return;
      this.ducked = false;
      this.fadeTo(this.volume, 500);
    },

    fadeTo(target, duration) {
      if (!musicAudio) return;
      clearInterval(this.fadeTimer);
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

    updateTrackUI() {
      const track = this.currentTrack;
      if (!track) return;

      const title = track.titleZh || track.name || track.title;
      const displayTitle = track.title || title;
      const album = track.albumZh || track.album || '';
      const artist = track.artist || 'HOYO-MiX';
      const region = track.region || '提瓦特';
      const quality = track.quality || '320kbps 殿堂级母带';
      const desc = track.desc || \`\${album} · 官方原声音轨\`;

      if ($('musicPillCover')) $('musicPillCover').src = track.cover;
      if ($('musicPillTitle')) $('musicPillTitle').textContent = title;
      if ($('musicPillRegion')) $('musicPillRegion').textContent = \`\${region} · 原声大典\`;

      if ($('musicBoxCover')) $('musicBoxCover').src = track.cover;
      if ($('musicBoxRegion')) $('musicBoxRegion').textContent = region;
      if ($('musicBoxQuality')) $('musicBoxQuality').textContent = quality;
      if ($('musicBoxTrackTitle')) $('musicBoxTrackTitle').textContent = displayTitle;
      if ($('musicBoxAlbum')) $('musicBoxAlbum').textContent = \`《\${album}》 · \${artist}\`;
      if ($('musicBoxDesc')) $('musicBoxDesc').textContent = desc;

      document.querySelectorAll('.music-track-item').forEach(item => {
        const isActive = item.dataset.trackId === track.id || item.dataset.title === track.title;
        item.classList.toggle('active', isActive);
      });
    },

    renderPlaylist() {
      const container = $('musicTrackList');
      if (!container) return;
      const list = this.visibleTracks;
      if (list.length === 0) {
        container.innerHTML = '<div class="music-empty-state"><p>未找到符合条件的提瓦特曲目</p></div>';
        return;
      }
      const slice = list.slice(0, this.renderLimit);
      container.innerHTML = slice.map((t, i) => {
        const isActive = this.currentTrack && (t.id === this.currentTrack.id || t.title === this.currentTrack.title);
        const isLossless = t.quality && t.quality.includes('FLAC');
        const displayTitle = t.title || t.name;
        const albumName = t.albumZh || t.album || '';
        return \`
          <div class="music-track-item \${isActive ? 'active' : ''}" data-track-id="\${t.id}" data-title="\${esc(t.title)}" role="button" tabindex="0">
            <span class="track-item-idx">\${String(i + 1).padStart(2, '0')}</span>
            <img class="track-item-cover" src="\${esc(t.cover)}" alt="" width="38" height="38" loading="lazy">
            <div class="track-item-info">
              <strong class="track-item-title">\${esc(displayTitle)}</strong>
              <span class="track-item-sub">\${esc(t.artist || 'HOYO-MiX')} · 《\${esc(albumName)}》</span>
            </div>
            <div class="track-item-tags">
              <span class="track-tag-region">\${esc(t.region || '提瓦特')}</span>
              <span class="track-tag-flac">\${isLossless ? 'FLAC' : '320K'}</span>
              <span class="track-item-duration">\${t.duration || ''}</span>
            </div>
          </div>
        \`;
      }).join('');

      if (list.length > this.renderLimit) {
        container.insertAdjacentHTML('beforeend', \`
          <button class="music-more-btn" id="musicLoadMoreBtn">加载更多曲目（剩余 \${list.length - this.renderLimit} 首）</button>
        \`);
        const moreBtn = $('musicLoadMoreBtn');
        if (moreBtn) {
          moreBtn.onclick = () => {
            this.renderLimit += 80;
            this.renderPlaylist();
          };
        }
      }

      container.querySelectorAll('.music-track-item').forEach(item => {
        item.onclick = () => {
          const trackId = item.dataset.trackId;
          const target = list.find(t => t.id === trackId);
          if (target) {
            this.playTrack(target, true);
            toast(\`正在播放【\${target.titleZh || target.name || target.title}】\`);
          }
        };
      });
    }
  };
  window.musicBox = musicBox;`;

const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx + markerEnd.length);
fs.writeFileSync(appPath, newContent, 'utf8');
console.log('Successfully patched app.js!');
