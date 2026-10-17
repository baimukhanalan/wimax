import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "cognitive-mirror.mobile-token";

export function mobileApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiUrl) throw new Error("Mirror API URL is not configured");
  return apiUrl;
}

export async function getMobileToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function signInMobile(account: string, password: string) {
  const response = await fetch(`${mobileApiUrl()}/api/mobile/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, password }),
  });
  const payload = await response.json() as { token?: string; error?: string };
  if (!response.ok || !payload.token) throw new Error(payload.error || "Could not connect to WIMAX");
  await SecureStore.setItemAsync(TOKEN_KEY, payload.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return payload.token;
}

export async function registerMobile(input: { name: string; email: string; password: string }) {
  const response = await fetch(`${mobileApiUrl()}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, client: "mobile" }),
  });
  const payload = await response.json() as { token?: string; error?: string };
  if (!response.ok || !payload.token) throw new Error(payload.error || "Could not create your WIMAX account");
  await SecureStore.setItemAsync(TOKEN_KEY, payload.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return payload.token;
}

export async function signOutMobile() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
