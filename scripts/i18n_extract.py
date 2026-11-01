"""Extract/apply translatable strings of a story JSON. Usage:
   python3 scripts/i18n_extract.py dump <in.json> <out.txt>
   python3 scripts/i18n_extract.py apply <in.json> <translations.txt> <out.json>
Translatable = strings under known text keys; ids, flags and visual data are left alone."""
import json, sys

WL = {'title','category','minutes','synopsis','disclaimer','name','role','text','label','description','preview','mapLabel','result',
      'situation','subtitle','unresolved','kicker','finding','argument','limitation','info','pressures','themes','body','rows',
      'output','log','resultText','doneText','app','channel','day','time','assignee','note','button','sendLabel','questions',
      'byEnding','byFlag','conflicts','values','caption'}
SKIP = {'accounts'}
DICT_VALUES = {'byEnding','byFlag','limitation','conflicts','values'}

def walk(o, tr, key=None, inwl=False):
    """tr(str)->str ; returns transformed copy."""
    if isinstance(o, str):
        return tr(o) if inwl else o
    if isinstance(o, list):
        return [walk(x, tr, key, inwl) for x in o]
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in SKIP:
                out[k] = v; continue
            out[k] = walk(v, tr, k, (k in WL) or (inwl and key in DICT_VALUES))
        return out
    return o

def main():
    mode = sys.argv[1]
    data = json.load(open(sys.argv[2]))
    if mode == 'dump':
        seen, order = {}, []
        def collect(s):
            if s not in seen: seen[s] = len(order); order.append(s)
            return s
        walk(data, collect)
        with open(sys.argv[3], 'w') as f:
            for i, s in enumerate(order): f.write(f"{i}|{s}\n")
        print(len(order), 'strings')
    else:
        order = []
        walk(data, lambda s: (order.append(s) or s) if s not in order else s)
        tl = {}
        for line in open(sys.argv[3], encoding='utf-8'):
            line = line.rstrip('\n')
            if not line: continue
            i, t = line.split('|', 1); tl[int(i)] = t
        missing = [i for i in range(len(order)) if i not in tl]
        if missing: print('MISSING', missing[:20], len(missing)); sys.exit(1)
        idx = {s: i for i, s in enumerate(order)}
        res = walk(data, lambda s: tl[idx[s]])
        json.dump(res, open(sys.argv[4], 'w'), indent=2, ensure_ascii=False)
        print('ok', len(order))
main()
