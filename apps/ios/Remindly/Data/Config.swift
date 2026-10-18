import Foundation

/// Supabase settings baked into Info.plist from Config/Secrets.xcconfig.
enum RemindlyConfig {
    static var supabaseURL: URL {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            let url = URL(string: raw), url.host?.isEmpty == false
        else {
            fatalError("SUPABASE_URL is missing. Run apps/ios/scripts/sync-secrets.sh, then rebuild.")
        }
        return url
    }

    /// The hosted web app, if REMINDLY_WEB_HOST is set in Config/Base.xcconfig.
    static var webAppURL: URL? {
        guard let host = Bundle.main.object(forInfoDictionaryKey: "REMINDLY_WEB_HOST") as? String, !host.isEmpty else { return nil }
        return URL(string: "https://\(host)")
    }

    static var supabaseAnonKey: String {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String, !key.isEmpty else {
            fatalError("SUPABASE_ANON_KEY is missing. Run apps/ios/scripts/sync-secrets.sh, then rebuild.")
        }
        return key
    }
}
