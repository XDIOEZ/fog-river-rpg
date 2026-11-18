'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
require('../js/battle.js');
require('../js/world.js');
require('../js/drag-drop.js');
const R = globalThis.River;

function traveler() {
  const g = R.newGame(41);
  g.scene = 'town';
  g.level = 2; // Capacity 12: one new reserve card can be added after a swap.
  R.starter.forEach((word, i) => { g.collection['c' + (i + 1)] = word; });
  g.deck = R.starter.map((_, i) => 'c' + (i + 1));
  g.collection.c11 = R.pools[0][0];
  g.collection.c12 = R.pools[0][1];
  g.learned = ['ward', 'insight', 'redraw', 'burst', 'pages'];
  g.slots = ['ward', 'insight', null, null];
  return g;
}

test('dragging reserve cards onto carried cards swaps safely; dragging them onto the carrying area equips', () => {
  const g = traveler();
  const reserve = { kind: 'reserve', id: 'c11' };
  const choice = R.planDrop(g, reserve, { kind: 'equipped', id: 'c1' });
  assert.deepEqual(choice, { action: 'deck', add: 'c11', remove: 'c1' });
  assert.ok(R.worldAction(g, choice.action, choice));
  assert.equal(g.deck[0], 'c11');
  assert.equal(R.planDrop(g, reserve, { kind: 'equipped-zone' }), null);

  const equip = R.planDrop(g, { kind: 'reserve', id: 'c12' }, { kind: 'equipped-zone' });
  assert.deepEqual(equip, { action: 'deck', add: 'c12', remove: null });
  assert.ok(R.worldAction(g, 'deck', equip));
  assert.equal(g.deck.length, 11);
  assert.equal(g.deck.at(-1), 'c12');

  const old = g.deck.slice();
  const reorder = R.planDrop(g, { kind: 'equipped', id: 'c12' }, { kind: 'equipped', id: 'c11' });
  assert.deepEqual(reorder, { action: 'deck-order', from: 'c12', to: 'c11' });
  assert.ok(R.worldAction(g, reorder.action, reorder));
  assert.equal(g.deck[0], 'c12');
  assert.deepEqual(g.deck.slice(1), old.filter(id => id !== 'c12'));
  assert.equal(R.planDrop(g, { kind: 'equipped', id: 'c12' }, { kind: 'equipped', id: 'c12' }), null);
});

test('dropping carried cards into reserve unequips or replaces while respecting the five-card minimum', () => {
  const g = traveler();
  const swap = R.planDrop(g, { kind: 'equipped', id: 'c2' }, { kind: 'reserve', id: 'c11' });
  assert.deepEqual(swap, { action: 'deck', add: 'c11', remove: 'c2' });
  assert.ok(R.worldAction(g, swap.action, swap));

  while (g.deck.length > 5) {
    const first = g.deck.at(-1);
    const remove = R.planDrop(g, { kind: 'equipped', id: first }, { kind: 'reserve-zone' });
    assert.ok(R.worldAction(g, remove.action, remove));
  }
  const before = [...g.deck];
  const forbidden = R.planDrop(g, { kind: 'equipped', id: before[0] }, { kind: 'reserve-zone' });
  assert.equal(R.worldAction(g, forbidden.action, forbidden), false);
  assert.deepEqual(g.deck, before);
  g.scene = 'road';
  assert.equal(R.planDrop(g, { kind: 'equipped', id: before[0] }, { kind: 'reserve-zone' }), null);
});

test('dragging learned spells equips, swapping slots moves them, and dragging back removes them', () => {
  const g = traveler();
  const choice = R.planDrop(g, { kind: 'learned-spell', id: 'pages' }, { kind: 'spell-slot', index: 2 });
  assert.deepEqual(choice, { action: 'slot', index: 2, skill: 'pages' });
  assert.ok(R.worldAction(g, choice.action, choice));
  const move = R.planDrop(g, { kind: 'slot-spell', id: 'pages', index: 2 }, { kind: 'spell-slot', index: 0 });
  assert.ok(R.worldAction(g, move.action, move));
  assert.deepEqual(g.slots, ['pages', 'insight', 'ward', null]);
  const unhang = R.planDrop(g, { kind: 'slot-spell', id: 'pages', index: 0 }, { kind: 'learned-zone' });
  assert.deepEqual(unhang, { action: 'slot', index: 0, skill: null });
  assert.ok(R.worldAction(g, unhang.action, unhang));
  assert.deepEqual(g.slots, [null, 'insight', 'ward', null]);
  assert.equal(R.planDrop(g, { kind: 'slot-spell', id: 'pages', index: 0 }, { kind: 'learned-zone' }), null);
});

test('battle drag maps a hand card to a weakness and skills to their correct target type', () => {
  const g = traveler();
  g.slots = ['ward', 'insight', 'redraw', 'burst'];
  R.battleStart(g, 'trial');
  g.scene = 'battle';
  const card = g.battle.hand[0];
  const enemy = g.battle.enemies[0], sign = enemy.tags[0];
  const tag = { kind: 'tag', id: sign.id, enemy: enemy.id };
  const attack = R.planDrop(g, { kind: 'hand', id: card }, tag);
  assert.deepEqual(attack, { action: 'attack', card, enemy: enemy.id, tag: sign.id });
  assert.ok(R.attack(g, attack.card, attack.enemy, attack.tag));
  assert.equal(R.planDrop(g, { kind: 'hand', id: card }, tag), null);

  const nextCard = g.battle.hand[0];
  const self = R.planDrop(g, { kind: 'combat-spell', id: 'ward' }, { kind: 'hero' });
  assert.deepEqual(self, { action: 'cast', skill: 'ward' });
  const spellOnCard = R.planDrop(g, { kind: 'combat-spell', id: 'redraw' }, { kind: 'hand', id: nextCard });
  assert.deepEqual(spellOnCard, { action: 'cast', skill: 'redraw', target: nextCard });
  const cardOnSpell = R.planDrop(g, { kind: 'hand', id: nextCard }, { kind: 'combat-spell', id: 'redraw' });
  assert.deepEqual(cardOnSpell, spellOnCard);
  const spellOnTag = R.planDrop(g, { kind: 'combat-spell', id: 'insight' }, { kind: 'tag', id: g.battle.enemies[0].tags[0].id, enemy: enemy.id });
  assert.equal(spellOnTag?.action, 'cast');
  assert.equal(R.planDrop(g, { kind: 'combat-spell', id: 'ward' }, tag), null);
});
