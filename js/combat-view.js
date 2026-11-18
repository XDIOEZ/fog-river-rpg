(() => {
  'use strict';
  const R = globalThis.River;
  const icons = {
    ward: 'shield', insight: 'eye', redraw: 'redraw', burst: 'burst',
    pages: 'pages', foretell: 'book', chain: 'sword', reveal: 'star'
  };
  const intents = {
    attack: 'claws', split: 'leaf', borrow: 'lantern', charge: 'lantern',
    guard: 'shield', shift: 'star', summon: 'sail', wait: 'leaf'
  };
  const icon = (name, size) => R.art.icon(name, size);

  function wrongPile(game) {
    const wrong = game.battle.wrong.map(id => R.cards[game.collection[id]]);
    if (!wrong.length) return '';
    const faces = wrong.slice(0, 3).map((card, n) =>
      `<span class="small-miss" title="${card.jp} · ${card.zh}" lang="ja" style="--turn:${(n - Math.min(2, wrong.length - 1) / 2) * 7}deg">${card.jp}</span>`
    ).join('');
    const entries = wrong.map(card =>
      `<li tabindex="0"><span lang="ja">${card.jp}</span><b>${card.zh}</b></li>`
    ).join('');
    return `<div class="wrong-pile" tabindex="0" aria-label="本回合 ${wrong.length} 张错卡，查看正确意思">
      <span class="miss-faces">${faces}</span><span class="miss-count">错卡 · ${wrong.length}</span>
      <div class="miss-review"><strong>回合末洗入抽牌堆</strong><ul>${entries}</ul></div>
    </div>`;
  }

  function travelerTokens(game) {
    const battle = game.battle;
    const { ward, burst, pages, borrow, foretell, chain } = battle.buffs;
    const tokens = [];
    if (ward) tokens.push([icons.ward, '护念']);
    if (burst) tokens.push([icons.burst, '下击翻倍']);
    if (pages) tokens.push([icons.pages, '丰页 ×' + pages]);
    if (borrow) tokens.push(['lantern', '下回合 +3']);
    if (chain != null) tokens.push([icons.chain, chain ? '连珠 · 下击 +' + chain : '连珠已结']);
    if (foretell?.length) tokens.push([icons.foretell, '预习 · ' + foretell.map(id => R.cards[game.collection[id]].jp).join(' › ')]);
    if (battle.combo >= 2) tokens.push(['sword', '连击 ' + battle.combo]);
    return tokens.map(([symbol, label]) => `<span>${icon(symbol, 14)}${label}</span>`).join('');
  }

  function fighter(battle, enemy, order) {
    const def = R.enemies[enemy.kind];
    const preview = R.forecast(battle, enemy);
    const signs = enemy.tags.map(tag => {
      const stamp = R.cards[tag.wordId].kind === 'kana' ? '<small class="phonetic-mark">音</small>' : '';
      const hint = tag.hint ? `<small class="tag-hint" lang="ja">${tag.hint}…</small>` : '';
      return `<button class="weak-sign" data-act="tag" data-val="${tag.id}" data-enemy="${enemy.id}"
        aria-label="${def.name}的弱点，${tag.label}${tag.hint ? '，线索' + tag.hint : ''}">${stamp}${tag.label}${hint}</button>`;
    }).join('');
    return `<div class="combat-fighter${enemy.charged ? ' charged' : ''}" data-fighter="${enemy.id}" data-group="${enemy.group}" style="--arrival:${order * 40}ms">
      <div class="enemy-plate">
        <span class="enemy-intent" title="下一次攻击这只敌人的弱点失败时执行">${icon(intents[preview.type], 17)}${preview.text}</span>
        <div class="foe-vitals"><span>${def.name}</span><small>${enemy.hp}/${enemy.maxHp}</small></div>
        <span class="foe-hp"><i style="width:${100 * enemy.hp / enemy.maxHp}%"></i></span>
      </div>
      <div class="weak-signs">${signs}</div>
      <button class="enemy-body" data-act="inspect" data-val="${enemy.id}" aria-label="查看${def.name}的行动">
        ${R.art.enemy(enemy.kind)}
      </button>
    </div>`;
  }

  function hand(game, selected) {
    const ids = game.battle.hand;
    const scroll = ids.length > 5;
    const compactScroll = ids.length >= 5 ||
      (ids.length > 3 && ids.some(id => R.cards[game.collection[id]].jp.length > 6));
    const cards = ids.map((id, i) => {
      const word = R.cards[game.collection[id]];
      const lane = i - (ids.length - 1) / 2;
      const angle = scroll ? 0 : Math.max(-6, Math.min(6, lane * 1.8));
      const offset = scroll ? 0 : Math.min(10, Math.abs(lane) * 2.5);
      const reading = word.reading === word.jp || word.jp.includes(word.reading) ? '' : '（' + word.reading + '）';
      const suffix = '（' + word.reading + '）';
      const face = word.jp.endsWith(suffix)
        ? '<ruby>' + word.jp.slice(0, -suffix.length) + '<rt>' + word.reading + '</rt></ruby>' : word.jp;
      return `<button class="hand-card${word.jp.length > 6 ? ' long-word' : ''}" lang="ja" data-act="card" data-val="${id}" data-drag="hand"
        title="${word.jp}${reading} · 伤害 ${word.level} · 可拖到怪物弱点" aria-label="${word.jp}，伤害 ${word.level}" aria-pressed="${id === selected}"
        style="--tilt:${angle}deg;--dip:${offset}px">
        <span class="paper-face playing-card"><span class="card-power" title="基础伤害 ${word.level}">${icon('sword', 13)}${word.level}</span>
          <b class="card-word">${face}</b><span class="copper-stamp">${icon('star', 16)}</span>
        </span>
      </button>`;
    }).join('');
    const controls = compactScroll ? `<button class="fan-turn fan-left" data-act="fan-prev" aria-label="向左翻手牌">‹</button>
      <button class="fan-turn fan-right" data-act="fan-next" aria-label="向右翻手牌">›</button>` : '';
    return `<div class="fan-frame">
      <div class="hand-fan${scroll ? ' overflowing' : ''}${compactScroll ? ' compact-scroll' : ''}" data-round="${game.battle.round}" aria-label="当前手牌">${cards}</div>
      ${controls}
    </div>`;
  }

  function spellBelt(game, selected) {
    const slots = game.slots.map((id, i) => {
      if (!id) return `<span class="spell-empty" aria-label="空法术槽 ${i + 1}"><i></i></span>`;
      const skill = R.skills[id];
      const active = R.canCast(game, id);
      const message = game.mp < skill.cost ? '需 ' + skill.cost + ' 点法力，现有 ' + game.mp : skill.description;
      return `<span class="spell-wrap"><button class="combat-spell" data-act="spell" data-val="${id}" ${active ? 'data-drag="combat-spell"' : ''}
        aria-pressed="${selected === id}" aria-label="${skill.name}，${skill.cost} 点法力" ${active ? '' : 'disabled'}>
        ${icon(icons[id], 23)}<span>${skill.cost}</span></button>
        <span class="spell-tip" role="tooltip"><b>${skill.name} · ${skill.cost} 法力</b>${message}</span>
      </span>`;
    }).join('');
    return `<div class="spell-belt">
      <div class="pile-tally">${icon('cards', 14)}<span>抽牌 ${game.battle.draw.length}</span><i></i><b>手牌 ${game.battle.hand.length}</b><i></i><span>弃牌 ${game.battle.discard.length}</span></div>
      <div class="spell-slots">${slots}</div><span>法术</span>
    </div>`;
  }

  function meter(name, label, value, max) {
    return `<div class="traveler-meter ${name}"><span>${icon(name, 15)}${label}</span><b>${value} / ${max}</b>
      <i><em style="width:${100 * value / max}%"></em></i></div>`;
  }

  R.combatView = function (game, ui) {
    const battle = game.battle;
    const skill = R.skills[ui.skill];
    let prompt = '';
    if (skill?.target === 'tag') prompt = skill.name + ' · 选择一枚弱点';
    else if (skill?.target === 'card') prompt = skill.name + ' · 选择一张手牌';
    else if (ui.card && battle.hand.includes(ui.card)) prompt = '「' + R.cards[game.collection[ui.card]].jp + '」 · 点选目标弱点';
    else if (battle.tutorial && !battle.stats.correct && !battle.stats.wrong) prompt = '拖动符卡到怪物弱点，或先选牌再点击弱点';

    return `<section class="combat-view" aria-label="词卡战斗">
      <div class="combat-field">
        <div class="turn-marker"><span class="turn-jewel"></span>第 ${battle.round} 回合</div>
        <button class="combat-log-button" data-act="log" title="战斗记事">${icon('book', 17)}<span>战斗记事</span></button>
        <div class="traveler-position">
          <div class="combat-hero">${R.art.hero()}</div>${wrongPile(game)}
          <div class="combat-tokens">${travelerTokens(game)}</div>
        </div>
        <div class="enemy-field" data-count="${battle.enemies.length}">
          ${battle.enemies.map((enemy, index) => fighter(battle, enemy, index)).join('')}
        </div>
      </div>
      <div class="battle-belt">
        <div class="traveler-vitals"><div class="traveler-portrait">${R.art.portrait()}</div>
          <div class="traveler-meters">${meter('heart', '生命', game.hp, game.maxHp)}${meter('mana', '法力', game.mp, game.maxMp)}</div>
        </div>
        <div class="hand-station">${prompt ? '<div class="hand-prompt">' + prompt + '</div>' : ''}${hand(game, ui.card)}</div>
        ${spellBelt(game, ui.skill)}
      </div>
    </section>`;
  };
})();
