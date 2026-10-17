import { processAudioCapture } from "./capture-service";
import { finishProviderEvent } from "./db";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    voice?: { file_id?: string; mime_type?: string };
    audio?: { file_id?: string; file_name?: string; mime_type?: string };
  };
};

export async function processTelegramUpdate(update: TelegramUpdate, eventId: string) {
  try {
    const token = required("TELEGRAM_BOT_TOKEN");
    const file = update.message?.voice || update.message?.audio;
    const fileId = file?.file_id;
    const chatId = update.message?.chat?.id;
    if (!fileId || !chatId) { await finishProviderEvent("TELEGRAM", eventId); return; }
    const fileInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileInfo = await fileInfoResponse.json() as { ok?: boolean; result?: { file_path?: string } };
    if (!fileInfo.ok || !fileInfo.result?.file_path) throw new Error("Telegram file lookup failed");
    const audioResponse = await fetch(`https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`);
    if (!audioResponse.ok) throw new Error("Telegram audio download failed");
    const result = await processAudioCapture({
      bytes: await audioResponse.arrayBuffer(),
      filename: "telegram.ogg",
      mimeType: file.mime_type || "audio/ogg",
      currentDateTime: new Date().toISOString(),
      source: "TELEGRAM",
      processingMode: "CLOUD",
      diarize: true,
    });
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `Mirror captured: ${result.parsed.summary}` }),
    });
    await finishProviderEvent("TELEGRAM", eventId);
  } catch (error) {
    await finishProviderEvent("TELEGRAM", eventId, error instanceof Error ? error.message : "Telegram processing failed");
    throw error;
  }
}

type WhatsAppPayload = {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ id?: string; from?: string; type?: string; audio?: { id?: string; mime_type?: string }; voice?: { id?: string; mime_type?: string } }> } }> }>;
};

export function firstWhatsAppAudio(payload: WhatsAppPayload) {
  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const audio = message?.audio || message?.voice;
  return message && audio?.id ? { eventId: message.id || audio.id, mediaId: audio.id, mimeType: audio.mime_type || "audio/ogg", from: message.from || null } : null;
}

export async function processWhatsAppAudio(input: { eventId: string; mediaId: string; mimeType: string; from: string | null }) {
  try {
    const token = required("WHATSAPP_ACCESS_TOKEN");
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(input.mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const mediaInfo = await mediaInfoResponse.json() as { url?: string };
    if (!mediaInfo.url) throw new Error("WhatsApp media lookup failed");
    const audioResponse = await fetch(mediaInfo.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!audioResponse.ok) throw new Error("WhatsApp audio download failed");
    const result = await processAudioCapture({
      bytes: await audioResponse.arrayBuffer(), filename: "whatsapp.ogg", mimeType: input.mimeType,
      currentDateTime: new Date().toISOString(), source: "WHATSAPP", processingMode: "CLOUD", diarize: true,
    });
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (phoneNumberId && input.from) {
      await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: input.from, type: "text", text: { body: `Mirror captured: ${result.parsed.summary}` } }),
      });
    }
    await finishProviderEvent("WHATSAPP", input.eventId);
  } catch (error) {
    await finishProviderEvent("WHATSAPP", input.eventId, error instanceof Error ? error.message : "WhatsApp processing failed");
    throw error;
  }
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

