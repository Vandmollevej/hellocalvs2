// Fetches /api/widgets/snapshot with the personal device token and keeps the
// last good copy in the shared App Group, so widgets still render offline.
// The main app writes the token (Keychain, shared access group) at login and
// calls `WidgetCenter.shared.reloadAllTimelines()` after every registration.

import Foundation
import Security

enum HelloCalConfig {
    static let baseURL = URL(string: "https://hellocal.packroff.dk")!
    static let appGroup = "group.dk.packroff.hellocal"
    /// "$(AppIdentifierPrefix)dk.packroff.hellocal.shared" from Info.plist — the
    /// Keychain only accepts the access group with the team prefix.
    static let keychainAccessGroup = (Bundle.main.object(forInfoDictionaryKey: "HCKeychainAccessGroup") as? String)
        ?? "dk.packroff.hellocal.shared"
    static let tokenAccount = "deviceToken"
}

enum DeviceTokenStore {
    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: HelloCalConfig.tokenAccount,
            kSecAttrAccessGroup as String: HelloCalConfig.keychainAccessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Called by the main app after login / "Generér enhedskode".
    static func write(_ token: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: HelloCalConfig.tokenAccount,
            kSecAttrAccessGroup as String: HelloCalConfig.keychainAccessGroup,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(token.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

enum SnapshotStore {
    private static let cacheKey = "widgetSnapshot"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: HelloCalConfig.appGroup) }

    static func cached() -> WidgetSnapshot? {
        guard let data = defaults?.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    /// Network first, cached copy on any failure, placeholder as last resort.
    static func load() async -> WidgetSnapshot {
        if let fresh = try? await fetch() { return fresh }
        return cached() ?? .placeholder
    }

    static func fetch() async throws -> WidgetSnapshot {
        guard let token = DeviceTokenStore.read() else { throw URLError(.userAuthenticationRequired) }
        var components = URLComponents(url: HelloCalConfig.baseURL.appendingPathComponent("api/widgets/snapshot"),
                                       resolvingAgainstBaseURL: false)!
        let locale = Locale.current.language.languageCode?.identifier == "en" ? "en" : "da"
        components.queryItems = [
            URLQueryItem(name: "tzOffsetMinutes", value: String(TimeZone.current.secondsFromGMT() / 60)),
            URLQueryItem(name: "locale", value: locale),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        defaults?.set(data, forKey: cacheKey)
        return snapshot
    }
}
