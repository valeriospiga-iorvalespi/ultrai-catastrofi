// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  // ✅ Mostra errore se redirectati con ?error=unauthorized
  useEffect(() => {
    if (searchParams.get("error") === "unauthorized") {
      setError("Accesso non autorizzato. Usa un'email aziendale Allianz.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError("Email o password non validi. Riprova.");
      setLoading(false);
      return;
    }

    router.push("/chat");
    router.refresh();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #001f5c 0%, #003781 50%, #0056c7 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ position: "fixed", inset: 0,
        backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%)",
        pointerEvents: "none" }} />

      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 44px",
        width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        position: "relative", zIndex: 1,
        // ✅ responsive su mobile
        margin: "0 16px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <Image src="/allianz-logo.png" alt="Allianz" width={40} height={40}
              style={{ objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#003781", lineHeight: 1.1 }}>UltrAI</div>
              <div style={{ fontSize: 11.5, color: "#5a6a85", lineHeight: 1.3 }}>Catastrofi naturali Impresa</div>
            </div>
          </div>
          <p style={{ color: "#5a6a85", fontSize: 14, marginTop: 12 }}>
            Accedi con le tue credenziali
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="email" style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.cognome@allianz.it"
              required autoComplete="email"
              style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #d1d9e0",
                borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none",
                transition: "border-color 0.2s", color: "#2c3e50" }}
              onFocus={(e) => (e.target.style.borderColor = "#003781")}
              onBlur={(e) => (e.target.style.borderColor = "#d1d9e0")} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password" style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input id="password" type={showPwd ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #d1d9e0",
                  borderRadius: 8, padding: "11px 42px 11px 14px", fontSize: 14, outline: "none",
                  transition: "border-color 0.2s", color: "#2c3e50" }}
                onFocus={(e) => (e.target.style.borderColor = "#003781")}
                onBlur={(e) => (e.target.style.borderColor = "#d1d9e0")} />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "#9aa5b4", fontSize: 14, padding: 0 }}>
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: "#fff0f0", border: "1px solid #ffbdbd", borderRadius: 6,
              padding: "9px 14px", fontSize: 13, color: "#c0392b", marginBottom: 18,
              display: "flex", gap: 6, alignItems: "center" }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: "100%", background: loading ? "#6b8fc4" : "#003781", color: "#fff",
              border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? (
              <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                animation: "spin 0.8s linear infinite" }} />Accesso in corso…</>
            ) : "Accedi"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#9aa5b4", fontStyle: "italic" }}>
          APPLICATIVO DEMO di Valerio Spiga
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
