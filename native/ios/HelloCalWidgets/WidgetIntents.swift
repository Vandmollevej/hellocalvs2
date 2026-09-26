// "Rediger widget" options (iOS 17 App Intents). The choices come from the
// last cached snapshot, so they always match what the server can deliver.

import AppIntents
import WidgetKit

// MARK: - Add buttons (widget 2)

struct AddActionEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Knap"
    static var defaultQuery = AddActionQuery()

    let id: String
    let label: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(label)") }
}

struct AddActionQuery: EntityQuery {
    private var all: [AddActionEntity] {
        (SnapshotStore.cached() ?? .placeholder).addActions.map { AddActionEntity(id: $0.key, label: $0.label) }
    }

    func entities(for identifiers: [String]) async throws -> [AddActionEntity] {
        all.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AddActionEntity] { all }

    func defaultResult() async -> AddActionEntity? { all.first }
}

struct AddRowConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Hurtig-tilføj"
    static var description = IntentDescription("Vælg op til fire knapper.")

    @Parameter(title: "Knapper", size: [.systemMedium: 4])
    var actions: [AddActionEntity]?
}

// MARK: - Stat box (widget 4)

struct StatBoxEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Statistik-boks"
    static var defaultQuery = StatBoxQuery()

    let id: String
    let label: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(label)") }
}

struct StatBoxQuery: EntityQuery {
    private var all: [StatBoxEntity] {
        (SnapshotStore.cached() ?? .placeholder).statBoxes.map { StatBoxEntity(id: $0.key, label: $0.label) }
    }

    func entities(for identifiers: [String]) async throws -> [StatBoxEntity] {
        all.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [StatBoxEntity] { all }

    func defaultResult() async -> StatBoxEntity? { all.first }
}

struct StatBoxConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Statistik-boks"
    static var description = IntentDescription("Vælg hvilken boks fra Statistik der vises.")

    @Parameter(title: "Boks")
    var box: StatBoxEntity?
}

// MARK: - Chart (widget 3) — one widget per chart, stacked in a Smart Stack

enum ChartKind: String, AppEnum {
    case kcal, weight, sleepQuality

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Graf"
    static var caseDisplayRepresentations: [ChartKind: DisplayRepresentation] = [
        .kcal: "Kalorier",
        .weight: "Vægt",
        .sleepQuality: "Oplevelse af søvn",
    ]
}

struct StatChartConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Statistik-graf"
    static var description = IntentDescription("Læg flere i en Smart Stack og swipe mellem graferne.")

    @Parameter(title: "Graf", default: .kcal)
    var chart: ChartKind
}
