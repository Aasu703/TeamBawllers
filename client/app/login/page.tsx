"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) router.push("/dashboard");
      else setError("Invalid credentials");
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" className="gradient-text" style={{ fontSize: "24px", fontWeight: "700", textDecoration: "none" }}>Cyber Guardian</Link>
        </div>
        
        <div className="card">
          <h1 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "6px" }}>Welcome back</h1>
          <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Sign in to your account</p>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#94a3b8" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#94a3b8" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="" required />
            </div>
            {error && <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginBottom: "16px" }} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          
          <p style={{ textAlign: "center", fontSize: "14px", color: "#64748b" }}>
            Don't have an account? <Link href="/register" style={{ color: "#a78bfa" }}>Sign up</Link>
          </p>
        </div>
        
        <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(102,126,234,0.1)", border: "1px solid rgba(102,126,234,0.2)", textAlign: "center" }}>
          <span style={{ fontSize: "13px", color: "#a78bfa" }}>Demo: test@example.com / password123</span>
        </div>
      </div>
    </div>
  );
}
