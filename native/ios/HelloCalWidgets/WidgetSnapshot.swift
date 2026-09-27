// Mirror of `WidgetSnapshot` in src/lib/widgets.ts (GET /api/widgets/snapshot).
// Keep field names identical — the JSON is decoded as-is.

import Foundation

struct WidgetSnapshot: Codable {
    struct Today: Codable {
        let date: String
        let eatenKcal: Int
        let goalKcal: Int
        let leftKcal: Int
        let overGoal: Bool
    }

    struct ChartPoint: Codable, Hashable {
        let date: String
        let value: Double?
    }

    struct Chart: Codable, Identifiable {
        var id: String { key }
        let key: String
        let label: String
        let unit: String
        let goal: Double?
        let points: [ChartPoint]
        let path: String
        let deepLink: String
    }

    struct StatBox: Codable, Identifiable {
        var id: String { key }
        let key: String
        let label: String
        let value: String
        let progress: Double?
        let path: String
        let deepLink: String
    }

    struct AddAction: Codable, Identifiable {
        var id: String { key }
        let key: String
        let label: String
        let path: String
        let deepLink: String
    }

    struct RecentEntry: Codable, Identifiable {
        let id: String
        let title: String
        let kcal: Int
        let amountGrams: Double
        let createdAt: String
        let imageUrl: String?
        let path: String
        let deepLink: String
    }

    struct Paths: Codable {
        let add: String
        let statistics: String
        let calendar: String
    }

    let generatedAt: String
    let locale: String
    let tzOffsetMinutes: Int
    let refreshAfterSeconds: Int
    let today: Today
    let charts: [Chart]
    let statBoxes: [StatBox]
    let addActions: [AddAction]
    let recentEntries: [RecentEntry]
    let paths: Paths
}

extension WidgetSnapshot {
    /// Shown in the widget gallery and before the first successful fetch.
    static let placeholder = WidgetSnapshot(
        generatedAt: ISO8601DateFormatter().string(from: .now),
        locale: "da",
        tzOffsetMinutes: 0,
        refreshAfterSeconds: 900,
        today: Today(date: "", eatenKcal: 1450, goalKcal: 2200, leftKcal: 750, overGoal: false),
        charts: [
            Chart(key: "kcal", label: "Kalorier", unit: "kcal", goal: 2200,
                  points: (0..<7).map { ChartPoint(date: "d\($0)", value: [1900, 2400, 2100, 1800, 2300, 2000, 1450][$0]) },
                  path: "/statistics", deepLink: "hellocal://statistics"),
        ],
        statBoxes: [
            StatBox(key: "kcalLeft", label: "Kalorier tilbage", value: "750 kcal", progress: nil,
                    path: "/statistics", deepLink: "hellocal://statistics"),
        ],
        addActions: [
            AddAction(key: "search", label: "Søg", path: "/search", deepLink: "hellocal://search"),
            AddAction(key: "camera", label: "Kamera", path: "/camera?mode=product", deepLink: "hellocal://camera?mode=product"),
            AddAction(key: "water", label: "Vand", path: "/water/create", deepLink: "hellocal://water/create"),
            AddAction(key: "weight", label: "Vægt", path: "/weight/create", deepLink: "hellocal://weight/create"),
        ],
        recentEntries: [],
        paths: Paths(add: "/add/menu", statistics: "/statistics", calendar: "/calendar")
    )

    func statBox(_ key: String?) -> StatBox? {
        statBoxes.first { $0.key == (key ?? "kcalLeft") } ?? statBoxes.first
    }

    func chart(_ key: String) -> Chart? {
        charts.first { $0.key == key }
    }
}
