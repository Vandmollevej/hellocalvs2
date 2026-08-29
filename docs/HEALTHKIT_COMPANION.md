# HealthKit / Health Connect companion-app — forberedelse

Dette dokument beskriver, hvad en fremtidig native iOS/Android-app skal gøre for at
sende data ind i Hello Cal. Selve app'en er **ikke** bygget endnu (kræver en Mac
med Xcode for iOS, se `docs/DECISIONS.md` 2026-08-28) — dette er kun
backend-kontrakten og referencekode, forberedt på forhånd.

## Hvorfor en companion-app

Apple Health (HealthKit) og Android Health Connect kan **kun** tilgås af native
apps med den rette entitlement/tilladelse — der findes ingen cloud-REST-API en
webserver kan kalde direkte. En lille companion-app løser det ved at:

1. Læse de ønskede datatyper fra HealthKit/Health Connect på enheden.
2. Sende dem videre til Hello Cals backend via et personligt enhedstoken.

```
Apple Watch / Fitbit / Garmin / smart-vægt
              │  (skriver allerede til)
              ▼
        Apple Health / Health Connect
              │  (companion-app læser)
              ▼
        Hello Cal companion-app
              │  POST + enhedstoken
              ▼
        Hello Cal backend (denne app)
```

Fordelen: Hello Cal behøver ikke en separat integration pr. urmærke — alt der
allerede synkroniserer til Apple Health/Health Connect kommer med gratis.

## Enhedstoken

Genereres i appen under Indstillinger → Integrationer → "Generér enhedskode"
(`POST /api/integrations/healthkit/tokens`). Vises kun én gang — companion-appen
skal gemme den (fx i Keychain/EncryptedSharedPreferences) og sende den som:

```
Authorization: Bearer hcal_<64 hex-tegn>
```

## Ingest-endpoint

`POST /api/integrations/healthkit/ingest`

```json
{
  "source": "APPLE_HEALTH",
  "metrics": [
    { "type": "STEPS", "value": 8426, "recordedAt": "2026-08-28T00:00:00Z" },
    { "type": "ACTIVE_ENERGY_KCAL", "value": 463, "recordedAt": "2026-08-28T00:00:00Z" }
  ],
  "weights": [
    { "weightKg": 78.4, "weighedAt": "2026-08-28T07:15:00Z" }
  ],
  "activities": [
    { "sportType": "running", "startedAt": "2026-08-28T06:30:00Z", "durationMinutes": 32, "caloriesBurned": 310 }
  ]
}
```

- `source`: `"APPLE_HEALTH"` eller `"GOOGLE_HEALTH"`.
- `metrics[].type`: én af `STEPS`, `ACTIVE_ENERGY_KCAL`, `RESTING_ENERGY_KCAL`,
  `HEART_RATE_BPM`, `SLEEP_MINUTES`, `BODY_FAT_PERCENT`, `HEIGHT_CM`, `BMI`,
  `WATER_ML` (se `HealthMetricType` i `prisma/schema.prisma`). For kumulative
  døgn-typer (skridt, aktiv energi, vand) sendes typisk **én række pr. dag**
  (`recordedAt` = dagens dato) — samme (source, type, recordedAt) opdaterer
  ikke en eksisterende række (unik-constraint, `skipDuplicates`), så send den
  nyeste sum for dagen for at overskrive.
- `weights`/`activities` er valgfrie og lander i de samme `WeightEntry`/
  `Activity`-tabeller som Fitbit/Withings-synkroniseringen bruger, med
  `source` sat til `APPLE_HEALTH`/`GOOGLE_HEALTH`.
- Alle tre lister er valgfrie — send kun det du har.

Svar: `{ "ok": true, "metricsCreated": 2, "weightsCreated": 1, "activitiesCreated": 1 }`.

Eksempel:

```bash
curl -X POST https://hellocal.packroff.dk/api/integrations/healthkit/ingest \
  -H "Authorization: Bearer hcal_..." \
  -H "Content-Type: application/json" \
  -d '{"source":"APPLE_HEALTH","metrics":[{"type":"STEPS","value":8426,"recordedAt":"2026-08-28T00:00:00Z"}]}'
```

## HealthKit-typer at bede om adgang til (iOS)

| HealthKit-type | → HealthMetricType |
|---|---|
| `HKQuantityType(.stepCount)` | `STEPS` |
| `HKQuantityType(.activeEnergyBurned)` | `ACTIVE_ENERGY_KCAL` |
| `HKQuantityType(.basalEnergyBurned)` | `RESTING_ENERGY_KCAL` |
| `HKQuantityType(.heartRate)` | `HEART_RATE_BPM` |
| `HKCategoryType(.sleepAnalysis)` | `SLEEP_MINUTES` (summér i appen) |
| `HKQuantityType(.bodyFatPercentage)` | `BODY_FAT_PERCENT` |
| `HKQuantityType(.height)` | `HEIGHT_CM` |
| `HKQuantityType(.bodyMassIndex)` | `BMI` |
| `HKQuantityType(.dietaryWater)` | `WATER_ML` |
| `HKQuantityType(.bodyMass)` | → `weights[]`, ikke `metrics[]` |
| `HKWorkoutType` | → `activities[]`, ikke `metrics[]` |

Android Health Connect har samme opdeling under `androidx.health.connect.client`
(`StepsRecord`, `ActiveCaloriesBurnedRecord`, `HeartRateRecord`,
`SleepSessionRecord`, `WeightRecord`, `ExerciseSessionRecord` m.fl.).

## Minimalt Swift-eksempel (skridt, læs + send)

```swift
import HealthKit

final class HealthKitManager {
    private let healthStore = HKHealthStore()
    private let ingestURL = URL(string: "https://hellocal.packroff.dk/api/integrations/healthkit/ingest")!
    private let deviceToken = "hcal_..." // fra Keychain, ikke hardkodet i en rigtig app

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let stepType = HKQuantityType(.stepCount)
        try await healthStore.requestAuthorization(toShare: [], read: [stepType])
    }

    func syncTodaySteps() async throws {
        let stepType = HKQuantityType(.stepCount)
        let startOfDay = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: Date(), options: .strictStartDate)

        let steps: Double = try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
            }
            healthStore.execute(query)
        }

        var request = URLRequest(url: ingestURL)
        request.httpMethod = "POST"
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "source": "APPLE_HEALTH",
            "metrics": [["type": "STEPS", "value": steps, "recordedAt": ISO8601DateFormatter().string(from: startOfDay)]],
        ])
        _ = try await URLSession.shared.data(for: request)
    }
}
```

Næste skridt, når en Mac/Xcode er tilgængelig: opret et rigtigt Xcode-projekt,
tilføj HealthKit-capability, byg videre på ovenstående for de øvrige typer i
tabellen, og tilføj baggrunds-levering (`HKObserverQuery` +
`enableBackgroundDelivery`) så appen ikke kun synkroniserer, når den åbnes.
