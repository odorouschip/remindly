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
                    Text("Reminders are scheduled on this iPhone. Remindly syncs when you open it, and in the background a few times a day if Background App Refresh is on.")
                }

                Section("Categories") {
                    NavigationLink {
                        CategoriesView()
                    } label: {
                        HStack {
                            Text("Edit Categories")
                            Spacer()
                            HStack(spacing: -4) {
                                ForEach(store.categories.prefix(5)) { category in
                                    Circle()
                                        .fill(category.color.color)
                                        .frame(width: 12, height: 12)
                                        .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 1.5))
                                }
                            }
                        }
                    }
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
