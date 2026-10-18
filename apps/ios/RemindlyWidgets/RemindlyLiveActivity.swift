import ActivityKit
import SwiftUI
import WidgetKit

@main
struct RemindlyWidgetsBundle: WidgetBundle {
    var body: some Widget {
        UpNextWidget()
        TodayWidget()
        RemindlyLiveActivity()
    }
}

// Styled after the app icon: ink background, paper text, a coral accent.
private enum Brand {
    static let ink = Color(red: 0x0D / 255, green: 0x0D / 255, blue: 0x0D / 255)
    static let paper = Color(red: 0xF3 / 255, green: 0xF1 / 255, blue: 0xEC / 255)
    static let coral = Color(red: 0xF7 / 255, green: 0x60 / 255, blue: 0x4B / 255)
}

/// The "r" from the app icon, in the system serif.
private struct Mark: View {
    var body: some View {
        Text("r")
            .font(.system(.body, design: .serif).italic().weight(.bold))
            .foregroundStyle(Brand.coral)
    }
}

struct RemindlyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RemindlyActivityAttributes.self) { context in
            LockScreenActivityView(state: context.state, started: context.isStale)
                .activityBackgroundTint(Brand.ink)
                .activitySystemActionForegroundColor(Brand.paper)
                .widgetURL(URL(string: context.state.deepLinkUrl))
        } dynamicIsland: { context in
            let started = context.isStale || context.state.phase == "in_progress"
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        PhaseLabel(state: context.state, started: started)
                        Text(context.state.title)
                            .font(.headline)
                            .lineLimit(1)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(state: context.state, started: started)
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(context.state.isSoon || started ? Brand.coral : Brand.paper)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if started {
                        ProgressView(timerInterval: context.state.startsAtDate...context.state.endsAtDate, countsDown: false) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .tint(context.state.tintColor)
                    } else {
                        Text(context.state.timeRange)
                            .font(.footnote)
                            .foregroundStyle(Brand.paper.opacity(0.6))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 4)
                    }
                }
            } compactLeading: {
                Mark()
            } compactTrailing: {
                Countdown(state: context.state, started: started)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(context.state.isSoon || started ? Brand.coral : Brand.paper)
                    .frame(maxWidth: 52)
            } minimal: {
                Mark()
            }
            .widgetURL(URL(string: context.state.deepLinkUrl))
            .keylineTint(Brand.coral)
        }
    }
}

struct LockScreenActivityView: View {
    let state: RemindlyActivityAttributes.ContentState
    let started: Bool

    private var isStarted: Bool { started || state.phase == "in_progress" }

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 2)
                .fill(state.tintColor)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 3) {
                PhaseLabel(state: state, started: isStarted)
                Text(state.title)
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .lineLimit(2)
                Text(state.timeRange)
                    .font(.footnote)
                    .foregroundStyle(Brand.paper.opacity(0.6))
            }

            Spacer(minLength: 8)

            if isStarted {
                ProgressView(timerInterval: state.startsAtDate...state.endsAtDate, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    Text("Now")
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .foregroundStyle(Brand.coral)
                }
                .progressViewStyle(.circular)
                .tint(Brand.coral)
                .frame(width: 64)
            } else {
                Countdown(state: state, started: false)
                    .font(.system(size: 34, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(state.isSoon ? Brand.coral : Brand.paper)
                    .multilineTextAlignment(.trailing)
                    .minimumScaleFactor(0.6)
                    .frame(maxWidth: 130, alignment: .trailing)
            }
        }
        .foregroundStyle(Brand.paper)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

private struct PhaseLabel: View {
    let state: RemindlyActivityAttributes.ContentState
    let started: Bool

    var body: some View {
        HStack(spacing: 5) {
            if started || state.isSoon {
                Circle().fill(Brand.coral).frame(width: 6, height: 6)
            }
            Text(started ? "HAPPENING NOW" : state.isSoon ? "STARTING SOON" : "UP NEXT")
                .font(.caption2.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(Brand.paper.opacity(0.6))
        }
    }
}

/// Counts down to the start and stops at zero (the widget turns to "Now" when
/// the activity goes stale at the start time).
private struct Countdown: View {
    let state: RemindlyActivityAttributes.ContentState
    let started: Bool

    var body: some View {
        if started {
            Text("Now")
        } else {
            Text(timerInterval: Date.now...max(Date.now, state.startsAtDate), countsDown: true)
        }
    }
}

extension RemindlyActivityAttributes.ContentState {
    /// Within ten minutes of starting when the countdown began. (Widget views
    /// don't re-render as time passes, so this comes from the state, not the clock.)
    var isSoon: Bool { urgency == "soon" || urgency == "now" }

    var timeRange: String {
        "\(startsAtDate.formatted(date: .omitted, time: .shortened)) – \(endsAtDate.formatted(date: .omitted, time: .shortened))"
    }

    /// The event's category color (dark-mode shades, since the background is dark).
    var tintColor: Color {
        CategoryPalette.darkColor(tint) ?? Brand.coral // coral when there's no category
    }
}
