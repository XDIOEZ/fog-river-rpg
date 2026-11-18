(() => {
  'use strict';
  const R = globalThis.River;
  const fieldLimit = 4;
  const freshBuffs = () => ({ ward: false, burst: false, pages: 0, borrow: false, foretell: [], chain: null });

  function addEnemy(battle, kind, hp = R.enemies[kind].hp, group) {
    const id = 'e' + battle.nextEnemy++;
    const enemy = { id, kind, group: group ?? id, hp, maxHp: hp, tags: [] };
    if (R.enemies[kind].shield) enemy.shield = true;
    battle.queues[enemy.group] ??= 0;
    battle.enemies.push(enemy);
    return enemy;
  }

  function makeTag(game, wordId, label) {
    const word = R.cards[wordId];
    const battle = game.battle;
    // Two instances of one meaning use the same wording while both signs are visible.
    const visible = battle.enemies.flatMap(enemy => enemy.tags)
      .find(tag => R.cards[tag.wordId].meaning === word.meaning);
    label ??= visible?.label ?? (word.answers.length === 1 ? word.zh : word.answers[Math.floor(R.random(game) * word.answers.length)]);
    return { id: 't' + battle.nextTag++, wordId, label, hint: '' };
  }

  function slotsOf(enemy) {
    const normal = enemy.visibleSlots ?? R.enemies[enemy.kind].slots;
    return Math.min(4, normal + (enemy.revealed ? 1 : 0));
  }

  function repairTags(game) {
    const battle = game.battle;
    const available = [...battle.hand];
    const old = battle.enemies.map(enemy => enemy.tags);
    for (const enemy of battle.enemies) enemy.tags = [];

    // Reserve one distinct physical card per surviving sign. Walk by row so one
    // monster's second sign never outranks another monster's only valid sign.
    const oldRows = Math.max(0, ...old.map(tags => tags.length));
    for (let row = 0; row < oldRows; row++) {
      for (const [i, enemy] of battle.enemies.entries()) {
        const tag = old[i][row];
        if (!tag || enemy.tags.length >= slotsOf(enemy)) continue;
        const meaning = R.cards[tag.wordId].meaning;
        let index = available.findIndex(id => game.collection[id] === tag.wordId);
        if (index < 0) index = available.findIndex(id => R.cards[game.collection[id]].meaning === meaning);
        if (index < 0) continue;
        const [id] = available.splice(index, 1);
        tag.wordId = game.collection[id];
        if (tag.hint) tag.hint = R.cards[tag.wordId].reading[0];
        enemy.tags.push(tag);
      }
    }

    const rows = Math.max(0, ...battle.enemies.map(slotsOf));
    for (let row = 0; row < rows && available.length; row++) {
      for (const enemy of battle.enemies) {
        if (!available.length) break;
        if (enemy.tags.length > row || slotsOf(enemy) <= row) continue;
        const preference = R.enemies[enemy.kind].prefers;
        const preferred = preference ? available.filter(id => R.cards[game.collection[id]].kind === preference) : [];
        const pool = preferred.length ? preferred : available;
        const id = pool[Math.floor(R.random(game) * pool.length)];
        available.splice(available.indexOf(id), 1);
        enemy.tags.push(makeTag(game, game.collection[id]));
      }
    }
  }

  function drawCards(game, count) {
    const battle = game.battle;
    const cards = battle.draw.splice(0, count);
    if (cards.length < count && battle.discard.length) {
      battle.draw = R.shuffle(game, battle.discard);
      battle.discard = [];
      cards.push(...battle.draw.splice(0, count - cards.length));
    }
    battle.stats.drawn += cards.length;
    if (cards.length) battle.buffs.foretell = [];
    return cards;
  }

  function startRound(game, firstWords = []) {
    const battle = game.battle;
    for (const id of battle.wrong) {
      const index = Math.floor(R.random(game) * (battle.draw.length + 1));
      battle.draw.splice(index, 0, id);
    }
    battle.wrong = [];
    battle.round++;
    const { buffs } = battle;
    const extra = (buffs.pages > 0 ? 3 : 0) + (buffs.borrow ? 3 : 0);
    buffs.pages = Math.max(0, buffs.pages - 1);
    buffs.borrow = false;
    battle.hand = drawCards(game, 5 + extra);
    battle.stats.extraDrawn += Math.max(0, battle.hand.length - 5);
    for (const enemy of battle.enemies) enemy.tags = [];
    for (const wordId of firstWords) {
      battle.enemies[0].tags.push(makeTag(game, wordId, R.cards[wordId].zh));
    }
    repairTags(game);
    battle.log.push('第 ' + battle.round + ' 回合，抽到 ' + battle.hand.length + ' 张牌。');
  }

  R.battleStart = function (game, kind, tutorial = false) {
    if (game.battle?.status === 'active' || !game.deck.length || !R.enemies[kind]) return false;
    const battle = game.battle = {
      round: 0, status: 'active', tutorial, enemies: [], queues: {}, nextEnemy: 1, nextTag: 1,
      draw: R.shuffle(game, game.deck), hand: [], discard: [], wrong: [], combo: 0, log: [],
      buffs: freshBuffs(),
      stats: { correct: 0, wrong: 0, damage: 0, baseDamage: 0, taken: 0, casts: 0, drawn: 0, extraDrawn: 0 }
    };
    addEnemy(battle, kind);
    game.mp = game.maxMp;
    const wordIds = game.deck.map(id => game.collection[id]);
    const starter = tutorial && kind === 'slime' && wordIds.length === R.starter.length &&
      R.starter.every(wordId => wordIds.includes(wordId));
    if (starter) {
      const first = R.starter.slice(0, 5).map(wordId => game.deck[wordIds.indexOf(wordId)]);
      battle.draw = first.concat(battle.draw.filter(id => !first.includes(id)));
    }
    startRound(game, starter ? [R.starter[0], R.starter[3]] : []);
    return battle;
  };

  function plannedMove(battle, enemy) {
    if (battle.training) return { type: 'wait', name: '等待你继续练习' };
    const moves = R.enemies[enemy.kind].moves;
    const move = moves[battle.queues[enemy.group] % moves.length];
    if (move.type === 'split') {
      const canSplit = battle.enemies.some(other => other.group === enemy.group && other.hp >= 2);
      if (!canSplit || battle.enemies.length >= fieldLimit) return { type: 'wait', name: '颤动' };
    }
    if (move.type === 'summon' && battle.enemies.length >= fieldLimit) return { type: 'wait', name: '笛声消散' };
    return move;
  }

  R.forecast = function (battle, enemy) {
    const move = plannedMove(battle, enemy);
    let text = move.name;
    if (move.type === 'attack') text += ' ' + (move.damage + (enemy.charged ? 2 : 0));
    if (move.type === 'borrow') text += ' +3';
    return { type: move.type, text };
  };
  R.intent = (battle, enemy) => R.forecast(battle, enemy).text;

  function splitGroup(battle, actor) {
    const index = battle.enemies.indexOf(actor);
    const original = battle.enemies.slice(index).concat(battle.enemies.slice(0, index));
    let count = 0;
    for (const enemy of original) {
      if (battle.enemies.length >= fieldLimit) break;
      if (enemy.group !== actor.group || enemy.hp < 2) continue;
      const childHp = Math.floor(enemy.hp / 2);
      enemy.hp -= childHp;
      enemy.maxHp = enemy.hp;
      addEnemy(battle, enemy.kind, childHp, actor.group);
      count++;
    }
    return count;
  }

  function enemyTurn(game, enemy) {
    const battle = game.battle;
    const move = plannedMove(battle, enemy);
    const name = R.enemies[enemy.kind].name;
    const event = { type: move.type, name: move.name, actor: enemy.id, damage: 0, text: '' };
    battle.queues[enemy.group]++;
    switch (move.type) {
      case 'attack': {
        const power = move.damage + (enemy.charged ? 2 : 0);
        const blocked = battle.buffs.ward ? Math.min(power, 2) : 0;
        event.damage = Math.min(game.hp, power - blocked);
        event.blocked = blocked;
        game.hp -= event.damage;
        battle.stats.taken += event.damage;
        battle.buffs.ward = false;
        enemy.charged = false;
        event.text = name + '使出' + move.name + '，你受到 ' + event.damage + ' 点伤害。';
        if (blocked) event.text += '护念抵消 ' + blocked + ' 点。';
        if (game.hp === 0) {
          battle.status = 'lost';
          battle.buffs = freshBuffs();
        }
        break;
      }
      case 'split':
        event.spawned = splitGroup(battle, enemy);
        event.text = '芦叶摇晃，分出 ' + event.spawned + ' 只史莱姆。';
        break;
      case 'borrow':
        battle.buffs.borrow = true;
        event.text = '灯罩亮起三道刻线，你下一回合多抽三张牌。';
        break;
      case 'charge':
        enemy.charged = true;
        event.text = name + '举灯蓄势，下次攻击增加 2 点伤害。';
        break;
      case 'guard':
        enemy.shield = true;
        event.text = name + '重新架起船盾。';
        break;
      case 'shift':
        enemy.visibleSlots = enemy.visibleSlots === 1 ? 3 : 1;
        event.text = '灯羽折光，弱点槽变为 ' + enemy.visibleSlots + ' 枚。';
        break;
      case 'summon':
        addEnemy(battle, 'spirit');
        event.spawned = 1;
        event.text = name + '唤来一只纸灯灵。';
        break;
      default:
        event.text = name + '轻轻一颤，行动结束。';
    }
    battle.log.push(event.text);
    return event;
  }

  function recordWord(game, wordId, hit, tag) {
    const entry = game.profile[wordId] ??= {
      correct: 0, wrong: 0, firstRegion: game.region, lastRegion: game.region, lastMiss: null
    };
    entry.lastRegion = game.region;
    if (hit) entry.correct++;
    else {
      entry.wrong++;
      entry.lastMiss = { target: tag.label, targetWordId: tag.wordId, region: game.region, round: game.battle.round };
    }
  }

  function dealDamage(battle, enemy, word) {
    const definition = R.enemies[enemy.kind];
    const power = word.level * (battle.buffs.burst ? 2 : 1);
    battle.buffs.burst = false;
    if (enemy.shield && battle.combo >= 3) {
      enemy.shield = false;
      battle.log.push('连续命中，船盾裂开。');
    }
    const armor = (definition.armor ?? 0) + (enemy.shield ? 2 : 0);
    const chainBonus = battle.buffs.chain ?? 0;
    if (battle.buffs.chain != null) battle.buffs.chain = Math.min(2, chainBonus + 1);
    const bonus = chainBonus + (definition.vulnerable === word.kind ? 1 : 0);
    const damage = Math.min(enemy.hp, Math.max(1, power + bonus - armor));
    enemy.hp -= damage;
    battle.stats.baseDamage += word.level;
    battle.stats.damage += damage;
    if (enemy.hp === 0) {
      battle.enemies = battle.enemies.filter(other => other !== enemy);
      if (!battle.enemies.some(other => other.group === enemy.group)) delete battle.queues[enemy.group];
      if (!battle.enemies.length) {
        battle.status = 'won';
        battle.buffs = freshBuffs();
      }
    }
    return damage;
  }

  R.attack = function (game, instanceId, enemyId, tagId) {
    const battle = game.battle;
    if (battle?.status !== 'active') return false;
    const handIndex = battle.hand.indexOf(instanceId);
    const enemy = battle.enemies.find(other => other.id === enemyId);
    const tag = enemy?.tags.find(other => other.id === tagId);
    if (handIndex < 0 || !tag) return false;

    const wordId = game.collection[instanceId];
    const word = R.cards[wordId];
    const hit = word.meaning === R.cards[tag.wordId].meaning;
    const event = { type: hit ? 'hit' : 'miss', wordId, enemyId, tagId, damage: 0, text: '' };
    battle.hand.splice(handIndex, 1);
    recordWord(game, wordId, hit, tag);
    if (hit) {
      battle.combo++;
      battle.stats.correct++;
      battle.discard.push(instanceId);
      enemy.tags = enemy.tags.filter(other => other !== tag);
      event.damage = dealDamage(battle, enemy, word);
      event.text = '「' + word.jp + '」命中「' + tag.label + '」，造成 ' + event.damage + ' 点伤害。';
    } else {
      battle.combo = 0;
      battle.buffs.chain = null;
      battle.stats.wrong++;
      battle.wrong.push(instanceId);
      event.text = '「' + word.jp + '」对应「' + word.zh + '」。';
    }
    battle.log.push(event.text);
    if (battle.status !== 'active') return event;

    // A last-card miss owes its enemy action to the *new* round. All operations
    // finish in this call, so a saved snapshot never holds an unpaid or doubled action.
    if (!battle.hand.length) {
      startRound(game);
      event.newRound = battle.round;
    }
    if (!hit) {
      event.enemyAction = enemyTurn(game, enemy);
      event.text += event.enemyAction.text;
    }
    if (battle.status === 'active' && (!event.newRound || !hit)) repairTags(game);
    return event;
  };

  function targetTag(battle, target) {
    const enemy = battle.enemies.find(other => other.id === target.enemyId);
    return enemy?.tags.find(other => other.id === target.tagId);
  }

  R.canCast = function (game, skillId, target) {
    const battle = game.battle;
    const skill = R.skills[skillId];
    if (battle?.status !== 'active' || !skill || game.mp < skill.cost ||
        !game.learned.includes(skillId) || !game.slots.includes(skillId)) return false;
    switch (skillId) {
      case 'ward': return !battle.buffs.ward;
      case 'pages': return !battle.buffs.pages;
      case 'foretell': return battle.draw.length > 0 && !battle.buffs.foretell?.length;
      case 'chain': return battle.buffs.chain == null;
      case 'reveal': {
        const inUse = battle.enemies.reduce((sum, enemy) => sum + enemy.tags.length, 0);
        if (inUse >= battle.hand.length) return false;
        return battle.enemies.some(enemy => !enemy.revealed && slotsOf(enemy) < 4 &&
          enemy.tags.length === slotsOf(enemy) && (target == null ||
          (target.enemyId === enemy.id && enemy.tags.some(tag => tag.id === target.tagId))));
      }
      case 'insight':
        if (target == null) return battle.enemies.some(enemy => enemy.tags.some(tag => !tag.hint));
        return targetTag(battle, target)?.hint === '';
      case 'redraw':
        if (!battle.draw.length && !battle.discard.length) return false;
        break;
      case 'burst':
        if (battle.buffs.burst) return false;
        break;
    }
    return target == null ? battle.hand.length > 0 : battle.hand.includes(target);
  };

  R.cast = function (game, skillId, target) {
    if (!R.canCast(game, skillId, target)) return false;
    const skill = R.skills[skillId];
    if (skill.target !== 'self' && target == null) return false;
    const battle = game.battle;
    const event = { type: 'skill', skillId, text: '' };
    switch (skillId) {
      case 'ward':
        battle.buffs.ward = true;
        event.text = '护念已亮，下次攻击抵消 2 点伤害。';
        break;
      case 'pages':
        battle.buffs.pages = 2;
        event.text = '两枚铜扣张开，接下来两个回合各多抽三张。';
        break;
      case 'foretell':
        battle.buffs.foretell = battle.draw.slice(0, 2);
        event.text = '预习时的牌堆顶依次是' +
          battle.buffs.foretell.map(id => '「' + R.cards[game.collection[id]].jp + '」').join('、') + '。';
        break;
      case 'chain':
        battle.buffs.chain = 0;
        event.text = '法珠亮起。连续命中时，从第二张牌开始追加伤害。';
        break;
      case 'reveal': {
        const enemy = battle.enemies.find(other => other.id === target.enemyId);
        enemy.revealed = true;
        repairTags(game);
        event.enemyId = enemy.id;
        event.text = R.enemies[enemy.kind].name + '头顶又亮起一枚弱点签。';
        break;
      }
      case 'insight': {
        const tag = targetTag(battle, target);
        tag.hint = R.cards[tag.wordId].reading[0];
        event.enemyId = target.enemyId;
        event.text = '「' + tag.label + '」的答案以「' + tag.hint + '」开头。';
        break;
      }
      case 'redraw': {
        const [fresh] = drawCards(game, 1);
        const index = battle.hand.indexOf(target);
        battle.hand[index] = fresh;
        battle.discard.push(target);
        repairTags(game);
        event.text = '重整手牌，换来「' + R.cards[game.collection[fresh]].jp + '」。';
        break;
      }
      case 'burst':
        battle.hand.splice(battle.hand.indexOf(target), 1);
        battle.discard.push(target);
        battle.buffs.burst = true;
        event.text = '舍牌结契，下次正确命中的基础伤害翻倍。';
        break;
    }
    game.mp -= skill.cost;
    battle.stats.casts++;
    battle.log.push(event.text);
    if (!battle.hand.length) {
      startRound(game);
      event.newRound = battle.round;
    } else if (skillId === 'burst') repairTags(game);
    return event;
  };
})();
