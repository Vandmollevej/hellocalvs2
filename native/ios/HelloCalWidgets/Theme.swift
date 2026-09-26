// Hello Cal colours and text roles for widgets — values from design.md §3/§4.

import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }

    static let hcPage = Color(hex: 0xFAF8F3)      // --hf-color-page
    static let hcCard = Color(hex: 0xEEE9DF)      // --hf-color-card
    static let hcNav = Color(hex: 0xDFD9CC)       // --hf-color-nav
    static let hcBrand = Color(hex: 0x067A46)     // --hf-color-brand
    static let hcAction = Color(hex: 0x232323)    // --hf-color-action
    static let hcTextSecondary = Color(hex: 0x656565)
    static let hcInactive = Color(hex: 0x828282)
    static let hcDanger = Color(hex: 0xA3271F)
}

extension Font {
    static let hcCaption = Font.system(size: 13)                       // .hf-type-caption
    static let hcCaptionStrong = Font.system(size: 13, weight: .semibold)
    static let hcBodySmStrong = Font.system(size: 15, weight: .bold)
    static let hcSectionTitle = Font.system(size: 20, weight: .bold)   // .hf-type-section-title
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
