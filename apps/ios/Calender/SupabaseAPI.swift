import Foundation

@MainActor
final class SupabaseAPI: ObservableObject {
    @Published var events: [CalendarEvent] = []
    @Published var lastError: String?

    private var baseURL: URL { CalenderConfig.supabaseURL }
    private var anonKey: String { CalenderConfig.supabaseAnonKey }

    func signIn(email: String, password: String) async throws -> AuthResponse {
        var request = URLRequest(url: endpoint("auth/v1/token", queryItems: [
            URLQueryItem(name: "grant_type", value: "password")
        ]))
        request.httpMethod = "POST"
        request.addValue(anonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        return try await send(request, as: AuthResponse.self)
    }

    func signUp(email: String, password: String) async throws -> AuthResponse {
        var request = URLRequest(url: endpoint("auth/v1/signup"))
        request.httpMethod = "POST"
        request.addValue(anonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        return try await send(request, as: AuthResponse.self)
    }

    func loadEvents(accessToken: String) async {
        do {
            let url = endpoint("rest/v1/events", queryItems: [
                URLQueryItem(name: "select", value: "*,reminders(*)"),
                URLQueryItem(name: "deleted_at", value: "is.null"),
                URLQueryItem(name: "order", value: "starts_at.asc"),
            ])

            var request = authorizedRequest(url: url, accessToken: accessToken)
            request.httpMethod = "GET"
            events = try await send(request, as: [CalendarEvent].self)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func saveEvent(accessToken: String, userId: UUID, draft: EventDraft, reminders: [Int], existingEventId: UUID?) async throws {
        let savedEvent: CalendarEvent

        if let existingEventId {
            var request = authorizedRequest(url: endpoint("rest/v1/events", queryItems: [
                URLQueryItem(name: "id", value: "eq.\(existingEventId.uuidString)"),
                URLQueryItem(name: "select", value: "*"),
            ]), accessToken: accessToken)
            request.httpMethod = "PATCH"
            request.addValue("return=representation", forHTTPHeaderField: "prefer")
            request.httpBody = try JSONEncoder.supabase.encode(draft)
            let response = try await send(request, as: [CalendarEvent].self)
            guard let firstEvent = response.first else { throw APIError.emptyResponse }
            savedEvent = firstEvent
        } else {
            var request = authorizedRequest(url: endpoint("rest/v1/events", queryItems: [
                URLQueryItem(name: "select", value: "*")
            ]), accessToken: accessToken)
            request.httpMethod = "POST"
            request.addValue("return=representation", forHTTPHeaderField: "prefer")
            request.httpBody = try JSONEncoder.supabase.encode(draft)
            let response = try await send(request, as: [CalendarEvent].self)
            guard let firstEvent = response.first else { throw APIError.emptyResponse }
            savedEvent = firstEvent
        }

        try await replaceReminders(accessToken: accessToken, event: savedEvent, offsets: reminders)
        await loadEvents(accessToken: accessToken)
    }

    func softDeleteEvent(accessToken: String, eventId: UUID) async throws {
        struct DeletePayload: Encodable {
            let deletedAt: Date

            enum CodingKeys: String, CodingKey {
                case deletedAt = "deleted_at"
            }
        }

        var request = authorizedRequest(url: endpoint("rest/v1/events", queryItems: [
            URLQueryItem(name: "id", value: "eq.\(eventId.uuidString)")
        ]), accessToken: accessToken)
        request.httpMethod = "PATCH"
        request.httpBody = try JSONEncoder.supabase.encode(DeletePayload(deletedAt: Date()))
        _ = try await sendEmpty(request)
        await loadEvents(accessToken: accessToken)
    }

    func upsertDevice(accessToken: String, userId: UUID, apnsToken: String?, activityPushToStartToken: String?) async throws {
        struct DevicePayload: Encodable {
            let userId: UUID
            let platform = "ios"
            let apnsDeviceToken: String?
            let activityPushToStartToken: String?
            let lastSeenAt = Date()

            enum CodingKeys: String, CodingKey {
                case userId = "user_id"
                case platform
                case apnsDeviceToken = "apns_device_token"
                case activityPushToStartToken = "activity_push_to_start_token"
                case lastSeenAt = "last_seen_at"
            }
        }

        var request = authorizedRequest(url: endpoint("rest/v1/devices", queryItems: [
            URLQueryItem(name: "on_conflict", value: "user_id,platform")
        ]), accessToken: accessToken)
        request.httpMethod = "POST"
        request.addValue("resolution=merge-duplicates", forHTTPHeaderField: "prefer")
        request.httpBody = try JSONEncoder.supabase.encode(DevicePayload(
            userId: userId,
            apnsDeviceToken: apnsToken,
            activityPushToStartToken: activityPushToStartToken
        ))
        _ = try await sendEmpty(request)
    }

    private func replaceReminders(accessToken: String, event: CalendarEvent, offsets: [Int]) async throws {
        var deleteRequest = authorizedRequest(url: endpoint("rest/v1/reminders", queryItems: [
            URLQueryItem(name: "event_id", value: "eq.\(event.id.uuidString)")
        ]), accessToken: accessToken)
        deleteRequest.httpMethod = "DELETE"
        _ = try await sendEmpty(deleteRequest)

        guard !offsets.isEmpty else { return }

        let drafts = offsets.map { offset in
            ReminderDraft(
                eventId: event.id,
                userId: event.userId,
                offsetMinutes: offset,
                channel: .liveActivity,
                dueAt: event.startsAt.addingTimeInterval(TimeInterval(-offset * 60))
            )
        }

        var request = authorizedRequest(url: endpoint("rest/v1/reminders"), accessToken: accessToken)
        request.httpMethod = "POST"
        request.httpBody = try JSONEncoder.supabase.encode(drafts)
        _ = try await sendEmpty(request)
    }

    private func authorizedRequest(url: URL, accessToken: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.addValue(anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(accessToken)", forHTTPHeaderField: "authorization")
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        return request
    }

    private func endpoint(_ path: String, queryItems: [URLQueryItem] = []) -> URL {
        let root = baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let suffix = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: "\(root)/\(suffix)")!
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        return components.url!
    }

    private func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder.supabase.decode(T.self, from: data)
    }

    private func sendEmpty(_ request: URLRequest) async throws {
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
            throw APIError.requestFailed(message)
        }
    }
}

enum APIError: LocalizedError {
    case emptyResponse
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .emptyResponse:
            return "Supabase returned an empty response."
        case .requestFailed(let message):
            return message
        }
    }
}
