import SwiftUI

struct SignInView: View {
    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var message: String?
    @State private var messageIsError = true
    @FocusState private var focus: Field?

    private enum Mode { case signIn, signUp }
    private enum Field { case name, email, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 14) {
                    LogoMark(size: 52)
                    Text(mode == .signIn ? "Log in to Remindly" : "Create your account")
                        .font(.title2.weight(.semibold))
                }
                .padding(.top, 72)

                VStack(spacing: 12) {
                    if mode == .signUp {
                        field("Name", text: $name, field: .name)
                            .textContentType(.name)
                    }
                    field("Email", text: $email, field: .email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(mode == .signIn ? .password : .newPassword)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                        .padding(.horizontal, 14)
                        .frame(height: 48)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    if mode == .signUp {
                        Text("At least 8 characters")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                if let message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(messageIsError ? Color.red : Color.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await submit() }
                } label: {
                    Group {
                        if isWorking { ProgressView() } else { Text(mode == .signIn ? "Log in" : "Create account") }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 30)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isWorking || email.isEmpty || password.isEmpty)

                Button(mode == .signIn ? "No account yet? Sign up" : "Already have an account? Log in") {
                    withAnimation { mode = mode == .signIn ? .signUp : .signIn }
                    message = nil
                }
                .font(.subheadline)

                if mode == .signIn {
                    if let web = RemindlyConfig.webAppURL {
                        Link("Forgot your password? Reset it on the web", destination: web)
                            .font(.footnote)
                    } else {
                        Text("Forgot your password? Reset it on the web app.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func field(_ title: String, text: Binding<String>, field: Field) -> some View {
        TextField(title, text: text)
            .focused($focus, equals: field)
            .submitLabel(.next)
            .onSubmit { focus = field == .name ? .email : .password }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func submit() async {
        guard !isWorking, !email.isEmpty, !password.isEmpty else { return }
        isWorking = true
        defer { isWorking = false }
        message = nil
        do {
            let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
            if mode == .signIn {
                try await auth.signIn(email: trimmedEmail, password: password)
            } else if try await auth.signUp(email: trimmedEmail, password: password, name: name) == .needsConfirmation {
                messageIsError = false
                message = "Check your email to confirm your account, then log in."
                mode = .signIn
            }
        } catch {
            messageIsError = true
            message = Self.friendly(error)
        }
    }

    /// URLSession reports offline as a long system string; keep it short.
    private static func friendly(_ error: Error) -> String {
        if (error as? URLError) != nil { return "Couldn't reach the server. Check your connection and try again." }
        return error.localizedDescription
    }
}
