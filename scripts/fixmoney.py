import re, sys
for p in sys.argv[1:]:
    s = open(p, encoding='utf-8').read()
    s2 = s.replace('\\$', 'USD ')
    s2 = s2.replace('i.e. $4.41 per day', 'i.e. USD 4.41 per day').replace('a $250 insulation', 'a USD 250 insulation').replace('the $30 kit', 'the USD 30 kit')
    if s2 != s:
        open(p, 'w', encoding='utf-8').write(s2)
        print('fixed', p)
