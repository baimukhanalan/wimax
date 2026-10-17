# Публикация WIMAX 1.0.0: точный гайд владельца

Подготовлено 25 августа 2026. Код уже использует одинаковый iOS bundle ID и Android package: `com.cognitivemirror.app`. Не создавайте карточки с другим идентификатором.

## Что уже подготовлено в проекте

- Store-тексты на English, Russian и Kazakh.
- Черновики Apple App Privacy, Google Data safety и возрастного рейтинга.
- Публичные Privacy Policy, Terms и страница удаления аккаунта.
- Удаление аккаунта внутри web и mobile с повторным вводом пароля.
- Production EAS profile с удалёнными credentials и Android App Bundle.
- Android release больше не может случайно подписаться debug-ключом.
- iOS Privacy Manifest содержит account, audio, user content и optional financial data; tracking отключён.
- Иконки 1024 × 1024 готовы. Store screenshots и feature graphic нужно снять с финального подписанного кандидата после подключения аккаунтов.

## Шаг 0. Выберите юридический сценарий

Если IE BAI Group — ИП/sole proprietor, Apple обычно требует enrollment как **Individual**. Тогда в App Store как seller отображается юридическое ФИО владельца. Чтобы отображалось название IE BAI Group как organization seller, нужна самостоятельная организация/юрлицо, которую Apple может проверить, и D-U-N-S.

Google рекомендует **Organization** для коммерческой деятельности, но такой аккаунт тоже требует D-U-N-S. Personal имеет те же основные функции, однако новые personal-аккаунты должны пройти дополнительное тестирование: минимум 12 testers, непрерывно 14 дней, прежде чем запрашивать production access.

Практический выбор:

1. Если есть отдельное юрлицо и D-U-N-S — создавайте Apple Organization + Google Organization.
2. Если есть только ИП без подходящего D-U-N-S — Apple Individual; по Google сначала попробуйте Organization через официальную поддержку только если D-U-N-S нельзя получить в регионе, иначе Personal и планируйте закрытый тест.

## Шаг 1. Apple Developer Program

1. Включите 2FA на Apple Account владельца.
2. Откройте https://developer.apple.com/programs/enroll/.
3. Выберите Individual или Organization по шагу 0.
4. Для Individual подготовьте юридическое ФИО, адрес, телефон и документ личности.
5. Для Organization подготовьте полное юрназвание, D-U-N-S, корпоративную почту на домене, рабочий сайт и подтверждение полномочий подписанта.
6. Примите соглашение и оплатите $99 в год.
7. После активации пришлите только Apple Account email и Team ID; пароль и коды 2FA не передавайте.

## Шаг 2. App Store Connect и ownership bundle ID

1. Откройте Certificates, Identifiers & Profiles → Identifiers → `+` → App IDs → App.
2. Description: `WIMAX`.
3. Bundle ID: Explicit → `com.cognitivemirror.app`.
4. Включите Push Notifications. Остальные capabilities включайте только если Xcode/EAS запросит их.
5. Откройте https://appstoreconnect.apple.com/ → My Apps → `+` → New App.
6. Platforms: iOS; Name: WIMAX; Primary language: English (U.S.); Bundle ID: созданный `com.cognitivemirror.app`; SKU: `wimax-ios-001`.
7. Создание explicit App ID в вашей Apple Team и выбор его в App Store Connect подтверждают ownership. Сохраните Team ID и числовой Apple ID карточки.

## Шаг 3. Google Play Console и ownership package

1. Создайте отдельный Google Account владельца с 2FA.
2. Откройте https://play.google.com/console/signup.
3. Примите Developer Distribution Agreement и оплатите одноразовые $25.
4. Выберите Personal/Organization по шагу 0 и пройдите identity, email, phone и device verification. Для Organization нужны D-U-N-S, юрназвание, адрес, сайт и публичные developer contacts.
5. All apps → Create app → `WIMAX`; default language English (United States); App; Free.
6. Package name окончательно появится после первой загрузки AAB. Загрузите только сборку `com.cognitivemirror.app`; первая принятая AAB закрепляет package за приложением.
7. В App integrity включите Play App Signing и сохраните upload key через EAS. Не создавайте второй app с тем же package.

## Шаг 4. Expo/EAS credentials — безопасный рекомендуемый путь

1. Создайте/войдите в Expo account: https://expo.dev/signup.
2. На Mac в папке `apps/mobile` выполните:

   `npx eas-cli@latest login`

   `npx eas-cli@latest init`

3. После `eas init` добавьте выданный `projectId` в `app.json` как `expo.extra.eas.projectId` и сообщите Expo username/organization slug и project ID для финальной проверки.
4. Выполните `npx eas-cli@latest credentials`.
5. iOS: разрешите EAS создать/управлять Distribution Certificate, App Store provisioning profile и APNs key. Войдите в Apple только в интерактивном окне EAS и подтвердите 2FA самостоятельно.
6. Android: разрешите EAS создать новый production upload keystore. Храните его удалённо в EAS; затем включите Google Play App Signing.
7. Credentials не нужно отправлять мне файлами и нельзя коммитить. EAS повторно использует их для сборок.

## Шаг 5. Сервисный аккаунт Google для EAS Submit

Первую Android AAB обычно нужно загрузить вручную в Play Console хотя бы один раз. Затем:

1. Play Console → Users and permissions/API access → свяжите Google Cloud project.
2. Создайте service account специально для EAS Submit.
3. Дайте минимальные права для нужного приложения/релизных треков, не Owner всего Cloud project.
4. JSON key храните вне репозитория. Либо укажите локальный путь только на время `eas submit`, либо добавьте его как защищённый EAS secret по официальному процессу.
5. После первой ручной загрузки используйте `pnpm submit:store` из `apps/mobile`.

## Шаг 6. Заполните карточки магазинов

Скопируйте тексты из `apps/mobile/store/metadata/apple/` и `apps/mobile/store/metadata/google/`. Главный язык English; добавьте Russian и Kazakh localizations.

Apple:

- Primary category Productivity, secondary Business.
- Privacy URL, User Privacy Choices URL, keywords, description и review notes уже подготовлены.
- Заполните App Privacy по `PRIVACY_DECLARATIONS.md`.
- Заполните age-rating questionnaire по `AGE_RATING.md`; не угадывайте итоговый рейтинг вручную.
- В App Review Information укажите рабочий demo account, контактное лицо и телефон.

Google:

- App category Productivity; no ads; target audience 16+.
- Заполните Data safety и Content rating по подготовленным файлам.
- App access: “All or some functionality is restricted” → добавьте demo login и ясные инструкции.
- Account deletion URL: `https://cognitive-mirror-two.vercel.app/account-deletion`.
- Privacy URL: `https://cognitive-mirror-two.vercel.app/privacy`.

## Шаг 7. Production build и загрузка

После активации аккаунтов и EAS project ID:

1. Создайте отдельный review account без личных данных.
2. Из `apps/mobile`: `pnpm build:store`.
3. Проверьте iOS candidate через TestFlight на реальном iPhone и Android candidate через Internal testing на реальном Android.
4. Проверьте регистрацию, логин, микрофон, voice capture, Meeting Mode, background indicator, upload recovery, notifications, export и удаление review account.
5. Снимите screenshots именно с этого build для 6.9-inch iPhone/iPad и phone/tablet Android, подготовьте Google feature graphic 1024 × 500.
6. iOS: `pnpm submit:store` или Transporter; затем выберите build в App Store Connect и Submit for Review.
7. Android: загрузите AAB в Internal, затем Closed/Open/Production согласно доступным трекам. Для нового Personal account завершите обязательные 12 testers / 14 days до production-access form.

## Что нужно прислать мне после ваших действий

Заполните `apps/mobile/store/OWNER_INPUT_TEMPLATE_RU.md` без секретов и сообщите:

- выбранный юридический сценарий;
- Apple Team ID и App Store Connect numeric App ID;
- Google Play Developer Account ID и создана ли карточка WIMAX;
- Expo username/organization slug и EAS project ID;
- privacy/support emails, юридический адрес и срок удаления из backups;
- страны первого релиза;
- подтверждение, что Apple/Google agreements и payments завершены.

После этого я смогу самостоятельно подставить IDs, собрать оба production candidates, прогнать финальный QA, подготовить store-sized screenshots/graphics и довести загрузки до экранов, где только владелец принимает соглашения или нажимает Submit for Review.

