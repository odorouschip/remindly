"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

type OAuthProvider = "google" | "apple" | "azure" | "github";

type LoginScreenProps = {
  onSignIn: (email: string, password: string) => void | Promise<void>;
  onOAuth: (provider: OAuthProvider) => void | Promise<void>;
  onForgotPassword: () => void;
  onSignUp: () => void;
  status: string;
  isWorking: boolean;
};

const ACCENT = "#F4845F";
const ACCENT_DARK = "#E06A44";

export function LoginScreen({ onSignIn, onOAuth, onForgotPassword, onSignUp, status, isWorking }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    void onSignIn(email, password);
  };

  return (
    <div style={{position:"fixed",inset:0,minHeight:"100vh",display:"grid",gridTemplateColumns:"1fr 1fr",fontFamily:"'DM Sans', sans-serif",background:"#FAFAF9",color:"#1A1714"}}>
      {/* Left brand panel */}
      <div style={{background:"#1A1714",display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-end",padding:48,position:"relative",overflow:"hidden"}} className="login-brand-panel">
        {/* Decorative circles */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 500 700" fill="none" preserveAspectRatio="xMidYMid slice">
          <circle cx="420" cy="80" r="220" fill="rgba(244,132,95,0.08)"/>
          <circle cx="80" cy="600" r="180" fill="rgba(244,132,95,0.06)"/>
          <circle cx="300" cy="350" r="120" fill="rgba(244,132,95,0.04)"/>
        </svg>

        {/* Logo lockup */}
        <div style={{position:"absolute",top:48,left:48,display:"flex",alignItems:"center",gap:10,zIndex:2}}>
          <div style={{width:36,height:36,borderRadius:10,background:ACCENT,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.4"/>
              <path d="M1 6h12" stroke="white" strokeWidth="1.4"/>
              <path d="M4 1v3M10 1v3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{fontSize:18,fontWeight:700,color:"#fff",letterSpacing:"-0.03em"}}>Remindly</span>
        </div>

        {/* Mini calendar preview card */}
        <CalendarPreview/>

        {/* Tagline */}
        <div style={{position:"relative",zIndex:1}}>
          <h1 style={{fontSize:36,fontWeight:700,color:"#fff",lineHeight:1.15,letterSpacing:"-0.03em",marginBottom:14,textWrap:"pretty" as CSSProperties["textWrap"]}}>
            Your time,<br/>
            <span style={{color:ACCENT}}>beautifully</span><br/>
            organized.
          </h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,0.45)",lineHeight:1.6,maxWidth:340}}>
            Remindly keeps every event, task, and reminder in one calm, focused place.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:48,background:"#FDFCFB"}}>
        <div style={{width:"100%",maxWidth:400,animation:"fadeUp 0.45s ease both"}}>
          <h2 style={{fontSize:24,fontWeight:700,letterSpacing:"-0.03em",color:"#1A1714",marginBottom:6}}>Welcome back</h2>
          <p style={{fontSize:13,color:"#8a8580",marginBottom:28}}>
            Don't have an account?{" "}
            <button onClick={onSignUp} style={{background:"none",border:"none",padding:0,color:ACCENT,fontWeight:600,fontFamily:"inherit",fontSize:13,cursor:"pointer",textDecoration:"none"}}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
              Create one
            </button>
          </p>

          {/* OAuth buttons */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
            <OAuthButton onClick={() => void onOAuth("google")} label="Continue with Google" icon={<GoogleIcon/>}/>
            <OAuthButton onClick={() => void onOAuth("apple")} label="Continue with Apple" icon={<AppleIcon/>}/>
            <OAuthButton onClick={() => void onOAuth("azure")} label="Continue with Microsoft" icon={<MicrosoftIcon/>}/>
            <OAuthButton onClick={() => void onOAuth("github")} label="Continue with GitHub" icon={<GitHubIcon/>}/>
          </div>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
            <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
            <span style={{fontSize:11,color:"#b0ada8",fontWeight:500,whiteSpace:"nowrap"}}>or sign in with email</span>
            <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
          </div>

          {/* Email + password form */}
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom:14}}>
              <label style={fieldLabelSt}>EMAIL ADDRESS</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                placeholder="you@example.com" autoComplete="email" required
                style={inputSt(emailFocus)}/>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <label style={fieldLabelSt}>PASSWORD</label>
                <button type="button" onClick={onForgotPassword}
                  style={{background:"none",border:"none",padding:0,fontFamily:"inherit",fontSize:11,color:ACCENT,fontWeight:600,cursor:"pointer"}}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
                  Forgot password?
                </button>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPassFocus(true)} onBlur={() => setPassFocus(false)}
                placeholder="••••••••" autoComplete="current-password" required
                style={inputSt(passFocus)}/>
            </div>

            <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,marginTop:4,cursor:"pointer"}}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                style={{width:15,height:15,accentColor:ACCENT,cursor:"pointer"}}/>
              <span style={{fontSize:12,color:"#4a4744"}}>Remember me</span>
            </label>

            <SubmitButton disabled={isWorking}>{isWorking ? "Signing in…" : "Sign in to Remindly"}</SubmitButton>
          </form>

          {status && (
            <p style={{textAlign:"center",fontSize:12,color:"#8a8580",marginTop:14,minHeight:18}}>{status}</p>
          )}

          <p style={{marginTop:16,fontSize:11,color:"#b0ada8",textAlign:"center",lineHeight:1.6}}>
            By continuing you agree to Remindly's{" "}
            <a href="#" style={{color:"#8a8580",textDecoration:"underline"}}>Terms of Service</a>{" "}and{" "}
            <a href="#" style={{color:"#8a8580",textDecoration:"underline"}}>Privacy Policy</a>.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) {
          :global(.login-brand-panel) { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── INPUTS ───────────────────────────────────────────────────────────────────
const fieldLabelSt: CSSProperties = {
  display:"block", fontSize:10, fontWeight:600, color:"#8a8580",
  letterSpacing:".07em", marginBottom:6,
};

function inputSt(focused: boolean): CSSProperties {
  return {
    width:"100%", padding:"10px 13px", borderRadius:9,
    border:`1px solid ${focused ? ACCENT : "#E5E2DD"}`,
    background: focused ? "#fff" : "#F5F2EE",
    fontFamily:"'DM Sans', sans-serif", fontSize:13.5, color:"#1A1714", outline:"none",
    boxShadow: focused ? "0 0 0 3px rgba(244,132,95,0.15)" : "none",
    transition:"border-color 0.15s, box-shadow 0.15s, background 0.15s",
  };
}

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="submit" disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width:"100%", padding:12, borderRadius:10, border:"none",
        background: disabled ? "#F0A896" : hov ? ACCENT_DARK : ACCENT,
        color:"#fff", fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600,
        cursor: disabled ? "default" : "pointer", letterSpacing:"-0.01em",
        boxShadow: hov && !disabled ? "0 4px 14px rgba(244,132,95,0.35)" : "none",
        transition:"background 0.18s, box-shadow 0.18s",
      }}>
      {children}
    </button>
  );
}

function OAuthButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:9,
        padding:"11px 14px", borderRadius:10,
        border:`1px solid ${hov ? "#D1CEC9" : "#E5E2DD"}`,
        background: hov ? "#F8F6F3" : "#fff",
        fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, color:"#1A1714",
        cursor:"pointer",
        boxShadow: hov ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
        transition:"background 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}>
      <span style={{width:18,height:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>
      {label}
    </button>
  );
}

// ─── BRAND-PANEL CALENDAR PREVIEW ────────────────────────────────────────────
function CalendarPreview() {
  const dayHeaders = ["S","M","T","W","T","F","S"];
  type CalDay = { d: number; today?: boolean; event?: boolean; ghost?: boolean };
  const days: CalDay[] = [
    { d:26, ghost:true }, { d:27, ghost:true }, { d:28, ghost:true }, { d:29, ghost:true }, { d:30, ghost:true }, { d:1, event:true }, { d:2, event:true },
    { d:3, event:true }, { d:4, event:true }, { d:5, today:true }, { d:6, event:true }, { d:7, event:true }, { d:8 }, { d:9 },
    { d:10 }, { d:11 }, { d:12, event:true }, { d:13 }, { d:14, event:true }, { d:15 }, { d:16, event:true },
    { d:17 }, { d:18 }, { d:19, event:true }, { d:20 }, { d:21, event:true }, { d:22 }, { d:23 },
    { d:24 }, { d:25 }, { d:26, event:true }, { d:27 }, { d:28 }, { d:29, event:true }, { d:30 },
  ];
  return (
    <div style={{
      position:"absolute", top:"50%", left:"50%", transform:"translate(-50%, -56%)",
      width:280, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:16, padding:20, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
      animation:"fadeIn 0.6s ease 0.3s both",
    }}>
      <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.5)",letterSpacing:".06em",marginBottom:14}}>MAY 2026</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center"}}>
        {dayHeaders.map((h, i) => (
          <div key={i} style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:600,padding:"2px 0"}}>{h}</div>
        ))}
        {days.map((day, i) => (
          <div key={i} style={{
            position:"relative", fontSize:11, padding:"5px 0", borderRadius:"50%",
            background: day.today ? ACCENT : "transparent",
            color: day.today ? "#fff"
              : day.ghost ? "rgba(255,255,255,0.15)"
              : day.event ? "rgba(255,255,255,0.9)"
              : "rgba(255,255,255,0.6)",
            fontWeight: day.today ? 700 : 400,
          }}>
            {day.d}
            {day.event && !day.today && (
              <div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:ACCENT}}/>
            )}
          </div>
        ))}
      </div>
      <EventPill color="#5046E5" title="Morning standup" time="9:00 AM"/>
      <EventPill color="#2DA87E" title="Doctor checkup" time="3:00 PM"/>
    </div>
  );
}

function EventPill({ color, title, time }: { color: string; title: string; time: string }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,marginTop:8}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
      <span style={{fontSize:11,color:"rgba(255,255,255,0.75)",fontWeight:500,flex:1}}>{title}</span>
      <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{time}</span>
    </div>
  );
}

// ─── OAUTH ICONS ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18">
      <path d="M12.547 0c.072.847-.24 1.69-.73 2.327-.49.636-1.254 1.11-2.057 1.057-.09-.82.27-1.68.727-2.27C10.968.5 11.78.025 12.547 0Zm2.682 6.37c-.886-.548-1.897-.794-2.912-.74-.753.04-1.476.268-2.108.63-.39.225-.76.5-1.21.5-.424 0-.78-.256-1.154-.47a6.018 6.018 0 0 0-2.1-.62c-1.376-.1-2.738.563-3.62 1.58C.875 9.01.5 10.7.7 12.36c.22 1.87.97 3.62 2.07 5.03.44.573.91 1.14 1.57 1.14.63 0 .88-.39 1.65-.4.77-.01 1.02.4 1.65.39.66-.01 1.14-.58 1.58-1.15a10.2 10.2 0 0 0 1.42-2.67c-.89-.41-1.72-1.17-2.18-2.09-.46-.92-.56-2.04-.14-2.99.36-.83 1.05-1.5 1.91-1.84.5-.2 1.03-.3 1.56-.3.56 0 1.1.12 1.61.32.3.12.59.27.87.44Z" fill="#1C1C1E"/>
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18">
      <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022"/>
      <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00"/>
      <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF"/>
      <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900"/>
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 4.03 0 9c0 3.98 2.58 7.35 6.16 8.54.45.08.62-.19.62-.43v-1.5c-2.5.54-3.04-1.21-3.04-1.21-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.37 2.1.97 2.61.74.08-.58.31-.97.57-1.19-1.99-.23-4.09-.99-4.09-4.42 0-.98.35-1.78.93-2.4-.09-.23-.4-1.14.09-2.37 0 0 .75-.24 2.47.92A8.6 8.6 0 0 1 9 4.39c.76 0 1.53.1 2.25.3 1.72-1.16 2.47-.92 2.47-.92.49 1.23.18 2.14.09 2.37.58.62.93 1.42.93 2.4 0 3.44-2.1 4.19-4.1 4.41.32.28.61.82.61 1.65v2.45c0 .24.16.52.62.43A9.003 9.003 0 0 0 18 9c0-4.97-4.03-9-9-9Z" fill="#24292E"/>
    </svg>
  );
}
