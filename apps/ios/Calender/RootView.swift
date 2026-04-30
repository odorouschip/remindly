import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isSignedIn {
                EventsView()
            } else {
                AuthView()
            }
        }
    }
}

struct AuthView: View {
    @EnvironmentObject private var api: SupabaseAPI
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var isCreatingAccount = false
    @State private var isWorking = false
    @State private var message = "Sign in to sync web and iPhone reminders."

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(.green)
                    Text("Calender")
                        .font(.system(size: 46, weight: .black, design: .rounded))
                    Text("A calendar built around countdowns you actually notice.")
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(isCreatingAccount ? .newPassword : .password)
                }
                .textFieldStyle(.roundedBorder)

                Button {
                    Task { await authenticate() }
                } label: {
                    Label(isCreatingAccount ? "Create Account" : "Sign In", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isWorking)

                Button(isCreatingAccount ? "I already have an account" : "Create an account") {
                    isCreatingAccount.toggle()
                }
                .buttonStyle(.bordered)

                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Spacer()
            }
            .padding(24)
            .navigationTitle("")
        }
    }

    private func authenticate() async {
        isWorking = true
        defer { isWorking = false }

        do {
            let response = isCreatingAccount
                ? try await api.signUp(email: email, password: password)
                : try await api.signIn(email: email, password: password)
            session.apply(response)
            if let token = session.accessToken {
                await api.loadEvents(accessToken: token)
            }
        } catch {
            message = error.localizedDescription
        }
    }
}
