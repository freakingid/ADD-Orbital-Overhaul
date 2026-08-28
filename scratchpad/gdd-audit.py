import re,sys,collections
html=open('orbital-overhaul.html',encoding='utf-8').read()
# --- extract the classic script block (largest <script> without type=module)
blocks=[]
for m in re.finditer(r'<script(?P<attr>[^>]*)>',html):
    if 'type="module"' in m.group('attr') or 'src=' in m.group('attr'): continue
    end=html.index('</script>',m.end())
    blocks.append(html[m.end():end])
src=max(blocks,key=len)
# --- character scanner: strip // and /* */ comments, keep string contents out too
def strip(s):
    out=[];i=0;n=len(s)
    while i<n:
        c=s[i]
        if c=='/' and i+1<n and s[i+1]=='/':
            while i<n and s[i]!='\n': i+=1
        elif c=='/' and i+1<n and s[i+1]=='*':
            i+=2
            while i+1<n and not(s[i]=='*' and s[i+1]=='/'): i+=1
            i+=2
        elif c in '"\'`':
            q=c; out.append(' '); i+=1
            while i<n and s[i]!=q:
                if s[i]=='\\': i+=1
                i+=1
            i+=1
        else:
            out.append(c); i+=1
    return ''.join(out)
live=strip(src)
print("script %d chars -> live %d chars (%.0f%% is comment/string)" % (len(src),len(live),100*(1-len(live)/len(src))),file=sys.stderr)
# --- identifiers the GDD names
gdd=open('ORBITAL-OVERHAUL-GDD.md',encoding='utf-8').read()
lines=gdd.split('\n')
hdr=[(i,re.match(r'^#{2,4} (\S+)',l).group(1)) for i,l in enumerate(lines) if re.match(r'^#{2,4} ',l)]
def sec_of(idx):
    cur='pre'
    for i,n in hdr:
        if i<=idx: cur=n
        else: break
    return cur
cand=collections.defaultdict(set)
for i,l in enumerate(lines):
    s=sec_of(i)
    if not (s.startswith('2') or s.startswith('3')): continue
    if s=='3' and i<70: continue
    for tok in re.findall(r'`([^`\n]{2,60})`',l):
        for name in re.findall(r'\b([A-Za-z_$][A-Za-z0-9_$]{3,})\b',tok):
            cand[name].add(s)
IGNORE=re.compile(r'^(true|false|null|undefined|this|const|let|function|return|else|break|Math|Infinity|NaN|Object|Array|JSON|window|document|navigator|localStorage|performance|requestAnimationFrame|href|width|height|text|size|type|name|value|index|scroll|back|pause|title|playing|dying|gameover|entry|full|small|closed|craft|piece|guard|rapid|triple|magnet|engine|scoop|health|level|drop|tier|noise|zen|retro|ambient|derelict|drift|warehouse|main|goal|initials)$')
dead=[]
for name,secs in cand.items():
    if IGNORE.match(name): continue
    if re.search(r'\b'+re.escape(name)+r'\b',live): continue
    dead.append((name,sorted(secs)))
dead.sort(key=lambda x:(x[1],x[0]))
bysec=collections.defaultdict(list)
for name,secs in dead:
    for s in secs: bysec[s].append(name)
print("GDD names %d distinct identifiers in §2/§3; %d have ZERO live (non-comment, non-string) occurrence in the build\n" % (len(cand),len(dead)))
for s in sorted(bysec,key=lambda x:[int(p) for p in x.rstrip('.').split('.')]):
    print("§%-8s %2d  %s" % (s,len(bysec[s]),", ".join(sorted(bysec[s]))))
