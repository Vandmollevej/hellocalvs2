"""Genererer ental/flertal-titelformlerne for et ark ud fra en kolonne-mapping (række 2)."""
import json
import sys

SUBS = [('tørret', 'tørrede'), ('Tørret', 'Tørrede'), ('kogt', 'kogte'), ('Kogt', 'Kogte'), ('stegt', 'stegte'), ('Stegt', 'Stegte'),
        ('syltet', 'syltede'), ('Syltet', 'Syltede'), ('ristet', 'ristede'), ('Ristet', 'Ristede'), ('røget', 'røgede'), ('Røget', 'Røgede')]
ADJ = ["Sur", "Sød", "Søde", "Groft", "Fint", "Grove", "Fine", "Dobbelte", "Instant"]


def build(m, plural):
    """m: dict med kolonnebogstaver: type, type_plural, variant, raw, cooked, frozen, kw (liste),
    decaf, sugar_free, glutenfree, lactose, alcohol_free, vegan, light (valgfri), alcohol (valgfri), title_singular."""
    r = '2'
    c = lambda k: m[k] + r
    e = c('cooked')
    for a, b in SUBS:
        e = f'SUBSTITUTE({e},"{a}","{b}")'
    kws = [k + r for k in m['kw']]

    def adj(x):
        return 'IF(OR(' + ','.join(f'{x}="{w}"' for w in ADJ) + f'),{x},"")'

    def nadj(x):
        return 'IF(OR(' + ','.join(f'{x}="{w}"' for w in ADJ) + f'),"",{x})'

    pl = 'TRUE' if plural else f'AND({c("type_plural")}<>"",LOWER({c("type_plural")})=LOWER({c("type")}))'
    ty0 = c('type_plural') if plural else c('type')
    flag_cols = [k for k in ('decaf', 'sugar_free', 'glutenfree', 'lactose', 'alcohol_free', 'vegan', 'light', 'alcohol') if m.get(k)]
    fl0 = 'TEXTJOIN(" ",TRUE,' + ','.join(f'LOWER({c(k)})' for k in flag_cols) + ')'
    lowkw = []
    f = ('LET(inn,LAMBDA(t,IF(ISNUMBER(FIND("(",t)),MID(t,FIND("(",t)+1,FIND(")",t)-FIND("(",t)-1),"")),'
         'out,LAMBDA(t,IF(ISNUMBER(FIND("(",t)),TRIM(LEFT(t,FIND("(",t)-1)&MID(t,FIND(")",t)+1,200)),t)),'
         f'pl,{pl},'
         f'rw,IF({c("raw")}="","",IF(pl,SUBSTITUTE(SUBSTITUTE({c("raw")},"Fersk","Ferske"),"fersk","ferske"),{c("raw")})),'
         f'ck0,IF({c("cooked")}="","",IF(pl,{e},{c("cooked")})),'
         'ck,ck0,'
         f'fz0,IF({c("frozen")}="","",IF(pl,"Frosne","Frosset")),'
         'fz,IF(AND(fz0<>"",ck<>""),LOWER(fz0),fz0),'
         'sw,LOWER(TEXTJOIN(" ",TRUE,' + ','.join(adj(k) for k in kws[:3]) + ')),'
         f'ty0,{ty0},pt,inn(ty0),ty,out(ty0),'
         'cw,IF(ISNUMBER(FIND(" ",ty)),MID(ty,FIND(" ",ty)+1,1),"a"),'
         'tt,IF(AND(ck="",fz="",sw=""),ty,IF(NOT(EXACT(cw,LOWER(cw))),ty,LOWER(LEFT(ty,1))&MID(ty,2,200))),'
         f'pv,inn({c("variant")}),vr0,out({c("variant")}),'
         'vr,IF(vr0="","",IF(LEFT(vr0,6)="Beluga",vr0,LOWER(LEFT(vr0,1))&MID(vr0,2,300))),'
         f'fl0,{fl0},'
         'fl,IF(pl,SUBSTITUTE(SUBSTITUTE(fl0,"fri","frie"),"vegansk","veganske"),fl0),')
    names = ['ko']
    f += f'ko,IF({kws[0]}="","",IF(OR(rw="",EXACT({kws[0]},UPPER({kws[0]}))),{kws[0]},LOWER(LEFT({kws[0]},1))&MID({kws[0]},2,200))),'
    for i, k in enumerate(kws[1:], start=2):
        n = f'k{i}x'
        names.append(n)
        f += f'{n},IF({k}="","",IF(EXACT({k},UPPER({k})),{k},LOWER(LEFT({k},1))&MID({k},2,200))),'
    f += 'kw,TEXTJOIN(", ",TRUE,pt,pv,LOWER(rw),' + ','.join(nadj(n) for n in names) + '),'
    f += 'pr,IF(kw="","",UPPER(LEFT(kw,1))&MID(kw,2,300)),'
    core = 'TEXTJOIN(" ",TRUE,ck,fz,sw,tt,vr,fl,IF(pr="","","("&pr&")"))'
    if plural:
        core = f'SUBSTITUTE(SUBSTITUTE({core},"paneret","panerede"),"Paneret","Panerede")'
    f += f'tl,{core},UPPER(LEFT(tl,1))&MID(tl,2,500))'
    if plural:
        return f'=IF({c("type_plural")}="",{c("title_singular")},{f})'
    return '=' + f


if __name__ == '__main__':
    mapping = json.load(open(sys.argv[1], encoding='utf-8'))
    out = sys.argv[2]
    open(out + '_sing.txt', 'w', encoding='utf-8').write(build(mapping, False))
    open(out + '_plur.txt', 'w', encoding='utf-8').write(build(mapping, True))
    print('ok')
