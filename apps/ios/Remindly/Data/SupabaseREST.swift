import Foundation

/// Minimal PostgREST client: every request carries the signed-in user's token,
/// and a 401 triggers one token refresh and retry.
@MainActor
struct SupabaseREST {
    let auth: AuthStore

    enum Method: String {
        case get = "GET", post = "POST", patch = "PATCH", delete = "DELETE"
    }

    @discardableResult
    func send(
        _ method: Method,
        _ table: String,
        query: [String: String] = [:],
        body: Data? = nil,
        prefer: String? = nil
    ) async throws -> Data {
        var components = URLComponents(
            url: RemindlyConfig.supabaseURL.appendingPathComponent("rest/v1/\(table)"),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        for attempt in 0..<2 {
            let token = attempt == 0 ? try await auth.accessToken() : try await auth.refresh().accessToken
            var request = URLRequest(url: components.url!)
            request.httpMethod = method.rawValue
            request.httpBody = body
            request.addValue(RemindlyConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            if let prefer { request.addValue(prefer, forHTTPHeaderField: "Prefer") }

            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 && attempt == 0 { continue }
            guard (200..<300).contains(status) else { throw APIError(data: data, status: status) }
            return data
        }
        throw APIError("Couldn't authenticate with the server.")
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()
}
