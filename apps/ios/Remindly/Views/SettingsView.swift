import SwiftUI
import UserNotifications

struct SettingsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(CalendarStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var notificationStatus: UNAuthorizationStatus?

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Email", value: auth.session?.email ?? "—")
                    LabeledContent("Time zone", value: TimeZone.current.identifier)
                }

                Section {
                    LabeledContent("Notifications", value: notificationLabel)
                    if notificationStatus == .denied {
                        Button("Turn on in Settings") {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                        }
                    }
                } header: {
                    Text("Reminders")
                } footer: {
                    Text("Reminders are scheduled on this iPhone each time Remindly syncs. Open the app after adding events on the web so it picks them up.")
                }

                Section {
                    ForEach(store.categories) { category in
                        Label {
                            Text(category.name)
                        } icon: {
                            Image(systemName: "circle.fill").foregroundStyle(category.color.color)
                        }
                    }
                } header: {
                    Text("Categories")
                } footer: {
                    Text("Rename, recolor or add categories in Settings on the web app.")
                }

                Section {
                    Button("Sign out", role: .destructive) {
                        Task {
                            await auth.signOut()
                            dismiss()
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { notificationStatus = await store.notifications.authorizationStatus() }
        }
    }

    private var notificationLabel: String {
        switch notificationStatus {
        case .authorized, .provisional, .ephemeral: "On"
        case .denied: "Off"
        case .notDetermined: "Not set up"
        default: "—"
        }
    }
}
