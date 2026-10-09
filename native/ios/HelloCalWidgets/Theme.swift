// Hello Cal colours and text roles for widgets. The values come from the
// generated HcTokens.swift (scripts/native/sync.mjs reads src/app/globals.css),
// so a web token change reaches the widgets without hand-copying hex codes.

import SwiftUI

extension Color {
    static let hcPage = HcColors.page
    static let hcCard = HcColors.card
    static let hcNav = HcColors.nav
    static let hcBrand = HcColors.brand
    static let hcAction = HcColors.action
    static let hcTextSecondary = HcColors.textSecondary
    static let hcInactive = HcColors.inactive
    static let hcDanger = HcColors.danger
}

extension Font {
    static let hcCaption = HcType.caption
    static let hcCaptionStrong = Font.system(size: 13, weight: .semibold)
    static let hcBodySmStrong = Font.system(size: 15, weight: .bold)
    static let hcSectionTitle = Font.system(size: 20, weight: .bold)
}

func formatKcal(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "da_DK")
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value)) ?? "\(Int(value))"
}

func deepLink(_ string: String) -> URL {
    URL(string: string) ?? URL(string: "hellocal://")!
}

/// SF Symbol per add action (mirrors the Tabler icons in src/lib/add-actions.ts).
func symbol(forAddAction key: String) -> String {
    switch key {
    case "microphone": return "mic"
    case "ownDishes": return "frying.pan"
    case "search": return "magnifyingglass"
    case "weight": return "scalemass"
    case "water": return "drop"
    case "camera": return "camera"
    case "targetWeight": return "target"
    case "bodyMeasurements": return "ruler"
    case "menstrualCycle": return "calendar.badge.plus"
    default: return "plus"
    }
}
