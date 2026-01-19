import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: "700" }} className="gradient-text">Cyber Guardian</div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link href="/login" className="btn btn-secondary">Login</Link>
          <Link href="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 20px" }}>
        <div className="badge" style={{ background: "rgba(102,126,234,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", marginBottom: "24px" }}>
          ✨ AI-Powered Security Platform
        </div>
        
        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "800", lineHeight: 1.1, marginBottom: "16px", maxWidth: "800px" }}>
          <span className="gradient-text">Deepfake Detection</span>
          <br />
          <span style={{ color: "#f1f5f9" }}>Made Simple</span>
        </h1>
        
        <p style={{ fontSize: "18px", color: "#94a3b8", maxWidth: "600px", marginBottom: "32px", lineHeight: 1.6 }}>
          Real-time AI detection for video calls. Protect your team from synthetic media threats with enterprise-grade security.
        </p>

        <div style={{ display: "flex", gap: "16px", marginBottom: "60px" }}>
          <Link href="/register" className="btn btn-primary" style={{ padding: "14px 28px", fontSize: "16px" }}>
            Start Free Trial →
          </Link>
          <Link href="/login" className="btn btn-secondary" style={{ padding: "14px 28px", fontSize: "16px" }}>
            Sign In
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", maxWidth: "800px", width: "100%" }}>
          {[
            { value: "99.8%", label: "Detection Accuracy" },
            { value: "<500ms", label: "Response Time" },
            { value: "10M+", label: "Frames Analyzed" },
            { value: "24/7", label: "Monitoring" }
          ].map((stat, i) => (
            <div key={i} className="card" style={{ textAlign: "center", padding: "20px" }}>
              <div className="stat-value">{stat.value}</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Features */}
      <section style={{ padding: "60px 40px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "28px", fontWeight: "700", marginBottom: "40px" }}>
            Why <span className="gradient-text">Cyber Guardian</span>?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { icon: "🛡️", title: "Enterprise Security", desc: "Military-grade encryption for all your communications" },
              { icon: "⚡", title: "Real-time Detection", desc: "Instant deepfake analysis during live video calls" },
              { icon: "🎥", title: "Secure Conferencing", desc: "Built-in video calls with threat monitoring" }
            ].map((f, i) => (
              <div key={i} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{f.icon}</div>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>{f.title}</h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "20px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p style={{ fontSize: "13px", color: "#475569" }}>© 2026 Cyber Guardian. Protecting digital authenticity.</p>
      </footer>
    </div>
  );
}
