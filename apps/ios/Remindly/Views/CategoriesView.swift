import SwiftUI

/// Rename, recolor, add, reorder and delete categories. Saves as you go.
struct CategoriesView: View {
    @Environment(CalendarStore.self) private var store
    @State private var confirmingDelete: Category?
    @State private var newlyAdded: UUID?

    var body: some View {
        List {
            Section {
                ForEach(store.categories) { category in
                    CategoryRow(category: category, startsEditing: category.id == newlyAdded)
                }
                .onMove { source, destination in
                    Task { await store.moveCategories(from: source, to: destination) }
                }
                .onDelete { offsets in
                    confirmingDelete = offsets.first.map { store.categories[$0] }
                }
                Button { add() } label: {
                    Label("Add Category", systemImage: "plus")
                }
            } footer: {
                Text("Deleting a category keeps its events; they just become uncategorized.")
            }
        }
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { EditButton() }
        .confirmationDialog(
            "Delete “\(confirmingDelete?.name ?? "")”?",
            isPresented: Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete Category", role: .destructive) {
                if let category = confirmingDelete { Task { await store.deleteCategory(category) } }
            }
        } message: {
            Text("Its events stay, uncategorized.")
        }
    }

    private func add() {
        // The first color nobody's using yet, so new categories stand apart.
        let used = Set(store.categories.map(\.color))
        let color = CategoryColor.allCases.first { $0 != .gray && !used.contains($0) } ?? .gray
        let category = Category(id: UUID(), name: "New category", color: color,
                                sortOrder: (store.categories.map(\.sortOrder).max() ?? -1) + 1)
        newlyAdded = category.id
        Task { await store.saveCategory(category, isNew: true) }
    }
}

private struct CategoryRow: View {
    @Environment(CalendarStore.self) private var store
    let category: Category
    var startsEditing = false

    @State private var name = ""
    @State private var choosingColor = false
    @FocusState private var nameFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Button {
                    withAnimation(.snappy) { choosingColor.toggle() }
                } label: {
                    Circle()
                        .fill(category.color.color)
                        .frame(width: 22, height: 22)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Color: \(category.color.rawValue)")

                TextField("Name", text: $name)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .onSubmit(commitName)
            }

            if choosingColor {
                HStack(spacing: 0) {
                    ForEach(CategoryColor.allCases, id: \.self) { color in
                        Button {
                            withAnimation(.snappy) { choosingColor = false }
                            guard color != category.color else { return }
                            var updated = category
                            updated.color = color
                            Task { await store.saveCategory(updated, isNew: false) }
                        } label: {
                            Circle()
                                .fill(color.color)
                                .frame(width: 26, height: 26)
                                .overlay {
                                    if color == category.color {
                                        Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(.white)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(color.rawValue.capitalized)
                    }
                }
            }
        }
        .padding(.vertical, 2)
        .onAppear {
            name = category.name
            if startsEditing { nameFocused = true }
        }
        .onChange(of: category.name) { _, newName in if !nameFocused { name = newName } }
        .onChange(of: nameFocused) { _, focused in if !focused { commitName() } }
    }

    private func commitName() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { name = category.name; return }
        guard trimmed != category.name else { return }
        var updated = category
        updated.name = trimmed
        Task { await store.saveCategory(updated, isNew: false) }
    }
}
