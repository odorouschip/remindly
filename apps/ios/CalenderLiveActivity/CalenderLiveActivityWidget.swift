import ActivityKit
import SwiftUI
import WidgetKit

@main
struct CalenderLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        CalenderLiveActivityWidget()
    }
}

struct CalenderLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CalenderActivityAttributes.self) { context in
            LockScreenActivityView(state: context.state)
                .activityBackgroundTint(Color(red: 0.10, green: 0.18, blue: 0.15))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: context.state.deepLinkUrl))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.phaseLabel)
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Text(context.state.title)
                            .font(.headline.weight(.heavy))
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    CountdownText(state: context.state)
                        .font(.title2.monospacedDigit().weight(.black))
                }

                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(timerInterval: Date.now...context.state.endsAtDate, countsDown: false)
                        .tint(context.state.accentColor)
                }
            } compactLeading: {
                Image(systemName: "calendar.badge.clock")
                    .foregroundStyle(context.state.accentColor)
            } compactTrailing: {
                CountdownText(state: context.state)
                    .font(.caption2.monospacedDigit().bold())
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(context.state.accentColor)
            }
            .widgetURL(URL(string: context.state.deepLinkUrl))
            .keylineTint(context.state.accentColor)
        }
    }
}

struct LockScreenActivityView: View {
    let state: CalenderActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text(state.phaseLabel)
                    .font(.caption.weight(.black))
                    .foregroundStyle(state.accentColor)
                    .textCase(.uppercase)
                Text(state.title)
                    .font(.title3.weight(.heavy))
                    .lineLimit(2)
            }

            Spacer(minLength: 12)

            CountdownText(state: state)
                .font(.system(size: 34, weight: .black, design: .rounded).monospacedDigit())
                .minimumScaleFactor(0.74)
        }
        .foregroundStyle(.white)
        .padding(18)
    }
}

struct CountdownText: View {
    let state: CalenderActivityAttributes.ContentState

    var body: some View {
        if state.phase == "in_progress" {
            Text("Now")
        } else if state.phase == "ended" {
            Text("Done")
        } else {
            Text(state.startsAtDate, style: .timer)
        }
    }
}

extension CalenderActivityAttributes.ContentState {
    var phaseLabel: String {
        switch phase {
        case "starting":
            return "Starting"
        case "in_progress":
            return "Happening"
        case "ended":
            return "Finished"
        case "stale":
            return "Needs sync"
        default:
            return "Upcoming"
        }
    }

    var accentColor: Color {
        switch urgency {
        case "now":
            return Color(red: 0.95, green: 0.38, blue: 0.25)
        case "soon":
            return Color(red: 0.95, green: 0.74, blue: 0.24)
        default:
            return Color(red: 0.56, green: 0.80, blue: 0.72)
        }
    }
}
