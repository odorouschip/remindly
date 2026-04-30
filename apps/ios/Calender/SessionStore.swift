import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published var accessToken: String?
    @Published var refreshToken: String?
    @Published var userId: UUID?
    @Published var email: String?
    @Published var pendingDeepLink: URL?

    var isSignedIn: Bool {
        accessToken != nil && userId != nil
    }

    func apply(_ response: AuthResponse) {
        accessToken = response.accessToken
        refreshToken = response.refreshToken
        userId = response.user.id
        email = response.user.email
    }

    func signOut() {
        accessToken = nil
        refreshToken = nil
        userId = nil
        email = nil
        pendingDeepLink = nil
    }
}
