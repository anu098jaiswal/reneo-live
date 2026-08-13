import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from "./supabase";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;

export interface LocalTracks {
  audioTrack: IMicrophoneAudioTrack;
  videoTrack: ICameraVideoTrack;
}

/**
 * Fetches a server-generated Agora RTC token from the Supabase Edge Function.
 * Tokens are never generated in the browser — the App Certificate must stay
 * server-side (see supabase/functions/agora-token). This satisfies A10.
 */
export async function fetchAgoraToken(
  channel: string,
  uid: number,
  role: "host" | "audience",
) {
  console.log(
    "Fetching Agora token for channel:",
    channel,
    "uid:",
    uid,
    "role:",
    role,
  );
  const { data, error } = await supabase.functions.invoke("agora-token", {
    body: { channel, uid, role },
  });
  console.log("Token response:", { data, error });
  if (error) throw new Error(`Could not get a live token: ${error.message}`);
  return data.token as string;
}

export function createAgoraClient(): IAgoraRTCClient {
  return AgoraRTC.createClient({ mode: "live", codec: "vp8" });
}

export async function joinAsHost(
  client: IAgoraRTCClient,
  channel: string,
  uid: number,
): Promise<LocalTracks> {
  await client.setClientRole("host");
  const token = await fetchAgoraToken(channel, uid, "host");
  await client.join(APP_ID, channel, token, uid);

  const [audioTrack, videoTrack] =
    await AgoraRTC.createMicrophoneAndCameraTracks();
  await client.publish([audioTrack, videoTrack]);

  return { audioTrack, videoTrack };
}

export async function joinAsAudience(
  client: IAgoraRTCClient,
  channel: string,
  uid: number,
) {
  // Audience role: subscribes to the host's stream but never publishes its
  // own camera/mic. This is the host/broadcaster vs audience/viewer
  // distinction A5 asks for — enforced by Agora's live-streaming mode, not
  // just by our UI not showing camera controls.
  await client.setClientRole("audience");
  const token = await fetchAgoraToken(channel, uid, "audience");
  await client.join(APP_ID, channel, token, uid);
}

export async function leaveChannel(
  client: IAgoraRTCClient,
  tracks?: LocalTracks,
) {
  tracks?.audioTrack.close();
  tracks?.videoTrack.close();
  await client.leave();
}
