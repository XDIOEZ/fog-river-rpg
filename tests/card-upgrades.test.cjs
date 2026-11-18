'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

require('../js/data.js');
require('../js/vocabulary.js');
const originalIds = Object.keys(globalThis.River.cards);
require('../js/card-upgrades.js');
require('../js/battle.js');
require('../js/world.js');
require('../js/panels.js');
const R = globalThis.River;

test('every original vocabulary card has three related, progressively harder upgrade forms', () => {
  assert.ok(originalIds.length > 500);
  const g = R.newGame(1);
  for (const id of originalIds) {
    g.collection.test = id;
    let previous = R.cards[id];
    for (let rank = 1; rank <= 3; rank++) {
      const info = R.upgradeInfo(g, 'test');
      assert.ok(info.next, id + ' stage ' + rank);
      assert.notEqual(info.next.jp, previous.jp, id);
      assert.notEqual(info.next.zh, previous.zh, id);
      assert.ok(info.next.reading, id);
      assert.equal(info.next.level, previous.level + 1, id);
      assert.equal(info.next.upgradeRank, rank, id);
      g.collection.test = info.nextId;
      previous = info.next;
    }
    assert.equal(R.upgradeInfo(g, 'test').next, null, id);
  }
});

test('water, mountain and person upgrade into the requested semantic families', () => {
  const g = R.newGame(8);
  const person = originalIds.find(id => R.cards[id].jp === '人（ひと）');
  for (const [id, name] of [['mizu', '大海'], ['yama', '山川'], [person, 'ロボット']]) {
    g.collection.sample = id;
    assert.equal(R.upgradeInfo(g, 'sample').next.jp, name);
  }
});

test('upgrading one physical card consumes coins and preserves other copies and deck order', () => {
  const g = R.newGame(42);
  const instance = g.deck[0], originalOrder = [...g.deck];
  assert.equal(R.worldAction(g, 'upgrade', instance), false, 'cannot upgrade on the map');
  R.worldAction(g, 'town', 0);
  assert.equal(R.worldAction(g, 'upgrade', instance), false, 'insufficient coins');
  g.collection.c99 = 'mizu';
  g.gold = 40;
  for (const [rank, nextWord, cost] of [
    [1, '大海', 4], [2, '大海原', 6], [3, '海洋生態系', 8]
  ]) {
    const previousGold = g.gold;
    assert.match(R.worldAction(g, 'upgrade', instance), new RegExp(nextWord));
    assert.equal(g.gold, previousGold - cost);
    assert.equal(R.cards[g.collection[instance]].jp, nextWord);
    assert.equal(R.upgradeInfo(g, instance).rank, rank);
    assert.deepEqual(g.deck, originalOrder);
    assert.equal(g.collection.c99, 'mizu', 'another copy must not change');
  }
  assert.equal(R.worldAction(g, 'upgrade', instance), false, 'there is a maximum rank');
  assert.equal(R.worldAction(g, 'upgrade', 'absent'), false);
});

test('upgrade works for reserve cards and survives save/load and combat', () => {
  const g = R.newGame(100), instance = 'c11';
  g.collection[instance] = 'core_5_001';
  g.nextCard++;
  R.worldAction(g, 'town', 0);
  g.gold = 100;
  assert.ok(R.worldAction(g, 'upgrade', instance));
  assert.equal(g.deck.includes(instance), false);
  const wordId = g.collection[instance];
  assert.equal(R.cards[wordId].level, 6);
  const storage = { value: '', getItem() { return this.value; }, setItem(_, value) { this.value = value; } };
  assert.equal(R.saveGame(g, storage), true);
  const saved = R.loadGame(storage);
  assert.equal(saved.collection[instance], wordId);
  assert.deepEqual(R.upgradeInfo(saved, instance).next, R.cards['upgrade_2_core_5_001']);

  // Replace one equipped physical card with the upgraded one and fight with it.
  assert.ok(R.worldAction(saved, 'deck', { add: instance, remove: saved.deck[0] }));
  R.worldAction(saved, 'road', 0);
  assert.ok(R.worldAction(saved, 'fight', 'road'));
  const battle = saved.battle;
  battle.hand = [instance];
  const enemy = battle.enemies[0];
  enemy.tags = [{ id: 'test', wordId, label: R.cards[wordId].zh, hint: '' }];
  const event = R.attack(saved, instance, enemy.id, 'test');
  assert.equal(event.type, 'hit');
  assert.equal(event.wordId, wordId);
  assert.ok(event.damage >= 1);
});

test('upgrade panel lists equipped and reserve cards with costs and clear disabled states', () => {
  R.art = { icon: () => '' };
  const g = R.newGame(12);
  R.worldAction(g, 'town', 0);
  g.gold = 4;
  const html = R.panelView(g, { modal: 'upgrades', page: 0 });
  assert.match(html, /词卡进阶/);
  assert.match(html, /data-act="upgrade"/);
  assert.match(html, /进阶 · 4 铜币/);
  assert.match(html, /folio-upgrade-path/);
  g.gold = 0;
  const insufficient = R.panelView(g, { modal: 'upgrades', page: 0 });
  assert.match(insufficient, /铜币不足/);
  assert.match(insufficient, /disabled/);
});
