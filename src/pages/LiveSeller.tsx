import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  createAgoraClient,
  joinAsHost,
  leaveChannel,
  LocalTracks,
} from "../lib/agora";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import Chat from "../components/Chat";
import ErrorBanner from "../components/ErrorBanner";
import type { Product } from "../types";

interface Props {
  sessionId: string;
  product: Product;
  onEnded: () => void;
}

export default function LiveSeller({ sessionId, product, onEnded }: Props) {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const videoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef(createAgoraClient());
  const tracksRef = useRef<LocalTracks | null>(null);

  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!profile) return;
      setConnecting(true);
      setError("");
      try {
        console.log(
          "LiveSeller: Starting host connection for session:",
          sessionId,
        );
        const client = clientRef.current;
        const uid = Math.floor(Math.random() * 1_000_000);
        console.log("LiveSeller: Joining as host with UID:", uid);
        const tracks = await joinAsHost(client, sessionId, uid);
        console.log("LiveSeller: Successfully joined as host");
        if (cancelled) {
          await leaveChannel(client, tracks);
          return;
        }
        tracksRef.current = tracks;
        if (videoRef.current) {
          tracks.videoTrack.play(videoRef.current);
          console.log("LiveSeller: Video track playing");
        }
      } catch (err) {
        console.error("LiveSeller: Connection failed:", err);
        // A11: camera permission denied, mic unavailable, Agora connection
        // failure all land here with an actionable message.
        const message =
          err instanceof Error
            ? err.message
            : "Could not start the live stream.";
        if (message.toLowerCase().includes("permission")) {
          setError(
            "Camera or microphone access was denied. Allow access in your browser settings and try again.",
          );
        } else {
          setError(
            "Could not connect to the live stream. Check your connection and try again.",
          );
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    }

    start();

    // Presence channel tracks viewer count in real time.
    const presenceChannel = supabase.channel(`presence:${sessionId}`);
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const viewerKeys = Object.keys(state).filter(
          (k) => k !== `host-${profile?.id}`,
        );
        setViewerCount(viewerKeys.length);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(presenceChannel);
      leaveChannel(clientRef.current, tracksRef.current ?? undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function toggleMute() {
    const track = tracksRef.current?.audioTrack;
    if (!track) return;
    await track.setEnabled(muted);
    setMuted(!muted);
  }

  async function toggleCamera() {
    const track = tracksRef.current?.videoTrack;
    if (!track) return;
    await track.setEnabled(cameraOff);
    setCameraOff(!cameraOff);
  }

  async function endLive() {
    setEnding(true);
    setError("");
    // Persist the status change first (A5 requires this), then tear down media.
    const { error: updateError } = await supabase
      .from("live_sessions")
      .update({ status: "ended" })
      .eq("id", sessionId);

    if (updateError) {
      setError(
        "Could not end the live session on the server. Your stream is stopping locally — try again if this repeats.",
      );
    }

    await leaveChannel(clientRef.current, tracksRef.current ?? undefined);
    setEnding(false);
    onEnded();
  }

  return (
    <div className="live-view seller-live">
      {!online && (
        <ErrorBanner message="Network interrupted — trying to reconnect..." />
      )}
      {error && (
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      )}

      <div className="live-main">
        <div className="video-area" ref={videoRef}>
          {connecting && <p className="center">Connecting to your stream...</p>}
        </div>

        <div className="live-info-bar">
          <span className="live-badge">● LIVE</span>
          <span>{viewerCount} watching</span>
          <span>{product.name}</span>
        </div>

        <div className="seller-controls">
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button onClick={toggleCamera}>
            {cameraOff ? "Camera On" : "Camera Off"}
          </button>
          <button onClick={endLive} disabled={ending} className="end-btn">
            {ending ? "Ending..." : "End Live"}
          </button>
        </div>
      </div>

      <div className="live-side">
        <Chat sessionId={sessionId} />
      </div>
    </div>
  );
}
