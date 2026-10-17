import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import {
  AudioModule, RecordingPresets, createAudioPlayer, setAudioModeAsync, useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Notifications from "expo-notifications";
import { Feather } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  captureResponseSchema, dashboardResponseSchema,
  type CaptureResponse, type DashboardResponse,
} from "@cognitive-mirror/contracts";
import MirrorSystemCapture from "./modules/mirror-system-capture/src/MirrorSystemCaptureModule";
import { enqueueMeeting, flushMeetingQueue, readMeetingQueue, registerMeetingUploadRecovery } from "./lib/meeting-queue";
import { getMobileToken, mobileApiUrl, registerMobile, signInMobile, signOutMobile } from "./lib/auth";

type Variant = "capture" | "ritual";
type Tab = "Home" | "Search" | "Voice" | "Inbox" | "New" | "Settings";

const bars = [9, 14, 22, 34, 48, 35, 18, 12, 25, 42, 29, 16, 33, 51, 30, 17, 11, 20, 34, 23, 13];

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

const demo: DashboardResponse = {
  captures: [{ id: "demo", summary: "Morning movement improved clarity; launch pressure remains.", dominant_sentiment: "ANXIOUS", energy_score: 6, raw_text_cleaned: "Clearer after movement. Still carrying pressure about the launch.", transcript: null, source: "DEMO", processing_mode: "CLOUD", audio_available: false, created_at: new Date().toISOString() }],
  tasks: [{ id: "task-1", capture_id: "demo", title: "Send marketing report", project: "Marketing", due_date: new Date(Date.now() + 3_600_000).toISOString(), priority: "HIGH", action_items: ["Check the final campaign totals"], status: "OPEN", created_at: new Date().toISOString(), completed_at: null }],
  habits: [{ id: "habit-1", capture_id: "demo", habit_name: "Morning run", status: "COMPLETED", metric_value: 5, metric_unit: "km", notes: "Energy rises after movement.", event_date: new Date().toISOString().slice(0, 10), occurred_at: new Date().toISOString() }],
  knowledge: [{ id: "note-1", capture_id: "demo", topic: "Launch pressure", category: "REFLECTIONS", content: "Launch-related thoughts have appeared for three days.", tags: ["launch", "energy"], created_at: new Date().toISOString() }],
  financial_transactions: [],
  energy: [], stats: { open_tasks: 1, completed_habits: 1, knowledge_notes: 1, current_streak: 4 }, persisted: false,
};

export default function App() {
  return <SafeAreaProvider><MirrorApp /></SafeAreaProvider>;
}

function MirrorApp() {
  const [authState, setAuthState] = useState<"LOADING" | "SIGNED_OUT" | "READY">("LOADING");
  useEffect(() => { void getMobileToken().then((token) => setAuthState(token ? "READY" : "SIGNED_OUT")); }, []);
  if (authState === "LOADING") return <View style={styles.authScreen}><ActivityIndicator color="#1B1B1B" /></View>;
  if (authState === "SIGNED_OUT") return <SignInScreen onConnected={() => setAuthState("READY")} />;
  return <AuthenticatedMirrorApp onSignedOut={() => setAuthState("SIGNED_OUT")} />;
}

function SignInScreen({ onConnected }: { onConnected: () => void }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  async function connect() {
    if (!account.trim() || !password.trim() || busy || (mode === "register" && (!name.trim() || password !== confirm || !accepted))) return;
    setBusy(true);
    try {
      if (mode === "register") await registerMobile({ name, email: account, password });
      else await signInMobile(account, password);
      onConnected();
    }
    catch (error) { Alert.alert(mode === "register" ? "Could not create account" : "Could not connect", error instanceof Error ? error.message : "Please try again"); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.authScreen}>
    <View style={styles.authMark}><Feather name="activity" size={30} color="#B94716" /></View>
    <Text style={styles.authTitle}>{mode === "register" ? "Create your WIMAX workspace" : "Connect to WIMAX"}</Text>
    <Text style={styles.authCopy}>{mode === "register" ? "One private account keeps voice notes, habits and meetings connected across mobile and web." : "Sign in once. Your expiring token stays protected in Keychain or Android Keystore."}</Text>
    {mode === "register" ? <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" placeholderTextColor="#8A9690" style={styles.authInput} /> : null}
    <TextInput accessibilityLabel="Email or WIMAX account" value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} keyboardType={mode === "register" ? "email-address" : "default"} placeholder={mode === "register" ? "Email" : "Email or WIMAX account"} placeholderTextColor="#8A9690" style={styles.authInput} />
    <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Password" placeholderTextColor="#8A9690" style={styles.authInput} onSubmitEditing={() => mode === "signin" ? void connect() : undefined} />
    {mode === "register" ? <TextInput accessibilityLabel="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Confirm password" placeholderTextColor="#8A9690" style={styles.authInput} onSubmitEditing={() => void connect()} /> : null}
    {mode === "register" ? <View style={styles.authLegal}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)}><Feather name={accepted ? "check-square" : "square"} size={19} color={accepted ? "#FF6B2C" : "#6C7B74"} /></Pressable><Text style={styles.authLegalText}>I agree to the <Text style={styles.authLegalLink} onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/terms")}>Terms</Text> and acknowledge the <Text style={styles.authLegalLink} onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/privacy")}>Privacy Policy</Text>, including lawful meeting-recording rules.</Text></View> : null}
    <Pressable accessibilityRole="button" onPress={() => void connect()} disabled={busy || !account.trim() || password.length < (mode === "register" ? 10 : 1) || (mode === "register" && (!name.trim() || password !== confirm || !accepted))} style={[styles.authButton, (busy || !account.trim() || !password.trim() || (mode === "register" && !accepted)) && styles.authButtonDisabled]}>
      {busy ? <ActivityIndicator color="white" /> : <Text style={styles.authButtonText}>{mode === "register" ? "Create account" : "Connect securely"}</Text>}
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => { setMode(mode === "signin" ? "register" : "signin"); setPassword(""); setConfirm(""); setAccepted(false); }} style={styles.authSwitch}><Text style={styles.authSwitchText}>{mode === "register" ? "Already have an account? Sign in" : "New to WIMAX? Create an account"}</Text></Pressable>
  </SafeAreaView>;
}

function AuthenticatedMirrorApp({ onSignedOut }: { onSignedOut: () => void }) {
  const [variant, setVariant] = useState<Variant>("capture");
  const [tab, setTab] = useState<Tab>("Home");
  const [data, setData] = useState<DashboardResponse>(demo);
  const capture = useVoiceCapture(() => void loadDashboard());
  const meeting = useMeetingMode();
  const { width } = useWindowDimensions();

  async function loadDashboard() {
    const token = await getMobileToken();
    if (!token) return;
    try {
      const response = await fetch(`${mobileApiUrl()}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setData(dashboardResponseSchema.parse(await response.json()));
    } catch { /* Keep the last local state while offline. */ }
  }

  useEffect(() => {
    void loadDashboard(); void registerMeetingUploadRecovery(); void flushMeetingQueue(); void registerPushNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void (async () => {
      const audioPath = response.notification.request.content.data?.audio_path;
      const screen = response.notification.request.content.data?.screen;
      if (screen === "Inbox") setTab("Inbox");
      const token = await getMobileToken();
      if (typeof audioPath === "string" && token) {
        const player = createAudioPlayer({ uri: `${mobileApiUrl()}${audioPath}`, headers: { Authorization: `Bearer ${token}` } });
        player.play(); setTimeout(() => player.release(), 180_000);
      }
    })(); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    async function beginExternalCapture() {
      setTab("Voice"); setVariant("capture");
      if (!capture.recording && !capture.processing) await capture.toggle();
    }
    async function consumeSystemAction() {
      const action = await MirrorSystemCapture.consumePendingActionAsync();
      if (action === "capture") await beginExternalCapture();
      if (action === "meeting" && !meeting.recording) await meeting.startWithConsent();
    }
    function handleUrl(url: string | null) { if (url?.startsWith("cognitivemirror://capture")) void beginExternalCapture(); }
    void consumeSystemAction();
    void Linking.getInitialURL().then(handleUrl);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void consumeSystemAction(); });
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => { subscription.remove(); linkingSubscription.remove(); };
  }, [capture.processing, capture.recording]);

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <StatusBar style="dark" />
    <View style={styles.modeRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open home" style={styles.brandRow} onPress={() => setTab("Home")}><View style={styles.brandMark}><Feather name="activity" size={17} color="#B94716" /></View><View><Text style={styles.brand}>WIMAX</Text><Text style={styles.mobileWorkspaceMeta}>{tab === "Voice" ? "Voice workspace" : "Alan’s workspace"}</Text></View></Pressable>
      {tab === "Voice" ? <View style={styles.modeSwitch}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: variant === "capture" }} accessibilityLabel="Capture mode" onPress={() => setVariant("capture")} style={[styles.modeChoice, variant === "capture" && styles.modeChoiceActive]}><Text style={[styles.modeText, variant === "capture" && styles.modeTextActive]}>Capture</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: variant === "ritual" }} accessibilityLabel="Ritual mode" onPress={() => setVariant("ritual")} style={[styles.modeChoice, variant === "ritual" && styles.modeChoiceActive]}><Text style={[styles.modeText, variant === "ritual" && styles.modeTextActive]}>Ritual</Text></Pressable>
      </View> : <View style={styles.mobileHeaderActions}><Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => setTab("Search")}><Feather name="search" size={19} color="#52635A" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open inbox" onPress={() => setTab("Inbox")}><Feather name="bell" size={19} color="#52635A" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => setTab("Settings")}><Feather name="settings" size={19} color="#52635A" /></Pressable></View>}
    </View>

    {tab === "Home" ? <MobileWorkspaceHome data={data} capture={capture} onOpen={setTab} /> : tab === "Voice" ? variant === "capture"
      ? <CaptureScreen capture={capture} meeting={meeting} data={data} compact={width < 370} />
      : <RitualScreen capture={capture} data={data} compact={width < 370} />
      : tab === "Search" ? <MobileSearch data={data} /> : tab === "Inbox" ? <MobileInbox data={data} /> : tab === "Settings" ? <MobileSettings onSignedOut={onSignedOut} /> : <MobileNewPage capture={capture} />}

    {capture.result ? <ReviewSheet result={capture.result} onExecuteCommands={capture.executeCommands} onClose={capture.closeReview} /> : null}
    <BottomTabs tab={tab} onChange={setTab} />
  </SafeAreaView>;
}

function MobileWorkspaceHome({ data, capture, onOpen }: { data: DashboardResponse; capture: ReturnType<typeof useVoiceCapture>; onOpen: (tab: Tab) => void }) {
  const pages = [
    { title: "Launch narrative", meta: "Edited from your voice · now", icon: "file-text" as const },
    { title: "Projects & tasks", meta: `${data.stats.open_tasks} open items`, icon: "check-square" as const },
    { title: "Daily reflections", meta: `${data.captures.length} connected captures`, icon: "book-open" as const },
  ];
  return <ScrollView style={styles.screen} contentContainerStyle={styles.mobileHomeContent} bounces={false}>
    <Text style={styles.mobileDate}>MONDAY · 24 AUGUST</Text><Text style={styles.mobileHomeTitle}>Good morning, Alan</Text><Text style={styles.mobileHomeCopy}>Your workspace is already organised from what you said.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={capture.recording ? "Stop recording" : "Start voice capture"} onPress={() => { onOpen("Voice"); if (!capture.recording && !capture.processing) void capture.toggle(); }} style={styles.mobileVoiceHero}><View style={styles.mobileVoiceIcon}><Feather name="mic" size={25} color="white" /></View><View style={styles.mobileVoiceCopy}><Text style={styles.mobileVoiceLabel}>VOICE CAPTURE</Text><Text style={styles.mobileVoiceTitle}>Speak. WIMAX builds the workspace.</Text><Text style={styles.mobileVoiceMeta}>Tasks · pages · habits · meetings</Text></View><Feather name="arrow-right" size={20} color="#A8C3B6" /></Pressable>
    <View style={styles.mobileSectionHeading}><Text style={styles.mobileSectionHeadingText}>Jump back in</Text><Pressable accessibilityRole="button" accessibilityLabel="Search all workspace content" onPress={() => onOpen("Search")}><Text style={styles.mobileSectionLink}>Search all</Text></Pressable></View>
    <View style={styles.mobilePageList}>{pages.map((page, index) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${page.title}`} key={page.title} onPress={() => onOpen(index === 1 ? "Inbox" : "New")} style={styles.mobilePageRow}><View style={styles.mobilePageIcon}><Feather name={page.icon} size={18} color="#1B1B1B" /></View><View style={styles.mobilePageRowCopy}><Text style={styles.mobilePageTitle}>{page.title}</Text><Text style={styles.mobilePageMeta}>{page.meta}</Text></View><Feather name="chevron-right" size={17} color="#9BA69F" /></Pressable>)}</View>
    <View style={styles.mobileSectionHeading}><Text style={styles.mobileSectionHeadingText}>Today</Text><Pressable accessibilityRole="button" accessibilityLabel="Open today's tasks" onPress={() => onOpen("Inbox")}><Text style={styles.mobileSectionLink}>{data.stats.open_tasks} open</Text></Pressable></View>
    <View style={styles.mobileDatabase}>{data.tasks.slice(0, 4).map((task) => <View key={task.id} style={styles.mobileDatabaseRow}><Feather name={task.status === "COMPLETED" ? "check-circle" : "circle"} size={18} color={task.status === "COMPLETED" ? "#1B1B1B" : "#FF6B2C"} /><View style={styles.mobileDatabaseRowCopy}><Text numberOfLines={1} style={styles.mobileDatabaseTitle}>{task.title}</Text><Text style={styles.mobileDatabaseMeta}>{task.project} · {task.priority}</Text></View><Text style={styles.mobileDatabaseTime}>{task.due_date ? timeOnly(task.due_date) : "Anytime"}</Text></View>)}</View>
    <View style={styles.mobileCoach}><Feather name="sun" size={22} color="#B8AFA3" /><View style={styles.mobileCoachCopy}><Text style={styles.mobileCoachLabel}>MIRROR NOTICED</Text><Text style={styles.mobileCoachText}>{data.knowledge[0]?.content || "Morning movement is followed by clearer captures."}</Text></View></View><View style={styles.bottomSpacer} />
  </ScrollView>;
}

function MobileSearch({ data }: { data: DashboardResponse }) {
  const [query, setQuery] = useState("");
  const items = [...data.knowledge.map((item) => ({ title: item.topic, copy: item.content, kind: "Page" })), ...data.tasks.map((item) => ({ title: item.title, copy: item.project, kind: "Task" })), ...data.captures.map((item) => ({ title: item.summary, copy: item.raw_text_cleaned, kind: "Voice" }))].filter((item) => !query.trim() || `${item.title} ${item.copy}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.mobileToolContent} keyboardShouldPersistTaps="handled"><Text style={styles.mobileToolTitle}>Search</Text><View style={styles.mobileSearchBox}><Feather name="search" size={18} color="#6A7A72" /><TextInput style={styles.mobileSearchInput} autoFocus value={query} onChangeText={setQuery} placeholder="Search pages, tasks and voice…" placeholderTextColor="#8A9690" /></View><Text style={styles.mobileToolKicker}>{query ? `${items.length} RESULTS` : "RECENT & CONNECTED"}</Text>{items.map((item, index) => <View key={`${item.kind}-${index}`} style={styles.mobileSearchResult}><View style={styles.mobilePageIcon}><Feather name={item.kind === "Task" ? "check-square" : item.kind === "Voice" ? "mic" : "file-text"} size={17} color="#1B1B1B" /></View><View style={styles.mobileSearchResultCopy}><Text style={styles.mobileSearchResultTitle}>{item.title}</Text><Text numberOfLines={2} style={styles.mobileSearchResultText}>{item.copy}</Text><Text style={styles.mobileSearchResultKind}>{item.kind}</Text></View></View>)}<View style={styles.bottomSpacer} /></ScrollView>;
}

function MobileInbox({ data }: { data: DashboardResponse }) {
  const [filter, setFilter] = useState<"All" | "Tasks" | "Pages" | "Voice">("All");
  const [pushBusy, setPushBusy] = useState(false);
  const testPush = async () => {
    setPushBusy(true);
    try {
      const result = await registerPushNotifications(true);
      Alert.alert(result.remote ? "Push notifications enabled" : "Notification preview ready", result.remote ? "This device is registered for WIMAX updates." : "Local notifications work. Remote delivery will activate when the EAS project is connected.");
    } catch (error) { Alert.alert("Notifications unavailable", error instanceof Error ? error.message : "Please try again"); }
    finally { setPushBusy(false); }
  };
  const items = [...data.tasks.map((item) => ({ title: item.title, meta: `${item.project} · ${item.priority}`, icon: "check-square" as const, kind: "Tasks" as const })), ...data.knowledge.map((item) => ({ title: item.topic, meta: item.category, icon: "file-text" as const, kind: "Pages" as const })), ...data.captures.map((item) => ({ title: item.summary, meta: `${item.energy_score}/10 energy`, icon: "mic" as const, kind: "Voice" as const }))].filter((item) => filter === "All" || item.kind === filter);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.mobileToolContent}><Text style={styles.mobileToolTitle}>Inbox</Text><Text style={styles.mobileToolIntro}>Everything WIMAX extracted from your voice, ready to review.</Text><Pressable accessibilityRole="button" accessibilityLabel="Enable and test push notifications" disabled={pushBusy} onPress={() => void testPush()} style={styles.notificationCard}><View style={styles.notificationIcon}><Feather name="bell" size={20} color="white" /></View><View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{pushBusy ? "Connecting notifications…" : "Enable smart notifications"}</Text><Text style={styles.notificationMeta}>Meeting ready · Weekly briefing · Coaching insight</Text></View><Feather name="chevron-right" size={18} color="#A8C3B6" /></Pressable><View style={styles.mobileInboxTabs}>{(["All", "Tasks", "Pages", "Voice"] as const).map((label) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === label }} key={label} onPress={() => setFilter(label)}><Text style={filter === label ? styles.mobileInboxTabActive : undefined}>{label}</Text></Pressable>)}</View>{items.slice(0, 16).map((item, index) => <View key={`${item.title}-${index}`} style={styles.mobileInboxRow}><View style={styles.mobilePageIcon}><Feather name={item.icon} size={17} color="#1B1B1B" /></View><View style={styles.mobileInboxRowCopy}><Text style={styles.mobileInboxTitle}>{item.title}</Text><Text style={styles.mobileInboxMeta}>{item.meta}</Text></View><Feather name="chevron-right" size={16} color="#9BA69F" /></View>)}<View style={styles.bottomSpacer} /></ScrollView>;
}

function MobileNewPage({ capture }: { capture: ReturnType<typeof useVoiceCapture> }) {
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [saved, setSaved] = useState(false);
  const draftFile = useMemo(() => new File(Paths.document, "wimax-new-page-draft.json"), []);
  useEffect(() => { if (!draftFile.exists) return; try { const draft = JSON.parse(draftFile.textSync()) as { title?: string; body?: string }; setTitle(draft.title || ""); setBody(draft.body || ""); setSaved(true); } catch { /* start with a clean draft */ } }, [draftFile]);
  const append = (value: string) => { setBody((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${value}`); setSaved(false); };
  const attachFile = async () => { const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }); if (!picked.canceled) append(`[File: ${picked.assets[0].name}]`); };
  const save = () => { draftFile.write(JSON.stringify({ title: title.trim() || "Untitled", body })); setSaved(true); };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.mobileEditorContent} keyboardShouldPersistTaps="handled"><View style={styles.mobileEditorIcon}><Feather name="file-text" size={24} color="#1B1B1B" /></View><TextInput accessibilityLabel="Page title" value={title} onChangeText={(value) => { setTitle(value); setSaved(false); }} placeholder="Untitled" placeholderTextColor="#9BA49F" style={styles.mobileEditorTitle} /><View style={styles.mobileEditorProperties}><Text>Status</Text><Text>{saved ? "Saved locally" : "Draft"}</Text><Text>Created by</Text><Text>You + WIMAX</Text></View><TextInput accessibilityLabel="Page content" value={body} onChangeText={(value) => { setBody(value); setSaved(false); }} placeholder="Start writing, or let your voice fill this page…" placeholderTextColor="#919C96" multiline style={styles.mobileEditorBody} /><Pressable accessibilityRole="button" accessibilityLabel={capture.recording ? "Stop page voice capture" : "Capture into this page"} onPress={() => void capture.toggle()} style={[styles.mobileEditorVoice, capture.recording && styles.mobileEditorVoiceActive]}><Feather name={capture.recording ? "square" : "mic"} size={20} color="white" /><View style={styles.mobileEditorVoiceCopy}><Text style={styles.mobileEditorVoiceTitle}>{capture.recording ? "Listening…" : "Capture into this page"}</Text><Text style={styles.mobileEditorVoiceMeta}>WIMAX will add structured blocks</Text></View></Pressable><View style={styles.mobileBlockBar}><Pressable accessibilityRole="button" onPress={() => append("New block")} style={styles.mobileBlockAction}><Feather name="plus" size={17} color="#65776D" /><Text>Block</Text></Pressable><Pressable accessibilityRole="button" onPress={() => append("☐ ")} style={styles.mobileBlockAction}><Feather name="check-square" size={17} color="#65776D" /><Text>To-do</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void attachFile()} style={styles.mobileBlockAction}><Feather name="paperclip" size={17} color="#65776D" /><Text>File</Text></Pressable><Pressable accessibilityRole="button" onPress={() => append("@")} style={styles.mobileBlockAction}><Feather name="at-sign" size={17} color="#65776D" /><Text>Mention</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel="Save page draft" onPress={save} style={styles.save}><Text style={styles.saveText}>{saved ? "Saved" : "Save page"}</Text></Pressable><View style={styles.bottomSpacer} /></ScrollView>;
}

function CaptureScreen({ capture, meeting, data, compact }: { capture: ReturnType<typeof useVoiceCapture>; meeting: ReturnType<typeof useMeetingMode>; data: DashboardResponse; compact: boolean }) {
  const task = data.tasks[0];
  const recent = useMemo(() => [
    ...data.tasks.slice(0, 1).map((item) => ({ type: "Task", icon: "check-square" as const, tone: "coral" as const, title: item.title, meta: item.due_date ? timeOnly(item.due_date) : item.project })),
    ...data.habits.slice(0, 1).map((item) => ({ type: "Habit", icon: "activity" as const, tone: "sage" as const, title: `${item.habit_name}${item.metric_value ? ` · ${item.metric_value} ${item.metric_unit || ""}` : ""}`, meta: item.status })),
    ...data.financial_transactions.slice(0, 1).map((item) => ({ type: "Transaction", icon: "credit-card" as const, tone: "mint" as const, title: item.description, meta: `${item.amount} ${item.currency}` })),
    ...data.knowledge.slice(0, 1).map((item) => ({ type: "Insight", icon: "mic" as const, tone: "mint" as const, title: item.topic, meta: "Now" })),
  ], [data]);
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.captureContent, compact && styles.captureContentCompact]} bounces={false}>
    <Text style={styles.eyebrow}>MONDAY · 24 AUGUST</Text>
    <Text style={styles.greeting}>Good morning, Alan</Text>
    <Text style={styles.subcopy}>Your mind has a place to land.</Text>
    <View style={styles.waveWrap}><Waveform active={capture.recording} /></View>
    <Text style={styles.capturePrompt}>{capture.recording ? "I’m listening…" : capture.processing ? "Structuring your thought…" : "What’s on your mind?"}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={capture.recording ? "Stop recording" : "Start recording"} onPress={capture.toggle} disabled={capture.processing} style={({ pressed }) => [styles.micOuter, pressed && styles.pressed]}>
      <View style={[styles.micButton, capture.recording && styles.micButtonActive]}><Feather name={capture.recording ? "square" : "mic"} size={36} color="white" /></View>
    </Pressable>
    <Text style={styles.captureHint}>{capture.recording ? "Tap to finish" : capture.processing ? "Transcript · Tasks · Habits · Ideas" : "Tap once, then speak naturally"}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Import a voice note" accessibilityState={{ disabled: capture.processing }} onPress={capture.importAudio} disabled={capture.processing} style={styles.importAudio}><Feather name="upload" size={14} color="#B94716" /><Text style={styles.importAudioText}>Import a voice note</Text></Pressable>

    <View style={styles.meetingCard}>
      <View style={styles.meetingCopy}><Text style={styles.miniLabel}>{meeting.recording ? "MEETING MODE · RECORDING" : "MEETING MODE"}</Text><Text style={styles.meetingTitle}>{meeting.recording ? formatDuration(meeting.durationMillis) : "Record a long meeting"}</Text><Text style={styles.meetingMeta}>{meeting.recording ? "Safe in Documents · continues with screen locked" : meeting.pending ? `${meeting.pending} upload${meeting.pending === 1 ? "" : "s"} recover automatically` : "Background recording · resumable upload"}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={meeting.recording ? "Stop meeting recording" : "Start meeting recording"} onPress={meeting.recording ? meeting.stop : meeting.startWithConsent} style={[styles.meetingButton, meeting.recording && styles.meetingButtonStop]}><Feather name={meeting.recording ? "square" : "radio"} size={19} color="white" /></Pressable>
    </View>
    <Text style={styles.meetingLegal}>Only record when permitted by law. Inform every participant before you start. <Text style={styles.meetingLegalLink} onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/privacy")}>Privacy</Text> · <Text style={styles.meetingLegalLink} onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/terms")}>Terms</Text></Text>

    {task ? <View style={styles.reviewCard}><View style={styles.reviewTop}><View><Text style={styles.miniLabel}>NEXT UP</Text><Text style={styles.reviewTitle}>{task.title}</Text></View><View style={styles.priorityDot} /></View><Text style={styles.reviewCopy}>{task.action_items[0] || task.project}</Text><View style={styles.reviewMeta}><Feather name="clock" size={14} color="#6B7A73" /><Text>{task.due_date ? timeOnly(task.due_date) : "Today"}</Text><Text>·</Text><Text>{task.project}</Text></View></View> : null}

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Today</Text><Text style={styles.sectionLink}>{data.stats.open_tasks} open</Text></View>
    {recent.map((item, index) => <View key={`${item.type}-${index}`} style={styles.timelineItem}><Text style={styles.timelineTime}>{index === 0 ? "Now" : `${7 + index}:10`}</Text><View style={[styles.timelineIcon, item.tone === "coral" ? styles.timelineCoral : item.tone === "sage" ? styles.timelineSage : styles.timelineMint]}><Feather name={item.icon} size={19} color={item.tone === "coral" ? "#E95845" : "#B94716"} /></View><View style={styles.timelineCopy}><Text style={styles.timelineType}>{item.type}</Text><Text numberOfLines={1} style={styles.timelineTitle}>{item.title}</Text></View><Text style={styles.timelineMeta}>{item.meta}</Text></View>)}
    <View style={styles.bottomSpacer} />
  </ScrollView>;
}

function RitualScreen({ capture, data, compact }: { capture: ReturnType<typeof useVoiceCapture>; data: DashboardResponse; compact: boolean }) {
  const energy = data.captures[0]?.energy_score || 6;
  const task = data.tasks[0]?.title || "Choose one next step";
  const habit = data.habits[0]?.habit_name || "Morning movement";
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.ritualContent, compact && styles.ritualContentCompact]} bounces={false}>
    <View style={styles.ritualHeader}><Text style={styles.ritualTitle}>Daily WIMAX</Text><Text style={styles.ritualDate}>Mon · 24 Aug</Text><Feather name="rotate-ccw" size={22} color="#111111" /></View>
    <View style={styles.energyOrbit}>
      <View style={styles.energyOrbitInner}><Text style={styles.energyLabel}>Energy <Text style={styles.energyNumber}>{energy}</Text> / 10</Text><View style={styles.energyRule} /><Text style={styles.mirrorSentence}>{data.captures[0]?.summary || "Clearer after movement. Still carrying pressure about the launch."}</Text></View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={capture.recording ? "Stop check-in" : "Speak your check-in"} onPress={capture.toggle} disabled={capture.processing} style={({ pressed }) => [styles.ritualMic, pressed && styles.pressed]}><Feather name={capture.recording ? "square" : "mic"} size={34} color="white" /></Pressable>
    <Text style={styles.ritualMicLabel}>{capture.recording ? "Listening…" : capture.processing ? "Reflecting…" : "Speak your check-in"}</Text>
    <View style={styles.noticed}><Feather name="sun" size={25} color="#B94716" /><View><Text style={styles.noticedTitle}>WIMAX noticed</Text><Text style={styles.noticedCopy}>{data.knowledge[0]?.content || "Your energy rises after morning movement, but launch-related thoughts have appeared for 3 days."}</Text></View></View>
    <View style={styles.path}>
      <PathItem icon="check" label="Keep" title={habit} />
      <PathItem icon="minus" label="Release" title="Launch perfection" />
      <PathItem icon="arrow-right" label="Do next" title={task} action="Add to today" />
    </View>
    <View style={styles.bottomSpacer} />
  </ScrollView>;
}

function PathItem({ icon, label, title, action }: { icon: keyof typeof Feather.glyphMap; label: string; title: string; action?: string }) {
  return <View style={styles.pathItem}><View style={styles.pathIcon}><Feather name={icon} size={22} color="#111111" /></View><View><Text style={styles.pathLabel}>{label}</Text><Text style={styles.pathTitle}>{title}</Text>{action ? <Text style={styles.pathAction}>{action}  ›</Text> : null}</View></View>;
}

function ReviewSheet({ result, onExecuteCommands, onClose }: { result: CaptureResponse; onExecuteCommands: () => void; onClose: () => void }) {
  const count = result.parsed.tasks.length + result.parsed.habits.length + result.parsed.knowledge_base.length + result.parsed.financial_transactions.length + result.parsed.commands.length;
  return <View style={styles.sheet}><View style={styles.handle} /><View style={styles.sheetHeading}><View style={styles.sheetIcon}><Feather name="check" size={23} color="#B94716" /></View><View style={styles.sheetHeadingCopy}><Text style={styles.sheetKicker}>CAPTURE STRUCTURED</Text><Text numberOfLines={3} style={styles.sheetTitle}>{result.parsed.summary}</Text></View></View><Text numberOfLines={3} style={styles.cleaned}>{result.parsed.raw_text_cleaned}</Text><View style={styles.sheetMeta}><Text>{count} items</Text><Text>Energy {result.parsed.energy_score}/10</Text><Text>{result.persisted ? "Saved" : "Preview"}</Text></View>{result.parsed.commands.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Review and run ${result.parsed.commands.length} actions`} style={styles.commandConfirm} onPress={onExecuteCommands}><Text style={styles.commandConfirmText}>Review & run {result.parsed.commands.length} action{result.parsed.commands.length === 1 ? "" : "s"}</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Close capture review" style={styles.save} onPress={onClose}><Text style={styles.saveText}>Done</Text></Pressable></View>;
}

function MobileSettings({ onSignedOut }: { onSignedOut: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function signOut() { await signOutMobile(); onSignedOut(); }
  async function deleteAccount() {
    if (!password || confirmation !== "DELETE" || busy) return;
    Alert.alert("Delete WIMAX account?", "Your account and active-service data will be permanently deleted. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete permanently", style: "destructive", onPress: () => void (async () => {
        setBusy(true);
        try {
          const token = await getMobileToken();
          if (!token) throw new Error("Sign in again before deleting your account.");
          const response = await fetch(`${mobileApiUrl()}/api/account`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
          const payload = await response.json() as { error?: string };
          if (!response.ok) throw new Error(payload.error === "INVALID_PASSWORD" ? "The password is incorrect." : payload.error || "Account deletion failed.");
          await signOutMobile(); onSignedOut();
        } catch (error) { Alert.alert("Could not delete account", error instanceof Error ? error.message : "Please try again."); }
        finally { setBusy(false); }
      })() },
    ]);
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.mobileSettingsContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.mobileToolTitle}>Settings</Text>
    <View style={styles.mobileSettingsCard}><View style={styles.mobileSettingsHeading}><Feather name="shield" size={20} color="#B94716" /><View><Text style={styles.mobileSettingsTitle}>Privacy & legal</Text><Text style={styles.mobileSettingsCopy}>Control your data and review recording rules.</Text></View></View><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/privacy")} style={styles.mobileSettingsLink}><Text>Privacy Policy</Text><Feather name="external-link" size={15} color="#65776D" /></Pressable><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/terms")} style={styles.mobileSettingsLink}><Text>Terms of Service</Text><Feather name="external-link" size={15} color="#65776D" /></Pressable><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://cognitive-mirror-two.vercel.app/account-deletion")} style={styles.mobileSettingsLink}><Text>Account deletion information</Text><Feather name="external-link" size={15} color="#65776D" /></Pressable></View>
    <View style={[styles.mobileSettingsCard, styles.mobileDangerCard]}><View style={styles.mobileSettingsHeading}><Feather name="trash-2" size={20} color="#A03423" /><View><Text style={styles.mobileSettingsTitle}>Delete account</Text><Text style={styles.mobileSettingsCopy}>Export anything you need first. This action is permanent.</Text></View></View><TextInput accessibilityLabel="Current password for account deletion" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Current password" placeholderTextColor="#8A9690" style={styles.mobileSettingsInput} /><TextInput accessibilityLabel="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="Type DELETE" placeholderTextColor="#8A9690" style={styles.mobileSettingsInput} /><Pressable accessibilityRole="button" disabled={busy || !password || confirmation !== "DELETE"} onPress={() => void deleteAccount()} style={[styles.mobileDeleteButton, (busy || !password || confirmation !== "DELETE") && styles.authButtonDisabled]}>{busy ? <ActivityIndicator color="white" /> : <><Feather name="trash-2" size={17} color="white" /><Text style={styles.mobileDeleteButtonText}>Permanently delete account</Text></>}</Pressable></View>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.mobileSignOut}><Feather name="log-out" size={17} color="#52635A" /><Text>Sign out</Text></Pressable><View style={styles.bottomSpacer} />
  </ScrollView>;
}

function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<[Tab, keyof typeof Feather.glyphMap]> = [["Home", "home"], ["Search", "search"], ["Voice", "mic"], ["Inbox", "inbox"], ["New", "edit-3"]];
  return <View style={styles.tabs}>{tabs.map(([label, icon]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === label }} key={label} onPress={() => onChange(label)} style={[styles.tab,label === "Voice" && styles.voiceTab]}>{label === "Voice" ? <View style={[styles.voiceTabIcon,tab === label && styles.voiceTabIconActive]}><Feather name={icon} size={23} color="white" /></View> : <Feather name={icon} size={21} color={tab === label ? "#1B1B1B" : "#52635A"} />}<Text style={[styles.tabText, tab === label && styles.tabActive]}>{label}</Text></Pressable>)}</View>;
}

function Waveform({ active }: { active: boolean }) { return <View style={styles.wave}>{bars.map((height, index) => <View key={index} style={[styles.bar, { height: active ? Math.max(8, height * (index % 3 === 0 ? .7 : 1)) : height }]} />)}</View>; }

function useVoiceCapture(onSaved: () => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, directory: "document" });
  const recorderState = useAudioRecorderState(recorder);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CaptureResponse | null>(null);
  const meteringSamples = useRef<number[]>([]);

  useEffect(() => { void (async () => { const permission = await AudioModule.requestRecordingPermissionsAsync(); if (!permission.granted) Alert.alert("Microphone required", "Enable microphone access to capture thoughts."); await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }); })(); }, []);
  useEffect(() => {
    if (recorderState.isRecording && typeof recorderState.metering === "number" && meteringSamples.current.length < 7_200) meteringSamples.current.push(recorderState.metering);
  }, [recorderState.isRecording, recorderState.metering]);

  async function toggle() {
    if (recorderState.isRecording) { const metering = summarizeMetering(meteringSamples.current); await recorder.stop(); if (recorder.uri) await upload(recorder.uri, "capture.m4a", "audio/m4a", metering); return; }
    setResult(null); meteringSamples.current = []; await recorder.prepareToRecordAsync(); recorder.record();
  }
  async function upload(uri: string, name = "capture.m4a", mimeType = "audio/m4a", metering?: { averageDb: number; peakDb: number; variabilityDb: number } | null) {
    const token = await getMobileToken();
    if (!token) { Alert.alert("Connect to WIMAX", "Sign in again to continue cloud processing."); return; }
    setProcessing(true);
    try {
      const form = new FormData();
      const audio = new File(uri);
      form.append("audio", audio, name);
      form.append("current_datetime", dateTimeWithOffset()); form.append("source", name === "capture.m4a" ? "MOBILE_VOICE" : "MOBILE_SHARE"); form.append("diarize", "true");
      if (metering) { form.append("metering_average_db", String(metering.averageDb)); form.append("metering_peak_db", String(metering.peakDb)); form.append("metering_variability_db", String(metering.variabilityDb)); }
      const response = await expoFetch(`${mobileApiUrl()}/api/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Capture failed"); setResult(captureResponseSchema.parse(payload)); onSaved();
    } catch (error) { Alert.alert("Capture failed", error instanceof Error ? error.message : "Please try again."); } finally { setProcessing(false); }
  }
  async function importAudio() { const picked = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false }); const asset = picked.canceled ? null : picked.assets[0]; if (asset) await upload(asset.uri, asset.name || "imported-audio", asset.mimeType || "audio/mpeg"); }
  async function executeCommands() {
    if (!result?.capture_id) return;
    const apiUrl = mobileApiUrl(); const token = await getMobileToken();
    if (!token) return;
    try {
      const response = await fetch(`${apiUrl}/api/commands?capture_id=${encodeURIComponent(result.capture_id)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { commands?: Array<{ id: string; provider: string; title: string; parameters: Record<string, unknown> }>; error?: string };
      if (!response.ok) throw new Error(payload.error || "Commands unavailable");
      const commands = payload.commands || [];
      Alert.alert("Run external actions?", commands.map((command) => `• ${command.title} → ${command.provider}`).join("\n"), [
        { text: "Cancel", style: "cancel" },
        { text: "Run", onPress: () => void (async () => {
          for (const command of commands) {
            const executed = await fetch(`${apiUrl}/api/commands/${command.id}/execute`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
            const execution = await executed.json() as { status?: string; result?: { title?: string; parameters?: Record<string, unknown> }; error?: string };
            if (!executed.ok) throw new Error(execution.error || `Could not run ${command.title}`);
            if (execution.status === "AWAITING_DEVICE") {
              const parameters = execution.result?.parameters || command.parameters;
              const deviceResult = await MirrorSystemCapture.createReminderAsync(command.title, parameters.notes == null ? null : String(parameters.notes), parameters.due_date == null ? null : String(parameters.due_date));
              const completed = await fetch(`${apiUrl}/api/commands/${command.id}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ result: deviceResult }) });
              if (!completed.ok) throw new Error("Reminder was created but completion sync failed");
            }
          }
          Alert.alert("Actions completed", `${commands.length} confirmed action${commands.length === 1 ? "" : "s"} completed.`);
        })().catch((error) => Alert.alert("Action failed", error instanceof Error ? error.message : "Please try again")) },
      ]);
    } catch (error) { Alert.alert("Actions unavailable", error instanceof Error ? error.message : "Please try again"); }
  }
  return { recording: recorderState.isRecording, processing, result, toggle, importAudio, executeCommands, closeReview: () => setResult(null) };
}

function useMeetingMode() {
  const meetingOptions = useMemo(() => ({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 32_000,
    isMeteringEnabled: true,
    directory: "document" as const,
  }), []);
  const recorder = useAudioRecorder(meetingOptions);
  const state = useAudioRecorderState(recorder, 500);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(() => readMeetingQueue().length);

  async function start() {
    if (Platform.OS === "android") {
      const notifications = await AudioModule.requestNotificationPermissionsAsync();
      if (!notifications.granted) throw new Error("Notification permission is required so Meeting Mode can keep recording in the background.");
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, allowsBackgroundRecording: true });
    await recorder.prepareToRecordAsync();
    const started = new Date().toISOString();
    setStartedAt(started);
    recorder.record();
  }

  function startWithConsent() {
    Alert.alert("Before recording", "WIMAX will capture audio, keep recoverable local chunks, upload them for transcription and AI processing, and create speaker labels, chapters, decisions and action items.\n\nBy continuing, you confirm that every participant has been informed and that you obtained all consent or another lawful basis required where you are. WIMAX cannot determine whether recording is lawful.", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm & record", onPress: () => void start().catch((error) => Alert.alert("Meeting mode", error instanceof Error ? error.message : "Could not start")) },
    ]);
  }

  async function stop() {
    const durationMillis = state.durationMillis;
    await recorder.stop();
    if (!recorder.uri || !startedAt) return;
    enqueueMeeting({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      serverId: null,
      title: `Meeting ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(startedAt))}`,
      source: Platform.OS === "ios" ? "IOS" : "ANDROID",
      fileUri: recorder.uri,
      startedAt,
      endedAt: new Date().toISOString(),
      durationSeconds: durationMillis / 1_000,
      uploadedChunks: [],
      attempts: 0,
      lastError: null,
    });
    setStartedAt(null);
    setPending(readMeetingQueue().length);
    const remaining = await flushMeetingQueue();
    setPending(remaining.length);
    Alert.alert(remaining.length ? "Meeting saved" : "Meeting uploaded", remaining.length ? "The encrypted transport queue will resume automatically when the connection returns." : "Processing has started. The original local file was removed after verified upload.");
  }

  return { recording: state.isRecording, durationMillis: state.durationMillis, pending, startWithConsent, stop: () => void stop() };
}

function timeOnly(value: string) { return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function dateTimeWithOffset(date = new Date()) { const offset = -date.getTimezoneOffset(); const sign = offset >= 0 ? "+" : "-"; const pad = (value: number) => String(Math.abs(value)).padStart(2, "0"); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19); return `${local}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`; }
function formatDuration(value: number) { const total = Math.floor(value / 1_000); const hours = Math.floor(total / 3_600); const minutes = Math.floor((total % 3_600) / 60); const seconds = total % 60; return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":"); }
function summarizeMetering(samples: number[]) { if (!samples.length) return null; const averageDb = samples.reduce((sum, value) => sum + value, 0) / samples.length; const peakDb = Math.max(...samples); const variabilityDb = Math.sqrt(samples.reduce((sum, value) => sum + (value - averageDb) ** 2, 0) / samples.length); return { averageDb, peakDb, variabilityDb }; }
async function registerPushNotifications(showLocalTest = false) {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID; const token = await getMobileToken();
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("wimax-updates", { name: "WIMAX updates", importance: Notifications.AndroidImportance.HIGH, sound: "default", vibrationPattern: [0, 180, 100, 180] });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Notification permission was not granted.");
  if (showLocalTest) await Notifications.scheduleNotificationAsync({ content: { title: "WIMAX notifications are ready", body: "Meeting, briefing and coaching updates will appear here.", sound: "default", data: { kind: "TEST", screen: "Inbox" } }, trigger: null });
  if (!projectId || !token) return { remote: false };
  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const response = await fetch(`${mobileApiUrl()}/api/push/register`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ token: pushToken, platform: Platform.OS === "ios" ? "IOS" : "ANDROID", locale: Intl.DateTimeFormat().resolvedOptions().locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
  if (!response.ok) throw new Error("The device could not be registered for remote notifications.");
  return { remote: true };
}

const styles = StyleSheet.create({
  authScreen:{flex:1,backgroundColor:"#F5F1E8",paddingHorizontal:28,alignItems:"center",justifyContent:"center"},authMark:{width:66,height:66,borderRadius:33,borderWidth:1,borderColor:"#B8AFA3",alignItems:"center",justifyContent:"center",marginBottom:22},authTitle:{fontSize:30,fontWeight:"600",letterSpacing:-1,color:"#111111"},authCopy:{fontSize:14,lineHeight:21,color:"#66766F",textAlign:"center",maxWidth:360,marginTop:10,marginBottom:24},authInput:{width:"100%",maxWidth:390,height:54,borderWidth:1,borderColor:"#C9D4CE",borderRadius:12,backgroundColor:"white",paddingHorizontal:16,fontSize:16,color:"#111111",marginBottom:10},authLegal:{width:"100%",maxWidth:390,flexDirection:"row",gap:10,alignItems:"flex-start",marginVertical:8},authLegalText:{flex:1,fontSize:11,lineHeight:17,color:"#66766F"},authLegalLink:{color:"#B94716",fontWeight:"700",textDecorationLine:"underline"},authButton:{width:"100%",maxWidth:390,height:54,borderRadius:12,backgroundColor:"#FF6B2C",alignItems:"center",justifyContent:"center",marginTop:2},authButtonDisabled:{opacity:.5},authButtonText:{color:"white",fontSize:16,fontWeight:"700"},authSwitch:{marginTop:20,padding:8},authSwitchText:{color:"#B94716",fontSize:14,fontWeight:"700"},
  safe:{flex:1,backgroundColor:"#F5F1E8"},screen:{flex:1},modeRow:{height:62,paddingHorizontal:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#E1DACE"},brandRow:{flexDirection:"row",alignItems:"center",gap:8},brandMark:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:"#B8AFA3",alignItems:"center",justifyContent:"center"},brand:{fontSize:15,fontWeight:"700",color:"#111111",letterSpacing:-.3},modeSwitch:{flexDirection:"row",padding:3,backgroundColor:"#EEE8DE",borderRadius:9},modeChoice:{paddingHorizontal:10,paddingVertical:6,borderRadius:7},modeChoiceActive:{backgroundColor:"white",shadowColor:"#111111",shadowOpacity:.08,shadowRadius:5},modeText:{fontSize:10,color:"#6C7B74",fontWeight:"600"},modeTextActive:{color:"#111111"},
  captureContent:{paddingHorizontal:24,paddingTop:30},captureContentCompact:{paddingHorizontal:18},eyebrow:{fontSize:9,fontWeight:"800",letterSpacing:1.5,color:"#B94716"},greeting:{fontSize:32,lineHeight:38,letterSpacing:-1.2,color:"#111111",marginTop:10,fontWeight:"500"},subcopy:{fontSize:14,color:"#728078",marginTop:5},waveWrap:{marginTop:24},wave:{height:56,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4},bar:{width:3,borderRadius:3,backgroundColor:"#C5BDB2"},capturePrompt:{fontSize:22,fontWeight:"600",textAlign:"center",letterSpacing:-.7,marginTop:12,color:"#111111"},micOuter:{width:112,height:112,borderRadius:56,borderWidth:1.5,borderColor:"#9BB5A8",padding:8,alignSelf:"center",marginTop:17},micButton:{flex:1,borderRadius:50,backgroundColor:"#FF6B2C",alignItems:"center",justifyContent:"center",shadowColor:"#FF6B2C",shadowOpacity:.23,shadowRadius:18,shadowOffset:{width:0,height:8}},micButtonActive:{backgroundColor:"#111111"},pressed:{transform:[{scale:.97}]},captureHint:{textAlign:"center",color:"#B94716",fontSize:13,marginTop:10},importAudio:{flexDirection:"row",alignItems:"center",alignSelf:"center",gap:6,paddingVertical:10},importAudioText:{fontSize:11,color:"#B94716",fontWeight:"600"},reviewCard:{backgroundColor:"#111111",borderRadius:14,padding:17,marginTop:18},reviewTop:{flexDirection:"row",justifyContent:"space-between"},miniLabel:{fontSize:8,color:"#B7AEA3",letterSpacing:1.4,fontWeight:"800"},reviewTitle:{fontSize:17,color:"white",fontWeight:"700",marginTop:5},priorityDot:{width:8,height:8,borderRadius:4,backgroundColor:"#FF6B2C"},reviewCopy:{color:"#C8D5CF",fontSize:12,marginTop:12},reviewMeta:{flexDirection:"row",alignItems:"center",gap:7,marginTop:13},reviewMetaText:{color:"#C9C0B5"},sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:32,paddingBottom:8,borderBottomWidth:1,borderBottomColor:"#DDD6CA"},sectionTitle:{fontSize:22,color:"#111111",fontWeight:"600"},sectionLink:{fontSize:11,color:"#B94716"},timelineItem:{minHeight:76,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:"#E1DACE"},timelineTime:{width:42,fontSize:10,color:"#718078"},timelineIcon:{width:42,height:42,borderRadius:12,alignItems:"center",justifyContent:"center"},timelineCoral:{backgroundColor:"#FFE9E5"},timelineSage:{backgroundColor:"#EEE8DE"},timelineMint:{backgroundColor:"#EDF1EF"},timelineCopy:{flex:1,marginLeft:13},timelineType:{fontSize:8,letterSpacing:1.1,color:"#74837B",textTransform:"uppercase"},timelineTitle:{fontSize:14,color:"#111111",fontWeight:"600",marginTop:3},timelineMeta:{fontSize:9,color:"#6D6861",marginLeft:8},
  meetingCard:{marginTop:8,backgroundColor:"#111111",borderRadius:15,padding:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},meetingCopy:{flex:1,paddingRight:12},meetingTitle:{fontSize:17,color:"white",fontWeight:"700",marginTop:5},meetingMeta:{fontSize:11,color:"#C9C0B5",marginTop:5},meetingButton:{width:48,height:48,borderRadius:24,backgroundColor:"#1B1B1B",alignItems:"center",justifyContent:"center"},meetingButtonStop:{backgroundColor:"#FF6B2C"},meetingLegal:{fontSize:9,lineHeight:14,color:"#6C7B74",marginTop:8,paddingHorizontal:3},meetingLegalLink:{color:"#B94716",fontWeight:"700",textDecorationLine:"underline"},
  ritualContent:{paddingHorizontal:24,paddingTop:24},ritualContentCompact:{paddingHorizontal:18},ritualHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},ritualTitle:{fontSize:25,fontWeight:"600",letterSpacing:-.7,color:"#111111"},ritualDate:{fontSize:13,color:"#749081"},energyOrbit:{width:310,height:310,borderRadius:155,borderWidth:1.5,borderColor:"#B8AFA3",alignSelf:"center",marginTop:26,padding:16,shadowColor:"#B94716",shadowOpacity:.08,shadowRadius:18},energyOrbitInner:{flex:1,borderRadius:140,borderWidth:1,borderStyle:"dashed",borderColor:"#C9C1B6",alignItems:"center",justifyContent:"center",paddingHorizontal:36},energyLabel:{fontSize:16,color:"#6D6861"},energyNumber:{fontSize:30,fontWeight:"600"},energyRule:{width:40,height:2,backgroundColor:"#D4CCC0",marginVertical:14},mirrorSentence:{fontSize:24,lineHeight:30,textAlign:"center",fontFamily:"serif",color:"#111111"},ritualMic:{width:82,height:82,borderRadius:41,backgroundColor:"#FF6B2C",alignSelf:"center",marginTop:-25,borderWidth:6,borderColor:"#F5F1E8",alignItems:"center",justifyContent:"center"},ritualMicLabel:{textAlign:"center",fontSize:14,color:"#B94716",marginTop:6},noticed:{flexDirection:"row",gap:15,paddingVertical:24,borderTopWidth:1,borderBottomWidth:1,borderColor:"#DDD6CA",marginTop:28},noticedTitle:{fontSize:17,fontWeight:"700",color:"#111111"},noticedCopy:{fontSize:13,lineHeight:19,color:"#53645C",marginTop:6,paddingRight:22},path:{paddingVertical:18},pathItem:{flexDirection:"row",gap:16,minHeight:78},pathIcon:{width:42,height:42,borderRadius:21,borderWidth:2,borderColor:"#D8D0C5",alignItems:"center",justifyContent:"center"},pathLabel:{fontSize:14,fontWeight:"700",color:"#B94716"},pathTitle:{fontSize:15,color:"#111111",marginTop:3},pathAction:{fontSize:13,color:"#FF6B2C",marginTop:6},
  secondaryContent:{padding:24},secondaryTitle:{fontSize:34,fontWeight:"500",letterSpacing:-1.2,color:"#111111",marginTop:8},secondaryIntro:{fontSize:14,color:"#6C7B74",lineHeight:21,marginTop:8,marginBottom:25},secondaryRow:{paddingVertical:20,borderTopWidth:1,borderTopColor:"#DDD6CA"},secondaryMeta:{fontSize:8,letterSpacing:1.1,color:"#B94716",textTransform:"uppercase"},secondaryRowTitle:{fontSize:18,fontWeight:"600",color:"#111111",marginTop:6},secondaryCopy:{fontSize:13,lineHeight:20,color:"#6C7B74",marginTop:6},emptyState:{height:300,alignItems:"center",justifyContent:"center",gap:14},bottomSpacer:{height:110},
  sheet:{position:"absolute",left:0,right:0,bottom:72,backgroundColor:"white",borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:24,paddingTop:9,paddingBottom:20,shadowColor:"#17211E",shadowOpacity:.15,shadowRadius:20,shadowOffset:{width:0,height:-8},elevation:12,zIndex:20},handle:{width:46,height:5,backgroundColor:"#D3D7D5",borderRadius:3,alignSelf:"center",marginBottom:18},sheetHeading:{flexDirection:"row",gap:13,alignItems:"flex-start"},sheetIcon:{width:44,height:44,borderRadius:22,backgroundColor:"#EEE8DE",alignItems:"center",justifyContent:"center"},sheetHeadingCopy:{flex:1},sheetKicker:{fontSize:8,letterSpacing:1.2,color:"#5B826F",fontWeight:"800"},sheetTitle:{fontSize:17,lineHeight:22,fontWeight:"600",color:"#111111",marginTop:4},cleaned:{color:"#66736E",lineHeight:20,marginTop:13},sheetMeta:{flexDirection:"row",gap:18,marginTop:12},commandConfirm:{borderWidth:1,borderColor:"#1B1B1B",borderRadius:9,paddingVertical:12,alignItems:"center",marginTop:14},commandConfirmText:{color:"#B94716",fontSize:14,fontWeight:"700"},save:{backgroundColor:"#FF6B2C",borderRadius:9,paddingVertical:14,alignItems:"center",marginTop:12},saveText:{color:"white",fontSize:16,fontWeight:"700"},
  tabs:{height:76,backgroundColor:"#FFFDF8",borderTopWidth:1,borderTopColor:"#DCE2DE",flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingBottom:7},tab:{alignItems:"center",justifyContent:"center",gap:3,minWidth:54,flex:1},tabText:{fontSize:9,color:"#52635A"},tabActive:{color:"#1B1B1B",fontWeight:"700"},voiceTab:{marginTop:-24},voiceTabIcon:{width:52,height:52,borderRadius:26,backgroundColor:"#FF6B2C",alignItems:"center",justifyContent:"center",borderWidth:5,borderColor:"#FFFDF8",shadowColor:"#FF6B2C",shadowOpacity:.18,shadowRadius:10},voiceTabIconActive:{backgroundColor:"#111111"},
  mobileWorkspaceMeta:{fontSize:9,color:"#829087",marginTop:1},mobileHeaderActions:{flexDirection:"row",alignItems:"center",gap:20,paddingRight:4},mobileHomeContent:{paddingHorizontal:20,paddingTop:25},mobileDate:{fontSize:8,fontWeight:"800",letterSpacing:1.25,color:"#B94716"},mobileHomeTitle:{fontSize:31,lineHeight:37,letterSpacing:-1.1,color:"#111111",marginTop:8,fontWeight:"500"},mobileHomeCopy:{fontSize:13,color:"#738179",marginTop:6,lineHeight:19},mobileVoiceHero:{minHeight:126,backgroundColor:"#111111",borderRadius:14,marginTop:23,padding:17,flexDirection:"row",alignItems:"center",gap:13},mobileVoiceIcon:{width:50,height:50,borderRadius:25,backgroundColor:"#FF6B2C",alignItems:"center",justifyContent:"center"},mobileVoiceCopy:{flex:1},mobileVoiceLabel:{fontSize:8,fontWeight:"800",letterSpacing:1.2,color:"#C9C0B5"},mobileVoiceTitle:{fontSize:16,lineHeight:21,fontWeight:"700",color:"white",marginTop:5},mobileVoiceMeta:{fontSize:9,color:"#C9C0B5",marginTop:6},mobileSectionHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:29,marginBottom:8},mobileSectionHeadingText:{fontSize:19,fontWeight:"600",color:"#111111"},mobileSectionLink:{fontSize:11,color:"#B94716",fontWeight:"600"},mobilePageList:{borderTopWidth:1,borderTopColor:"#DDD6CA"},mobilePageRow:{minHeight:70,flexDirection:"row",alignItems:"center",gap:12,borderBottomWidth:1,borderBottomColor:"#E5DED3"},mobilePageRowCopy:{flex:1},mobilePageIcon:{width:36,height:36,borderRadius:8,backgroundColor:"#EEE8DE",alignItems:"center",justifyContent:"center"},mobilePageTitle:{fontSize:14,fontWeight:"600",color:"#111111"},mobilePageMeta:{fontSize:10,color:"#7A8780",marginTop:4},mobileDatabase:{borderTopWidth:1,borderTopColor:"#DDD6CA"},mobileDatabaseRow:{minHeight:62,flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:1,borderBottomColor:"#E5DED3"},mobileDatabaseRowCopy:{flex:1},mobileDatabaseTitle:{fontSize:13,fontWeight:"600",color:"#111111"},mobileDatabaseMeta:{fontSize:9,color:"#7A8780",marginTop:4},mobileDatabaseTime:{fontSize:9,color:"#6D6861"},mobileCoach:{flexDirection:"row",gap:13,backgroundColor:"#EEE8DE",borderRadius:12,padding:17,marginTop:22},mobileCoachCopy:{flex:1},mobileCoachLabel:{fontSize:8,fontWeight:"800",letterSpacing:1.1,color:"#B94716"},mobileCoachText:{fontSize:13,lineHeight:19,color:"#38342F",marginTop:6},
  mobileToolContent:{paddingHorizontal:20,paddingTop:24},mobileToolTitle:{fontSize:32,fontWeight:"500",letterSpacing:-1,color:"#111111"},mobileToolIntro:{fontSize:13,lineHeight:20,color:"#718078",marginTop:7},mobileSearchBox:{height:48,borderRadius:10,backgroundColor:"#EEE8DE",flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,marginTop:19},mobileSearchInput:{flex:1,fontSize:14,color:"#111111"},mobileToolKicker:{fontSize:8,fontWeight:"800",letterSpacing:1.25,color:"#6D6861",marginTop:24,marginBottom:8},mobileSearchResult:{minHeight:82,flexDirection:"row",gap:12,borderBottomWidth:1,borderBottomColor:"#E5DED3",paddingVertical:13},mobileSearchResultCopy:{flex:1},mobileSearchResultTitle:{fontSize:14,fontWeight:"600",color:"#111111"},mobileSearchResultText:{fontSize:11,lineHeight:17,color:"#738078",marginTop:4},mobileSearchResultKind:{fontSize:8,letterSpacing:1,color:"#B94716",marginTop:6},notificationCard:{minHeight:78,marginTop:18,borderRadius:14,backgroundColor:"#111111",paddingHorizontal:15,flexDirection:"row",alignItems:"center",gap:12},notificationIcon:{width:40,height:40,borderRadius:20,backgroundColor:"#FF6B2C",alignItems:"center",justifyContent:"center"},notificationCopy:{flex:1},notificationTitle:{fontSize:14,fontWeight:"700",color:"white"},notificationMeta:{fontSize:9,lineHeight:14,color:"#BFCBC5",marginTop:4},mobileInboxTabs:{height:44,flexDirection:"row",alignItems:"center",gap:21,borderBottomWidth:1,borderBottomColor:"#DDD6CA",marginTop:20},mobileInboxTabActive:{color:"#B94716",fontWeight:"700"},mobileInboxRow:{minHeight:68,flexDirection:"row",alignItems:"center",gap:12,borderBottomWidth:1,borderBottomColor:"#E5DED3"},mobileInboxRowCopy:{flex:1},mobileInboxTitle:{fontSize:13,fontWeight:"600",color:"#111111"},mobileInboxMeta:{fontSize:9,color:"#76847C",marginTop:4},
  mobileSettingsContent:{paddingHorizontal:20,paddingTop:24},mobileSettingsCard:{borderWidth:1,borderColor:"#DDD6CA",borderRadius:14,backgroundColor:"#FFFDF8",padding:16,marginTop:18},mobileDangerCard:{borderColor:"#D7AAA0"},mobileSettingsHeading:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:13},mobileSettingsTitle:{fontSize:16,fontWeight:"700",color:"#111111"},mobileSettingsCopy:{fontSize:11,lineHeight:16,color:"#718078",marginTop:4,paddingRight:22},mobileSettingsLink:{minHeight:46,borderTopWidth:1,borderTopColor:"#E5DED3",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},mobileSettingsInput:{height:48,borderWidth:1,borderColor:"#C9D4CE",borderRadius:10,backgroundColor:"white",paddingHorizontal:14,fontSize:14,color:"#111111",marginTop:10},mobileDeleteButton:{minHeight:48,borderRadius:10,backgroundColor:"#A03423",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,marginTop:12},mobileDeleteButtonText:{color:"white",fontSize:14,fontWeight:"700"},mobileSignOut:{minHeight:50,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,marginTop:16},
  mobileEditorContent:{paddingHorizontal:22,paddingTop:31},mobileEditorIcon:{width:48,height:48,borderRadius:11,backgroundColor:"#EEE8DE",alignItems:"center",justifyContent:"center"},mobileEditorTitle:{fontSize:36,fontWeight:"600",letterSpacing:-1.3,color:"#111111",marginTop:18},mobileEditorProperties:{display:"flex",marginTop:19,borderTopWidth:1,borderBottomWidth:1,borderColor:"#DDD6CA",paddingVertical:10},mobileEditorBody:{minHeight:250,textAlignVertical:"top",fontSize:15,lineHeight:24,color:"#2B2926",paddingTop:20},mobileEditorVoice:{minHeight:64,backgroundColor:"#111111",borderRadius:11,flexDirection:"row",alignItems:"center",gap:13,paddingHorizontal:16},mobileEditorVoiceActive:{backgroundColor:"#FF6B2C"},mobileEditorVoiceCopy:{flex:1},mobileEditorVoiceTitle:{fontSize:14,fontWeight:"700",color:"white"},mobileEditorVoiceMeta:{fontSize:9,color:"#C9C0B5",marginTop:4},mobileBlockBar:{height:66,flexDirection:"row",justifyContent:"space-between",alignItems:"center",borderTopWidth:1,borderTopColor:"#DDD6CA",marginTop:22},mobileBlockAction:{alignItems:"center",gap:4},
});
