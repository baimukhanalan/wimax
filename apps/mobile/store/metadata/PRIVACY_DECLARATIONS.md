# WIMAX privacy declarations — form-ready draft

This inventory reflects release 1.0.0 as prepared on 25 August 2026. Re-audit it whenever an SDK, integration, analytics provider, advertising feature or data flow changes.

## Shared answers

- Privacy policy: `https://cognitive-mirror-two.vercel.app/privacy`
- Account deletion: `https://cognitive-mirror-two.vercel.app/account-deletion`
- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes — in-app and web instructions**
- Tracking across apps/websites: **No**
- Advertising: **No**
- Data sale: **No**
- Public user-generated content or social feed: **No**
- Account required: **Yes**, for synchronized private workspace data

## Apple App Privacy

Select “Yes, we collect data from this app.” For every item below: **Linked to the user = Yes**, **Used for tracking = No**, purpose **App Functionality**.

| App Store category | Data | Required/optional | Reason |
|---|---|---|---|
| Contact Info | Name | Required for account | Workspace identity |
| Contact Info | Email Address | Required for account | Authentication and service communication |
| Identifiers | User ID | Required | Tenant separation and sync |
| User Content | Audio Data | Optional feature | Voice capture and meeting processing |
| User Content | Other User Content | Optional feature | Transcripts, pages, tasks, habits, commands, searches |
| Financial Info | Other Financial Info | Optional feature | User-created financial entries |

Do not select precise/coarse location, contacts, photos, health, purchases, browsing history, advertising data, or tracking unless the release adds those flows.

The bundled `PrivacyInfo.xcprivacy` declares the same collected-data inventory and required-reason APIs. App Store Connect declarations must still be completed separately.

## Google Play Data safety

Data is **collected**, not **shared** under the Google service-provider exception, provided hosting/AI vendors only process it on WIMAX's behalf under appropriate terms.

| Google category | Data type | Collected | Shared | Required? | Purpose |
|---|---|---:|---:|---|---|
| Personal info | Name | Yes | No | Required | Account management, app functionality |
| Personal info | Email address | Yes | No | Required | Account management, app functionality |
| Personal info | User IDs | Yes | No | Required | Account management, app functionality |
| Financial info | Other financial info | Yes | No | Optional | App functionality |
| Audio files | Voice or sound recordings | Yes | No | Optional | App functionality |
| App activity | App interactions | Yes | No | Required while using service | App functionality, security |
| App activity | Other user-generated content | Yes | No | Optional | App functionality |
| Device or other IDs | Device or other IDs | Yes | No | Optional | Push notifications, security |

Processing is not ephemeral for synchronized workspace content. Audio persistence depends on the selected feature and server configuration, so do not claim all audio is ephemeral.

## Permissions disclosure

- Microphone: activated by Voice Capture or Meeting Mode.
- Notifications: coaching, briefing, meeting-processing and test notifications after user permission.
- Foreground service (Android): keeps an explicitly started meeting recording active and visible.
- Reminders (iOS): requested only when a user confirms a reminder command.
- Storage compatibility permissions (Android <= 12): imported audio compatibility; verify merged manifest at each release.

## Owner verification before submission

Replace the pending registered address and privacy contact in the Privacy Policy. Confirm contracts and retention with Vercel, Neon, OpenAI, Expo and any future speech/push provider. If a vendor uses data for its own purposes rather than solely as a processor, update “shared” answers before submission.

