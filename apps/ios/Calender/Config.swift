import Foundation

enum CalenderConfig {
    static var supabaseURL: URL {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            let url = URL(string: rawValue)
        else {
            fatalError("Missing SUPABASE_URL in Info.plist")
        }

        return url
    }

    static var supabaseAnonKey: String {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String else {
            fatalError("Missing SUPABASE_ANON_KEY in Info.plist")
        }

        return key
    }
}
