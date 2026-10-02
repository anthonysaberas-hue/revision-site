"""usage: replace_block.py file start_marker end_marker new_text_file
Replaces from the first occurrence of start_marker up to (not including) end_marker with the contents of new_text_file."""
import sys
p, a, b, newf = sys.argv[1:5]
s = open(p, encoding='utf-8').read()
i = s.index(a)
j = s.index(b, i)
new = open(newf, encoding='utf-8').read()
s = s[:i] + new + s[j:]
open(p, 'w', encoding='utf-8').write(s)
print('replaced', j - i, 'chars with', len(new))
