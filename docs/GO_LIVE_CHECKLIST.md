# Cognitive Mirror go-live checklist

The production web service and managed PostgreSQL database are live. The items below require account ownership, legal acceptance, or provider secrets and therefore cannot be completed safely by an unattended local build.

## Mobile stores

- Android 36 ARM64 emulator acceptance passed: install, launch, protected login, production dashboard, microphone permission, capture deep link, all four tabs, widget registration, and crash-log scan. The local release remains debug-signed and is not a Play Store artifact.
- Sign in to Expo Application Services from `apps/mobile` with `pnpm dlx eas-cli login`, then initialize the project and create iOS/Android distribution credentials.
- Xcode 26.6 is installed and the iOS 26.5 Simulator runtime download is running in Xcode. Apple Accounts currently has no signed-in account; device/archive builds still require the owner to sign in and select Xcode with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- Provide App Store Connect and Google Play Console apps, bundle/package ownership, store metadata, privacy declarations, and production signing. The local Android artifacts are validation builds and currently use the Android debug certificate.
- Create APNs and FCM credentials and set the Expo EAS project ID before enabling real proactive coaching pushes.

## External integrations

- Notion: create an integration, share the target database, and provide its integration token and data-source identifier.
- Todoist: provide an API token for the owner account.
- Google Calendar: create an OAuth client, complete consent-screen verification as applicable, and authorize a refresh token for the target calendar.
- Apple Reminders: grant EventKit permission on the signed iOS build.
- Optional after launch — Telegram and WhatsApp imports: create the bot/business application, add webhook secrets, and complete provider verification only if these extra capture channels are wanted. Direct web/iOS/Android capture does not depend on them.
- ElevenLabs is optional; OpenAI text-to-speech remains the fallback.

## Compliance and operations

- Approve the privacy policy, retention/export/deletion wording, and jurisdiction-specific meeting-recording consent flow.
- Choose a hosted error-reporting/tracing destination and its data-retention region.
- Upgrade Vercel if retries, sync, and coaching must run more frequently than the daily Hobby-plan recovery schedule.
- Rotate any API key that has ever been pasted into a chat before public launch.

After the credentials above are available, run the provider-specific end-to-end acceptance flows before marking those integrations or store releases as production-ready.
