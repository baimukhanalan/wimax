"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type Locale = "en" | "ru" | "kk";

const localeOptions: Array<{ value: Locale; short: string; label: string }> = [
  { value: "en", short: "EN", label: "English" },
  { value: "ru", short: "RU", label: "Русский" },
  { value: "kk", short: "KZ", label: "Қазақша" },
];

const translations: Record<Exclude<Locale, "en">, Record<string, string>> = {
  ru: {
    "nav.how": "Как это работает", "nav.meetings": "Встречи", "nav.privacy": "Приватность", "nav.apps": "Приложения",
    "auth.signin": "Войти", "auth.create": "Создать аккаунт", "auth.workspace": "Создать рабочее пространство",
    "hero.title": "Думайте вслух.\nПолучайте ясность.",
    "hero.copy": "WIMAX превращает голосовые заметки, встречи и рефлексии в задачи, привычки и связанную базу знаний — мгновенно.",
    "hero.private": "Приватность по умолчанию. Ваши мысли остаются вашими.",
    "landing.scroll": "ПРОКРУТИТЕ, ЧТОБЫ ПРОСЛЕДИТЬ ПУТЬ МЫСЛИ", "landing.speech": "От речи\nк структуре",
    "landing.why": "ПОЧЕМУ WIMAX", "landing.mind": "Ваши мысли движутся быстрее, чем система продуктивности.",
    "landing.mindCopy": "Большинство инструментов заставляют остановиться, сортировать и форматировать. Mirror начинает раньше — когда мысль ещё не структурирована.",
    "landing.command": "Ваш командный центр.", "landing.commandCopy": "Всё сказанное становится организованным, доступным для поиска и готовым к работе.",
    "landing.open": "Открыть веб-приложение", "landing.privacyTitle": "Приватность заложена в основу.",
    "landing.privacyCopy": "Ваш голос — личный. Таким он и останется.", "landing.appsTitle": "WIMAX всегда с вами.",
    "landing.appsCopy": "Фиксируйте мысли в пути. Голос и система синхронизированы между устройствами.",
    "landing.final": "Думайте вслух. Получайте ясность.", "landing.finalCopy": "Откройте WIMAX и дайте мыслям полезное место.",
    "flow.0.title": "Говорите естественно", "flow.0.copy": "Расскажите вслух мысль, задачу или содержание встречи.",
    "flow.1.title": "Mirror обрабатывает", "flow.1.copy": "Система понимает контекст, намерение и даты.",
    "flow.2.title": "Готовая структура", "flow.2.copy": "Появляются задачи, привычки, идеи и записи.",
    "flow.3.title": "Связанные знания", "flow.3.copy": "Каждая новая мысль остаётся в контексте.",
    "before.title": "Одна голосовая заметка вместо десяти открытых вкладок.", "before.label": "ДО", "after.label": "ПОСЛЕ",
    "journey.label": "ПУТЬ MIRROR", "journey.title": "Скажите один раз.\nСохраните смысл.", "journey.copy": "Пять этапов превращают сырой голос в систему, которая становится полезнее со временем.",
    "journey.0.title": "Начните с голоса", "journey.0.lead": "Без шаблона и выбора категории.", "journey.0.copy": "Скажите мысль так, как она появилась. Mirror сохраняет контекст, убирая повторы и слова-паразиты.",
    "journey.1.title": "Позвольте Mirror понять", "journey.1.lead": "Одна запись может стать множеством полезных сущностей.", "journey.1.copy": "ИИ разделяет задачи, привычки, идеи, расходы и рефлексии, автоматически определяя даты и проекты.",
    "journey.2.title": "Получите ясный следующий шаг", "journey.2.lead": "Структура появляется без административной работы.", "journey.2.copy": "Задачи попадают в план, привычки — в историю, а решения остаются связанными с исходным аудио.",
    "journey.3.title": "Создавайте связанную память", "journey.3.lead": "Прошлые мысли всегда доступны.", "journey.3.copy": "Mirror связывает заметки и встречи, возвращая источник и незавершённую работу даже спустя месяцы.",
    "journey.4.title": "Замечайте закономерности", "journey.4.lead": "Неделя становится историей, на которую можно повлиять.", "journey.4.copy": "Энергия, рутины и давление превращаются в приватный брифинг с практическими рекомендациями.",
    "meeting.clean": "Встречи без потери смысла.", "meeting.cleanCopy": "Записывайте длинные разговоры и получайте таймкоды, главы и задачи, не выпадая из беседы.",
    "meeting.title": "Оставайтесь в разговоре.\nMirror сохранит нить.", "meeting.copy": "Длинные записи защищаются локально, загружаются возобновляемыми частями и превращаются в спикеров, главы, решения и задачи.",
    "use.label": "ОДНА СИСТЕМА, МНОГО СИТУАЦИЙ", "use.title": "Место для мыслей, которые обычно теряются между инструментами.",
    "use.0.title": "Мысль в движении", "use.0.copy": "Зафиксируйте её, пока она не исчезла. Mirror превратит её в идею, задачу или запись дневника.",
    "use.1.title": "Часовая встреча", "use.1.copy": "Сохраните главы, спикеров, решения и следующие шаги в одной восстанавливаемой записи.",
    "use.2.title": "Вопрос двухмесячной давности", "use.2.copy": "Спросите естественно и вернитесь к точной заметке, транскрипту и незавершённой работе.",
    "knowledge.label": "СВЯЗАННАЯ ПАМЯТЬ", "knowledge.title": "Задайте прошлому себе настоящий вопрос.", "knowledge.question": "«Что я говорил о ребрендинге два месяца назад и какие задачи ещё открыты?»", "knowledge.cta": "Создать граф знаний",
    "privacy.0.title": "Зашифрованное аудио", "privacy.0.copy": "Защищено при передаче и хранении.", "privacy.1.title": "Локально или в облаке", "privacy.1.copy": "Выберите максимальную приватность или точность.", "privacy.2.title": "Данные принадлежат вам", "privacy.2.copy": "Экспортируйте или удалите Mirror в любое время.", "privacy.3.title": "Приватно по умолчанию", "privacy.3.copy": "Без рекламы и экономики внимания.",
    "registration.title": "Один аккаунт.\nЗнакомое устройство.", "registration.copy": "Создайте аккаунт в вебе или приложении. После первого защищённого входа знакомое устройство запросит только пароль.",
    "registration.0.title": "Создайте аккаунт", "registration.0.copy": "Имя, email и пароль минимум из 10 символов.", "registration.1.title": "Подключите устройства", "registration.1.copy": "Мобильные токены хранятся в Keychain или Android Keystore.", "registration.2.title": "Возвращайтесь быстрее", "registration.2.copy": "Браузер запоминает устройство, не сохраняя пароль.",
    "workspace.home": "Главная", "workspace.voice": "Голосовой inbox", "workspace.today": "Сегодня", "workspace.tasks": "Задачи",
    "workspace.databases": "Базы данных", "workspace.analytics": "Аналитика", "workspace.knowledge": "База знаний", "workspace.patterns": "Паттерны",
    "workspace.meetings": "Встречи", "workspace.settings": "Настройки", "workspace.search": "Поиск", "workspace.newPage": "Новая страница",
    "workspace.favorites": "Избранное", "workspace.private": "Личное", "workspace.saved": "Сохранено",
    "db.title": "Проекты и задачи", "db.subtitle": "Рабочая база", "db.table": "Таблица", "db.board": "Доска", "db.timeline": "Таймлайн",
    "db.calendar": "Календарь", "db.chart": "Диаграммы", "db.filter": "Фильтр", "db.sort": "Сортировка", "db.group": "Группа",
    "db.properties": "Свойства", "db.search": "Поиск", "db.new": "Новая", "db.name": "Название", "db.status": "Статус",
    "db.owner": "Ответственный", "db.project": "Проект", "db.due": "Срок", "db.priority": "Приоритет", "db.progress": "Прогресс", "db.relation": "Связь",
    "analytics.title": "Аналитика", "analytics.subtitle": "Прогресс и нагрузка", "analytics.progress": "Прогресс во времени",
    "analytics.workload": "Нагрузка по ответственным", "analytics.completion": "Выполнено", "analytics.metrics": "Ключевые показатели",
    "settings.title": "Настройки", "settings.language": "Язык и регион", "settings.languageCopy": "Выберите язык интерфейса. Настройка сохранится на этом устройстве.",
    "settings.default": "По умолчанию", "settings.active": "Активен", "settings.appearance": "Оформление", "settings.notifications": "Уведомления",
    "settings.integrations": "Интеграции", "settings.data": "Экспорт данных", "settings.region": "Регион и форматы",
    "voice.title": "Скажите WIMAX, что сделать", "voice.copy": "Создавайте, обновляйте, ищите или записывайте встречу, не покидая страницу.",
    "voice.listening": "Слушаю…", "voice.meeting": "Записываю встречу…", "voice.processing": "Превращаю речь в действие…",
    "voice.recordingCopy": "Говорите естественно. WIMAX сохранит исходное аудио и структурирует его после остановки.", "voice.processingCopy": "Распознаю речь, определяю намерение и связываю результат с рабочим пространством.",
    "voice.stop": "Остановить и обработать", "voice.detected": "Определено", "voice.addTask": "Добавить задачу", "voice.update": "Изменить строку",
    "voice.find": "Найти заметку", "voice.recordMeeting": "Записать встречу", "voice.type": "Или введите команду…", "voice.private": "Аудио шифруется, когда включено защищённое хранение",
    "voice.meetingSafe": "Локальное сохранение каждые 30 секунд · загрузка возобновится автоматически", "voice.pendingMeeting": "сохранённая встреча ожидает восстановления загрузки",
  },
  kk: {
    "nav.how": "Қалай жұмыс істейді", "nav.meetings": "Кездесулер", "nav.privacy": "Құпиялық", "nav.apps": "Қосымшалар",
    "auth.signin": "Кіру", "auth.create": "Тіркелгі ашу", "auth.workspace": "Жұмыс кеңістігін ашу",
    "hero.title": "Дауыстап ойлаңыз.\nАйқындыққа жетіңіз.",
    "hero.copy": "WIMAX дауыс жазбаларын, кездесулер мен ой-толғауларды тапсырмаларға, әдеттерге және байланысқан білімге бірден айналдырады.",
    "hero.private": "Құпиялық әдепкіде қосулы. Ойларыңыз өзіңізде қалады.",
    "landing.scroll": "ОЙДЫҢ ЖОЛЫН КӨРУ ҮШІН ТӨМЕН ЖЫЛЖЫТЫҢЫЗ", "landing.speech": "Сөзден\nқұрылымға",
    "landing.why": "НЕЛІКТЕН WIMAX", "landing.mind": "Ойыңыз өнімділік жүйесінен жылдамырақ қозғалады.",
    "landing.mindCopy": "Көп құрал сізді тоқтап, сұрыптап, пішімдеуге мәжбүрлейді. Mirror ой әлі құрылымдалмаған сәттен бастайды.",
    "landing.command": "Сіздің басқару орталығыңыз.", "landing.commandCopy": "Айтқаныңыздың бәрі реттеліп, іздеуге және жұмысқа дайын болады.",
    "landing.open": "Веб-қосымшаны ашу", "landing.privacyTitle": "Құпиялық негізден басталады.",
    "landing.privacyCopy": "Даусыңыз — жеке. Біз оны солай сақтаймыз.", "landing.appsTitle": "WIMAX әрдайым жаныңызда.",
    "landing.appsCopy": "Жолда да ойларыңызды жазыңыз. Дауыс пен жүйе барлық құрылғыда синхрондалады.",
    "landing.final": "Дауыстап ойлаңыз. Айқындыққа жетіңіз.", "landing.finalCopy": "WIMAX-ты ашып, ойларыңызға пайдалы орын беріңіз.",
    "flow.0.title": "Табиғи сөйлеңіз", "flow.0.copy": "Ойыңызды, тапсырманы немесе кездесуді дауыстап айтыңыз.",
    "flow.1.title": "Mirror өңдейді", "flow.1.copy": "Контекст, ниет және күндер түсініледі.",
    "flow.2.title": "Дайын құрылым", "flow.2.copy": "Тапсырмалар, әдеттер, идеялар мен жазбалар пайда болады.",
    "flow.3.title": "Байланысқан білім", "flow.3.copy": "Әр жаңа ой өз контекстінде қалады.",
    "before.title": "Он ашық бет орнына бір дауыс жазбасы.", "before.label": "БҰРЫН", "after.label": "КЕЙІН",
    "journey.label": "MIRROR ЖОЛЫ", "journey.title": "Бір рет айтыңыз.\nМағынасын сақтаңыз.", "journey.copy": "Бес кезең шикі дауысты уақыт өте пайдалырақ болатын жүйеге айналдырады.",
    "journey.0.title": "Дауыстан бастаңыз", "journey.0.lead": "Үлгі де, санат таңдау да жоқ.", "journey.0.copy": "Ойды пайда болған қалпында айтыңыз. Mirror контекстті сақтап, қайталауларды алып тастайды.",
    "journey.1.title": "Mirror түсінсін", "journey.1.lead": "Бір жазба көптеген пайдалы нысанға айналады.", "journey.1.copy": "ЖИ тапсырмалар, әдеттер, идеялар, шығындар мен рефлексияларды бөліп, күндер мен жобаларды анықтайды.",
    "journey.2.title": "Келесі қадамды біліңіз", "journey.2.lead": "Құрылым әкімшілік жұмыссыз пайда болады.", "journey.2.copy": "Тапсырмалар жоспарға, әдеттер тарихқа түседі, ал шешімдер бастапқы аудиомен байланыста қалады.",
    "journey.3.title": "Байланысқан жады құрыңыз", "journey.3.lead": "Өткен ойлар әрдайым қолжетімді.", "journey.3.copy": "Mirror жазбалар мен кездесулерді байланыстырып, айлардан кейін де дереккөз бен аяқталмаған жұмысты қайтарады.",
    "journey.4.title": "Үлгілерді байқаңыз", "journey.4.lead": "Апта әрекет етуге болатын оқиғаға айналады.", "journey.4.copy": "Энергия, күнделікті әдеттер мен қысым жеке брифинг пен практикалық кеңестерге айналады.",
    "meeting.clean": "Мағынасы жоғалмайтын кездесулер.", "meeting.cleanCopy": "Ұзақ әңгімені жазып, сұхбаттан шықпай-ақ уақыт белгілерін, тарауларды және тапсырмаларды алыңыз.",
    "meeting.title": "Әңгімеде қалыңыз.\nMirror желіні сақтайды.", "meeting.copy": "Ұзақ жазбалар жергілікті қорғалып, жалғастырылатын бөліктермен жүктеледі де, спикерлерге, тарауларға, шешімдер мен тапсырмаларға айналады.",
    "use.label": "БІР ЖҮЙЕ, КӨП ЖАҒДАЙ", "use.title": "Құралдардың арасында жоғалатын ойларға арналған орын.",
    "use.0.title": "Жолдағы ой", "use.0.copy": "Жоғалмай тұрғанда жазып алыңыз. Mirror оны идеяға, тапсырмаға немесе күнделік жазбасына айналдырады.",
    "use.1.title": "Бір сағаттық кездесу", "use.1.copy": "Тарауларды, спикерлерді, шешімдер мен келесі қадамдарды бір қалпына келетін жазбада сақтаңыз.",
    "use.2.title": "Екі ай бұрынғы сұрақ", "use.2.copy": "Табиғи түрде сұрап, нақты жазбаға, транскриптке және аяқталмаған жұмысқа оралыңыз.",
    "knowledge.label": "БАЙЛАНЫСҚАН ЖАДЫ", "knowledge.title": "Өткен өзіңізге нақты сұрақ қойыңыз.", "knowledge.question": "«Екі ай бұрын ребрендинг туралы не айттым және қай тапсырмалар ашық қалды?»", "knowledge.cta": "Білім графын құру",
    "privacy.0.title": "Шифрланған аудио", "privacy.0.copy": "Тасымалдау мен сақтау кезінде қорғалған.", "privacy.1.title": "Жергілікті не бұлтта", "privacy.1.copy": "Құпиялықты немесе ең жоғары дәлдікті таңдаңыз.", "privacy.2.title": "Деректер сіздікі", "privacy.2.copy": "Mirror деректерін кез келген уақытта экспорттаңыз не жойыңыз.", "privacy.3.title": "Әдепкіде құпия", "privacy.3.copy": "Жарнамасыз және назар экономикасынсыз.",
    "registration.title": "Бір тіркелгі.\nТаныс құрылғы.", "registration.copy": "Тіркелгіні вебте немесе қолданбада ашыңыз. Алғашқы қауіпсіз кіруден кейін таныс құрылғы тек құпиясөзді сұрайды.",
    "registration.0.title": "Тіркелгі ашыңыз", "registration.0.copy": "Аты, email және кемінде 10 таңбалы құпиясөз.", "registration.1.title": "Құрылғыларды қосыңыз", "registration.1.copy": "Мобильді токендер Keychain немесе Android Keystore ішінде сақталады.", "registration.2.title": "Жылдам оралыңыз", "registration.2.copy": "Браузер құпиясөзді сақтамай, құрылғыны есте ұстайды.",
    "workspace.home": "Басты бет", "workspace.voice": "Дауыс inbox", "workspace.today": "Бүгін", "workspace.tasks": "Тапсырмалар",
    "workspace.databases": "Дерекқорлар", "workspace.analytics": "Талдау", "workspace.knowledge": "Білім қоры", "workspace.patterns": "Үлгілер",
    "workspace.meetings": "Кездесулер", "workspace.settings": "Баптаулар", "workspace.search": "Іздеу", "workspace.newPage": "Жаңа бет",
    "workspace.favorites": "Таңдаулылар", "workspace.private": "Жеке", "workspace.saved": "Сақталды",
    "db.title": "Жобалар мен тапсырмалар", "db.subtitle": "Жұмыс дерекқоры", "db.table": "Кесте", "db.board": "Тақта", "db.timeline": "Уақыт сызығы",
    "db.calendar": "Күнтізбе", "db.chart": "Диаграммалар", "db.filter": "Сүзгі", "db.sort": "Сұрыптау", "db.group": "Топтау",
    "db.properties": "Қасиеттер", "db.search": "Іздеу", "db.new": "Жаңа", "db.name": "Атауы", "db.status": "Күйі",
    "db.owner": "Жауапты", "db.project": "Жоба", "db.due": "Мерзімі", "db.priority": "Басымдық", "db.progress": "Прогресс", "db.relation": "Байланыс",
    "analytics.title": "Талдау", "analytics.subtitle": "Прогресс пен жүктеме", "analytics.progress": "Уақыт бойынша прогресс",
    "analytics.workload": "Жауаптылардың жүктемесі", "analytics.completion": "Орындалуы", "analytics.metrics": "Негізгі көрсеткіштер",
    "settings.title": "Баптаулар", "settings.language": "Тіл және аймақ", "settings.languageCopy": "Интерфейс тілін таңдаңыз. Таңдау осы құрылғыда сақталады.",
    "settings.default": "Әдепкі", "settings.active": "Белсенді", "settings.appearance": "Көрініс", "settings.notifications": "Хабарландырулар",
    "settings.integrations": "Интеграциялар", "settings.data": "Деректерді экспорттау", "settings.region": "Аймақ және пішімдер",
    "voice.title": "WIMAX-қа не істеу керегін айтыңыз", "voice.copy": "Осы беттен шықпай-ақ құрыңыз, жаңартыңыз, іздеңіз немесе кездесуді жазыңыз.",
    "voice.listening": "Тыңдап тұрмын…", "voice.meeting": "Кездесуді жазып тұрмын…", "voice.processing": "Сөзді әрекетке айналдырып жатырмын…",
    "voice.recordingCopy": "Еркін сөйлеңіз. WIMAX бастапқы аудионы сақтап, тоқтатқаннан кейін құрылымдайды.", "voice.processingCopy": "Сөзді танып, ниетті анықтап, нәтижені жұмыс кеңістігімен байланыстырып жатырмын.",
    "voice.stop": "Тоқтату және өңдеу", "voice.detected": "Анықталды", "voice.addTask": "Тапсырма қосу", "voice.update": "Жолды жаңарту",
    "voice.find": "Жазбаны табу", "voice.recordMeeting": "Кездесуді жазу", "voice.type": "Немесе пәрменді теріңіз…", "voice.private": "Қорғалған сақтау қосылғанда аудио шифрланады",
    "voice.meetingSafe": "Әр 30 секунд сайын жергілікті сақталады · жүктеу автоматты жалғасады", "voice.pendingMeeting": "сақталған кездесу жүктеуді қалпына келтіруді күтуде",
  },
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const localeSubscribers = new Set<() => void>();

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("wimax.locale.v1");
  return stored === "ru" || stored === "kk" ? stored : "en";
}

function subscribeToLocale(callback: () => void) {
  localeSubscribers.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === "wimax.locale.v1") callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    localeSubscribers.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, readStoredLocale, (): Locale => "en");
  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem("wimax.locale.v1", next);
    localeSubscribers.forEach((callback) => callback());
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key, fallback) => locale === "en" ? fallback : translations[locale][key] || fallback,
  }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const active = localeOptions.find((option) => option.value === locale) || localeOptions[0];
  return <div className={`language-menu ${open ? "is-open" : ""}`}>
    <button className="language-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Choose language">
      <Globe2 />{compact ? null : <span>{active.short}</span>}<ChevronDown />
    </button>
    {open ? <div className="language-popover" role="menu">
      {localeOptions.map((option) => <button key={option.value} role="menuitemradio" aria-checked={locale === option.value} onClick={() => { setLocale(option.value); setOpen(false); }}>
        <span>{option.short}</span><strong>{option.label}</strong>{locale === option.value ? <Check /> : null}
      </button>)}
    </div> : null}
  </div>;
}

export const supportedLocales = localeOptions;
