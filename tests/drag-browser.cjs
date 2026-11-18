// Optional end-to-end pointer check: node tests/drag-browser.cjs (Windows + Edge).
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 19487;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!fs.existsSync(edge)) throw new Error('Edge not found at ' + edge);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-drag-'));
  const browser = spawn(edge, ['--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'],
    { stdio: 'ignore' });
  let socket;
  try {
    let page;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
        page = tabs.find(tab => tab.type === 'page' && tab.webSocketDebuggerUrl);
        if (page) break;
      } catch {}
      await wait(100);
    }
    if (!page) throw new Error('Edge debugging port did not open');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let serial = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + expression);
      return result.result.value;
    }
    async function loaded() {
      for (let i = 0; i < 40; i++) {
        if (await evaluate('Boolean(globalThis.River?.planDrop && document.querySelector("#game"))')) return;
        await wait(100);
      }
      throw new Error('Game scripts did not load');
    }
    async function reload() { await send('Page.reload'); await wait(350); await loaded(); }
    async function center(selector) {
      const found = await evaluate('(() => { const el = document.querySelector(' + JSON.stringify(selector) +
        '); if(!el) return null; const r = el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
      assert.ok(found, 'Missing element: ' + selector);
      return found;
    }
    async function mouse(type, position, down) {
      await send('Input.dispatchMouseEvent', { type, ...position, button: 'left',
        buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
    }
    async function click(selector) {
      const point = await center(selector);
      await mouse('mousePressed', point, true);
      await mouse('mouseReleased', point, false);
      await wait(100);
    }
    async function drag(from, to) {
      const start = await center(from), end = await center(to);
      await mouse('mousePressed', start, true);
      for (let i = 1; i <= 12; i++) {
        const f = i / 12;
        await mouse('mouseMoved', { x: start.x + (end.x - start.x) * f,
          y: start.y + (end.y - start.y) * f }, true);
      }
      await mouse('mouseReleased', end, false);
      await wait(250);
    }
    async function touchDrag(from, to) {
      const start = await center(from), end = await center(to);
      await send('Input.dispatchTouchEvent', { type: 'touchStart',
        touchPoints: [{ ...start, id: 0 }] });
      for (let i = 1; i <= 12; i++) {
        const f = i / 12;
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          id: 0, x: start.x + (end.x - start.x) * f, y: start.y + (end.y - start.y) * f
        }] });
      }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(250);
    }
    const saved = () => evaluate('JSON.parse(localStorage.getItem(River.saveKey))');
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href });
    await wait(500);
    await loaded();

    assert.equal(await evaluate(`(() => {
      const g = River.newGame(43);
      g.scene='battle'; g.learned=['ward','insight','redraw','burst'];
      g.slots=['ward','insight','redraw','burst'];
      River.battleStart(g,'trial');
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    const initial = await saved();
    const card = initial.battle.hand[0];
    const sign = initial.battle.enemies[0].tags[0];
    await drag('.hand-card[data-val="' + card + '"]', '.weak-sign[data-val="' + sign.id + '"]');
    const fought = await saved();
    assert.equal(fought.battle.stats.correct + fought.battle.stats.wrong, 1, 'Card drop must attack exactly once');
    console.log('PASS: hand card -> monster weakness');

    assert.equal(await evaluate(`(() => {
      const g = River.newGame(44);
      g.scene='town'; g.level=2;
      g.collection.c11=River.pools[0][0];g.nextCard=12;
      g.learned=['ward','insight','redraw'];g.slots=['ward',null,null,null];
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    await click('[data-act="modal"][data-val="deck"]');
    const before = await saved();
    await drag('.folio-row[data-act="reserve"][data-val="c11"]',
      '.folio-row[data-act="equipped"][data-val="' + before.deck[0] + '"]');
    const swapped = await saved();
    assert.equal(swapped.deck[0], 'c11', 'Card drop must swap into deck');
    console.log('PASS: reserve card -> equipped card');

    await click('[data-act="modal"][data-val="spells"]');
    await drag('.folio-spell[data-val="redraw"]', '.folio-strap[data-val="1"]');
    const slotted = await saved();
    assert.equal(slotted.slots[1], 'redraw', 'Skill drop must equip');
    console.log('PASS: learned skill -> empty slot');
    await drag('.folio-strap[data-val="1"]', '[data-drop-zone="learned"] h3');
    const unslotted = await saved();
    assert.equal(unslotted.slots[1], null, 'Skill drop back to inventory must unequip');
    console.log('PASS: equipped skill -> learned list');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`(() => {
      const g = River.newGame(45);
      g.scene='battle';
      River.battleStart(g,'trial');
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    await touchDrag('.hand-card', '.weak-sign');
    const touched = await saved();
    assert.equal(touched.battle.stats.correct + touched.battle.stats.wrong, 1,
      'Touch card drop must attack exactly once');
    console.log('PASS: touch hand card -> weakness (mobile viewport)');

    assert.equal(await evaluate(`(() => {
      const g = River.newGame(46);
      g.scene='town';g.level=2;g.collection.c11=River.pools[0][0];g.nextCard=12;
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    await click('[data-act="modal"][data-val="deck"]');
    const mobileBefore = await saved();
    await touchDrag('.folio-row[data-act="reserve"][data-val="c11"]',
      '.folio-row[data-act="equipped"][data-val="' + mobileBefore.deck[0] + '"]');
    assert.equal((await saved()).deck[0], 'c11', 'Touch inventory swap must change equipment');
    console.log('PASS: touch reserve card -> equipped card (mobile viewport)');

    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`(() => {
      const g = River.newGame(47);
      g.scene='battle';River.battleStart(g,'trial');
      g.battle.hand.push(...g.battle.draw.splice(0,4));
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    await drag('.hand-card:nth-child(5)', '.hand-card:first-child');
    assert.ok(await evaluate('document.querySelector(".hand-fan").scrollLeft > 0'),
      'Mouse dragging horizontally should scroll an overflowing hand');
    console.log('PASS: horizontal drag scrolls an overflowing hand');

    assert.equal(await evaluate(`(() => {
      const g = River.newGame(48);
      g.scene='battle';River.battleStart(g,'slime');g.scene='loot';
      g.loot={source:'road',choices:River.pools[0].slice(0,3),gold:4,xp:4};
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    assert.equal(await evaluate('document.querySelectorAll("[data-act=loot-preview]").length'), 3);
    assert.equal(await evaluate('Boolean(document.querySelector("[data-act=take]"))'), false);
    const beforeReward = await saved();
    await click('.folio-reward:nth-child(1)');
    assert.equal(await evaluate('document.querySelector(".folio-reward.picked")?.dataset.val'), beforeReward.loot.choices[0]);
    assert.deepEqual(await saved(), beforeReward, 'A preview must not award a card, gold or XP');
    await click('.folio-reward:nth-child(2)');
    assert.equal(await evaluate('document.querySelector("[data-act=take]")?.dataset.val'), beforeReward.loot.choices[1]);
    assert.deepEqual(await saved(), beforeReward, 'Switching the preview must not award anything');
    console.log('PASS: reward preview and switching do not claim');

    await reload();
    await click('[data-act="continue"]');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-act=take]"))'), false,
      'Refreshing should not silently confirm a previous selection');
    await click('.folio-reward:nth-child(2)');
    await click('[data-act="take"]');
    const rewarded = await saved();
    assert.equal(rewarded.scene, 'road');
    assert.equal(rewarded.gold, beforeReward.gold + 4);
    assert.equal(rewarded.xp, beforeReward.xp + 4);
    assert.equal(Object.keys(rewarded.collection).length, Object.keys(beforeReward.collection).length + 1);
    assert.equal(rewarded.collection['c' + (rewarded.nextCard - 1)], beforeReward.loot.choices[1]);
    assert.equal(await evaluate('Boolean(document.querySelector("[data-act=take]"))'), false);
    console.log('PASS: explicit confirmation claims exactly one reward');

    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 600, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`(() => {
      const g = River.newGame(49);
      g.scene='battle';River.battleStart(g,'slime');g.scene='loot';
      g.loot={source:'road',choices:River.pools[0].slice(0,3),gold:4,xp:4};
      return River.saveGame(g);
    })()`), true);
    await reload();
    await click('[data-act="continue"]');
    await click('.folio-reward:nth-child(1)');
    const confirmPosition = await evaluate(`(() => {
      const r = document.querySelector('[data-act="take"]').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: window.innerHeight };
    })()`);
    assert.ok(confirmPosition.top >= 0 && confirmPosition.bottom <= confirmPosition.height,
      'Mobile claim button must remain on screen after preview: ' + JSON.stringify(confirmPosition));
    console.log('PASS: mobile viewport keeps claim confirmation visible');
  } finally {
    socket?.close();
    browser.kill();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
