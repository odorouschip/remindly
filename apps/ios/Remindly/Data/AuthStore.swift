import Foundation
import Observation

struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userId: UUID
    var email: String?
}

struct APIError: LocalizedError {
    let message: String
    var status: Int = 0
    var errorDescription: String? { message }

    /// Supabase errors arrive as {"msg"}, {"message"} or {"error_description"} depending on the service.
    init(data: Data, status: Int) {
        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let text = ["msg", "message", "error_description", "error"].lazy.compactMap { body?[$0] as? String }.first
        self.message = text ?? "Request failed (\(status))."
        self.status = status
    }

    init(_ message: String) {
        self.message = message
    }
}

enum SignUpResult {
    case signedIn
    /// Email confirmation is on; the account exists but has no session yet.
    case needsConfirmation
}

/// Signs in with Supabase Auth, keeps the session in the keychain, and
/// refreshes the access token before it expires.
@MainActor
@Observable
final class AuthStore {
    private(set) var session: AuthSession?
    private static let keychainKey = "auth-session"
    private var refreshTask: Task<AuthSession, Error>?

    var isSignedIn: Bool { session != nil }

    init() {
        session = Keychain.load(AuthSession.self, key: Self.keychainKey)
    }

    func signIn(email: String, password: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let response: TokenResponse = try await post("token?grant_type=password", body: body)
        store(try response.session())
    }

    func signUp(email: String, password: String, name: String) async throws -> SignUpResult {
        let payload: [String: Any] = [
            "email": email,
            "password": password,
            "data": ["full_name": name, "timezone": TimeZone.current.identifier],
        ]
        let response: TokenResponse = try await post("signup", body: try JSONSerialization.data(withJSONObject: payload))
        guard response.accessToken != nil else { return .needsConfirmation }
        store(try response.session())
        return .signedIn
    }

    func signOut() async {
        if let token = session?.accessToken {
            var request = URLRequest(url: Self.authURL("logout"))
            request.httpMethod = "POST"
            request.addValue(RemindlyConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: request) // best effort; we sign out locally regardless
        }
        clear()
    }

    /// A token that's good for at least another minute, refreshing if needed.
    func accessToken() async throws -> String {
        guard let session else { throw APIError("You're signed out.") }
        if session.expiresAt.timeIntervalSinceNow > 60 { return session.accessToken }
        return try await refresh().accessToken
    }

    /// Exchanges the refresh token for a new session. Concurrent callers share one request.
    @discardableResult
    func refresh() async throws -> AuthSession {
        if let refreshTask { return try await refreshTask.value }
        guard let refreshToken = session?.refreshToken else { throw APIError("You're signed out.") }

        let task = Task { () throws -> AuthSession in
            let body = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
            let response: TokenResponse = try await self.post("token?grant_type=refresh_token", body: body)
            return try response.session()
        }
        refreshTask = task
        defer { refreshTask = nil }
        do {
            let fresh = try await task.value
            store(fresh)
            return fresh
        } catch let error as APIError where (400..<500).contains(error.status) {
            // The refresh token was revoked or expired; the user has to sign in again.
            clear()
            throw APIError("Your session expired. Please sign in again.")
        }
    }

    private func store(_ session: AuthSession) {
        self.session = session
        Keychain.save(session, key: Self.keychainKey)
    }

    private func clear() {
        session = nil
        Keychain.delete(key: Self.keychainKey)
    }

    private static func authURL(_ path: String) -> URL {
        URL(string: "auth/v1/\(path)", relativeTo: RemindlyConfig.supabaseURL.appendingPathComponent("/"))!.absoluteURL
    }

    private func post<T: Decodable>(_ path: String, body: Data) async throws -> T {
        var request = URLRequest(url: Self.authURL(path))
        request.httpMethod = "POST"
        request.httpBody = body
        request.addValue(RemindlyConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw APIError(data: data, status: status) }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
}

/// Shape of /auth/v1/token and /auth/v1/signup responses.
private struct TokenResponse: Decodable {
    struct User: Decodable {
        let id: UUID
        let email: String?
    }

    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Double?
    let expiresAt: Double?
    let user: User?
    // With email confirmation on, signup returns the user fields at the top level.
    let id: UUID?
    let email: String?

    func session() throws -> AuthSession {
        guard let accessToken, let refreshToken, let user else {
            throw APIError("Unexpected response from the server.")
        }
        let expires = expiresAt.map { Date(timeIntervalSince1970: $0) } ?? Date().addingTimeInterval(expiresIn ?? 3600)
        return AuthSession(accessToken: accessToken, refreshToken: refreshToken, expiresAt: expires, userId: user.id, email: user.email)
    }
}
