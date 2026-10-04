# HELLO CAL — privacy-by-architecture (OPHÆVET)

Ophævet 2026-09-24 af brugeren. Den krypterede boks, passkey-only-login,
gendannelsesfil, anonym statistik og supportpakker er fjernet fra
brugerappen. Brugerdata ligger igen i de almindelige tabeller, og brugere
logger ind som i andre apps. Se `docs/DECISIONS.md` 2026-09-24
"Normalt login" og `docs/DEPLOYMENT.md` "Login (brugere)".

Den tidligere kontrakt findes i git-historikken (commit db0f464).

## Note 2026-10-04: kryptering i hvile

Ophævelsen ovenfor gælder den krypterede boks/passkey-only-modellen. Uafhængigt heraf er `User.email` og `User.displayName` nu krypteret i databasen (feltkryptering, AES-256-GCM) — se `docs/DECISIONS.md` 2026-10-04 og `docs/DEPLOYMENT.md` "Feltkryptering". Brugerne logger stadig ind som i andre apps; kun lagringen er krypteret. Admin → Brugere viser kun pseudonym.
