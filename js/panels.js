(() => {
  'use strict';
  const R = globalThis.River;
  const titles = {
    deck: ['随身牌匣', 'cards'], spells: ['法术腰带', 'shield'], journal: ['旅途手札', 'quill'],
    upgrades: ['法师姐姐 · 词卡进阶', 'star'], shop: ['船屋柜台', 'coin'], loot: ['战斗胜利', 'sail'], log: ['战斗记事', 'book']
  };
  const spellIcons = { ward: 'shield', insight: 'eye', redraw: 'redraw', burst: 'burst', pages: 'pages', foretell: 'book', chain: 'sword', reveal: 'star' };
  const icon = (name, size = 20) => R.art.icon(name, size);
  const escape = value => String(value).replace(/[&<>"']/g, mark => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[mark]);

  function button(action, value, content, css = '', attributes = '') {
    return '<button type="button" class="folio-button ' + css + '" data-act="' + action +
      '" data-val="' + escape(value ?? '') + '" ' + attributes + '>' + content + '</button>';
  }

  function paging(page, total, size) {
    const count = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(0, Number(page) || 0), count - 1);
    return {
      slice: values => values.slice(current * size, (current + 1) * size),
      controls: count < 2 ? '' : '<nav class="folio-pages" aria-label="翻页">' +
        button('page', current - 1, icon('back', 17), '', 'aria-label="上一页" ' + (current === 0 ? 'disabled' : '')) +
        '<span>' + (current + 1) + ' / ' + count + '</span>' +
        button('page', current + 1, icon('arrow', 17), '', 'aria-label="下一页" ' + (current + 1 === count ? 'disabled' : '')) + '</nav>'
    };
  }

  function empty(name, text) {
    return '<div class="folio-empty">' + icon(name, 35) + '<p>' + text + '</p></div>';
  }

  function wordRow(g, id, action, selected, writable) {
    const word = R.cards[g.collection[id]];
    const content = '<span class="folio-damage" title="基础伤害">' + icon('sword', 16) + word.level + '</span>' +
      '<span class="folio-word"><b lang="ja">' + escape(word.jp) + '</b><small>' + escape(word.zh) + '</small></span>';
    return button(action, id, content, 'folio-row' + (selected ? ' picked' : ''),
      'aria-pressed="' + selected + '" ' + (writable ? 'data-drag="' + action + '"' : 'disabled'));
  }

  function deck(g, ui) {
    const equipped = g.deck;
    const reserve = Object.keys(g.collection).filter(id => !equipped.includes(id));
    const add = reserve.includes(ui.reserve) ? ui.reserve : null;
    const remove = equipped.includes(ui.equipped) ? ui.equipped : null;
    const pages = paging(ui.page, Math.max(reserve.length, equipped.length), 6);
    const writable = R.canGear(g), cap = R.capacity(g);
    let reason = '';
    if (!writable) reason = '在城镇或已点亮的航灯处可以整理牌匣。';
    else if (!add && !remove) reason = '拖动符卡可换装或排序；也可点选两页中的符卡。';
    else if (add && !remove && equipped.length >= cap) reason = '牌匣已满，再从右页选一张换出。';
    else if (remove && !add && equipped.length <= 5) reason = '至少带五张符卡。可以从左页选一张替换。';
    else if (add && equipped.filter(id => id !== remove && g.collection[id] === g.collection[add]).length >= 2) reason = '同一个词最多带两张。选一张同词的牌换出即可。';
    const labels = [];
    if (add) labels.push('带上「' + escape(R.cards[g.collection[add]].jp) + '」');
    if (remove) labels.push('收回「' + escape(R.cards[g.collection[remove]].jp) + '」');
    const left = pages.slice(reserve).map(id => wordRow(g, id, 'reserve', id === add, writable)).join('');
    const right = pages.slice(equipped).map(id => wordRow(g, id, 'equipped', id === remove, writable)).join('');
    return '<div class="folio-spread"><section data-drop-zone="reserve"><h3>收藏余牌 <small>' + reserve.length + ' 张</small></h3><div class="folio-rows">' +
      (left || empty('cards', reserve.length ? '这一页没有余牌。' : equipped.length ? '现有的符卡都已带在身上。' : '先到船屋领取第一匣符卡。')) +
      '</div></section><section data-drop-zone="equipped"><h3>随身携带 <small>' + equipped.length + ' / ' + cap + '</small></h3><div class="folio-rows">' +
      (right || empty('bag', '这一页没有装备的符卡。')) + '</div></section></div>' +
      '<footer class="folio-foot"><span class="folio-tip" role="status">' + (reason || labels.join('，')) + '</span>' + pages.controls +
      button('gear-apply', null, add && remove ? '交换符卡' : remove ? '收回收藏' : '放入牌匣', 'folio-primary', reason ? 'disabled' : '') + '</footer>';
  }

  function upgrades(g, ui) {
    const equipped = new Set(g.deck);
    const ids = Object.keys(g.collection).sort((a, b) => Number(equipped.has(b)) - Number(equipped.has(a)));
    const pages = paging(ui.page, ids.length, 5);
    const writable = R.canUpgrade(g);
    const cards = pages.slice(ids).map(id => {
      const info = R.upgradeInfo(g, id);
      if (!info) return '';
      const { current, next, rank, cost } = info;
      const canAfford = next && g.gold >= cost;
      const label = !next ? '已经升满' : !writable ? '请找法师姐姐' : !canAfford ? '铜币不足' : '进阶 · ' + cost + ' 铜币';
      const nextFace = next
        ? '<div class="folio-upgrade-face"><b lang="ja">' + escape(next.jp) + '</b><small>' + escape(next.zh) +
          ' · 伤害 ' + next.level + '</small></div>'
        : '<div class="folio-upgrade-face"><b>最高阶</b><small>已完成三次进阶</small></div>';
      return '<article class="folio-upgrade-card"><div class="folio-upgrade-top"><span>' +
        (equipped.has(id) ? '随身携带' : '收藏余牌') + ' · 已进阶 ' + rank + '/3 次</span>' +
        '<span>卡牌 ' + escape(id) + '</span></div><div class="folio-upgrade-path"><div class="folio-upgrade-face">' +
        '<b lang="ja">' + escape(current.jp) + '</b><small>' + escape(current.zh) + ' · 伤害 ' + current.level +
        '</small></div><span class="folio-upgrade-arrow" aria-hidden="true">→</span>' + nextFace +
        button('upgrade', id, label, 'folio-primary folio-upgrade-button', !next || !writable || !canAfford ? 'disabled' :
          'aria-label="将' + escape(current.jp) + '升级为' + escape(next.jp) + '，消耗' + cost + '枚铜币"') +
        '</div></article>';
    }).join('');
    return '<div class="folio-filterbar folio-upgrade-summary"><span>' + icon('coin', 17) + ' 持有 ' + g.gold +
      ' 枚铜币</span><small>所有词卡都可进阶三次；升级后替换为相关的更难词语，伤害 +1</small></div>' +
      '<div class="folio-upgrades">' + (cards || empty('cards', '先获得词卡，就能在这里进阶。')) +
      '</div><footer class="folio-foot"><span class="folio-tip">' +
      (writable ? '法师姐姐可以升级随身牌和收藏牌，不影响装备位置。' : '只有在符卡工坊找到法师姐姐才能升级。') +
      '</span>' + pages.controls + '</footer>';
  }

  function spells(g, ui) {
    const selected = ui.spell, writable = R.canGear(g);
    const learned = g.learned.map(id => {
      const skill = R.skills[id];
      const content = '<span class="folio-glyph">' + icon(spellIcons[id]) + '</span><span class="folio-spell-name"><b>' + skill.name +
        '</b><small>' + skill.description + '</small></span><span class="folio-cost" title="法力消耗">' + icon('mana', 15) + skill.cost + '</span>';
      return button('skill-choice', id, content, 'folio-spell' + (selected === id ? ' picked' : ''), 'aria-pressed="' + (selected === id) + '" ' + (writable ? 'data-drag="learned-spell"' : 'disabled'));
    }).join('');
    const slots = g.slots.map((id, i) => {
      const disabled = !writable || (!id && !selected) || (selected && !g.learned.includes(selected));
      const mark = id ? icon(spellIcons[id], 28) : '<span class="folio-socket">◇</span>';
      return button('slot', i, '<span class="folio-notch">' + (i + 1) + '</span>' + mark +
        '<b>' + (id ? R.skills[id].name : '空槽') + '</b>', 'folio-strap',
        'data-skill="' + (id || '') + '" ' + (writable && id ? 'data-drag="slot-spell" ' : '') + (disabled ? 'disabled' : ''));
    }).join('');
    return '<div class="folio-spread"><section data-drop-zone="learned"><h3>已经学会 <small>' + g.learned.length + ' 种</small></h3><div class="folio-rows">' +
      (learned || empty('shrine', '去' + R.regions[0].temple + '拜访' + R.regions[0].mentor + '，可以学到第一道护符。')) + '</div></section>' +
      '<section data-drop-zone="slots"><h3>装备位置 <small>' + g.slots.filter(Boolean).length + ' / 4</small></h3><div class="folio-belt">' + slots + '</div>' +
      button('skill-choice', '', '取下护符', 'folio-unhang' + (selected === '' ? ' picked' : ''), writable && g.slots.some(Boolean) ? '' : 'disabled') +
      '</section></div><footer class="folio-foot"><span class="folio-tip">' +
      (!writable ? '在镇内或亮起的航灯处可以换装。' : selected === '' ? '点腰带上要取下的护符。' : selected ? '点一个位置，挂上「' + R.skills[selected].name + '」。' : '拖动法术到装备槽，或拖回左页取下；也可以点选换装。') + '</span></footer>';
  }

  function journal(g, ui) {
    const wrongOnly = ui.journalFilter === 'wrong';
    const entries = Object.entries(g.profile).filter(([, entry]) => !wrongOnly || entry.wrong)
      .sort((a, b) => a[1].firstRegion - b[1].firstRegion);
    const pages = paging(ui.page, entries.length, 4);
    const notes = pages.slice(entries).map(([id, entry]) => {
      const word = R.cards[id], miss = entry.lastMiss;
      const note = miss ? '<p class="folio-note">' + R.regions[miss.region].name + '第 ' + miss.round + ' 回合曾误点「' + escape(miss.target) + '」，这枚签可用「<span lang="ja">' +
        escape(R.cards[miss.targetWordId].jp) + '</span>」。</p>' : '';
      return '<article class="folio-entry"><small class="folio-place">' + icon('pin', 14) + R.regions[entry.firstRegion].name + '</small>' +
        '<b lang="ja">' + escape(word.jp) + '</b><span class="folio-meaning">' + escape(word.zh) + '</span>' +
        (word.reading !== word.jp ? '<small>读音 <span lang="ja">' + escape(word.reading) + '</span></small>' : '') +
        '<small>命中 ' + entry.correct + ' 次 · 失手 ' + entry.wrong + ' 次</small>' + note + '</article>';
    }).join('');
    const filter = (id, label, active) => button('journal-filter', id, label, 'folio-filter' + (active ? ' picked' : ''), 'aria-pressed="' + active + '"');
    return '<div class="folio-filterbar">' + filter('all', '全部词卡', !wrongOnly) + filter('wrong', '失误记录', wrongOnly) +
      '<small>' + entries.length + ' 个词</small></div><div class="folio-notes">' +
      (notes || empty('quill', wrongOnly ? '旅途中遇到的错词会记在这里。' : '收到第一张符卡，就能在这里读到它。')) +
      '</div><footer class="folio-foot">' + pages.controls + '</footer>';
  }

  function shop(g, ui) {
    const all = R.pools[g.region];
    const levels = [...new Set(all.map(id => R.cards[id].level))];
    const selected = levels.includes(ui.shopLevel) ? ui.shopLevel : 0;
    const pool = selected ? all.filter(id => R.cards[id].level === selected) : all;
    const pages = paging(ui.page, pool.length, 6);
    const enough = g.gold >= R.shopPrice;
    const filters = '<div class="folio-filterbar folio-levels" role="group" aria-label="按难度筛选词卡">' +
      button('shop-level', 0, '全部 ' + all.length, 'folio-filter' + (!selected ? ' picked' : ''), 'aria-pressed="' + (!selected) + '"') +
      levels.map(level => button('shop-level', level, '难度 ' + level, 'folio-filter' + (selected === level ? ' picked' : ''),
        'aria-pressed="' + (selected === level) + '"')).join('') + '</div>';
    const offers = pages.slice(pool).map(id => {
      const word = R.cards[id];
      const label = '购买「' + escape(word.jp) + '」';
      return '<details class="folio-offer"><summary><span class="folio-offer-face"><span lang="ja">' + escape(word.jp) +
        '</span><small>翻开价签</small></span><span class="folio-price">' + icon('coin', 17) + R.shopPrice + '</span></summary>' +
        '<div class="folio-offer-back"><b>' + escape(word.zh) + '</b><small>' + R.wordKinds[word.kind] + ' · 基础伤害 ' + word.level + '</small>' +
        button('buy', id, enough ? '买下词卡' : '铜币不足', 'folio-primary', 'aria-label="' + label + '" ' + (enough ? '' : 'disabled')) + '</div></details>';
    }).join('');
    return '<div class="folio-filterbar"><b>' + R.regions[g.region].lodge + '</b><span class="folio-wallet">' + icon('coin', 18) +
      '持有 ' + g.gold + ' 枚</span></div>' + filters + '<div class="folio-counter">' + offers +
      '</div><footer class="folio-foot"><span class="folio-tip">词卡按难度从低到高排列</span>' + pages.controls + '</footer>';
  }

  function loot(g, ui) {
    if (!g.loot || !g.battle) return '';
    const stats = g.battle.stats;
    const selected = g.loot.choices.includes(ui.lootChoice) ? ui.lootChoice : null;
    const cards = g.loot.choices.map(id => {
      const word = R.cards[id];
      return button('loot-preview', id, '<span class="card-power" title="基础伤害 ' + word.level + '">' + icon('sword', 13) + word.level +
        '</span><span class="folio-reward-kind">' + R.wordKinds[word.kind] + '</span><b class="card-word" lang="ja">' +
        escape(word.jp) + '</b><span class="folio-reward-meaning">' + escape(word.zh) +
        '</span><span class="folio-stamp">' + icon('lantern', 23) + '</span>', 'folio-reward playing-card' + (selected === id ? ' picked' : ''),
        'aria-pressed="' + (selected === id) + '" aria-label="预览「' + escape(word.jp) + '」，基础伤害 ' + word.level + '"');
    }).join('');
    const chosen = selected && R.cards[selected];
    return '<div class="folio-bounty"><div><span>' + icon('coin') + g.loot.gold + ' 枚铜币</span><span>' + icon('star') +
      g.loot.xp + ' 点经验</span></div><small>第 ' + g.battle.round + ' 回合取胜 · 命中 ' + stats.correct +
      ' 次 · 造成 ' + stats.damage + ' 点伤害</small></div><p class="folio-take-label">单击词卡预览，确认后领取一张</p><div class="folio-rewards">' + cards + '</div>' +
      '<footer class="folio-foot folio-reward-confirm"><span class="folio-tip" role="status" aria-live="polite">' +
      (chosen ? '已选择「' + escape(chosen.jp) + '」 · 读音 ' + escape(chosen.reading) + ' · ' + escape(chosen.zh) : '请选择一张词卡，试听读音并确认。') + '</span>' +
      (chosen ? button('take', selected, '确认领取', 'folio-primary', 'aria-label="确认领取「' + escape(chosen.jp) + '」"') : '') + '</footer>';
  }

  function log(g, ui) {
    const rows = [...(g.battle?.log ?? [])].reverse();
    const pages = paging(ui.page, rows.length, 8);
    return '<ol class="folio-log">' + pages.slice(rows).map(line => '<li>' + escape(line) + '</li>').join('') +
      '</ol><footer class="folio-foot"><span class="folio-tip">最近的行动写在最上方。</span>' + pages.controls + '</footer>';
  }

  const draw = { deck, upgrades, spells, journal, shop, loot, log };
  R.panelView = function (g, ui) {
    const key = ui.modal;
    if (!Object.hasOwn(draw, key)) return '';
    if (key === 'upgrades' && !R.canUpgrade(g)) return '';
    const [title, mark] = titles[key];
    const tabs = ['deck', 'spells', 'journal'];
    const nav = tabs.includes(key) ? '<nav class="folio-tabs" aria-label="随身物件">' + tabs.map(tab =>
      button('modal', tab, titles[tab][0], 'folio-tab' + (key === tab ? ' current' : ''), key === tab ? 'aria-current="page"' : '')).join('') + '</nav>' : '';
    return '<div class="folio-shade"><section class="folio folio-' + key + '" role="dialog" aria-modal="true" aria-labelledby="folio-title">' +
      '<header class="folio-head"><span class="folio-head-mark">' + icon(mark, 24) + '</span><h2 id="folio-title">' +
      (key === 'shop' && g.region ? '河港柜台' : title) + '</h2>' + (key === 'loot' ? '' :
        button('close', null, icon('close'), 'folio-close', 'aria-label="合上" title="合上"')) + '</header>' +
      nav + '<div class="folio-body">' + draw[key](g, ui) + '</div></section></div>';
  };
})();
