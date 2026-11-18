'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
require('../js/vocabulary.js');
require('../js/battle.js');
require('../js/world.js');
require('../js/art.js');
require('../js/scenes.js');
const R = globalThis.River;

function act(g, action, value) {
  assert.notEqual(R.worldAction(g, action, value), false, action + ' in ' + g.scene);
}

function hit(g, correct = true) {
  const battle = g.battle;
  const enemy = battle.enemies.find(enemy => enemy.tags.length > 0);
  const tag = enemy.tags[0], meaning = R.cards[tag.wordId].meaning;
  const id = battle.hand.find(id => (R.cards[g.collection[id]].meaning === meaning) === correct);
  assert.ok(id);
  assert.ok(R.attack(g, id, enemy.id, tag.id));
  R.advanceBattle(g);
}

function win(g) {
  for (let n = 0; g.scene === 'battle' && n < 60; n++) hit(g);
  assert.equal(g.scene, 'loot');
}

function roadQuest(g, region) {
  act(g, 'town', region);
  act(g, 'room', 'lodge');
  act(g, 'accept');
  assert.equal(R.worldAction(g, 'accept'), false);
  act(g, 'back');
  act(g, 'world');
  act(g, 'road', region);
}

function encounter(g, source) {
  act(g, 'fight', source);
  win(g);
  act(g, 'take', g.loot.choices[0]);
}

function store() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('optional quests, tutors, and the final ferry still work after opening the world', () => {
  const g = R.newGame(317);
  assert.equal(g.unlocked, 2);
  act(g, 'town', 1);
  act(g, 'world');
  for (const [region, place] of R.regions.entries()) {
    roadQuest(g, region);
    assert.equal(R.worldAction(g, 'fight', 'boss'), false);
    encounter(g, 'road');
    if (place.work) {
      assert.equal(R.worldAction(g, 'fight', 'boss'), false);
      act(g, 'work');
      assert.equal(R.worldAction(g, 'work'), false);
    }
    encounter(g, 'boss');
    assert.equal(R.worldAction(g, 'fight', 'boss'), false);
    act(g, 'room', 'lamp');
    act(g, 'light');
    assert.equal(R.worldAction(g, 'light'), false);
    act(g, 'town');
    act(g, 'room', 'temple');
    act(g, 'learn', ['ward', 'redraw', 'pages'][region]);
    assert.equal(R.worldAction(g, 'learn', region === 1 ? 'foretell' : 'reveal'), false);
    if (region === 1) {
      act(g, 'back');
      act(g, 'room', 'witch');
      act(g, 'learn', 'burst');
      assert.equal(R.worldAction(g, 'learn', 'chain'), false);
    }
    act(g, 'back');
    act(g, 'room', 'lodge');
    act(g, 'claim');
    assert.equal(R.worldAction(g, 'claim'), false);
    if (region === 0) {
      assert.deepEqual([g.level, g.xp, g.gold, R.capacity(g), Object.keys(g.collection).length], [2, 4, 12, 12, 13]);
      act(g, 'back');
      act(g, 'room', 'temple');
      act(g, 'learn', 'insight');
    }
  }
  assert.equal(g.scene, 'ending');
  assert.ok(g.progress.every(p => p.lit && p.claimed));
  assert.ok(R.questCards.every(word => Object.values(g.collection).includes(word)));
  act(g, 'finish');
  assert.deepEqual([g.scene, g.region, g.endingSeen], ['town', 0, true]);
  assert.equal(g.learned.length, 5);
  assert.deepEqual(g.slots, ['ward', 'insight', 'redraw', 'burst']);
  act(g, 'slot', { index: 0, skill: 'pages' });
  act(g, 'slot', { index: 1, skill: 'pages' });
  assert.deepEqual(g.slots, ['insight', 'pages', 'redraw', 'burst']);
  act(g, 'town', 1);
  act(g, 'room', 'temple');
  act(g, 'learn', 'foretell');
  act(g, 'back');
  act(g, 'room', 'witch');
  act(g, 'learn', 'chain');
  act(g, 'town', 2);
  act(g, 'room', 'temple');
  act(g, 'learn', 'reveal');
  assert.equal(g.learned.length, 8);
  assert.equal(g.slots.length, 4);
  encounter(g, 'trial');
  assert.equal(g.room, 'temple');
  act(g, 'fight', 'trial');
  assert.equal(g.battle.enemies[0].hp, 40);
});

test('a new journey begins with one safe practice monster and ends on the open map', () => {
  const g = R.newGame(19);
  assert.equal(g.scene, 'world');
  assert.equal(g.deck.length, 10);
  assert.equal(R.beginTutorial(g).includes('日语卡牌'), true);
  assert.equal(R.beginTutorial(g), false);
  assert.equal(g.scene, 'battle');
  assert.equal(g.battle.enemies.length, 1);
  assert.equal(g.battle.enemies[0].maxHp, 4);
  assert.equal(g.battle.training, true);
  // Even a mistaken card cannot spawn more enemies or damage the learner.
  hit(g, false);
  assert.equal(g.hp, g.maxHp);
  assert.equal(g.battle.enemies.length, 1);
  for (let n = 0; g.scene === 'battle' && n < 20; n++) hit(g);
  assert.equal(g.scene, 'world');
  assert.equal(g.loot, null);
  assert.equal(g.battle, null);
  assert.ok(g.progress.every(p => !p.accepted));
});

test('unlocked wilderness offers search, wait, and leave without automatic combat', () => {
  const g = R.newGame(43);
  act(g, 'road', 2);
  assert.deepEqual([g.scene, g.region, g.battle], ['road', 2, null]);
  act(g, 'search');
  assert.equal(g.scene, 'road');
  assert.ok(['fight', 'empty'].includes(g.discovery.type));
  assert.equal(g.battle, null);
  g.hp = 7;
  act(g, 'wait');
  assert.equal(g.hp, 9);
  assert.equal(g.discovery, null);
  act(g, 'leave');
  assert.equal(g.scene, 'world');
  act(g, 'town', 0);
  act(g, 'road', 1);
  assert.equal(g.region, 1);
});

test('search reveals story encounters before the player chooses to fight', () => {
  const g = R.newGame(68);
  act(g, 'town', 0);
  act(g, 'room', 'lodge');
  act(g, 'accept');
  act(g, 'back');
  act(g, 'road');
  act(g, 'search');
  assert.deepEqual([g.scene, g.discovery.type, g.discovery.source], ['road', 'fight', 'road']);
  encounter(g, g.discovery.source);
  act(g, 'search');
  assert.deepEqual([g.scene, g.discovery.type, g.discovery.source], ['road', 'fight', 'boss']);
  encounter(g, 'boss');
  act(g, 'search');
  assert.equal(g.discovery.type, 'lamp');
  act(g, 'room', 'lamp');
  act(g, 'light');
  assert.equal(g.progress[0].lit, true);
});

test('world and towns draw connected travel paths while wilderness shows three choices', () => {
  const g = R.newGame(49), view = R.travelView;
  const world = view.landmarks(g, { lastDoor: '' });
  assert.match(world, /class="map-connections"/);
  assert.equal((world.match(/data-act="road"/g) ?? []).length, 3);
  assert.equal((world.match(/data-act="town"/g) ?? []).length, 6);
  assert.doesNotMatch(world, /data-act="locked"/);
  act(g, 'town', 2);
  assert.match(view.landmarks(g, { lastDoor: '' }), /class="connection-line"/);
  act(g, 'road', 2);
  const road = view.walkView(g);
  for (const action of ['search', 'wait', 'leave']) assert.match(road, new RegExp('data-act="' + action + '"'));
  assert.doesNotMatch(road, /data-act="fight"/);
  act(g, 'search');
  assert.equal(g.scene, 'road');
  assert.ok(view.walkView(g).includes('data-act="search"'));
});

test('refresh resumes the exact battle and pending spoils, with a single claim', () => {
  const g = R.newGame(812), local = store();
  roadQuest(g, 0);
  act(g, 'fight', 'road');
  hit(g, false);
  assert.equal(g.battle.wrong.length, 1);
  assert.ok(R.saveGame(g, local));
  const continued = R.loadGame(local);
  assert.deepEqual(continued, g);
  win(g);
  win(continued);
  assert.deepEqual(continued, g);
  assert.ok(R.saveGame(g, local));
  const waiting = R.loadGame(local), card = waiting.loot.choices[1];
  assert.equal(R.worldAction(waiting, 'world'), false);
  assert.equal(R.worldAction(waiting, 'take', 'akari'), false);
  act(waiting, 'take', card);
  assert.equal(R.worldAction(waiting, 'take', card), false);
  assert.ok(R.saveGame(waiting, local));
  const paid = R.loadGame(local);
  assert.deepEqual([paid.gold, paid.xp, paid.scene, paid.progress[0].road], [4, 4, 'road', true]);
  assert.equal(Object.keys(paid.collection).length, 11);
});

test('all three riverside events survive map travel and grant only one reward per outing', () => {
  for (const [seed, kind] of [[0, 'chest'], [500, 'merchant'], [1500, 'spirit']]) {
    const g = R.newGame(seed);
    roadQuest(g, 0);
    assert.equal(g.trip.kind, kind);
    encounter(g, 'road');
    const offer = JSON.stringify(g.trip);
    act(g, 'back');
    act(g, 'road');
    assert.equal(JSON.stringify(g.trip), offer);
    if (kind === 'merchant') {
      assert.equal(R.worldAction(g, 'side'), false);
      assert.equal(g.trip.used, false);
      encounter(g, 'road');
    }
    act(g, 'side');
    if (kind === 'spirit') {
      win(g);
      act(g, 'take', g.loot.choices[0]);
    }
    const settled = JSON.stringify(g);
    assert.equal(R.worldAction(g, 'side'), false);
    assert.equal(JSON.stringify(g), settled);
    act(g, 'town');
    act(g, 'road');
    assert.equal(g.trip.used, false);
  }
});

test('equipment swaps validate the resulting deck as a whole and preserve collected copies', () => {
  const g = R.newGame(79);
  roadQuest(g, 0);
  assert.equal(R.canGear(g), false);
  act(g, 'town');
  act(g, 'room', 'lodge');
  g.gold = R.shopPrice * 3;
  const word = R.pools[0][0];
  for (let i = 0; i < 3; i++) act(g, 'buy', word);
  const reserve = Object.keys(g.collection).filter(id => g.collection[id] === word);
  assert.equal(R.worldAction(g, 'deck', { add: reserve[0] }), false);
  for (let i = 0; i < 2; i++) act(g, 'deck', { add: reserve[i], remove: g.deck[i] });
  const before = [...g.deck];
  assert.equal(R.worldAction(g, 'deck', { add: reserve[2], remove: g.deck[2] }), false);
  assert.deepEqual(g.deck, before);
  while (g.deck.length > 5) act(g, 'deck', { remove: g.deck.at(-1) });
  assert.equal(R.worldAction(g, 'deck', { remove: g.deck.at(-1) }), false);
  assert.equal(Object.keys(g.collection).length, 13);
  assert.equal(R.capacity({ level: 25 }), 50);
});

test('defeat retains an actual mistake, restores life at the unlocked checkpoint, and pays no reward', () => {
  const g = R.newGame(37);
  roadQuest(g, 0);
  encounter(g, 'road');
  encounter(g, 'boss');
  act(g, 'room', 'lamp');
  act(g, 'light');
  act(g, 'town');
  act(g, 'room', 'lodge');
  act(g, 'claim');
  roadQuest(g, 1);
  const gold = g.gold, xp = g.xp;
  g.hp = 1;
  act(g, 'fight', 'road');
  hit(g, false);
  assert.equal(g.scene, 'defeat');
  assert.equal(R.worldAction(g, 'take', R.pools[1][0]), false);
  act(g, 'revive');
  assert.deepEqual([g.region, g.room, g.hp, g.gold, g.xp], [0, 'lamp', g.maxHp, gold, xp]);
  assert.equal(Object.values(g.profile).filter(entry => entry.wrong > 0).length, 1);
  act(g, 'back');
  assert.equal(g.scene, 'road');
  assert.equal(g.trip.region, 0);
});
