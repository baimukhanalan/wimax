import AppIntents
import Foundation

enum MirrorSystemAction {
  static let defaultsKey = "cognitiveMirror.pendingSystemAction"
  static let capture = "capture"
  static let meeting = "meeting"
}

@available(iOS 16.0, *)
struct StartMirrorMeetingIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Meeting Mode"
  static let description = IntentDescription("Open WIMAX and start a consent-confirmed meeting recording.")
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & ProvidesDialog {
    UserDefaults.standard.set(MirrorSystemAction.meeting, forKey: MirrorSystemAction.defaultsKey)
    return .result(dialog: "Opening Meeting Mode. Confirm consent before recording starts.")
  }
}

@available(iOS 16.0, *)
struct StartMirrorCaptureIntent: AppIntent {
  static let title: LocalizedStringResource = "Capture a thought"
  static let description = IntentDescription("Open WIMAX directly in voice capture.")
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & ProvidesDialog {
    UserDefaults.standard.set(MirrorSystemAction.capture, forKey: MirrorSystemAction.defaultsKey)
    return .result(dialog: "WIMAX is ready to listen.")
  }
}

@available(iOS 16.0, *)
struct CognitiveMirrorShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: StartMirrorCaptureIntent(), phrases: [
      "Hi \(.applicationName), record this",
      "Capture with \(.applicationName)",
      "Record a thought with \(.applicationName)",
      "Start \(.applicationName) capture"
    ], shortTitle: "Capture a thought", systemImageName: "waveform.circle.fill")
    AppShortcut(intent: StartMirrorMeetingIntent(), phrases: [
      "Hi \(.applicationName), start a meeting",
      "Start Meeting Mode with \(.applicationName)",
      "Record a meeting with \(.applicationName)"
    ], shortTitle: "Start Meeting Mode", systemImageName: "person.2.wave.2.fill")
  }
}
