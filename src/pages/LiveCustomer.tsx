import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { createAgoraClient, joinAsAudience, leaveChannel } from "../lib/agora";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import Chat from "../components/Chat";
import CartDrawer from "../components/CartDrawer";
import ErrorBanner from "../components/ErrorBanner";
import type { LiveSession, Product } from "../types";

interface Props {
  session: LiveSession;
  onLeave: () => void;
}

export default function LiveCustomer({ session, onLeave }: Props) {
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const online = useOnlineStatus();
  const videoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef(createAgoraClient());

  const [product, setProduct] = useState<Product | null>(null);
  const [sessionStatus, setSessionStatus] = useState(session.status);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);

  // Load the product being presented, and error out clearly if it's gone.
  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      const { data, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("id", session.product_id)
        .single();

      if (cancelled) return;
      if (fetchError || !data) {
        setError("This product is no longer available.");
      } else {
        setProduct(data);
      }
    }
    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [session.product_id]);

  // Watch for the seller ending the live, in real time.
  useEffect(() => {
    const channel = supabase
      .channel(`session-status:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as LiveSession).status;
          setSessionStatus(newStatus);
          if (newStatus === "ended") {
            setError("This live session has ended.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  // Join as audience — never publishes camera/mic (A5).
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!profile || sessionStatus === "ended") {
        setConnecting(false);
        return;
      }
      setConnecting(true);
      try {
        console.log("Starting Agora connection for session:", session.id);
        const client = clientRef.current;
        const uid = Math.floor(Math.random() * 1_000_000);
        console.log("Joining as audience with UID:", uid);
        await joinAsAudience(client, session.id, uid);
        console.log("Successfully joined Agora channel");

        client.on("user-published", async (user, mediaType) => {
          console.log("User published:", user.uid, mediaType);
          await client.subscribe(user, mediaType);
          if (mediaType === "video" && videoRef.current) {
            user.videoTrack?.play(videoRef.current);
            console.log("Video track playing");
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
            console.log("Audio track playing");
          }
        });
      } catch (err) {
        console.error("Agora join failed:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(
          `Connection failed: ${errorMessage}. Check your connection and try again.`,
        );
      } finally {
        if (!cancelled) setConnecting(false);
      }
    }
    start();

    const presenceChannel = supabase.channel(`presence:${session.id}`);
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const viewerIds = new Set<string>();
        Object.keys(state).forEach((k) => {
          const presences = state[k] as any[];
          presences.forEach((p) => {
            if (p.role !== "host" && p.user_id && p.user_id !== session.host_id) {
              viewerIds.add(p.user_id);
            }
          });
        });
        setViewerCount(viewerIds.size);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && profile) {
          await presenceChannel.track({ user_id: profile.id, role: "audience" });
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(presenceChannel);
      leaveChannel(clientRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, sessionStatus]);

  function handleAddToCart() {
    if (!product) return;
    addToCart(product, selectedQty);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1500);
  }

  return (
    <div className="live-view customer-live">
      {!online && (
        <ErrorBanner message="Network interrupted — trying to reconnect..." />
      )}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={
            sessionStatus === "ended" ? onLeave : () => window.location.reload()
          }
        />
      )}

      <div className="live-main">
        {/* The video keeps playing underneath — the product panel is an
            overlay, not a navigation away from the stream. That's how A6's
            "view the product without losing the live session" is satisfied. */}
        <div className="video-area" ref={videoRef}>
          {connecting && sessionStatus !== "ended" && (
            <p className="center">Joining stream...</p>
          )}
        </div>

        <div className="live-info-bar">
          <span className="live-badge">● LIVE</span>
          <span>{viewerCount} watching</span>
          {product && <span>{product.name}</span>}
        </div>

        <div className="customer-controls">
          <button onClick={() => setShowProductPanel(true)}>
            View product
          </button>
          <button onClick={() => setShowCart(true)}>Cart</button>
          <button onClick={onLeave}>Leave</button>
        </div>

        {showProductPanel && product && (
          <div className="product-overlay">
            <div className="product-panel">
              <button
                className="close-btn"
                onClick={() => setShowProductPanel(false)}
              >
                ✕
              </button>
              {product.image_url && (
                <img src={product.image_url} alt={product.name} />
              )}
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <p className="price">₹{product.price}</p>
              <p className="stock">{product.stock} in stock</p>

              {product.stock > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
                  <label>Quantity:</label>
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    disabled={selectedQty <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={selectedQty}
                    min={1}
                    max={product.stock}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setSelectedQty(Math.max(1, Math.min(val, product.stock)));
                      }
                    }}
                    style={{ width: '50px', textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedQty((q) => Math.min(product.stock, q + 1))}
                    disabled={selectedQty >= product.stock}
                  >
                    +
                  </button>
                </div>
              )}

              {addedFlash && <p className="added-flash">Added {selectedQty} to cart</p>}
              <button onClick={handleAddToCart} disabled={product.stock === 0}>
                {product.stock === 0 ? "Out of stock" : "Add to cart"}
              </button>
            </div>
          </div>
        )}

        {showCart && <CartDrawer onClose={() => setShowCart(false)} />}
      </div>

      <div className="live-side">
        <Chat sessionId={session.id} />
      </div>
    </div>
  );
}
