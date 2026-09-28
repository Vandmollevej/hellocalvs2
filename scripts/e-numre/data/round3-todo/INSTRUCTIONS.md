# Runde 3: udsagn-for-udsagn faktatjek af E-numre

Du får én fil `chunkNN.json` (JSON-array af poster). Brugeren kræver, at ALT er
kildebelagt — ingen stikprøver, ingen "egen viden".

For HVER post:
1. Opdel felterne nameDa, category, summary, description, uses, health, research,
   keyReferences, variants (navne), efsa og flags i enkelte faktuelle udsagn
   (kemi, fremstilling, hver fødevare/anvendelse, hvert tal, grænseværdi, årstal,
   studie, sundhedseffekt, følsom gruppe).
2. Bekræft HVERT udsagn med WebSearch. Gruppér søgninger for stoffer, der deler
   kilde (fx én EFSA-gruppeudtalelse), men hvert udsagn skal have dækning.
3. Kan et udsagn ikke bekræftes: fjern det, eller omformulér til det kilden
   faktisk siger. Opfind intet. Korrekt, detaljeret dansk (æøå).
4. **Storbritannien er ikke i EU.** Britiske kilder (food.gov.uk,
   legislation.gov.uk, FSA) må ALDRIG bruges som belæg for EU-status,
   EU-grænseværdier eller EU-regler. Brug EU-kilder (eur-lex.europa.eu,
   food.ec.europa.eu, efsa.europa.eu, EFSA Journal). Fjern britiske kilder fra
   `verification.sources`.
5. Sæt `verification` = {"status": "verified" | "corrected" | "uncertain",
   "sources": [alle brugte URL'er], "notes": "dansk: hvad der er bekræftet,
   rettet og fjernet"} og `claims` = [{"claim", "source", "result":
   "bekræftet" | "rettet" | "fjernet"}] for hvert udsagn. Behold alle øvrige felter.
6. Hvis nummeret ikke er godkendt i EU i dag: sæt euStatus til "banned" eller
   "not_approved" med EU-kilde.

Output: `scripts/e-numre/data/verified/r3_chunkNN.json` (samme poster og
rækkefølge). Valider med python (gyldig JSON, samme koder). Commit og push til
din egen branch. Rør ingen andre filer.
