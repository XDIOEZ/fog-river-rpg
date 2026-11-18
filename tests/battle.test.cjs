const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
require('../js/vocabulary.js');
require('../js/battle.js');
const R = globalThis.River;

function traveler(words = R.starter, slots = ['ward', 'insight', 'redraw', 'burst']) {
  const deck = words.map((_, i) => 'c' + (i + 1));
  return {
    region: 0, rng: 71, collection: Object.fromEntries(words.map((word, i) => [deck[i], word])),
    deck, learned: Object.keys(R.skills), slots, profile: {}, hp: 12, maxHp: 12, mp: 4, maxMp: 4
  };
}

function move(game, correct, kind) {
  for (const enemy of game.battle.enemies) {
    if (kind && enemy.kind !== kind) continue;
    for (const tag of enemy.tags) {
      const id = game.battle.hand.find(instance => {
        const meaning = R.cards[game.collection[instance]].meaning;
        return (meaning === R.cards[tag.wordId].meaning) === correct;
      });
      if (id) return [id, enemy.id, tag.id];
    }
  }
}

function play(game, correct, kind) {
  const choice = move(game, correct, kind);
  assert.ok(choice);
  return R.attack(game, ...choice);
}

function checkTable(game) {
  const b = game.battle;
  const fourZones = [...b.draw, ...b.hand, ...b.discard, ...b.wrong];
  assert.deepEqual(fourZones.sort(), [...game.deck].sort());
  assert.equal(new Set(fourZones).size, game.deck.length);
  assert.ok(b.enemies.length <= 4);
  const meanings = b.hand.map(id => R.cards[game.collection[id]].meaning);
  const tags = b.enemies.flatMap(enemy => enemy.tags);
  if (b.status === 'active') assert.ok(b.hand.length && tags.length);
  for (const tag of tags) {
    const i = meanings.indexOf(R.cards[tag.wordId].meaning);
    assert.notEqual(i, -1, 'a visible sign must have a distinct answer');
    meanings.splice(i, 1);
  }
}

test('the tutorial reserves five real cards and two meanings, and a perfect fight ends on hit twelve', () => {
  const g = traveler();
  const b = R.battleStart(g, 'slime', true);
  assert.deepEqual(b.hand.map(id => g.collection[id]), R.starter.slice(0, 5));
  assert.deepEqual(b.enemies[0].tags.map(tag => tag.label), ['水', '船']);
  const stale = move(g, true);
  assert.equal(R.attack(g, ...stale).type, 'hit');
  assert.equal(R.attack(g, ...stale), false);
  while (b.status === 'active') {
    checkTable(g);
    assert.equal(play(g, true).enemyAction, undefined);
  }
  assert.equal(b.round, 3);
  assert.equal(b.stats.correct, 12);
  assert.equal(b.stats.taken, 0);
  assert.equal(b.status, 'won');
  assert.equal(g.hp, 12);
});

test('four misses split a single pool from one to four and recycle only suspended cards', () => {
  const g = traveler();
  const b = R.battleStart(g, 'slime', true);
  const drawOrder = [...b.draw];
  for (const [i, count] of [1, 2, 2, 4].entries()) {
    const event = play(g, false);
    assert.equal(event.enemyAction.type, i % 2 ? 'split' : 'attack');
    assert.equal(b.wrong.length, i + 1);
    assert.equal(b.enemies.length, count);
    assert.equal(b.enemies.reduce((n, e) => n + e.hp, 0), 12);
    checkTable(g);
  }
  assert.equal(g.hp, 8);
  assert.equal(b.round, 1);
  assert.equal(move(g, false), undefined);
  const last = b.hand[0];
  play(g, true);
  assert.deepEqual(b.wrong, []);
  assert.deepEqual(b.discard, [last]);
  assert.deepEqual([...b.hand, ...b.draw].filter(id => drawOrder.includes(id)), drawOrder);
  assert.equal(Object.values(g.profile).reduce((n, record) => n + record.wrong, 0), 4);
  checkTable(g);
});

test('odd slime health splits exactly; a failed final card borrows light for the following round', () => {
  const g = traveler();
  const b = R.battleStart(g, 'slime', true);
  for (let i = 0; i < 5; i++) play(g, true);
  play(g, false);
  play(g, false);
  assert.deepEqual(b.enemies.map(e => [e.hp, e.maxHp]), [[4, 4], [3, 3]]);

  const trial = traveler();
  const t = R.battleStart(trial, 'trial');
  for (let i = 0; i < 4; i++) play(trial, true);
  // Normal selection can never miss the sole remaining card. Supply an already
  // incompatible target to exercise the GDD's exceptional ordering via attack().
  const sign = t.enemies[0].tags[0];
  sign.wordId = R.starter.find(word => word !== trial.collection[t.hand[0]]);
  sign.label = R.cards[sign.wordId].zh;
  const mistake = play(trial, false);
  assert.equal(mistake.newRound, 2);
  assert.equal(mistake.enemyAction.type, 'borrow');
  assert.equal(t.hand.length, 5);
  assert.equal(t.buffs.borrow, true);
  assert.equal(t.queues[t.enemies[0].group], 1);
  for (let i = 0; i < 5; i++) play(trial, true);
  assert.equal(t.hand.length, 8);
  assert.equal(t.buffs.borrow, false);
  checkTable(trial);
});

test('remaining draw cards are drawn before recycling discards', () => {
  const g = traveler();
  const b = R.battleStart(g, 'trial');
  while (b.hand.length > 1) play(g, true);
  b.discard.push(...b.draw.splice(3));
  const expectedFirst = [...b.draw];
  play(g, true);
  assert.deepEqual(b.hand.slice(0, 3), expectedFirst);
  assert.equal(b.hand.length, 5);
  assert.equal(b.discard.length, 0);
  checkTable(g);
});

test('ward survives a charge; failed, unlearned and repeated spells spend no MP', () => {
  const g = traveler();
  const b = R.battleStart(g, 'guardian');
  assert.equal(R.cast(g, 'pages'), false);
  assert.equal(R.cast(g, 'insight'), false);
  const sign = b.enemies[0].tags[0];
  const target = { enemyId: b.enemies[0].id, tagId: sign.id };
  g.learned = g.learned.filter(id => id !== 'insight');
  assert.equal(R.cast(g, 'insight', target), false);
  g.learned.push('insight');
  assert.equal(R.cast(g, 'insight', target).type, 'skill');
  assert.equal(sign.hint, R.cards[sign.wordId].reading[0]);
  assert.equal(R.cast(g, 'insight', target), false);
  assert.equal(g.mp, 2);
  assert.equal(R.cast(g, 'ward').type, 'skill');
  assert.equal(play(g, false).enemyAction.type, 'charge');
  assert.equal(b.buffs.ward, true);
  const blow = play(g, false).enemyAction;
  assert.equal(blow.damage, 2);
  assert.equal(blow.blocked, 2);
  assert.equal(b.buffs.ward, false);
  assert.equal(g.mp, 0);
});

test('redraw cannot draw its own discard; discarding the last card keeps burst without giving the foe a turn', () => {
  const tiny = traveler(R.starter.slice(0, 5));
  const small = R.battleStart(tiny, 'trial');
  assert.equal(R.cast(tiny, 'redraw', small.hand[0]), false);
  assert.equal(tiny.mp, 4);

  const g = traveler();
  const b = R.battleStart(g, 'trial');
  const old = b.hand[0], fresh = b.draw[0];
  assert.equal(R.cast(g, 'redraw', old).type, 'skill');
  assert.equal(b.hand[0], fresh);
  assert.deepEqual(b.discard, [old]);
  assert.equal(b.stats.wrong, 0);
  checkTable(g);

  const burst = traveler();
  const t = R.battleStart(burst, 'trial');
  for (let i = 0; i < 4; i++) play(burst, true);
  assert.equal(R.cast(burst, 'burst', t.hand[0]).newRound, 2);
  assert.equal(t.buffs.burst, true);
  assert.equal(t.queues[t.enemies[0].group], 0);
  assert.equal(play(burst, true).damage, 2);
  assert.equal(t.buffs.burst, false);
  assert.equal(burst.mp, 1);
});

test('the academy supports 5 + 8 + 8 opportunities; light and pages can also combine', () => {
  const words = Object.keys(R.cards).filter(id => R.cards[id].level === 2).slice(0, 12);
  const g = traveler(words, ['pages', null, null, null]);
  const b = R.battleStart(g, 'trial');
  R.cast(g, 'pages');
  while (b.status === 'active') {
    checkTable(g);
    play(g, true);
  }
  assert.equal(b.stats.correct, 20);
  assert.equal(b.stats.damage, 40);
  assert.equal(b.stats.drawn, 21);
  assert.equal(b.stats.extraDrawn, 6);
  assert.equal(b.round, 3);
  assert.equal(b.hand.length, 1);
  const combined = traveler(words, ['pages', null, null, null]);
  const t = R.battleStart(combined, 'trial');
  R.cast(combined, 'pages');
  play(combined, false);
  while (t.round === 1) play(combined, true);
  assert.equal(t.hand.length, 11);
  checkTable(combined);
});

test('synonymous cards, different meanings with identical readings, and kana signs are distinguished', () => {
  const g = traveler(['fune', 'senpaku', 'fune', 'senpaku', 'hashi_bridge']);
  const b = R.battleStart(g, 'trial');
  const enemy = b.enemies[0];
  const sign = enemy.tags.find(tag => R.cards[tag.wordId].meaning === 'fune');
  const alias = b.hand.find(id => R.cards[g.collection[id]].meaning === 'fune' && g.collection[id] !== sign.wordId);
  assert.equal(R.attack(g, alias, enemy.id, sign.id).type, 'hit');
  const labels = enemy.tags.filter(tag => R.cards[tag.wordId].meaning === 'fune').map(tag => tag.label);
  assert.ok(new Set(labels).size <= 1);
  const homonyms = traveler(['hashi_bridge', 'hashi_chopsticks', 'kana_shu', 'hashi_bridge', 'hashi_chopsticks']);
  const h = R.battleStart(homonyms, 'trial');
  const foe = h.enemies[0];
  const hashi = foe.tags.find(tag => R.cards[tag.wordId].reading === 'はし');
  const otherSense = h.hand.find(id => R.cards[homonyms.collection[id]].reading === 'はし' && homonyms.collection[id] !== hashi.wordId);
  assert.equal(R.attack(homonyms, otherSense, foe.id, hashi.id).type, 'miss');
  while (!foe.tags.some(tag => tag.wordId === 'kana_shu')) play(homonyms, true);
  const kana = foe.tags.find(tag => tag.wordId === 'kana_shu');
  assert.equal(kana.label, 'shu');
  assert.equal(R.attack(homonyms, h.hand.find(id => homonyms.collection[id] === 'kana_shu'), foe.id, kana.id).type, 'hit');
  checkTable(homonyms);
});

test('postgame foretell reads the real draw order and expires as soon as a card is drawn', () => {
  const g = traveler(R.starter, ['foretell', 'redraw', null, null]);
  const b = R.battleStart(g, 'trial');
  const originalOrder = [...b.draw];
  const rng = g.rng;
  assert.equal(R.cast(g, 'foretell').type, 'skill');
  assert.deepEqual(b.buffs.foretell, originalOrder.slice(0, 2));
  assert.deepEqual(b.draw, originalOrder);
  assert.equal(g.rng, rng);
  assert.equal(R.cast(g, 'foretell'), false);
  const before = b.hand[0];
  R.cast(g, 'redraw', before);
  assert.equal(b.hand[0], originalOrder[0]);
  assert.deepEqual(b.buffs.foretell, []);
  const small = traveler(R.starter.slice(0, 5), ['foretell', null, null, null]);
  R.battleStart(small, 'trial');
  play(small, true);
  assert.equal(small.battle.discard.length, 1);
  assert.equal(R.cast(small, 'foretell'), false);
  assert.equal(small.mp, 4);
});

test('postgame chain bonuses build on consecutive hits and lapse after a mistake or victory', () => {
  const g = traveler(R.starter, ['chain', null, null, null]);
  const b = R.battleStart(g, 'trial');
  R.cast(g, 'chain');
  assert.equal(R.cast(g, 'chain'), false);
  assert.deepEqual([play(g, true).damage, play(g, true).damage, play(g, true).damage], [1, 2, 3]);
  play(g, false);
  assert.equal(b.buffs.chain, null);
  assert.equal(play(g, true).damage, 1);
  R.cast(g, 'chain');
  while (b.status === 'active') play(g, true);
  assert.equal(b.buffs.chain, null);
});

test('postgame reveal charges only for a real fourth independently answerable sign', () => {
  const g = traveler(R.starter, ['reveal', null, null, null]);
  const b = R.battleStart(g, 'trial');
  const foe = b.enemies[0];
  let target = { enemyId: foe.id, tagId: foe.tags[0].id };
  assert.equal(foe.tags.length, 3);
  assert.equal(R.cast(g, 'reveal'), false);
  assert.equal(R.cast(g, 'reveal', { ...target, tagId: 'gone' }), false);
  assert.equal(g.mp, 4);
  assert.equal(R.cast(g, 'reveal', target).type, 'skill');
  assert.equal(foe.tags.length, 4);
  assert.equal(R.cast(g, 'reveal', target), false);
  assert.equal(g.mp, 2);
  checkTable(g);
  const limited = traveler(R.starter, ['reveal', null, null, null]);
  const l = R.battleStart(limited, 'trial');
  play(limited, true);
  play(limited, true);
  const enemy = l.enemies[0];
  target = { enemyId: enemy.id, tagId: enemy.tags[0].id };
  assert.equal(l.hand.length, enemy.tags.length);
  assert.equal(R.cast(limited, 'reveal', target), false);
  assert.equal(limited.mp, 4);
});

test('a restored turn resolves identically across enemy types and death suspends input', () => {
  const mixed = traveler();
  const party = R.battleStart(mixed, 'caller');
  assert.equal(play(mixed, false, 'caller').enemyAction.type, 'summon');
  const summoner = party.enemies[0], helper = party.enemies[1];
  assert.equal(play(mixed, false, 'spirit').enemyAction.type, 'borrow');
  assert.equal(party.queues[summoner.group], 1);
  assert.equal(party.queues[helper.group], 1);
  assert.equal(mixed.hp, 12);
  checkTable(mixed);

  for (const kind of Object.keys(R.enemies)) {
    const g = traveler();
    const b = R.battleStart(g, kind);
    for (let i = 0; b.status === 'active' && i < 200; i++) {
      checkTable(g);
      const args = (i % 4 === 1 && move(g, false)) || move(g, true);
      const copy = JSON.parse(JSON.stringify(g));
      const result = R.attack(g, ...args);
      assert.deepEqual(R.attack(copy, ...args), result);
      assert.deepEqual(copy, g);
    }
    assert.notEqual(b.status, 'active');
  }
  const doomed = traveler();
  doomed.hp = 2;
  const b = R.battleStart(doomed, 'slime', true);
  assert.equal(play(doomed, false).enemyAction.damage, 2);
  assert.equal(b.status, 'lost');
  assert.equal(doomed.hp, 0);
  assert.equal(R.attack(doomed, ...move(doomed, true)), false);
});
