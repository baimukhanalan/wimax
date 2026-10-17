import ExpoModulesCore
import EventKit

public class MirrorSystemCaptureModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MirrorSystemCapture")

    AsyncFunction("consumePendingActionAsync") {
      let value = UserDefaults.standard.string(forKey: MirrorSystemAction.defaultsKey)
      UserDefaults.standard.removeObject(forKey: MirrorSystemAction.defaultsKey)
      return value
    }

    AsyncFunction("createReminderAsync") { (title: String, notes: String?, dueDate: String?) async throws -> [String: Any] in
      let store = EKEventStore()
      let granted: Bool
      if #available(iOS 17.0, *) {
        granted = try await store.requestFullAccessToReminders()
      } else {
        granted = try await withCheckedThrowingContinuation { continuation in
          store.requestAccess(to: .reminder) { allowed, error in
            if let error = error { continuation.resume(throwing: error) }
            else { continuation.resume(returning: allowed) }
          }
        }
      }
      guard granted else { throw NSError(domain: "CognitiveMirror", code: 1, userInfo: [NSLocalizedDescriptionKey: "Reminders permission was denied"]) }
      guard let calendar = store.defaultCalendarForNewReminders() else { throw NSError(domain: "CognitiveMirror", code: 2, userInfo: [NSLocalizedDescriptionKey: "No default Reminders list is available"]) }
      let reminder = EKReminder(eventStore: store)
      reminder.title = title
      reminder.notes = notes
      reminder.calendar = calendar
      if let dueDate, let date = ISO8601DateFormatter().date(from: dueDate) {
        reminder.dueDateComponents = Calendar.current.dateComponents(in: TimeZone.current, from: date)
        reminder.addAlarm(EKAlarm(absoluteDate: date))
      }
      try store.save(reminder, commit: true)
      return ["external_id": reminder.calendarItemIdentifier ?? "", "title": title]
    }
  }
}
