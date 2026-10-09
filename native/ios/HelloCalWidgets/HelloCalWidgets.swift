// Widget extension entry point: the five widgets from docs/WIDGETS.md.

import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Timeline plumbing

struct SnapshotEntry<Config>: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
    let config: Config
}

private func nextRefresh(_ snapshot: WidgetSnapshot) -> Date {
    Date().addingTimeInterval(TimeInterval(max(snapshot.refreshAfterSeconds, 300)))
}

struct StaticSnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry<Void> {
        SnapshotEntry(date: .now, snapshot: .placeholder, config: ())
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry<Void>) -> Void) {
        completion(SnapshotEntry(date: .now, snapshot: SnapshotStore.cached() ?? .placeholder, config: ()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry<Void>>) -> Void) {
        Task {
            let snapshot = await SnapshotStore.load()
            completion(Timeline(entries: [SnapshotEntry(date: .now, snapshot: snapshot, config: ())],
                                policy: .after(nextRefresh(snapshot))))
        }
    }
}

struct IntentSnapshotProvider<Intent: WidgetConfigurationIntent>: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry<Intent> {
        SnapshotEntry(date: .now, snapshot: .placeholder, config: Intent())
    }

    func snapshot(for configuration: Intent, in context: Context) async -> SnapshotEntry<Intent> {
        SnapshotEntry(date: .now, snapshot: SnapshotStore.cached() ?? .placeholder, config: configuration)
    }

    func timeline(for configuration: Intent, in context: Context) async -> Timeline<SnapshotEntry<Intent>> {
        let snapshot = await SnapshotStore.load()
        return Timeline(entries: [SnapshotEntry(date: .now, snapshot: snapshot, config: configuration)],
                        policy: .after(nextRefresh(snapshot)))
    }
}

// MARK: - Widgets

struct QuickAddWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "quickAdd", provider: StaticSnapshotProvider()) { entry in
            QuickAddView(snapshot: entry.snapshot)
                .containerBackground(Color.hcPage, for: .widget)
        }
        .configurationDisplayName("Tilføj")
        .description("Én knap, der åbner listen over alt, du kan registrere.")
        .supportedFamilies([.systemSmall])
    }
}

struct AddRowWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "addRow", intent: AddRowConfiguration.self,
                               provider: IntentSnapshotProvider<AddRowConfiguration>()) { entry in
            AddRowView(snapshot: entry.snapshot, selectedKeys: entry.config.actions?.map(\.id))
                .containerBackground(Color.hcPage, for: .widget)
        }
        .configurationDisplayName("Hurtig-tilføj")
        .description("Genvejsknapper — vælg selv hvilke.")
        .supportedFamilies([.systemMedium])
    }
}

struct StatChartWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "statChart", intent: StatChartConfiguration.self,
                               provider: IntentSnapshotProvider<StatChartConfiguration>()) { entry in
            StatChartView(chart: entry.snapshot.chart(entry.config.chart.rawValue))
                .containerBackground(Color.hcPage, for: .widget)
        }
        .configurationDisplayName("Statistik-graf")
        .description("Læg flere oven i hinanden (Smart Stack) og swipe mellem graferne.")
        .supportedFamilies([.systemMedium])
    }
}

struct StatBoxWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "statBox", intent: StatBoxConfiguration.self,
                               provider: IntentSnapshotProvider<StatBoxConfiguration>()) { entry in
            StatBoxView(box: entry.snapshot.statBox(entry.config.box?.id))
                .containerBackground(Color.hcPage, for: .widget)
        }
        .configurationDisplayName("Statistik-boks")
        .description("Én boks fra Statistik, fx kalorier tilbage.")
        .supportedFamilies([.systemSmall])
    }
}

struct RecentEntriesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "recentEntries", provider: StaticSnapshotProvider()) { entry in
            RecentEntriesView(snapshot: entry.snapshot)
                .containerBackground(Color.hcPage, for: .widget)
        }
        .configurationDisplayName("Seneste registreringer")
        .description("Dine seneste madregistreringer.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct HelloCalWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickAddWidget()
        AddRowWidget()
        StatChartWidget()
        StatBoxWidget()
        RecentEntriesWidget()
    }
}
