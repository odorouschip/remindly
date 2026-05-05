"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { GoogleIcon, AppleIcon, MicrosoftIcon, GitHubIcon } from "./LoginScreen";

type OAuthProvider = "google" | "apple" | "azure" | "github";

export type SignupPrefs = {
  timezone: string;
  weekStart: "sunday" | "monday" | "saturday";
  defaultView: "month" | "week" | "agenda";
  importGoogle: boolean;
  importOutlook: boolean;
  importApple: boolean;
};

type SignupScreenProps = {
  onSignUp: (args: {
    firstName: string; lastName: string; email: string; password: string; prefs: SignupPrefs;
  }) => Promise<{ ok: boolean; needsConfirm: boolean; message?: string }>;
  onOAuth: (provider: OAuthProvider) => void | Promise<void>;
  onBackToLogin: () => void;
};

const ACCENT = "#F4845F";
const ACCENT_DARK = "#E06A44";

const TIMEZONES = [
  { value: "America/New_York",    label: "Eastern Time (ET)" },
  { value: "America/Chicago",     label: "Central Time (CT)" },
  { value: "America/Denver",      label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London",       label: "London (GMT)" },
  { value: "Europe/Paris",        label: "Paris (CET)" },
  { value: "Asia/Tokyo",          label: "Tokyo (JST)" },
  { value: "Asia/Shanghai",       label: "Shanghai (CST)" },
  { value: "Australia/Sydney",    label: "Sydney (AEST)" },
];

function detectTimezone(): string {
  if (typeof Intl === "undefined") return "America/New_York";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIMEZONES.some((t) => t.value === tz) ? tz : "America/New_York";
}

function passwordScore(val: string): number {
  if (!val) return 0;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  return score;
}

const STRENGTH_COLORS: Record<number, string> = {
  1: "#E85D3A",
  2: "#D97706",
  3: "#2DA87E",
  4: "#5046E5",
};
const STRENGTH_LABELS: Record<number, string> = {
  0: "Enter a password",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

export function SignupScreen({ onSignUp, onOAuth, onBackToLogin }: SignupScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [working, setWorking] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [pwMismatch, setPwMismatch] = useState(false);

  // Step 2
  const [timezone, setTimezone] = useState(detectTimezone());
  const [weekStart, setWeekStart] = useState<SignupPrefs["weekStart"]>("sunday");
  const [defaultView, setDefaultView] = useState<SignupPrefs["defaultView"]>("month");
  const [importGoogle, setImportGoogle] = useState(false);
  const [importOutlook, setImportOutlook] = useState(false);
  const [importApple, setImportApple] = useState(false);

  // Step 3
  const [needsConfirm, setNeedsConfirm] = useState(true);

  const score = passwordScore(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrMsg("");

    if (step === 1) {
      if (password !== confirmPw) { setPwMismatch(true); return; }
      setPwMismatch(false);
      if (!agree) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      setWorking(true);
      try {
        const res = await onSignUp({
          firstName, lastName, email, password,
          prefs: { timezone, weekStart, defaultView, importGoogle, importOutlook, importApple },
        });
        if (!res.ok) { setErrMsg(res.message ?? "Could not create account."); return; }
        setNeedsConfirm(res.needsConfirm);
        setStep(3);
      } finally {
        setWorking(false);
      }
    }
  };

  const stepLabel =
    step === 1 ? "Step 1 of 3 — Your info"
    : step === 2 ? "Step 2 of 3 — Preferences"
    : "Step 3 of 3 — Confirm";
  const submitLabel =
    step === 1 ? "Continue"
    : step === 2 ? (working ? "Creating account…" : "Create account")
    : "Go to Remindly";

  return (
    <div style={{position:"fixed",inset:0,minHeight:"100vh",display:"grid",gridTemplateColumns:"1fr 1fr",fontFamily:"'DM Sans', sans-serif",background:"#FAFAF9",color:"#1A1714"}}>
      {/* Left brand panel */}
      <div className="signup-brand-panel"
        style={{background:"#1A1714",display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-end",padding:48,position:"relative",overflow:"hidden"}}>
        {/* Decorative circles */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 500 700" fill="none" preserveAspectRatio="xMidYMid slice">
          <circle cx="80"  cy="100" r="200" fill="rgba(244,132,95,0.07)"/>
          <circle cx="450" cy="650" r="200" fill="rgba(244,132,95,0.07)"/>
          <circle cx="300" cy="350" r="100" fill="rgba(244,132,95,0.04)"/>
        </svg>

        {/* Logo */}
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

        {/* Feature highlights */}
        <div style={{position:"absolute",top:"50%",left:48,right:48,transform:"translateY(-60%)",display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.6s ease 0.3s both",zIndex:1}}>
          <FeatureItem
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="3" width="16" height="14" rx="3" stroke={ACCENT} strokeWidth="1.5"/><path d="M1 7h16" stroke={ACCENT} strokeWidth="1.5"/><path d="M5 1v3M13 1v3" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 11h4M5 14h2" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round"/></svg>}
            title="Month, week & agenda views"
            desc="See your schedule any way you like"/>
          <FeatureItem
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke={ACCENT} strokeWidth="1.5"/><path d="M9 5v4.5l3 2" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            title="Smart reminders & tasks"
            desc="Never miss what matters"/>
          <FeatureItem
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9.5C3 6.46 5.46 4 8.5 4h1C12.54 4 15 6.46 15 9.5S12.54 15 9.5 15h-1C5.46 15 3 12.54 3 9.5Z" stroke={ACCENT} strokeWidth="1.5"/><path d="M7 9.5h4M9 7.5v4" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"/></svg>}
            title="Import from Google, Outlook & more"
            desc="One tap to sync all your calendars"/>
        </div>

        {/* Tagline */}
        <div style={{position:"relative",zIndex:1}}>
          <h1 style={{fontSize:36,fontWeight:700,color:"#fff",lineHeight:1.15,letterSpacing:"-0.03em",marginBottom:14,textWrap:"pretty" as CSSProperties["textWrap"]}}>
            Start for free.<br/>
            Stay <span style={{color:ACCENT}}>organized</span><br/>
            forever.
          </h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,0.45)",lineHeight:1.6,maxWidth:340}}>
            Join thousands of people who use Remindly to plan their days with clarity.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:48,background:"#FDFCFB",overflowY:"auto"}}>
        <div style={{width:"100%",maxWidth:420,animation:"fadeUp 0.45s ease both",padding:"8px 0"}}>
          <h2 style={{fontSize:24,fontWeight:700,letterSpacing:"-0.03em",color:"#1A1714",marginBottom:6}}>Create your account</h2>
          <p style={{fontSize:13,color:"#8a8580",marginBottom:24}}>
            Already have one?{" "}
            <button onClick={onBackToLogin} style={{background:"none",border:"none",padding:0,color:ACCENT,fontWeight:600,fontFamily:"inherit",fontSize:13,cursor:"pointer"}}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
              Sign in
            </button>
          </p>

          {/* Step indicator */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:24}}>
            {[1,2,3].map((s) => {
              const isActive = step === s;
              const isDone = step > s;
              return (
                <div key={s} style={{
                  height:4, width: isActive ? 32 : 24, borderRadius:99,
                  background: isDone ? "#2DA87E" : isActive ? ACCENT : "#E5E2DD",
                  transition:"background 0.2s, width 0.2s",
                }}/>
              );
            })}
            <span style={{fontSize:11,color:"#b0ada8",marginLeft:4}}>{stepLabel}</span>
          </div>

          {/* OAuth buttons (steps 1 & 2) */}
          {step !== 3 && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
                <OAuthButton onClick={() => void onOAuth("google")} label="Sign up with Google" icon={<GoogleIcon/>}/>
                <OAuthButton onClick={() => void onOAuth("apple")} label="Sign up with Apple" icon={<AppleIcon/>}/>
                <OAuthButton onClick={() => void onOAuth("azure")} label="Sign up with Microsoft" icon={<MicrosoftIcon/>}/>
                <OAuthButton onClick={() => void onOAuth("github")} label="Sign up with GitHub" icon={<GitHubIcon/>}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
                <span style={{fontSize:11,color:"#b0ada8",fontWeight:500,whiteSpace:"nowrap"}}>or create with email</span>
                <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <Field label="FIRST NAME">
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Alex" autoComplete="given-name" required style={baseInputSt}/>
                  </Field>
                  <Field label="LAST NAME">
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      placeholder="Johnson" autoComplete="family-name" required style={baseInputSt}/>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <Field label="EMAIL ADDRESS">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email" required style={baseInputSt}/>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <Field label="PASSWORD">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" autoComplete="new-password" required minLength={8}
                      style={baseInputSt}/>
                    {/* Strength bars */}
                    <div style={{marginTop:8}}>
                      <div style={{display:"flex",gap:4,marginBottom:4}}>
                        {[1,2,3,4].map((i) => (
                          <div key={i} style={{
                            height:3, flex:1, borderRadius:99,
                            background: i <= score ? STRENGTH_COLORS[score] || "#E5E2DD" : "#E5E2DD",
                            transition:"background 0.3s",
                          }}/>
                        ))}
                      </div>
                      <span style={{fontSize:10,color:"#b0ada8"}}>
                        {password.length > 0 && password.length < 8 ? "Too short" : STRENGTH_LABELS[score]}
                      </span>
                    </div>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <Field label="CONFIRM PASSWORD">
                    <input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); if (pwMismatch) setPwMismatch(false); }}
                      placeholder={pwMismatch ? "Passwords don't match" : "Repeat your password"}
                      autoComplete="new-password" required
                      style={pwMismatch
                        ? { ...baseInputSt, borderColor:"#E85D3A", boxShadow:"0 0 0 3px rgba(232,93,58,0.15)" }
                        : baseInputSt}/>
                  </Field>
                </div>
                <label style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:20,marginTop:4,cursor:"pointer"}}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required
                    style={{width:15,height:15,accentColor:ACCENT,cursor:"pointer",flexShrink:0,marginTop:1}}/>
                  <span style={{fontSize:12,color:"#4a4744",lineHeight:1.5}}>
                    I agree to Remindly's <a href="#" style={{color:ACCENT,textDecoration:"none",fontWeight:600}}>Terms of Service</a> and <a href="#" style={{color:ACCENT,textDecoration:"none",fontWeight:600}}>Privacy Policy</a>
                  </span>
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{marginBottom:14}}>
                  <Field label="TIME ZONE">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={baseSelectSt}>
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <Field label="WEEK STARTS ON">
                    <select value={weekStart} onChange={(e) => setWeekStart(e.target.value as SignupPrefs["weekStart"])} style={baseSelectSt}>
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <Field label="DEFAULT VIEW">
                    <select value={defaultView} onChange={(e) => setDefaultView(e.target.value as SignupPrefs["defaultView"])} style={baseSelectSt}>
                      <option value="month">Month</option>
                      <option value="week">Week</option>
                      <option value="agenda">Agenda</option>
                    </select>
                  </Field>
                </div>
                <div style={{marginBottom:14}}>
                  <span style={fieldLabelSt}>IMPORT CALENDARS</span>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:2}}>
                    <ImportCheckbox checked={importGoogle} onChange={setImportGoogle} label="Google Calendar"/>
                    <ImportCheckbox checked={importOutlook} onChange={setImportOutlook} label="Microsoft Outlook"/>
                    <ImportCheckbox checked={importApple} onChange={setImportApple} label="Apple Calendar"/>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div style={{textAlign:"center",padding:"16px 0 24px"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:ACCENT+"22",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="13" stroke={ACCENT} strokeWidth="1.5"/>
                    <path d="M8 14.5l4 4 8-8" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{fontSize:17,fontWeight:700,color:"#1A1714",marginBottom:8,letterSpacing:"-0.02em"}}>
                  {needsConfirm ? "Almost there!" : "Welcome aboard!"}
                </div>
                <div style={{fontSize:13,color:"#8a8580",lineHeight:1.6,maxWidth:320,margin:"0 auto"}}>
                  {needsConfirm ? (
                    <>We've sent a verification email to <strong style={{color:"#1A1714"}}>{email}</strong>. Click the link to activate your account.</>
                  ) : (
                    <>Your account is ready. Tap below to start planning.</>
                  )}
                </div>
                <div style={{marginTop:24,padding:"14px 18px",background:"#F5F2EE",borderRadius:10,border:"1px solid #E5E2DD",textAlign:"left"}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#8a8580",letterSpacing:".06em",marginBottom:8}}>YOUR ACCOUNT</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1A1714"}}>{firstName} {lastName}</div>
                  <div style={{fontSize:12,color:"#8a8580",marginTop:2}}>{email}</div>
                </div>
              </div>
            )}

            {errMsg && (
              <p style={{fontSize:12,color:"#E85D3A",marginBottom:12,textAlign:"center"}}>{errMsg}</p>
            )}

            {step === 3 ? (
              <SubmitButton type="button" onClick={onBackToLogin}>{submitLabel}</SubmitButton>
            ) : (
              <SubmitButton type="submit" disabled={working || (step === 1 && !agree)}>
                {submitLabel}
              </SubmitButton>
            )}
          </form>

          {step !== 3 && (
            <p style={{marginTop:16,fontSize:11,color:"#b0ada8",textAlign:"center",lineHeight:1.6}}>
              Your data is encrypted and never shared.
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) {
          :global(.signup-brand-panel) { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── SHARED PARTS ────────────────────────────────────────────────────────────
const fieldLabelSt: CSSProperties = {
  display:"block", fontSize:10, fontWeight:600, color:"#8a8580",
  letterSpacing:".07em", marginBottom:6,
};

const baseInputSt: CSSProperties = {
  width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #E5E2DD",
  background:"#F5F2EE", fontFamily:"'DM Sans', sans-serif", fontSize:13.5, color:"#1A1714",
  outline:"none", transition:"border-color 0.15s, box-shadow 0.15s, background 0.15s",
};
const baseSelectSt: CSSProperties = { ...baseInputSt, cursor:"pointer", appearance:"none" as CSSProperties["appearance"] };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={fieldLabelSt}>{label}</label>
      {children}
    </div>
  );
}

function ImportCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{display:"flex",alignItems:"center",gap:9,fontSize:13,color:"#1A1714",fontWeight:400,cursor:"pointer"}}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{accentColor:ACCENT,width:15,height:15}}/>
      <span>{label}</span>
    </label>
  );
}

function SubmitButton({ children, disabled, type = "submit", onClick }: {
  children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width:"100%", padding:12, borderRadius:10, border:"none",
        background: disabled ? "#F0A896" : hov ? ACCENT_DARK : ACCENT,
        color:"#fff", fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600,
        cursor: disabled ? "default" : "pointer", letterSpacing:"-0.01em",
        boxShadow: hov && !disabled ? "0 4px 14px rgba(244,132,95,0.35)" : "none",
        transition:"background 0.18s, box-shadow 0.18s",
      }}>{children}</button>
  );
}

function OAuthButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:9,
        padding:"11px 10px", borderRadius:10,
        border:`1px solid ${hov ? "#D1CEC9" : "#E5E2DD"}`,
        background: hov ? "#F8F6F3" : "#fff",
        fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, color:"#1A1714",
        cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        boxShadow: hov ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
        transition:"background 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}>
      <span style={{width:18,height:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>
      {label}
    </button>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:12}}>
      <div style={{width:36,height:36,borderRadius:9,background:"rgba(244,132,95,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {icon}
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>{title}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.38)",marginTop:2}}>{desc}</div>
      </div>
    </div>
  );
}
