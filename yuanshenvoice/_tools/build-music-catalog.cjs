const fs = require('fs');
const path = require('path');

const ALBUM_INFO = {
  'The Wind and The Star Traveler': {
    zh: '风与异乡人',
    region: '蒙德',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_mondstadt.webp',
    desc: '提瓦特序章与原神经典主题交响'
  },
  'City of Winds and Idylls': {
    zh: '风与牧歌之城',
    region: '蒙德',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_mondstadt.webp',
    desc: '蒙德城、晨曦酒庄与风龙废墟官方全本原声'
  },
  'Jade Moon Upon a Sea of Clouds': {
    zh: '皎月云间之梦',
    region: '璃月',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_liyue.webp',
    desc: '璃月港、绝云间与轻策庄官方全本原声'
  },
  'The Stellar Moments vol. 1': {
    zh: '闪耀的群星 Vol. 1',
    region: '角色主题',
    category: '角色主题',
    artist: '陈致逸 / 苑迪萌 / HOYO-MiX',
    cover: 'cover_main_theme.webp',
    desc: '钟离、温迪、魈、可莉、刻晴等经典角色主题曲'
  },
  'Vortex of Legends': {
    zh: '漩涡、落星与冰山',
    region: '蒙德',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_mondstadt.webp',
    desc: '龙脊雪山极寒之境全本官方原声'
  },
  'The Shimmering Voyage vol. 1': {
    zh: '珍珠之歌 Vol. 1',
    region: '特典精选',
    category: '珍珠之歌',
    artist: 'HOYO-MiX',
    cover: 'cover_main_theme.webp',
    desc: '金苹果群岛与版本特典回忆旋律'
  },
  'Realm of Tranquil Eternity': {
    zh: '寂远与恒常之歌（寂远无妄之国）',
    region: '稻妻',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_inazuma.webp',
    desc: '稻妻雷樱与浮世百相官方全本原声'
  },
  'Fleeting Colors in Flight': {
    zh: '飞彩镌流年',
    region: '璃月',
    category: '特别单曲',
    artist: '杨扬 / 陈致逸 / HOYO-MiX',
    cover: 'cover_liyue.webp',
    desc: '海灯节《神女劈观·唤情》戏剧特典'
  },
  'The Stellar Moments vol. 2': {
    zh: '闪耀的群星 Vol. 2',
    region: '角色主题',
    category: '角色主题',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_inazuma.webp',
    desc: '雷电将军、神里绫华、枫原万叶、优菈等角色主题曲'
  },
  'Islands of the Lost and Forgotten': {
    zh: '佚落迁跃之地',
    region: '稻妻',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_inazuma.webp',
    desc: '鹤观、海祇岛与白夜国渊下宫神秘原声'
  },
  'Millelith’s Watch': {
    zh: '千岩的凝望',
    region: '璃月',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_liyue.webp',
    desc: '层岩巨渊深壑与琉璃晶石原声大碟'
  },
  'The Shimmering Voyage vol. 2': {
    zh: '珍珠之歌 Vol. 2',
    region: '特典精选',
    category: '珍珠之歌',
    artist: 'HOYO-MiX',
    cover: 'cover_main_theme.webp',
    desc: '仲夏幻夜奇想曲与版本精选原声'
  },
  'Footprints of the Traveler vol. 1': {
    zh: '旅人的足迹 Vol. 1',
    region: '特典精选',
    category: '特别单曲',
    artist: 'HOYO-MiX',
    cover: 'cover_main_theme.webp',
    desc: '提瓦特历程宣发与剧情动画原声'
  },
  'Forest of Jñāna and Vidyā': {
    zh: '智睿与欢跃的境界',
    region: '须弥',
    category: '大碟全本',
    artist: '陈致逸 / HOYO-MiX',
    cover: 'cover_sumeru.webp',
    desc: '须弥雨林、奥摩斯港与生机律动全本原声'
  },
  'The Stellar Moments vol. 3': {
    zh: '闪耀的群星 Vol. 3',
    region: '角色主题',
    category: '角色主题',
    artist: 'HOYO-MiX',
    cover: 'cover_sumeru.webp',
    desc: '纳西妲、流浪者、赛诺、艾尔海森、妮露等角色主题曲'
  },
  'The Unfathomable Sand Dunes': {
    zh: '流沙引路之人',
    region: '须弥',
    category: '大碟全本',
    artist: 'HOYO-MiX',
    cover: 'cover_sumeru.webp',
    desc: '须弥广袤沙漠与千壑沙地全本原声'
  },
  'Footprints of the Traveler vol. 2': {
    zh: '旅人的足迹 Vol. 2',
    region: '特典精选',
    category: '特别单曲',
    artist: 'HOYO-MiX',
    cover: 'cover_sumeru.webp',
    desc: '须弥历程宣发与剧情动画原声'
  },
  'The Shimmering Voyage vol. 3': {
    zh: '珍珠之歌 Vol. 3',
    region: '特典精选',
    category: '珍珠之歌',
    artist: 'HOYO-MiX',
    cover: 'cover_main_theme.webp',
    desc: '琉形蜃境与版本活动精选原声'
  },
  'Fountain of Belleau': {
    zh: '白露澈明之泉（白露与澈泉的咏叙）',
    region: '枫丹',
    category: '大碟全本',
    artist: '苑迪萌 / 丁谦 / HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '枫丹全本律典颂诗与廷都华章原声大碟'
  },
  'La vaguelette': {
    zh: '轻涟',
    region: '枫丹',
    category: '特别单曲',
    artist: 'Cécilia Cara / HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '芙宁娜水仙的誓言官方特别单曲'
  },
  'The Stellar Moments vol. 4': {
    zh: '闪耀的群星 Vol. 4',
    region: '角色主题',
    category: '角色主题',
    artist: 'HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '芙宁娜、那维莱特、莱欧斯利、娜维娅等角色主题曲'
  },
  'Pelagic Primaevality': {
    zh: '白露与澈泉的诗篇（万流始源之海）',
    region: '枫丹',
    category: '大碟全本',
    artist: 'HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '枫丹水下世界与梅洛彼得堡全本原声'
  },
  'Jadeite Redolence': {
    zh: '沉玉映芳',
    region: '璃月',
    category: '大碟全本',
    artist: 'HOYO-MiX',
    cover: 'cover_liyue.webp',
    desc: '沉玉谷茶香与翘英庄山水清幽原声大碟'
  },
  'Emberfire': {
    zh: '烬火',
    region: '枫丹',
    category: '特别单曲',
    artist: 'HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '阿蕾奇诺（仆人）动画短片原声单曲'
  },
  'Cantus Aeternus': {
    zh: '咏叙永恒之诗',
    region: '枫丹',
    category: '大碟全本',
    artist: 'HOYO-MiX',
    cover: 'cover_fontaine.webp',
    desc: '枫丹雷穆利亚与旧日之海殿堂交响原声'
  }
};

const FAMOUS_TRACK_MAP = {
  'Genshin Impact Main Theme': { zh: '原神主题曲', local: '06_main_theme.mp3' },
  'Dawn Winery Theme': { zh: '晨曦酒庄', localFlac: '01_dawn_winery.flac', localMp3: '01_dawn_winery.mp3' },
  'Twilight Serenity': { zh: '宁静的黄昏', localFlac: '02_twilight_serenity.flac', localMp3: '02_twilight_serenity.mp3' },
  'Moon in One’s Cup': { zh: '杯中明月', localFlac: '03_moon_in_ones_cup.flac', localMp3: '03_moon_in_ones_cup.mp3' },
  "Moon in One's Cup": { zh: '杯中明月', localFlac: '03_moon_in_ones_cup.flac', localMp3: '03_moon_in_ones_cup.mp3' },
  'Inazuma': { zh: '稻妻', localFlac: '04_inazuma.flac', localMp3: '04_inazuma.mp3' },
  'Fontaine': { zh: '枫丹', localFlac: '05_fontaine.flac', localMp3: '05_fontaine.mp3' },
  'Sumeru': { zh: '须弥', local: '07_sumeru.mp3' },
  'La vaguelette': { zh: '轻涟 (芙宁娜)', local: '08_la_vaguelette.mp3' },
  'Rex Incognito': { zh: '岩壑之崩 (钟离)', local: '09_rex_incognito.mp3' },
  'Termination of Desires': { zh: '斩破断绝的无想 (雷电将军)', local: '10_termination_of_desires.mp3' },
  'Surasthāna Fantasia': { zh: '净善的遐想 (纳西妲)', local: '11_surasthana_fantasia.mp3' },
  'Surasthana Fantasia': { zh: '净善的遐想 (纳西妲)', local: '11_surasthana_fantasia.mp3' },
  'Parousia Diluvi': { zh: '沉降的启示 (那维莱特)', local: '12_parousia_diluvi.mp3' },
  'Devastation and Redemption': { zh: '神女劈观·唤情 (云堇 / 申鹤)', local: '13_devastation_and_redemption.mp3' },
  'Emberfire': { zh: '烬火 (阿蕾奇诺)', local: '14_emberfire.mp3' },
  'Path of Yaksha': { zh: '靖妖降魔 (魈)', local: '15_path_of_yaksha.mp3' },
  'Broker Betwixt Life and Death': { zh: '生老病死 (胡桃)', local: '16_broker_betwixt_life_and_death.mp3' },
  
  // Character map
  "Bard’s Adventure": { zh: '诗人的流浪 (温迪)' },
  "Bard's Adventure": { zh: '诗人的流浪 (温迪)' },
  "Let’s Go, Crimson Knight!": { zh: '奔跑吧，红衣骑士！ (可莉)' },
  "Let's Go, Crimson Knight!": { zh: '奔跑吧，红衣骑士！ (可莉)' },
  'Where the Sunlight Flees': { zh: '日光逃遁之所 (琴)' },
  'Flaming Fry': { zh: '香嫩椒椒 (香菱)' },
  'Ouvertüre der ewigen Nacht': { zh: '永夜的序曲 (菲谢尔)' },
  'Letter From Ajax': { zh: '阿贾克斯的来信 (达达利亚)' },
  'Shirasagi Princess': { zh: '白鹭归庭 (神里绫华)' },
  'Wandering Flight': { zh: '随风而去 (枫原万叶)' },
  'Blossoms of Summer Night': { zh: '夏夜的烟火 (宵宫)' },
  'Time to Shine': { zh: '大显身手 (荒泷一斗)' },
  'The Crane Cries': { zh: '鹤鸣九皋 (申鹤)' },
  'As Miko Pleases': { zh: '如狐的欢欣 (八重神子)' },
  'Serene and Fathomless': { zh: '渊博幽邃 (夜兰)' },
  'Order of Silence': { zh: '寂静的律令 (赛诺)' },
  'Nephrite of Deshret': { zh: '赤王的碧玉 (坎蒂丝)' },
  'Lotus of Haftkarsvar': { zh: '七叶七卷的莲花 (妮露)' },
  'Novatio Novena': { zh: '九度创变 (流浪者)' },
  'Chantons à plusieurs': { zh: '合唱之歌 (芙宁娜)' },
  'Se mettre sur son 31 !': { zh: '盛装盛景 (芙宁娜)' },
  'Veritas Numquam Perit': { zh: '真理永不磨灭 (娜维娅)' },
  'Nippy Bout': { zh: '凛冽交锋 (莱欧斯利)' },
  'Lustrous Trick': { zh: '华丽魔术 (林尼)' },
  'Cat’s Cosy Course': { zh: '猫咪惬意步 (琳妮特)' },
  'Snow-Buried Tales': { zh: '覆雪之路' },
  'Fragile Fantasy': { zh: '脆弱的幻想' },
  'Líyuè': { zh: '璃月' },
  'Liyue': { zh: '璃月' },
  'Qingce Village': { zh: '轻策庄' },
  'Wangshu Inn': { zh: '望舒客栈' },
  'Hustle and Bustle of Ormos': { zh: '奥摩斯港的喧嚣' },
  'Port Ormos': { zh: '奥摩斯港' },
  'Knights of Favonius': { zh: '西风骑士团' },
  "Stormterror’s Lair": { zh: '风龙废墟' },
  "Stormterror's Lair": { zh: '风龙废墟' },
  'A Day in Mondstadt': { zh: '蒙德的一日' }
};

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const s = Math.round(parseFloat(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function run() {
  const rawPath = path.join(__dirname, 'archive_music_meta.json');
  const rawList = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

  const catalog = [];
  let trackIdx = 1;

  for (const item of rawList) {
    const albKey = item.album || 'Unknown';
    const info = ALBUM_INFO[albKey] || {
      zh: albKey,
      region: '提瓦特',
      category: '大碟全本',
      artist: 'HOYO-MiX',
      cover: 'cover_main_theme.webp',
      desc: '原神原声官方大碟'
    };

    const titleEn = item.title || path.basename(item.name, '.mp3').replace(/^\d+[\.\-\s]+/, '');
    const famous = FAMOUS_TRACK_MAP[titleEn] || FAMOUS_TRACK_MAP[item.title];
    const titleZh = famous?.zh || '';
    const displayTitle = titleZh ? `${titleZh} ${titleEn}` : titleEn;

    const lengthSec = parseFloat(item.length || 0);
    const duration = formatDuration(lengthSec);

    // Local file override if available
    let localPath = '';
    let isLossless = false;
    if (famous?.localFlac) {
      localPath = `/assets/audio/music/${famous.localFlac}`;
      isLossless = true;
    } else if (famous?.local) {
      localPath = `/assets/audio/music/${famous.local}`;
    } else if (famous?.localMp3) {
      localPath = `/assets/audio/music/${famous.localMp3}`;
    }

    // Encoded remote path for direct archive.org stream
    const encodedRemote = item.name.split('/').map(encodeURIComponent).join('/');
    const remoteStreamUrl = `https://archive.org/download/genshin-impact-music-collection/${encodedRemote}`;
    const proxyStreamUrl = `/api/music-stream?path=${encodeURIComponent(item.name)}`;

    catalog.push({
      id: `ost-${trackIdx++}`,
      rawName: item.name,
      title: displayTitle,
      titleZh: titleZh || titleEn,
      titleEn: titleEn,
      albumZh: info.zh,
      albumEn: albKey,
      region: info.region,
      category: info.category,
      artist: info.artist,
      cover: `/assets/audio/music/covers/${info.cover}`,
      duration: duration,
      durationSec: lengthSec,
      sizeBytes: parseInt(item.size || 0, 10),
      isLocal: !!localPath,
      localUrl: localPath,
      streamUrl: remoteStreamUrl,
      proxyUrl: proxyStreamUrl,
      quality: isLossless ? '24-bit / 48kHz 无损 FLAC' : '320kbps 殿堂级母带',
      desc: `${info.zh} · ${info.desc}`
    });
  }

  // Sort featured local tracks first, then by original album track order
  const featured = catalog.filter(t => t.isLocal);
  const remaining = catalog.filter(t => !t.isLocal);
  const sortedCatalog = [...featured, ...remaining];

  // Also build album group index
  const albumsSummary = {};
  for (const [k, v] of Object.entries(ALBUM_INFO)) {
    const tracksInAlb = catalog.filter(t => t.albumEn === k);
    albumsSummary[k] = {
      titleZh: v.zh,
      titleEn: k,
      region: v.region,
      category: v.category,
      artist: v.artist,
      cover: `/assets/audio/music/covers/${v.cover}`,
      desc: v.desc,
      trackCount: tracksInAlb.length
    };
  }

  const outData = {
    totalTracks: catalog.length,
    totalAlbums: Object.keys(ALBUM_INFO).length,
    updatedAt: new Date().toISOString(),
    albums: albumsSummary,
    tracks: sortedCatalog
  };

  const outDest = path.resolve(__dirname, '../assets/audio/music/music_catalog.json');
  fs.writeFileSync(outDest, JSON.stringify(outData, null, 2), 'utf8');
  console.log(`Generated music_catalog.json with ${catalog.length} tracks, ${featured.length} local master tracks!`);
}

run();
