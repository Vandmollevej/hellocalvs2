// SwiftUI views for the widgets — layout matches the approved web preview
// (src/components/widgets/WidgetPreviews.tsx).

import Charts
import SwiftUI
import WidgetKit

// MARK: 1. Quick add

struct QuickAddView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color.hcBrand).frame(width: 72, height: 72)
                Image(systemName: "plus").font(.system(size: 36, weight: .bold)).foregroundStyle(.white)
            }
            Text("Tilføj").font(.hcCaption).foregroundStyle(Color.hcAction)
        }
        .widgetURL(deepLink("hellocal://add/menu"))
    }
}

// MARK: 2. Add row

struct AddRowView: View {
    let snapshot: WidgetSnapshot
    let selectedKeys: [String]?

    private var actions: [WidgetSnapshot.AddAction] {
        let keys = (selectedKeys?.isEmpty == false ? selectedKeys! : ["search", "camera", "water", "weight"])
        return keys.compactMap { key in snapshot.addActions.first { $0.key == key } }.prefix(4).map { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Hello Cal").font(.hcCaptionStrong).foregroundStyle(Color.hcBrand)
                Spacer()
                Text(snapshot.today.overGoal ? "Over mål" : "\(formatKcal(Double(snapshot.today.leftKcal))) kcal tilbage")
                    .font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
            }
            HStack(spacing: 8) {
                ForEach(actions) { action in
                    Link(destination: deepLink(action.deepLink)) {
                        VStack(spacing: 4) {
                            Image(systemName: symbol(forAddAction: action.key)).font(.system(size: 24))
                            Text(action.label).font(.hcCaption).lineLimit(1)
                        }
                        .foregroundStyle(Color.hcAction)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.hcCard, in: RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }
}

// MARK: 3. Stat chart

struct StatChartView: View {
    let chart: WidgetSnapshot.Chart?

    private static let weekday: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "da_DK")
        f.dateFormat = "EEEEE"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    private static let parser: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    private func dayLabel(_ date: String) -> String {
        guard let d = Self.parser.date(from: date) else { return "" }
        return Self.weekday.string(from: d)
    }

    private var latest: String {
        guard let chart, let value = chart.points.last(where: { $0.value != nil })?.value else { return "—" }
        return chart.key == "kcal" ? "\(formatKcal(value)) kcal" : "\(value.formatted()) \(chart.unit)"
    }

    var body: some View {
        if let chart {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(chart.label).font(.hcCaptionStrong)
                    Spacer()
                    Text(latest).font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
                }
                Chart {
                    if let goal = chart.goal, chart.key != "sleepQuality" {
                        RuleMark(y: .value("Mål", goal))
                            .foregroundStyle(Color.hcInactive)
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    }
                    ForEach(Array(chart.points.enumerated()), id: \.offset) { index, point in
                        if let value = point.value {
                            if chart.key == "weight" {
                                LineMark(x: .value("Dag", "\(index)"), y: .value("kg", value))
                                    .foregroundStyle(Color.hcAction)
                                PointMark(x: .value("Dag", "\(index)"), y: .value("kg", value))
                                    .foregroundStyle(Color.hcAction)
                            } else {
                                BarMark(x: .value("Dag", "\(index)"), y: .value(chart.unit, value), width: 16)
                                    .cornerRadius(3)
                                    .foregroundStyle(barColor(chart: chart, value: value))
                            }
                        }
                    }
                }
                .chartYScale(domain: .automatic(includesZero: chart.key != "weight"))
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks { mark in
                        AxisValueLabel {
                            if let raw = mark.as(String.self), let i = Int(raw), i < chart.points.count {
                                Text(dayLabel(chart.points[i].date)).font(.system(size: 11))
                            }
                        }
                    }
                }
            }
            .widgetURL(deepLink(chart.deepLink))
        } else {
            Text("Ingen data endnu").font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
        }
    }

    private func barColor(chart: WidgetSnapshot.Chart, value: Double) -> Color {
        if chart.key == "sleepQuality" { return .hcAction }
        if let goal = chart.goal, value > goal { return .hcDanger }
        return .hcBrand
    }
}

// MARK: 4. Stat box

struct StatBoxView: View {
    let box: WidgetSnapshot.StatBox?

    var body: some View {
        VStack(alignment: .leading) {
            Text(box?.label ?? "—").font(.hcCaptionStrong).foregroundStyle(Color.hcAction)
            Spacer(minLength: 0)
            if let progress = box?.progress {
                ZStack {
                    Circle().stroke(Color.hcNav, lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: min(progress, 1))
                        .stroke(progress > 1 ? Color.hcDanger : Color.hcBrand,
                                style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 56, height: 56)
                .frame(maxWidth: .infinity)
                Spacer(minLength: 0)
                Text(box?.value ?? "—").font(.hcBodySmStrong)
            } else {
                Text(box?.value ?? "—").font(.hcSectionTitle).minimumScaleFactor(0.6).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(deepLink(box?.deepLink ?? "hellocal://statistics"))
    }
}

// MARK: 6. Recent entries

struct RecentEntriesView: View {
    let snapshot: WidgetSnapshot
    @Environment(\.widgetFamily) private var family

    private var rows: Int { family == .systemLarge ? 8 : 3 }

    private static let time: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "da_DK")
        f.dateFormat = "HH.mm"
        return f
    }()

    private func time(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) else { return "" }
        return Self.time.string(from: date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Link(destination: deepLink("hellocal://calendar")) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Seneste registreringer").font(.hcCaptionStrong)
                    Spacer()
                    Text("\(formatKcal(Double(snapshot.today.eatenKcal))) kcal i dag")
                        .font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
                }
                .foregroundStyle(Color.hcAction)
            }
            .padding(.bottom, 4)

            if snapshot.recentEntries.isEmpty {
                Text("Ingen registreringer endnu.").font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
            }
            ForEach(Array(snapshot.recentEntries.prefix(rows).enumerated()), id: \.element.id) { index, entry in
                if index > 0 { Divider().overlay(Color.hcNav) }
                Link(destination: deepLink(entry.deepLink)) {
                    HStack(spacing: 8) {
                        Text(entry.title).font(.hcCaption).lineLimit(1)
                        Spacer(minLength: 4)
                        Text(time(entry.createdAt)).font(.hcCaption).foregroundStyle(Color.hcTextSecondary)
                        Text("\(formatKcal(Double(entry.kcal))) kcal").font(.hcCaptionStrong)
                            .frame(width: 64, alignment: .trailing)
                    }
                    .foregroundStyle(Color.hcAction)
                    .frame(height: 36)
                }
            }
            Spacer(minLength: 0)
        }
    }
}
