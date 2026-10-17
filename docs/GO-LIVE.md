# Go-live — ting brugeren gør først ved lancering

Samlet liste, så intet glemmes (brugerens beslutning 2026-10-17: "Først når jeg går live").

- [ ] **Ny Google-nøgle til billed-robotten.** Den nuværende `GOOGLE_API_KEY` har stået i image-agents log og afvises af Google (`API_KEY_SERVICE_BLOCKED`). Lav en ny nøgle i Google Cloud → API-nøgler (https://console.cloud.google.com/apis/credentials), tillad "Custom Search API" under API-begrænsninger, og sæt den som `GOOGLE_API_KEY` i `.env.production`. Indtil da finder billed-robotten ingen billeder (STATUS 2026-10-17).
- [ ] **Admin "Log" slås fra** (test-log indtil go-live, DECISIONS 2026-09-28).
