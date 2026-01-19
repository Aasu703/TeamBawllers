"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [meetingId, setMeetingId] = useState("");

  useEffect(() => {
    let ws: WebSocket;
    let interval: NodeJS.Timeout;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Backend WebSocket - HARDCODED IP for hackathon
        // Change '172.20.10.13' to host's IP if network changes
        const BACKEND_IP = '172.20.10.13';
        ws = new WebSocket(`ws://${BACKEND_IP}:8000/ws`);
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (e) => setResult(JSON.parse(e.data));

        interval = setInterval(() => {
          if (canvasRef.current && videoRef.current && ws.readyState === 1) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0);
              ws.send(JSON.stringify({ frame: canvasRef.current.toDataURL("image/jpeg", 0.6), sent_at: Date.now() }));
            }
          }
        }, 500);
      } catch (e) { console.error(e); }
    })();

    return () => { clearInterval(interval); ws?.close(); };
  }, []);

  const startMeeting = () => {
    const id = Math.random().toString(36).substr(2, 8).toUpperCase();
    router.push("/dashboard/conference?mode=create&meetingId=" + id);
  };

  const joinMeeting = () => {
    if (meetingId.trim()) router.push("/dashboard/conference?mode=join&meetingId=" + meetingId);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "4px" }}>Detection Dashboard</h1>
          <p style={{ fontSize: "14px", color: "#64748b" }}>Real-time deepfake monitoring</p>
        </div>
        <div className={connected ? "badge badge-success" : "badge badge-danger"}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: connected ? "#34d399" : "#f87171" }}></span>
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {/* Meeting Buttons */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <span>+</span> Create Meeting
        </button>
        <button onClick={() => setShowJoin(true)} className="btn btn-secondary">
          Join Meeting
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px" }}>
        {/* Video Feed */}
        <div className="card">
          <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>Live Feed</h2>
          <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
            <video ref={videoRef} autoPlay muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {result && (
              <div style={{ 
                position: "absolute", top: "12px", left: "12px", 
                padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
                background: result.is_fake ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)",
                color: "white", backdropFilter: "blur(4px)"
              }}>
                {result.is_fake ? " DEEPFAKE DETECTED" : " GENUINE"}  {(result.confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="stat-value">99.8%</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Accuracy</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#a855f7" }}>&lt;500ms</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Response Time</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#22d3ee" }}>24/7</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Monitoring</div>
          </div>
        </div>
      </div>

      {/* Create Meeting Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", width: "380px", maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(102,126,234,0.3), rgba(168,85,247,0.3))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "24px" }}>📹</div>
              <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Create Meeting</h2>
              <p style={{ fontSize: "14px", color: "#64748b" }}>Start a new secure video conference with AI deepfake detection</p>
            </div>
            <button onClick={startMeeting} className="btn btn-primary" style={{ width: "100%", marginBottom: "12px", padding: "14px" }}>
              🚀 Start Meeting Now
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ width: "100%", padding: "12px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join Meeting Modal */}
      {showJoin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowJoin(false)}>
          <div style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", width: "380px", maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(34,211,238,0.3))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "24px" }}>🔗</div>
              <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Join Meeting</h2>
              <p style={{ fontSize: "14px", color: "#64748b" }}>Enter the meeting ID shared with you</p>
            </div>
            <input 
              value={meetingId} 
              onChange={(e) => setMeetingId(e.target.value.toUpperCase())} 
              className="input" 
              placeholder="Enter meeting ID (e.g., ABC123XY)" 
              style={{ marginBottom: "16px", padding: "14px", textAlign: "center", fontSize: "16px", letterSpacing: "2px", fontWeight: "600" }}
            />
            <button onClick={joinMeeting} className="btn btn-primary" style={{ width: "100%", marginBottom: "12px", padding: "14px" }} disabled={!meetingId.trim()}>
              ✓ Join Meeting
            </button>
            <button onClick={() => setShowJoin(false)} className="btn btn-secondary" style={{ width: "100%", padding: "12px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
