"""Create offline Japanese card audio.

Run: uv run --no-project --python 3.12 --with edge-tts scripts/generate_ja_audio.py
"""

import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'audio' / 'ja'
VOICE = 'ja-JP-NanamiNeural'


async def main():
    data = subprocess.check_output(
        ['node', '-e',
         'require("./js/data.js");'
         'if(require("node:fs").existsSync("./js/vocabulary.js"))require("./js/vocabulary.js");'
         'console.log(JSON.stringify(globalThis.River.cards))'],
        cwd=ROOT, text=True, encoding='utf-8',
    )
    cards = json.loads(data)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    limit = asyncio.Semaphore(16)

    async def generate(word_id, word):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', word_id):
            raise ValueError(f'Unsafe card id: {word_id}')
        target = OUTPUT / f'{word_id}.mp3'
        if target.exists() and target.stat().st_size:
            return
        async with limit:
            try:
                # Use the phonetic reading: 橋（はし） must be spoken once, as はし.
                await asyncio.wait_for(
                    edge_tts.Communicate(word['reading'] or word['jp'], VOICE, rate='-12%').save(str(target)),
                    timeout=35,
                )
                if not target.stat().st_size:
                    raise RuntimeError('Empty audio')
                print(f'{word_id}: {target.stat().st_size} bytes', flush=True)
            except Exception:
                target.unlink(missing_ok=True)
                raise

    results = await asyncio.gather(
        *(generate(word_id, word) for word_id, word in cards.items()),
        return_exceptions=True,
    )
    failures = [str(error) for error in results if isinstance(error, Exception)]
    print(f'Audio: {len(cards) - len(failures)}/{len(cards)} Japanese cards')
    if failures:
        raise RuntimeError(f'{len(failures)} audio files failed: {failures[:3]}')


if __name__ == '__main__':
    asyncio.run(main())
