import { registerWebModule, NativeModule } from "expo";

class MirrorSystemCaptureModule extends NativeModule<{}> {
  async consumePendingActionAsync(): Promise<null> { return null; }
}

export default registerWebModule(MirrorSystemCaptureModule, "MirrorSystemCaptureModule");
