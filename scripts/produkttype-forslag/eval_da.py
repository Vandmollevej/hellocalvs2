import sys,random,collections,importlib
import ptype; importlib.reload(ptype)
from ptype import *
random.seed(5)
vocab=build_vocab(["Excelark/bilka.xlsx","Frida-ark/frida.xlsx"])
brands=build_brands(["Excelark/bilka.xlsx"])
h,rows=load("Produkter/rema1000_version 2.xlsx")
ti,si,pi,bi=col(h,"Original Title"),col(h,"Subtitle"),col(h,"Product Type"),col(h,"Brand")
tot=ok=0; byc=collections.defaultdict(lambda:[0,0]); errs=[]
for r in rows:
    truth=(r[pi] or '').strip().lower()
    if not truth: continue
    p,c=propose_da(r[ti],r[si],r[bi],vocab,brands)
    tot+=1; byc[c][0]+=1
    if p.lower()==truth: ok+=1; byc[c][1]+=1
    else: errs.append((r[ti],p,c,r[pi]))
print('REMA nøjagtighed',ok,tot,round(100*ok/tot,1))
for c,(n,k) in byc.items(): print(' ',c,n,round(100*k/n,1))
for e in random.sample(errs,25): print('  ',e)
