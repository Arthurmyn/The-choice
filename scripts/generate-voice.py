"""Pre-render character voice-over with open-source neural TTS.

    English  Kokoro-82M  (Apache-2.0)             pip install kokoro-onnx soundfile numpy
    Russian  Silero v4   (CC BY-NC-SA 4.0, non-commercial)   pip install torch omegaconf soundfile

    MODELS_DIR must hold kokoro-v1.0.onnx, voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx, release
    model-files-v1.0) and v4_ru.pt (models.silero.ai/models/tts/ru/v4_ru.pt). Silero is loaded through
    torch.package, which unpickles code: only use the file from the official source.

    python scripts/generate-voice.py MODELS_DIR

Output: public/voice/<lang>/<id>.m4a and public/voice/<lang>/manifest.json (key "speaker|text" -> file).
Re-running renders only missing clips and deletes clips no line uses any more. Needs macOS `afconvert`
(or edit encode() to use ffmpeg).
"""
import hashlib, json, os, subprocess, sys, tempfile
from xml.sax.saxutils import escape

import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = sys.argv[1]

# EN: speaker -> (Kokoro voice, speed)
EN = {
    'narrator': ('bm_george', 0.95),
    'alex': ('am_michael', 1.0),
    'daniel': ('am_adam', 1.0),
    'maria': ('af_nicole', 1.0),
    'elena': ('bf_emma', 1.0),
    'player': ('am_eric', 1.0),
    'daniyar': ('am_puck', 1.0),
    'alina': ('af_sarah', 1.0),
    'tomas': ('bm_lewis', 0.95),
    # THE LAST JOURNEY
    'reed': ('am_michael', 0.97),
    'sarah': ('af_heart', 1.0),
    'noah': ('am_eric', 1.05),
    'emily': ('af_bella', 1.0),
    'james': ('bm_daniel', 0.92),
    'leo': ('am_puck', 1.08),
    'tobias': ('af_nova', 1.12),
    'marcus': ('bm_fable', 0.97),
    'wren': ('bf_isabella', 1.0),
    'anna': ('af_nicole', 0.92),
    'elise': ('bf_emma', 0.95),
    'voss': ('am_onyx', 0.92),
    'okafor': ('bm_george', 0.92),
    'broadcast': ('af_sky', 0.95),
}
# RU: speaker -> (Silero speaker, SSML pitch, SSML rate)
RU = {
    'narrator': ('eugene', 'medium', 'slow'),
    'alex': ('aidar', 'medium', 'medium'),
    'daniel': ('eugene', 'low', 'medium'),
    'maria': ('baya', 'medium', 'medium'),
    'elena': ('kseniya', 'low', 'medium'),
    'player': ('aidar', 'medium', 'medium'),
    'daniyar': ('eugene', 'high', 'medium'),
    'alina': ('xenia', 'medium', 'medium'),
    'tomas': ('aidar', 'low', 'slow'),
    # THE LAST JOURNEY
    'reed': ('eugene', 'medium', 'medium'),
    'sarah': ('baya', 'high', 'medium'),
    'noah': ('aidar', 'high', 'medium'),
    'emily': ('xenia', 'high', 'medium'),
    'james': ('aidar', 'x-low', 'slow'),
    'leo': ('eugene', 'high', 'fast'),
    'tobias': ('xenia', 'x-high', 'fast'),
    'marcus': ('eugene', 'low', 'slow'),
    'wren': ('kseniya', 'medium', 'medium'),
    'anna': ('baya', 'low', 'slow'),
    'elise': ('xenia', 'low', 'medium'),
    'voss': ('aidar', 'low', 'medium'),
    'okafor': ('eugene', 'x-low', 'slow'),
    'broadcast': ('kseniya', 'medium', 'fast'),
}
STORIES = {'en': ['releaseToday', 'speakForSomeoneElse', 'theLastJourney'], 'ru': ['releaseToday.ru', 'speakForSomeoneElse.ru', 'theLastJourney.ru']}


def lines_of(story):
    out = []
    for n in story['nodes'].values():
        if n['type'] == 'decision':
            for c in n['choices']:
                out += c['reaction']['lines']
        elif n['type'] != 'router':
            out += n['scene']['lines']
    for e in story['endings'].values():
        out += e['scene']['lines']
    return out


def clip_id(lang, speaker, text):
    return hashlib.sha1(f'{lang}|{speaker}|{text}'.encode()).hexdigest()[:12]


def encode(wav, out):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', wav, out], check=True)


def main():
    from kokoro_onnx import Kokoro
    import torch

    kokoro = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
    silero = torch.package.PackageImporter(os.path.join(MODELS, 'v4_ru.pt')).load_pickle('tts_models', 'model')

    def render(lang, sp, text, wav):
        if lang == 'en':
            voice, speed = EN[sp]
            samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
        else:
            who, pitch, speed = RU[sp]
            ssml = f'<speak><prosody pitch="{pitch}" rate="{speed}">{escape(text)}</prosody></speak>'
            samples = silero.apply_tts(ssml_text=ssml, speaker=who, sample_rate=24000, put_accent=True, put_yo=True).numpy()
            rate = 24000
        sf.write(wav, samples, rate)

    for lang in ('en', 'ru'):
        outdir = os.path.join(ROOT, 'public', 'voice', lang)
        os.makedirs(outdir, exist_ok=True)
        todo = {}
        for name in STORIES[lang]:
            story = json.load(open(os.path.join(ROOT, 'src/data/stories', name + '.json')))
            for l in lines_of(story):
                todo[(l.get('speaker') or 'narrator', l['text'])] = None
        print(lang, len(todo), 'clips', flush=True)
        manifest = {}
        for i, (sp, text) in enumerate(sorted(todo)):
            cid = clip_id(lang, sp, text) + '.m4a'
            manifest[f'{sp}|{text}'] = cid
            out = os.path.join(outdir, cid)
            if os.path.exists(out):
                continue
            with tempfile.TemporaryDirectory() as tmp:
                wav = os.path.join(tmp, 'a.wav')
                render(lang, sp, text, wav)
                encode(wav, out)
            if i % 25 == 0:
                print(f'  {lang} {i}/{len(todo)}', flush=True)
        for f in os.listdir(outdir):
            if f.endswith('.m4a') and f not in manifest.values():
                os.remove(os.path.join(outdir, f))
        json.dump(manifest, open(os.path.join(outdir, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)
    print('done')


main()
