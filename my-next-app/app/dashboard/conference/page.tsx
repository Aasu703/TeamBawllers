"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConferencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get("meetingId") || "MEETING";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const hasRemoteDescRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m.toString().padStart(2, "0") + ":" + sec.toString().padStart(2, "0");
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processPendingCandidates = async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn("Failed to add queued ICE candidate:", e);
      }
    }
    pendingCandidatesRef.current = [];
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ 
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ] 
        });
        peerConnectionRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream!));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current && e.streams[0]) {
            remoteVideoRef.current.srcObject = e.streams[0];
            setHasRemote(true);
            setParticipants(2);
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate, meetingId }));
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            setHasRemote(false);
            setParticipants(1);
          }
        };

        const ws = new WebSocket("ws://localhost:8000/conference");
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({ type: "join", meetingId }));
        };

        ws.onmessage = async (evt) => {
          const data = JSON.parse(evt.data);
          
          if (data.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            hasRemoteDescRef.current = true;
            await processPendingCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer, meetingId }));
          } else if (data.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            hasRemoteDescRef.current = true;
            await processPendingCandidates(pc);
          } else if (data.type === "ice-candidate") {
            const candidate = new RTCIceCandidate(data.candidate);
            if (hasRemoteDescRef.current && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (e) {
                console.warn("Failed to add ICE candidate:", e);
              }
            } else {
              pendingCandidatesRef.current.push(candidate);
            }
          } else if (data.type === "peer-joined") {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "offer", offer, meetingId }));
          } else if (data.type === "peer-left") {
            setHasRemote(false);
            setParticipants(1);
          }
        };

        ws.onclose = () => setConnected(false);
        ws.onerror = () => setError("Connection failed");
      } catch (err) {
        setError("Camera/Mic access denied. Please allow permissions.");
      }
    };

    init();
    
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      peerConnectionRef.current?.close();
      wsRef.current?.close();
    };
  }, [meetingId]);

  const toggleAudio = () => {
    localStream?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setIsAudioMuted(!isAudioMuted);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div style={{ height: "calc(100vh - 48px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <h1 className="gradient-text" style={{ fontSize: "20px", fontWeight: "600" }}>Video Conference</h1>
          <div className={connected ? "badge badge-success" : "badge badge-danger"}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: connected ? "#34d399" : "#f87171" }}></span>
            {connected ? "Live" : "Connecting..."}
          </div>
          <span style={{ color: "#a78bfa", fontSize: "14px", fontWeight: "600" }}>{formatTime(duration)}</span>
          <span style={{ color: "#64748b", fontSize: "13px" }}> {participants}</span>
        </div>
        <button onClick={() => router.push("/dashboard")} className="btn" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "8px 16px", fontSize: "13px" }}>
          End Call
        </button>
      </div>

      {/* Meeting ID Share Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "12px", margin: "16px 0", background: "rgba(102,126,234,0.1)", borderRadius: "10px", border: "1px solid rgba(102,126,234,0.2)" }}>
        <span style={{ color: "#94a3b8", fontSize: "13px" }}>Share this ID to invite others:</span>
        <code style={{ background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: "6px", fontSize: "15px", fontWeight: "600", color: "#a78bfa", letterSpacing: "1px" }}>{meetingId}</code>
        <button onClick={copyMeetingId} className="btn" style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)", color: copied ? "#34d399" : "#e2e8f0", border: "none", padding: "6px 12px", fontSize: "12px" }}>
          {copied ? " Copied!" : " Copy"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", marginBottom: "16px", color: "#f87171", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* Video Grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", minHeight: 0 }}>
        {/* Local Video */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "16px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "500" }}>You</span>
              <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(102,126,234,0.2)", borderRadius: "4px", color: "#a78bfa" }}>HOST</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={toggleAudio} style={{ 
                width: "32px", height: "32px", borderRadius: "6px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                background: isAudioMuted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)", color: isAudioMuted ? "#f87171" : "#e2e8f0"
              }}>
                {isAudioMuted ? "" : ""}
              </button>
              <button onClick={toggleVideo} style={{ 
                width: "32px", height: "32px", borderRadius: "6px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                background: isVideoOff ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)", color: isVideoOff ? "#f87171" : "#e2e8f0"
              }}>
                {isVideoOff ? "" : ""}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", background: "#0a0a0f", position: "relative", minHeight: "200px" }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {isVideoOff && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(102,126,234,0.3), rgba(168,85,247,0.3))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "32px" }}>
                    
                  </div>
                  <span style={{ color: "#64748b", fontSize: "13px" }}>Camera off</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Remote Video / Waiting */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "16px", overflow: "hidden" }}>
          <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "500" }}>{hasRemote ? "Participant" : "Waiting..."}</span>
            {hasRemote && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399" }}></span>}
          </div>
          <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", background: "#0a0a0f", position: "relative", minHeight: "200px" }}>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: hasRemote ? "block" : "none" }} />
            {!hasRemote && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, rgba(102,126,234,0.05), rgba(168,85,247,0.05))" }}>
                <div style={{ textAlign: "center", maxWidth: "280px" }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <span style={{ fontSize: "32px", opacity: 0.5 }}></span>
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: "15px", fontWeight: "500", marginBottom: "8px" }}>Waiting for others to join</p>
                  <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.5 }}>Share the meeting ID above to invite participants</p>
                  <div style={{ marginTop: "16px", padding: "10px 16px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", display: "inline-block" }}>
                    <span style={{ color: "#a78bfa", fontWeight: "600", letterSpacing: "1px" }}>{meetingId}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ display: "flex", justifyContent: "center", gap: "12px", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "16px" }}>
        <button onClick={toggleAudio} className="btn" style={{ 
          background: isAudioMuted ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)", 
          color: isAudioMuted ? "#f87171" : "#e2e8f0",
          border: isAudioMuted ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
          padding: "12px 24px", borderRadius: "12px"
        }}>
          {isAudioMuted ? " Unmute" : " Mute"}
        </button>
        <button onClick={toggleVideo} className="btn" style={{ 
          background: isVideoOff ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)", 
          color: isVideoOff ? "#f87171" : "#e2e8f0",
          border: isVideoOff ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
          padding: "12px 24px", borderRadius: "12px"
        }}>
          {isVideoOff ? " Start Video" : " Stop Video"}
        </button>
        <button onClick={copyMeetingId} className="btn" style={{ 
          background: "rgba(102,126,234,0.2)", 
          color: "#a78bfa",
          border: "1px solid rgba(102,126,234,0.3)",
          padding: "12px 24px", borderRadius: "12px"
        }}>
           Invite
        </button>
        <button onClick={() => router.push("/dashboard")} className="btn" style={{ 
          background: "linear-gradient(135deg, #ef4444, #dc2626)", 
          color: "white", 
          border: "none", 
          padding: "12px 24px", 
          borderRadius: "12px",
          boxShadow: "0 4px 15px rgba(239,68,68,0.3)"
        }}>
           End Call
        </button>
      </div>
    </div>
  );
}
