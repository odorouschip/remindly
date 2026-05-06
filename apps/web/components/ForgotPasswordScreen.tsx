"use client";

import { useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";

type Result = { ok: boolean; message?: string };

type ForgotPasswordScreenProps = {
  onSendCode: (email: string) => Promise<Result>;
  onVerifyCode: (email: string, code: string) => Promise<Result>;
  onUpdatePassword: (newPassword: string) => Promise<Result>;
  onBackToLogin: () => void;
};

const ACCENT = "#F4845F";
const ACCENT_DARK = "#E06A44";

function passwordScore(val: string): number {
  if (!val) return 0;
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  return score;
}
const STRENGTH_COLORS: Record<number, string> = { 1: "#E85D3A", 2: "#D97706", 3: "#2DA87E", 4: "#5046E5" };
const STRENGTH_LABELS: Record<number, string> = { 0: "Enter a password", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" };

export function ForgotPasswordScreen({ onSendCode, onVerifyCode, onUpdatePassword, onBackToLogin }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMismatch, setPwMismatch] = useState(false);
  const [working, setWorking] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [resendNote, setResendNote] = useState("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const score = passwordScore(newPw);

  // Step 1 — send code
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setErrMsg("");
    setWorking(true);
    try {
      const res = await onSendCode(email);
      if (!res.ok) { setErrMsg(res.message ?? "Could not send code."); return; }
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    } finally {
      setWorking(false);
    }
  };

  // Step 2 — OTP entry
  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/^\d$/.test(val)) return;
    setOtp((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    if (otpError) setOtpError(false);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };
  const handleOtpKey = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };
  const handleOtpPaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!data) return;
    setOtp((prev) => {
      const next = [...prev];
      [...data].forEach((ch, j) => { if (idx + j < 6) next[idx + j] = ch; });
      return next;
    });
    const focusIdx = Math.min(idx + data.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };
  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setOtpError(true);
      setTimeout(() => setOtpError(false), 1200);
      return;
    }
    setErrMsg("");
    setWorking(true);
    try {
      const res = await onVerifyCode(email, code);
      if (!res.ok) { setErrMsg(res.message ?? "Invalid code."); setOtpError(true); return; }
      setStep(3);
    } finally {
      setWorking(false);
    }
  };
  const handleResend = async () => {
    setResendNote("");
    const res = await onSendCode(email);
    setResendNote(res.ok ? "Sent!" : (res.message ?? "Could not resend."));
    setTimeout(() => setResendNote(""), 3000);
  };

  // Step 3 — new password
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMismatch(true); return; }
    setPwMismatch(false);
    setErrMsg("");
    setWorking(true);
    try {
      const res = await onUpdatePassword(newPw);
      if (!res.ok) { setErrMsg(res.message ?? "Could not update password."); return; }
      setStep(4);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,minHeight:"100vh",display:"grid",gridTemplateColumns:"1fr 1fr",fontFamily:"'DM Sans', sans-serif",background:"#FAFAF9",color:"#1A1714"}}>
      {/* Left brand panel */}
      <div className="forgot-brand-panel"
        style={{position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-end",padding:48,background:"#1A1714"}}>
        <Bubble width={320} height={320} top={60}    right={-80}             animDur="7s" animDelay={0} variant={1}/>
        <Bubble width={200} height={200} top={200}                left={-60} animDur="9s" animDelay={0} variant={2}/>
        <Bubble width={140} height={140}             bottom={160} right={60} animDur="6s" animDelay={0} variant={3}/>
        <Bubble width={80}  height={80}              bottom={280} left={120} animDur="8s" animDelay={1} variant={1}/>

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

        {/* Lock card */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%, -55%)",width:200,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:24,padding:"32px 24px",textAlign:"center",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",animation:"fadeIn 0.6s ease 0.3s both",zIndex:2}}>
          <div style={{width:60,height:60,borderRadius:18,background:"rgba(244,132,95,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="5" y="13" width="18" height="13" rx="3" stroke={ACCENT} strokeWidth="1.6"/>
              <path d="M9 13V9a5 5 0 0 1 10 0v4" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="14" cy="19.5" r="2" fill={ACCENT}/>
            </svg>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.7)",marginBottom:4}}>Account security</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:1.5}}>We'll verify it's you before resetting your password</div>
        </div>

        <div style={{position:"relative",zIndex:2}}>
          <h1 style={{fontSize:34,fontWeight:700,color:"#fff",lineHeight:1.15,letterSpacing:"-0.03em",marginBottom:12,textWrap:"pretty" as CSSProperties["textWrap"]}}>
            Forgot your<br/>
            <span style={{color:ACCENT}}>password?</span><br/>
            No worries.
          </h1>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.6,maxWidth:320}}>
            We'll send a verification code to your email so you can get back in quickly.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:48,background:"#FDFCFB"}}>
        <div style={{width:"100%",maxWidth:400,animation:"fadeUp 0.45s ease both"}}>
          {step !== 4 && (
            <div style={{display:"flex",gap:6,marginBottom:28}}>
              {[1,2,3].map((s) => (
                <div key={s} style={{
                  height:4, flex:1, borderRadius:99,
                  background: step > s ? "#2DA87E" : step === s ? ACCENT : "#E5E2DD",
                  transition:"background 0.3s",
                }}/>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <h2 style={headingSt}>Reset password</h2>
              <p style={subtitleSt}>Enter the email address linked to your account and we'll send a 6-digit code.</p>
              <form onSubmit={handleSendCode}>
                <div style={{marginBottom:16}}>
                  <label style={fieldLabelSt}>EMAIL ADDRESS</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required
                    style={baseInputSt}/>
                </div>
                {errMsg && <p style={errSt}>{errMsg}</p>}
                <SubmitButton disabled={working}>{working ? "Sending…" : "Send reset code"}</SubmitButton>
              </form>
              <BackToLogin onClick={onBackToLogin}/>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={headingSt}>Check your email</h2>
              <p style={subtitleSt}>
                We sent a 6-digit code to <strong style={{color:"#1A1714"}}>{email}</strong>. It expires in 10 minutes.
              </p>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                {otp.map((v, i) => (
                  <input key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    value={v} maxLength={1} inputMode="numeric"
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    onPaste={(e) => handleOtpPaste(i, e)}
                    style={{
                      flex:1, height:56, textAlign:"center", fontSize:22, fontWeight:700,
                      borderRadius:10,
                      border:`1px solid ${otpError ? "#E85D3A" : "#E5E2DD"}`,
                      background:"#F5F2EE", color:"#1A1714",
                      outline:"none", fontFamily:"'DM Sans', sans-serif",
                      boxShadow: otpError ? "0 0 0 3px rgba(232,93,58,0.12)" : "none",
                      transition:"border-color 0.15s, box-shadow 0.15s",
                    }}/>
                ))}
              </div>
              {errMsg && <p style={errSt}>{errMsg}</p>}
              <SubmitButton type="button" onClick={handleVerify} disabled={working}>
                {working ? "Verifying…" : "Verify code"}
              </SubmitButton>
              <div style={{textAlign:"center",fontSize:12,color:"#b0ada8",marginBottom:10}}>
                Didn't get it?{" "}
                <button type="button" onClick={handleResend}
                  style={{background:"none",border:"none",padding:0,fontFamily:"inherit",fontSize:12,color: resendNote === "Sent!" ? "#2DA87E" : ACCENT,fontWeight:600,cursor:"pointer"}}>
                  {resendNote || "Resend code"}
                </button>
              </div>
              <BackToLogin onClick={onBackToLogin}/>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={headingSt}>New password</h2>
              <p style={subtitleSt}>Choose a strong password you haven't used before.</p>
              <form onSubmit={handleUpdate}>
                <div style={{marginBottom:16}}>
                  <label style={fieldLabelSt}>NEW PASSWORD</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
                    style={baseInputSt}/>
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
                    <span style={{fontSize:10, color: score > 0 ? (STRENGTH_COLORS[score] || "#b0ada8") : "#b0ada8"}}>
                      {newPw.length > 0 && newPw.length < 8 ? "Too short" : STRENGTH_LABELS[score]}
                    </span>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={fieldLabelSt}>CONFIRM PASSWORD</label>
                  <input type="password" value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); if (pwMismatch) setPwMismatch(false); }}
                    placeholder={pwMismatch ? "Passwords don't match" : "Repeat your password"}
                    autoComplete="new-password" required
                    style={pwMismatch ? { ...baseInputSt, borderColor:"#E85D3A", boxShadow:"0 0 0 3px rgba(232,93,58,0.15)" } : baseInputSt}/>
                </div>
                {errMsg && <p style={errSt}>{errMsg}</p>}
                <SubmitButton disabled={working}>{working ? "Updating…" : "Update password"}</SubmitButton>
              </form>
              <BackToLogin onClick={onBackToLogin}/>
            </>
          )}

          {step === 4 && (
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(45,168,126,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="#2DA87E" strokeWidth="1.5"/>
                  <path d="M8 14.5l4.5 4.5 7.5-8" stroke="#2DA87E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{...headingSt, marginBottom:10}}>Password updated!</h2>
              <p style={{...subtitleSt, marginBottom:28}}>
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <SubmitButton type="button" onClick={onBackToLogin}>Sign in to Remindly</SubmitButton>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bubbleFloat1 { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-18px) scale(1.03); } }
        @keyframes bubbleFloat2 { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(14px) scale(0.97); } }
        @keyframes bubbleFloat3 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @media (max-width: 768px) {
          :global(.forgot-brand-panel) { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── BUBBLE DECORATION ───────────────────────────────────────────────────────
function Bubble({ width, height, top, left, right, bottom, animDur, animDelay, variant }: {
  width: number; height: number;
  top?: number; left?: number; right?: number; bottom?: number;
  animDur: string; animDelay: number; variant: 1 | 2 | 3;
}) {
  const positionSt: CSSProperties = {
    ...(top !== undefined ? { top } : {}),
    ...(left !== undefined ? { left } : {}),
    ...(right !== undefined ? { right } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
  };
  return (
    <div style={{
      position:"absolute", width, height, borderRadius:"50%",
      ...positionSt,
      background:"radial-gradient(circle at 35% 35%, rgba(244,132,95,0.28), rgba(244,132,95,0.04))",
      border:"1px solid rgba(244,132,95,0.15)",
      backdropFilter:"blur(2px)", WebkitBackdropFilter:"blur(2px)",
      animation: `bubbleFloat${variant} ${animDur} ease-in-out infinite${animDelay ? ` ${animDelay}s` : ""}`,
    }}/>
  );
}

// ─── SHARED PARTS ────────────────────────────────────────────────────────────
function BackToLogin({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:5,
        width:"100%", marginTop:4,
        background:"none", border:"none", cursor:"pointer",
        fontFamily:"inherit", fontSize:13, color: hov ? "#1A1714" : "#8a8580",
        transition:"color 0.15s",
      }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Back to sign in
    </button>
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
        marginBottom:16,
        boxShadow: hov && !disabled ? "0 4px 14px rgba(244,132,95,0.35)" : "none",
        transition:"background 0.18s, box-shadow 0.18s",
      }}>{children}</button>
  );
}

const headingSt: CSSProperties    = { fontSize:24, fontWeight:700, letterSpacing:"-0.03em", color:"#1A1714", marginBottom:6 };
const subtitleSt: CSSProperties   = { fontSize:13, color:"#8a8580", marginBottom:28, lineHeight:1.5 };
const fieldLabelSt: CSSProperties = { display:"block", fontSize:10, fontWeight:600, color:"#8a8580", letterSpacing:".07em", marginBottom:6 };
const baseInputSt: CSSProperties  = {
  width:"100%", padding:"11px 13px", borderRadius:9, border:"1px solid #E5E2DD",
  background:"#F5F2EE", fontFamily:"'DM Sans', sans-serif", fontSize:13.5, color:"#1A1714",
  outline:"none", transition:"border-color 0.15s, box-shadow 0.15s, background 0.15s",
};
const errSt: CSSProperties = { fontSize:12, color:"#E85D3A", marginBottom:12, textAlign:"center" };
