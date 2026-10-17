import { NativeModule, requireOptionalNativeModule } from "expo";

declare class MirrorSystemCaptureModule extends NativeModule<{}> {
  consumePendingActionAsync(): Promise<"capture" | "meeting" | null>;
  createReminderAsync(title: string, notes?: string | null, dueDate?: string | null): Promise<{ external_id: string; title: string }>;
}

const nativeModule = requireOptionalNativeModule<MirrorSystemCaptureModule>("MirrorSystemCapture");

export default nativeModule || {
  consumePendingActionAsync: async () => null,
  createReminderAsync: async () => { throw new Error("Apple Reminders is available on iOS only"); },
};
