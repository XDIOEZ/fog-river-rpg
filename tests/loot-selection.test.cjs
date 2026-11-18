'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');
require('../js/vocabulary.js');
require('../js/battle.js');
require('../js/world.js');
require('../js/art.js');
require('../js/panels.js');
const R = globalThis.River;

test('reward cards preview first; only the selected card has a claim button', () => {
  const g = R.newGame(48);
  g.scene = 'battle';
  R.battleStart(g, 'slime');
  g.scene = 'loot';
  g.loot = { source: 'road', choices: R.pools[0].slice(0, 3), gold: 4, xp: 4 };
  const initialState = JSON.stringify(g);

  const initial = R.panelView(g, { modal: 'loot', lootChoice: null });
  assert.equal((initial.match(/data-act="loot-preview"/g) || []).length, 3);
  assert.doesNotMatch(initial, /data-act="take"/);
  assert.match(initial, /单击词卡预览/);

  const first = g.loot.choices[0], second = g.loot.choices[1];
  const selected = R.panelView(g, { modal: 'loot', lootChoice: first });
  assert.match(selected, new RegExp('data-act="take" data-val="' + first + '"'));
  assert.equal((selected.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(selected, /确认领取/);
  assert.match(selected, /读音/);

  const changed = R.panelView(g, { modal: 'loot', lootChoice: second });
  assert.match(changed, new RegExp('data-act="take" data-val="' + second + '"'));
  assert.doesNotMatch(changed, new RegExp('data-act="take" data-val="' + first + '"'));
  assert.doesNotMatch(R.panelView(g, { modal: 'loot', lootChoice: 'unknown' }), /data-act="take"/);
  assert.equal(JSON.stringify(g), initialState, 'previewing must not mutate the saved game');
});
