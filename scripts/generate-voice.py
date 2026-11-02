"""Pre-render character voice-over with Piper (open-source neural TTS).

    # Piper 1.2 (needs piper-phonemize, which has no arm64 macOS wheel: use an x86_64 or Linux Python)
    pip install "piper-tts==1.2.0"
    # download the voices below from https://huggingface.co/rhasspy/piper-voices into MODELS
    venv/bin/python scripts/generate-voice.py MODELS_DIR

Output: public/voice/<lang>/<id>.m4a and public/voice/<lang>/manifest.json
(key "speaker|text" -> file). Re-running only renders missing clips. Needs macOS `afconvert`
(or edit encode() to use ffmpeg).
"""
import hashlib, json, os, subprocess, sys, tempfile, wave
from piper import PiperVoice

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = sys.argv[1]

# speaker id -> (model, pitch factor). Pitch is a small sample-rate shift; tempo is compensated.
CAST = {
    'en': {
        'narrator': ('en_GB-alan-medium', 1.0, 1.04),
        'alex': ('en_US-ryan-medium', 1.0, 1.0),
        'daniel': ('en_US-john-medium', 1.0, 1.0),
        'maria': ('en_US-amy-medium', 1.0, 1.0),
        'elena': ('en_GB-jenny_dioco-medium', 1.0, 1.0),
        'player': ('en_US-ryan-medium', 1.0, 1.0),
        'daniyar': ('en_US-hfc_male-medium', 1.0, 1.0),
        'alina': ('en_US-kristin-medium', 1.0, 1.0),
        'tomas': ('en_US-norman-medium', 1.0, 1.0),
        # THE LAST JOURNEY
        'reed': ('en_US-ryan-medium', 1.0, 1.0),
        'sarah': ('en_US-amy-medium', 1.0, 1.0),
        'noah': ('en_US-john-medium', 0.96, 1.0),
        'emily': ('en_US-kristin-medium', 1.04, 1.0),
        'james': ('en_US-norman-medium', 0.94, 1.06),
        'leo': ('en_US-hfc_male-medium', 1.04, 1.0),
        'tobias': ('en_US-kristin-medium', 1.25, 1.0),
        'marcus': ('en_GB-alan-medium', 0.95, 1.0),
        'wren': ('en_GB-jenny_dioco-medium', 1.0, 1.0),
        'anna': ('en_US-amy-medium', 0.93, 1.06),
        'elise': ('en_GB-jenny_dioco-medium', 0.94, 1.0),
        'voss': ('en_US-john-medium', 0.9, 1.0),
        'okafor': ('en_US-ryan-medium', 0.92, 1.05),
        'broadcast': ('en_US-kristin-medium', 0.92, 1.0),
    },
    'ru': {
        'narrator': ('ru_RU-ruslan-medium', 0.97, 1.04),
        'alex': ('ru_RU-denis-medium', 1.0, 1.0),
        'daniel': ('ru_RU-dmitri-medium', 0.95, 1.0),
        'maria': ('ru_RU-irina-medium', 1.04, 1.0),
        'elena': ('ru_RU-irina-medium', 0.95, 1.0),
        'player': ('ru_RU-denis-medium', 1.0, 1.0),
        'daniyar': ('ru_RU-dmitri-medium', 1.04, 1.0),
        'alina': ('ru_RU-irina-medium', 1.08, 1.0),
        'tomas': ('ru_RU-ruslan-medium', 0.93, 1.0),
        # THE LAST JOURNEY
        'reed': ('ru_RU-denis-medium', 1.0, 1.0),
        'sarah': ('ru_RU-irina-medium', 1.0, 1.0),
        'noah': ('ru_RU-dmitri-medium', 0.93, 1.0),
        'emily': ('ru_RU-irina-medium', 1.08, 1.0),
        'james': ('ru_RU-ruslan-medium', 0.9, 1.06),
        'leo': ('ru_RU-denis-medium', 1.06, 1.0),
        'tobias': ('ru_RU-irina-medium', 1.3, 1.0),
        'marcus': ('ru_RU-dmitri-medium', 0.97, 1.0),
        'wren': ('ru_RU-irina-medium', 0.96, 1.0),
        'anna': ('ru_RU-irina-medium', 0.92, 1.06),
        'elise': ('ru_RU-irina-medium', 1.03, 1.0),
        'voss': ('ru_RU-ruslan-medium', 0.94, 1.0),
        'okafor': ('ru_RU-denis-medium', 0.92, 1.05),
        'broadcast': ('ru_RU-irina-medium', 0.9, 1.0),
    },
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


def pitch_shift(path, factor):
    if abs(factor - 1.0) < 1e-3:
        return
    with wave.open(path, 'rb') as r:
        params, frames = r.getparams(), r.readframes(r.getnframes())
    with wave.open(path, 'wb') as w:
        w.setnchannels(params.nchannels); w.setsampwidth(params.sampwidth)
        w.setframerate(int(params.framerate * factor)); w.writeframes(frames)


def encode(wav, out):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '32000', wav, out], check=True)


def main():
    voices = {}
    for lang in ('en', 'ru'):
        outdir = os.path.join(ROOT, 'public', 'voice', lang)
        os.makedirs(outdir, exist_ok=True)
        mpath = os.path.join(outdir, 'manifest.json')
        manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
        todo = {}
        for name in STORIES[lang]:
            story = json.load(open(os.path.join(ROOT, 'src/data/stories', name + '.json')))
            for l in lines_of(story):
                sp = l.get('speaker') or 'narrator'
                todo[(sp, l['text'])] = None
        print(lang, len(todo), 'clips', flush=True)
        for i, (sp, text) in enumerate(sorted(todo)):
            cid = clip_id(lang, sp, text)
            out = os.path.join(outdir, cid + '.m4a')
            manifest[f'{sp}|{text}'] = cid + '.m4a'
            if os.path.exists(out):
                continue
            model, pitch, length = CAST[lang][sp]
            if model not in voices:
                voices[model] = PiperVoice.load(os.path.join(MODELS, model + '.onnx'))
            with tempfile.TemporaryDirectory() as tmp:
                wav = os.path.join(tmp, 'a.wav')
                with wave.open(wav, 'wb') as w:
                    voices[model].synthesize(text, w, length_scale=length * pitch, sentence_silence=0.15)
                pitch_shift(wav, pitch)
                encode(wav, out)
            if i % 25 == 0:
                print(f'  {lang} {i}/{len(todo)}', flush=True)
        json.dump(manifest, open(mpath, 'w'), ensure_ascii=False, indent=0)
    print('done')


main()
