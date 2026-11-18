const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/data.js');

const clips = [];
class MockAudio {
  constructor() {
    this.pauseCount = 0;
    this.currentTime = 0;
    clips.push(this);
  }
  pause() { this.pauseCount++; }
  play() { return Promise.resolve(); }
}
const speech = [];
const engine = {
  cancelCount: 0,
  cancel() { this.cancelCount++; },
  getVoices() { return [{ lang: 'ja-JP', name: 'Japanese' }]; },
  speak(utterance) { speech.push(utterance); }
};
globalThis.Audio = MockAudio;
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};
globalThis.speechSynthesis = engine;
require('../js/pronunciation.js');
const voice = globalThis.River.pronunciation;

test('selecting a word plays its Japanese clip and respects the volume', () => {
  assert.equal(voice.play('mizu', 0.45), true);
  assert.equal(clips.length, 1);
  assert.equal(clips[0].src, 'audio/ja/mizu.mp3');
  assert.equal(clips[0].volume, 0.45);
  voice.setVolume(0.2);
  assert.equal(clips[0].volume, 0.2);
  voice.play('fune', 0.5);
  assert.equal(clips.length, 1, 'reuse one audio player');
  assert.equal(clips[0].src, 'audio/ja/fune.mp3');
  assert.ok(clips[0].pauseCount >= 1, 'stop the previous word');
});

test('a missing clip falls back to correct Japanese reading, not Chinese or ruby text', async () => {
  clips[0].play = () => Promise.reject(new Error('missing file'));
  voice.play('hashi_bridge', 0.6);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(speech.at(-1).text, 'はし');
  assert.equal(speech.at(-1).lang, 'ja-JP');
  assert.equal(speech.at(-1).voice.lang, 'ja-JP');
  assert.equal(speech.at(-1).volume, 0.6);
  assert.equal(speech.at(-1).rate, 0.88);
});

test('muting stops playback, and a late failure cannot speak an old selection', async () => {
  let rejectOld;
  clips[0].play = () => new Promise((_, reject) => { rejectOld = reject; });
  voice.play('kaze', 1);
  const count = speech.length;
  voice.stop();
  rejectOld(new Error('late failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(speech.length, count);
  assert.equal(voice.play('mizu', 0), false);
  assert.ok(engine.cancelCount > 0);
});
