'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
const R = globalThis.River;
const legacyIds = new Set(Object.keys(R.cards));
const originalStarter = [...R.starter];
const originalQuestCards = [...R.questCards];
require('../js/vocabulary.js');
require('../js/battle.js');
require('../js/world.js');
require('../js/panels.js');

test('expanded library is complete, ordered and keeps every existing word ID intact', () => {
  const ids = Object.keys(R.cards);
  const { added, byLevel, total } = R.vocabularyStats;
  assert.ok(added >= 500, 'keep the expanded learning corpus available');
  assert.equal(total, ids.length);
  assert.equal(total, legacyIds.size + added);
  assert.deepEqual(R.starter, originalStarter);
  assert.deepEqual(R.questCards, originalQuestCards);
  assert.deepEqual(Object.keys(byLevel).map(Number), [1, 2, 3, 4, 5]);
  for (const id of legacyIds) assert.ok(R.cards[id]);

  const valid = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'kana']);
  const unique = new Set();
  for (const id of ids) {
    const word = R.cards[id];
    assert.ok(word.jp && word.zh && word.reading && word.meaning, id);
    assert.ok(valid.has(word.kind), id);
    assert.ok(word.answers.includes(word.zh), id);
    assert.ok(word.level >= 1 && word.level <= 5, id);
    assert.ok(!unique.has(word.jp), 'repeated card face: ' + word.jp);
    unique.add(word.jp);
  }
  assert.equal(new Set(R.pools.flat()).size, R.pools.flat().length);
  assert.deepEqual(R.pools.map(pool => [...new Set(pool.map(id => R.cards[id].level))]),
    [[1, 2], [2, 3, 4], [3, 4, 5]]);
  for (const pool of R.pools) {
    for (let i = 1; i < pool.length; i++)
      assert.ok(R.cards[pool[i - 1]].level <= R.cards[pool[i]].level);
  }
  for (const id of ids.filter(id => id.startsWith('core_')))
    assert.ok(R.pools.some(pool => pool.includes(id)), id);
});

test('clear synonyms share a target meaning rather than making identical labels ambiguous', () => {
  for (const [legacy, extra] of [
    ['sagasu', '探す（さがす）'],
    ['erabu', '選ぶ（えらぶ）'],
    ['wataru', '渡る（わたる）'],
    ['harau', '払う（はらう）']
  ]) {
    const word = Object.values(R.cards).find(card => card.jp === extra);
    assert.ok(word, extra);
    assert.equal(word.meaning, R.cards[legacy].meaning, extra);
  }
});

test('new cards can be bought, put in a deck, fought with and saved without losing them', () => {
  const g = R.newGame(100);
  assert.ok(R.worldAction(g, 'town', 0));
  assert.ok(R.worldAction(g, 'room', 'lodge'));
  assert.ok(R.worldAction(g, 'accept'));
  const wordId = R.pools[0].find(id => id.startsWith('core_'));
  const oldDeck = [...g.deck];
  g.gold = R.shopPrice;
  assert.ok(R.worldAction(g, 'buy', wordId));
  const instance = 'c11';
  assert.equal(g.collection[instance], wordId);
  assert.ok(R.worldAction(g, 'deck', { add: instance, remove: oldDeck[0] }));
  const storage = { value: null, getItem() { return this.value; }, setItem(_, v) { this.value = v; } };
  assert.ok(R.saveGame(g, storage));
  const saved = R.loadGame(storage);
  assert.equal(saved.collection[instance], wordId);
  assert.ok(saved.deck.includes(instance));
  assert.ok(R.worldAction(saved, 'back'));
  assert.ok(R.worldAction(saved, 'road', 0));
  assert.ok(R.worldAction(saved, 'fight', 'road'));
  assert.equal(saved.battle.status, 'active');
  assert.equal(saved.battle.draw.length + saved.battle.hand.length, saved.deck.length);
});

test('the shop filters by learning difficulty without hiding newly integrated cards', () => {
  R.art = { icon: () => '' };
  const g = R.newGame(20);
  R.worldAction(g, 'town', 0);
  R.worldAction(g, 'room', 'lodge');
  const allHtml = R.panelView(g, { modal: 'shop', shopLevel: 0, page: 0 });
  const advancedHtml = R.panelView(g, { modal: 'shop', shopLevel: 2, page: 0 });
  assert.match(allHtml, /全部 \d+/);
  assert.match(allHtml, /难度 1/);
  assert.match(advancedHtml, /难度 2/);
  assert.match(advancedHtml, /aria-pressed="true"/);
  assert.match(advancedHtml, /词卡按难度从低到高排列/);
  const levelTwo = R.pools[0].find(id => R.cards[id].level === 2);
  assert.ok(advancedHtml.includes(R.cards[levelTwo].jp));
});
