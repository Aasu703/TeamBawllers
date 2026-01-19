"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  const navItems = [
    { href: "/dashboard", icon: "", label: "Dashboard" },
    { href: "/dashboard/conference", icon: "", label: "Conference" }
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ width: "220px", padding: "20px", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
        <Link href="/" className="gradient-text" style={{ fontSize: "18px", fontWeight: "700", textDecoration: "none", marginBottom: "32px" }}>
          Cyber Guardian
        </Link>
        
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href} 
              className={pathname === item.href ? "nav-link active" : "nav-link"}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        
        <button onClick={handleLogout} className="nav-link" style={{ border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}>
          <span></span>
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
