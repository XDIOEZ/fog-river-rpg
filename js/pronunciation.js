(() => {
  'use strict';
  const R = globalThis.River;
  const missingAudio = new Set();
  let audio, utterance, version = 0;

  function stop() {
    version++;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    globalThis.speechSynthesis?.cancel();
    utterance = null;
  }

  function speak(word, volume, onUnavailable, expectedVersion) {
    if (version !== expectedVersion) return false;
    const engine = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (!engine || !Utterance) {
      onUnavailable?.();
      return false;
    }
    const voices = engine.getVoices?.() ?? [];
    const japanese = voices.find(voice => /^ja(?:-|$)/i.test(voice.lang));
    if (voices.length && !japanese) {
      onUnavailable?.();
      return false;
    }
    try {
      utterance = new Utterance(word.reading || word.jp);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.88;
      utterance.volume = volume;
      if (japanese) utterance.voice = japanese;
      utterance.onerror = () => {
        if (version === expectedVersion) onUnavailable?.();
      };
      engine.speak(utterance);
      return true;
    } catch {
      onUnavailable?.();
      return false;
    }
  }

  function play(wordId, volume, onUnavailable) {
    stop();
    const word = R.cards[wordId];
    const level = Math.max(0, Math.min(1, Number(volume) || 0));
    if (!word || !level) return false;
    const expectedVersion = version;
    if (missingAudio.has(wordId) || typeof globalThis.Audio !== 'function') {
      return speak(word, level, onUnavailable, expectedVersion);
    }
    try {
      audio ??= new globalThis.Audio();
      audio.src = 'audio/ja/' + encodeURIComponent(wordId) + '.mp3';
      audio.volume = level;
      Promise.resolve(audio.play()).catch(() => {
        if (version !== expectedVersion) return;
        missingAudio.add(wordId);
        speak(word, level, onUnavailable, expectedVersion);
      });
      return true;
    } catch {
      missingAudio.add(wordId);
      return speak(word, level, onUnavailable, expectedVersion);
    }
  }

  function setVolume(volume) {
    const level = Math.max(0, Math.min(1, Number(volume) || 0));
    if (!level) return stop();
    if (audio) audio.volume = level;
    if (utterance) utterance.volume = level;
  }

  R.pronunciation = { play, stop, setVolume };
})();
