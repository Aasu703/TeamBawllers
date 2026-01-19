"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BACKEND_IP = process.env.NEXT_PUBLIC_BACKEND_HOST || "localhost";

// Deepfake detection result interface
interface DeepfakeResult {
  is_fake: boolean;
  confidence: number;
  message: string;
  face_detected?: boolean;
  timestamp?: string;
}

export default function ConferencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get("meetingId") || "MEETING";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const initRef = useRef(false); // Prevent double init
  const isHostRef = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState(1);
  const [isHost, setIsHost] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // Deepfake detection states
  const [localDeepfakeResult, setLocalDeepfakeResult] = useState<DeepfakeResult | null>(null);
  const [remoteDeepfakeResult, setRemoteDeepfakeResult] = useState<DeepfakeResult | null>(null);
  const [isDetectionEnabled, setIsDetectionEnabled] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  
  // Video testing states
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testVideoUrl, setTestVideoUrl] = useState<string | null>(null);
  const [testVideoResult, setTestVideoResult] = useState<DeepfakeResult | null>(null);
  const [isTestingVideo, setIsTestingVideo] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Function to capture frame from video and send to detection API
  const captureAndDetect = useCallback(async (
    videoElement: HTMLVideoElement | null,
    setResult: (result: DeepfakeResult | null) => void,
    source: string
  ) => {
    if (!videoElement || videoElement.readyState < 2 || !isDetectionEnabled) return;

    try {
      setDetectionStatus('checking');
      
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.9);
      
      // Send to detection API with source identifier
      const response = await fetch(`http://${BACKEND_IP}:8000/api/detect/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: frameBase64, source: source }),
      });
      
      if (response.ok) {
        const result: DeepfakeResult = await response.json();
        setResult(result);
        setDetectionStatus('idle');
      }
    } catch (err) {
      console.error(`Detection error (${source}):`, err);
      setDetectionStatus('error');
    }
  }, [isDetectionEnabled]);

  // Start periodic deepfake detection
  useEffect(() => {
    if (!isDetectionEnabled) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }

    // Run initial detection immediately
    captureAndDetect(localVideoRef.current, setLocalDeepfakeResult, 'local');

    // Run detection every 1.5 seconds for faster response
    detectionIntervalRef.current = setInterval(() => {
      // Detect local video
      captureAndDetect(localVideoRef.current, setLocalDeepfakeResult, 'local');
      
      // Detect remote video if connected - use separate source for independent buffering
      if (hasRemote && remoteVideoRef.current) {
        setTimeout(() => {
          captureAndDetect(remoteVideoRef.current, setRemoteDeepfakeResult, 'remote');
        }, 500); // Stagger remote detection to avoid overloading
      }
    }, 1500);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isDetectionEnabled, hasRemote, captureAndDetect]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteVideoRef.current, remoteStream]);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return (
      m.toString().padStart(2, "0") + ":" + sec.toString().padStart(2, "0")
    );
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.relay.metered.ca:80" },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "e8dd65b92c629e4e1048c809",
          credential: "5UxxMNdpNIBJsrlq",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "e8dd65b92c629e4e1048c809",
          credential: "5UxxMNdpNIBJsrlq",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "e8dd65b92c629e4e1048c809",
          credential: "5UxxMNdpNIBJsrlq",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "e8dd65b92c629e4e1048c809",
          credential: "5UxxMNdpNIBJsrlq",
        },
      ],
      iceCandidatePoolSize: 10,
    });

    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    pc.ontrack = (e) => {
      console.log("Got remote track:", e.track.kind);
      if(e.streams[0]){
        setRemoteStream(e.streams[0]);
      }
      if (remoteVideoRef.current && e.streams[0]) {
        // Always set the stream (in case of new tracks or stream changes)
        remoteVideoRef.current.srcObject = e.streams[0];
        console.log("Video stream",remoteVideoRef.current)
        setHasRemote(true);
        setParticipants(2);

        // Listen for new tracks added to the remote stream
        e.streams[0].onaddtrack = () => {
          console.log("Added stream")
          remoteVideoRef.current!.srcObject = e.streams[0];
        };
        // Listen for tracks being removed (optional, for cleanup)
        e.streams[0].onremovetrack = () => {
          // If no tracks left, clear the video
          if (e.streams[0].getTracks().length === 0 && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
            setHasRemote(false);
            setParticipants(1);
          }
        };
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: e.candidate,
            meetingId,
          }),
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.log("ICE failed, restarting...");
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setHasRemote(true);
        setParticipants(2);
      } else if (pc.connectionState === "failed") {
        // Try to restart the connection
        console.log("Connection failed, attempting restart...");
        if (isHostRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          setTimeout(async () => {
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              wsRef.current?.send(
                JSON.stringify({
                  type: "offer",
                  offer: pc.localDescription,
                  meetingId,
                }),
              );
              console.log("Restart offer sent");
            } catch (e) {
              console.error("Restart failed:", e);
            }
          }, 1000);
        }
      }
    };

    return pc;
  };

  useEffect(() => {
    // Prevent double initialization (React StrictMode)
    if (initRef.current) return;
    initRef.current = true;

    let stream: MediaStream | null = null;
    let ws: WebSocket | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 640, height: 480 },
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        ws = new WebSocket(`ws://${BACKEND_IP}:8000/conference`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WS connected");
          setConnected(true);
          createPeerConnection();
          ws!.send(JSON.stringify({ type: "join", meetingId }));
        };

        ws.onmessage = async (evt) => {
          const data = JSON.parse(evt.data);
          console.log("MSG:", data.type);

          if (data.type === "joined") {
            const existingPeers = data.existingPeers || [];

            if (existingPeers.length === 0) {
              // We are HOST (first in room) - we will send offers
              isHostRef.current = true;
              setIsHost(true);
              console.log("I am HOST");
            } else {
              // We are GUEST - we wait for offers
              isHostRef.current = false;
              setIsHost(false);
              setParticipants(existingPeers.length + 1);
              console.log("I am GUEST");
            }
          } else if (data.type === "peer-joined") {
            // Only HOST sends offers to new peers
            if (!isHostRef.current) {
              console.log("Ignoring peer-joined (I am guest)");
              return;
            }

            console.log("Peer joined, sending offer");
            setParticipants((p) => p + 1);

            const pc = pcRef.current;
            if (!pc || !wsRef.current) return;

            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              wsRef.current.send(
                JSON.stringify({
                  type: "offer",
                  offer: pc.localDescription,
                  meetingId,
                }),
              );
              console.log("Offer sent");
            } catch (err) {
              console.error("Offer error:", err);
            }
          } else if (data.type === "offer") {
            const pc = pcRef.current;
            if (!pc || !wsRef.current) return;

            // Guests handle offers (including re-offers for ICE restart)
            console.log("Handling offer, signaling state:", pc.signalingState);
            try {
              // If we're in stable state or have-remote-offer, we can accept
              if (
                pc.signalingState !== "stable" &&
                pc.signalingState !== "have-remote-offer"
              ) {
                console.log("Rolling back before accepting offer");
                await pc.setLocalDescription({ type: "rollback" });
              }

              await pc.setRemoteDescription(
                new RTCSessionDescription(data.offer),
              );

              // Add any pending ICE candidates
              for (const c of pendingCandidates.current) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              pendingCandidates.current = [];

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              wsRef.current.send(
                JSON.stringify({
                  type: "answer",
                  answer: pc.localDescription,
                  meetingId,
                }),
              );
              console.log("Answer sent");
            } catch (err) {
              console.error("Offer handling error:", err);
            }
          } else if (data.type === "answer") {
            const pc = pcRef.current;
            if (!pc) return;

            // Only host should receive answers
            if (!isHostRef.current) {
              console.log("Ignoring answer (I am guest)");
              return;
            }

            console.log("Handling answer, state:", pc.signalingState);
            try {
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(data.answer),
                );
                console.log("Answer applied");
              }
            } catch (err) {
              console.error("Answer error:", err);
            }
          } else if (data.type === "ice-candidate" && data.candidate) {
            const pc = pcRef.current;
            if (!pc) return;

            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                // Queue candidates until we have remote description
                pendingCandidates.current.push(data.candidate);
              }
            } catch (err) {
              // Ignore
            }
          } else if (data.type === "peer-left") {
            console.log("Peer left");
            setHasRemote(false);
            setParticipants((p) => Math.max(1, p - 1));
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null;
            }
          }
        };

        ws.onclose = () => setConnected(false);
        ws.onerror = () => setError("Connection failed");
      } catch (err) {
        setError("Camera/Mic access denied");
      }
    };

    init();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      wsRef.current?.close();
    };
  }, [meetingId]);

  const toggleAudio = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsAudioMuted(!isAudioMuted);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsVideoOff(!isVideoOff);
  };

  const endCall = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    wsRef.current?.close();
    router.push("/dashboard");
  };
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video) return;
    const onError = () => console.error("Remote video error", video.error);
    video.addEventListener("error", onError);
    return () => video.removeEventListener("error", onError);
  }, []);

  return (
    <div style={{ padding: "24px", minHeight: "100vh", background: "#0a0a0f" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
            Video Conference
          </h1>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: "12px",
              background: connected
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(239, 68, 68, 0.2)",
              color: connected ? "#22c55e" : "#ef4444",
            }}
          >
            {connected ? "● Connected" : "● Disconnected"}
          </span>
          <span style={{ color: "#888" }}>{formatTime(duration)}</span>
          <span style={{ color: "#888" }}>👥 {participants}</span>
        </div>
        <button
          onClick={endCall}
          style={{
            padding: "8px 16px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          End Call
        </button>
      </div>

      <div
        style={{
          padding: "16px",
          marginBottom: "16px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "12px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ color: "#888" }}>Share this ID:</span>
        <span
          style={{
            color: "#a855f7",
            fontWeight: "bold",
            fontFamily: "monospace",
          }}
        >
          {meetingId}
        </span>
        <button
          onClick={copyMeetingId}
          style={{
            padding: "6px 12px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasRemote ? "1fr 1fr" : "1fr",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "12px",
            padding: "16px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span style={{ color: "#fff" }}>You</span>
            <span
              style={{
                padding: "2px 8px",
                background: isHost ? "#a855f7" : "#22c55e",
                color: "#fff",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {isHost ? "HOST" : "GUEST"}
            </span>
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: "8px",
              background: "#1a1a2e",
              transform: "scaleX(-1)",
            }}
          />
          {/* Local Deepfake Detection Badge */}
          {localDeepfakeResult && isDetectionEnabled && (
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                left: "24px",
                right: "24px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: localDeepfakeResult.is_fake 
                  ? "rgba(239, 68, 68, 0.95)" 
                  : localDeepfakeResult.face_detected 
                    ? "rgba(34, 197, 94, 0.95)"
                    : "rgba(156, 163, 175, 0.9)",
                color: "#fff",
                fontSize: localDeepfakeResult.is_fake ? "14px" : "13px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backdropFilter: "blur(4px)",
                border: localDeepfakeResult.is_fake ? "2px solid #ff0000" : localDeepfakeResult.face_detected ? "2px solid #22c55e" : "none",
                animation: localDeepfakeResult.is_fake ? "flash 0.5s infinite" : "none",
                boxShadow: localDeepfakeResult.is_fake ? "0 0 20px rgba(255, 0, 0, 0.8)" : localDeepfakeResult.face_detected ? "0 0 10px rgba(34, 197, 94, 0.5)" : "none",
              }}
            >
              <span>
                {localDeepfakeResult.is_fake 
                  ? "🚨 DEEPFAKE DETECTED 🚨" 
                  : localDeepfakeResult.face_detected 
                    ? "✅ GENUINE FACE (YOU)"
                    : "👤 No face"}
              </span>
              <span style={{ 
                background: localDeepfakeResult.is_fake ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "12px"
              }}>
                {localDeepfakeResult.face_detected 
                  ? `${(localDeepfakeResult.confidence * 100).toFixed(0)}%`
                  : ""}
              </span>
            </div>
          )}
        </div>

        {hasRemote ? (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              padding: "16px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ color: "#fff" }}>Remote Participant</span>
              {remoteDeepfakeResult && isDetectionEnabled && (
                <span style={{
                  padding: "2px 8px",
                  background: remoteDeepfakeResult.is_fake ? "#ef4444" : remoteDeepfakeResult.face_detected ? "#22c55e" : "#666",
                  color: "#fff",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  animation: remoteDeepfakeResult.is_fake ? "flash 0.5s infinite" : "none",
                }}>
                  {remoteDeepfakeResult.is_fake ? "⚠️ FAKE" : remoteDeepfakeResult.face_detected ? "✓ REAL" : "?"}
                </span>
              )}
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              controls
              style={{
                width: "100%",
                borderRadius: "8px",
                background: "#1a1a2e",
              }}
            />
            {/* Remote Deepfake Detection Badge */}
            {remoteDeepfakeResult && isDetectionEnabled && (
              <div
                style={{
                  position: "absolute",
                  bottom: "24px",
                  left: "24px",
                  right: "24px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: remoteDeepfakeResult.is_fake 
                    ? "rgba(239, 68, 68, 0.95)" 
                    : remoteDeepfakeResult.face_detected 
                      ? "rgba(34, 197, 94, 0.95)"
                      : "rgba(156, 163, 175, 0.9)",
                  color: "#fff",
                  fontSize: remoteDeepfakeResult.is_fake ? "14px" : "13px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backdropFilter: "blur(4px)",
                  border: remoteDeepfakeResult.is_fake ? "2px solid #ff0000" : remoteDeepfakeResult.face_detected ? "2px solid #22c55e" : "none",
                  animation: remoteDeepfakeResult.is_fake ? "flash 0.5s infinite" : "none",
                  boxShadow: remoteDeepfakeResult.is_fake ? "0 0 20px rgba(255, 0, 0, 0.8)" : remoteDeepfakeResult.face_detected ? "0 0 10px rgba(34, 197, 94, 0.5)" : "none",
                }}
              >
                <span>
                  {remoteDeepfakeResult.is_fake 
                    ? "🚨 DEEPFAKE DETECTED (REMOTE) 🚨" 
                    : remoteDeepfakeResult.face_detected 
                      ? "✅ GENUINE FACE (REMOTE)"
                      : "👤 No face detected"}
                </span>
                <span style={{ 
                  background: remoteDeepfakeResult.is_fake ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px"
                }}>
                  {remoteDeepfakeResult.face_detected 
                    ? `${(remoteDeepfakeResult.confidence * 100).toFixed(0)}%`
                    : ""}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <span
              style={{ color: "#fff", marginBottom: "12px", display: "block" }}
            >
              Waiting...
            </span>
            <div
              style={{
                aspectRatio: "16/9",
                background: "#1a1a2e",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "3px solid #333",
                  borderTopColor: "#a855f7",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ color: "#666" }}>Waiting for others</span>
              <span style={{ color: "#a855f7", fontFamily: "monospace" }}>
                {meetingId}
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
        <button
          onClick={toggleAudio}
          style={{
            padding: "12px 24px",
            background: isAudioMuted ? "#ef4444" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {isAudioMuted ? "🔇 Unmute" : "🎤 Mute"}
        </button>
        <button
          onClick={toggleVideo}
          style={{
            padding: "12px 24px",
            background: isVideoOff ? "#ef4444" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {isVideoOff ? "📷 Start Video" : "🎥 Stop Video"}
        </button>
        <button
          onClick={() => setIsDetectionEnabled(!isDetectionEnabled)}
          style={{
            padding: "12px 24px",
            background: isDetectionEnabled ? "#22c55e" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {isDetectionEnabled ? "🛡️ AI Shield ON" : "🛡️ AI Shield OFF"}
        </button>
        <button
          onClick={copyMeetingId}
          style={{
            padding: "12px 24px",
            background: "#a855f7",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          📋 Share ID
        </button>
        <button
          onClick={endCall}
          style={{
            padding: "12px 24px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          📞 End
        </button>
      </div>

      {/* Detection Status Bar */}
      {isDetectionEnabled && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            background: "rgba(168, 85, 247, 0.1)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <span style={{ color: "#a855f7" }}>🛡️ AI Deepfake Shield Active</span>
          <span style={{ color: "#666", fontSize: "12px" }}>
            {detectionStatus === 'checking' ? '• Analyzing...' : '• Monitoring'}
          </span>
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              background: "#a855f7",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            🎬 Test Video
          </button>
        </div>
      )}

      {/* Video Test Panel */}
      {showTestPanel && (
        <div
          style={{
            marginTop: "16px",
            padding: "20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ color: "#fff", margin: 0 }}>🎬 Test Deepfake Detection</h3>
            <button onClick={() => setShowTestPanel(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "20px" }}>✕</button>
          </div>
          
          <p style={{ color: "#888", fontSize: "14px", marginBottom: "16px" }}>
            Upload a video to test if it contains a deepfake. The AI will analyze frames and detect manipulated faces.
          </p>
          
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setTestVideoUrl(url);
                  setTestVideoResult(null);
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📁 Upload Video
            </button>
            
            {testVideoUrl && (
              <button
                onClick={async () => {
                  if (!testVideoRef.current || testVideoRef.current.readyState < 2) return;
                  setIsTestingVideo(true);
                  setTestVideoResult(null);
                  
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = testVideoRef.current.videoWidth || 640;
                    canvas.height = testVideoRef.current.videoHeight || 480;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    ctx.drawImage(testVideoRef.current, 0, 0, canvas.width, canvas.height);
                    const frameBase64 = canvas.toDataURL('image/jpeg', 0.9);
                    
                    const response = await fetch(`http://${BACKEND_IP}:8000/api/detect/face`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ frame: frameBase64, source: 'test' }),
                    });
                    
                    if (response.ok) {
                      const result: DeepfakeResult = await response.json();
                      setTestVideoResult(result);
                    }
                  } catch (err) {
                    console.error('Test detection error:', err);
                  } finally {
                    setIsTestingVideo(false);
                  }
                }}
                disabled={isTestingVideo}
                style={{
                  padding: "10px 20px",
                  background: isTestingVideo ? "#666" : "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isTestingVideo ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {isTestingVideo ? "🔄 Analyzing..." : "🔍 Analyze Current Frame"}
              </button>
            )}
          </div>
          
          {testVideoUrl && (
            <div style={{ position: "relative" }}>
              <video
                ref={testVideoRef}
                src={testVideoUrl}
                controls
                style={{
                  width: "100%",
                  maxHeight: "300px",
                  borderRadius: "8px",
                  background: "#1a1a2e",
                }}
              />
              
              {/* Test Result Badge */}
              {testVideoResult && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "16px",
                    borderRadius: "8px",
                    background: testVideoResult.is_fake 
                      ? "rgba(239, 68, 68, 0.2)" 
                      : testVideoResult.face_detected 
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(156, 163, 175, 0.2)",
                    border: testVideoResult.is_fake 
                      ? "2px solid #ef4444" 
                      : testVideoResult.face_detected 
                        ? "2px solid #22c55e"
                        : "2px solid #666",
                    animation: testVideoResult.is_fake ? "flash 0.5s infinite" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ 
                      color: testVideoResult.is_fake ? "#ef4444" : "#22c55e", 
                      fontWeight: "bold",
                      fontSize: "18px"
                    }}>
                      {testVideoResult.is_fake 
                        ? "🚨 DEEPFAKE DETECTED 🚨" 
                        : testVideoResult.face_detected 
                          ? "✅ GENUINE HUMAN FACE"
                          : "👤 No face detected"}
                    </span>
                    <span style={{ 
                      color: "#fff",
                      background: testVideoResult.is_fake ? "#ef4444" : "#22c55e",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontWeight: "bold"
                    }}>
                      {testVideoResult.face_detected 
                        ? `${(testVideoResult.confidence * 100).toFixed(1)}% confidence`
                        : "N/A"}
                    </span>
                  </div>
                  <p style={{ color: "#888", marginTop: "8px", marginBottom: 0, fontSize: "14px" }}>
                    {testVideoResult.is_fake 
                      ? "⚠️ This video appears to contain AI-generated or manipulated facial content."
                      : testVideoResult.face_detected 
                        ? "✅ This video appears to contain a genuine, unmanipulated human face."
                        : "No face was detected in the current frame. Try a different frame."}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {!testVideoUrl && (
            <div
              style={{
                padding: "40px",
                border: "2px dashed #444",
                borderRadius: "8px",
                textAlign: "center",
                color: "#666",
              }}
            >
              <p style={{ margin: 0 }}>📹 Upload a video file to test deepfake detection</p>
              <p style={{ margin: "8px 0 0 0", fontSize: "12px" }}>Supports MP4, WebM, MOV formats</p>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
