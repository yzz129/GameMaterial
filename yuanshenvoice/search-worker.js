'use strict';
let indexPromise;
self.onmessage = async ({ data: { id, query, indexUrl } }) => {
  try {
    indexPromise ||= fetch(indexUrl || 'data/voice-search-index.json').then(r => { if (!r.ok) throw Error('搜索索引加载失败'); return r.json(); }).catch(e => { indexPromise = null; throw e; });
    const index = await indexPromise;
    const words = query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
    self.postMessage({ id, ids: index.filter(row => words.every(word => row.text.includes(word))).map(row => row.id) });
  } catch (e) { self.postMessage({ id, error: e.message }); }
};
