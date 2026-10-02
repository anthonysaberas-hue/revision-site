import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
before = len(re.findall(r'Big', s))
s = re.sub(r'\\[bB]*Big[^_\n]*?(?=_)', lambda m: '\\Big\\vert ', s)
open(p, 'w', encoding='utf-8').write(s)
print('Big occurrences', before, '->', len(re.findall(r'\\Big\\vert ', s)))
