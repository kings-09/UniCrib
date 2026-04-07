import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";

const INSTITUTIONS = [
  "Harare Institute of Technology (HIT)",
  "University of Zimbabwe (UZ)",
  "Belvedere Teachers College (BTTC)",
  "TelOne Centre for Learning",
  "Midlands State University – Harare Campus",
  "Zimbabwe Open University (ZOU)",
  "Other",
];

const STEPS_STUDENT  = ["Account", "Personal", "Academic"];
const STEPS_LANDLORD = ["Account", "Personal", "Business"];

export default function Signup() {
  const navigate = useNavigate();

  /* ── step & role ── */
  const [step, setStep]   = useState(1);
  const [role, setRole]   = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── step 1 ── */
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);

  /* ── step 2 – personal ── */
  const [fullName, setFullName] = useState("");
  const [phone, setPhone]       = useState("");
  const [gender, setGender]     = useState("");
  const [dob, setDob]           = useState("");

  /* ── step 3 – student ── */
  const [institution, setInstitution] = useState("");
  const [course, setCourse]           = useState("");
  const [studyYear, setStudyYear]     = useState("");
  const [bio, setBio]                 = useState("");
  const [sleepSchedule, setSleepSchedule] = useState("");
  const [cleanliness, setCleanliness]     = useState("");
  const [socialStyle, setSocialStyle]     = useState("");
  const [smoking, setSmoking] = useState(false);
  const [pets, setPets]       = useState(false);

  /* ── step 3 – landlord ── */
  const [company, setCompany]   = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [area, setArea]         = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/dashboard");
    });
  }, [navigate]);

  /* ─── validation per step ─── */
  const validate = () => {
    setError("");
    if (step === 1) {
      if (!email.trim() || !password || !confirm) return "Please fill in all fields.";
      if (!email.includes("@")) return "Enter a valid email.";
      if (password.length < 6) return "Password must be at least 6 characters.";
      if (password !== confirm) return "Passwords do not match.";
    }
    if (step === 2) {
      if (!fullName.trim()) return "Please enter your full name.";
      if (!gender) return "Please select your gender.";
    }
    if (step === 3 && role === "student") {
      if (!institution) return "Please select your institution.";
      if (!course.trim()) return "Please enter your course / programme.";
    }
    return "";
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  };

  const back = () => { setError(""); setStep(s => s - 1); };

  /* ─── final submit ─── */
  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signupError) {
        if (signupError.status === 422 || signupError.message.toLowerCase().includes("already")) {
          setError("An account with this email already exists. Try logging in instead.");
        } else {
          setError(signupError.message);
        }
        setLoading(false);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) { setError("User creation failed. Please try again."); setLoading(false); return; }

      const roleId = role === "student" ? 1 : 2;

      const profilePayload = {
        id: userId,
        role_id: roleId,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        gender,
        dob: dob || null,
        ...(role === "student" ? {
          institution,
          course: course.trim(),
          study_year: studyYear ? Number(studyYear) : null,
          bio: bio.trim() || null,
          sleep_schedule: sleepSchedule || null,
          cleanliness: cleanliness || null,
          social_style: socialStyle || null,
          smoking,
          pets,
        } : {
          landlord_company: company.trim() || null,
          landlord_whatsapp: waNumber.trim() || null,
          landlord_area: area.trim() || null,
        }),
      };

      const { error: profileError } = await supabase.from("user_profiles").insert(profilePayload);
      if (profileError) { setError(profileError.message); setLoading(false); return; }

      navigate("/login", { state: { message: "Account created! Check your email to confirm, then log in." } });
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const steps = role === "student" ? STEPS_STUDENT : STEPS_LANDLORD;
  const totalSteps = steps.length;

  return (
    <div style={S.page}>
      {/* left panel */}
      <div style={S.leftPanel}>
        <div style={S.leftContent}>
          <div style={S.leftLogo}>🏠 UniCrib</div>
          <h2 style={S.leftHeading}>Find your perfect student home in Harare</h2>
          <p style={S.leftSub}>Verified listings · Campus proximity · Secure payments</p>
          <div style={S.leftBullets}>
            {["200+ verified properties", "Near HIT, UZ, BTTC & more", "Book & pay fully online", "Real student reviews"].map(b => (
              <div key={b} style={S.leftBullet}>
                <span style={S.leftBulletDot}>✓</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={S.leftImg} />
      </div>

      {/* right panel */}
      <div style={S.rightPanel}>
        <div style={S.formWrap}>

          {/* progress */}
          <div style={S.progressRow}>
            {steps.map((label, i) => {
              const n = i + 1;
              const done    = step > n;
              const current = step === n;
              return (
                <div key={label} style={S.progressItem}>
                  <div style={{ ...S.progressCircle, ...(done ? S.progressDone : current ? S.progressActive : {}) }}>
                    {done ? "✓" : n}
                  </div>
                  <span style={{ ...S.progressLabel, ...(current ? S.progressLabelActive : {}) }}>{label}</span>
                  {i < totalSteps - 1 && <div style={{ ...S.progressLine, ...(done ? S.progressLineDone : {}) }} />}
                </div>
              );
            })}
          </div>

          {/* heading */}
          <div style={S.formHeader}>
            <h1 style={S.formTitle}>
              {step === 1 && "Create your account"}
              {step === 2 && "Personal details"}
              {step === 3 && role === "student" && "Academic details"}
              {step === 3 && role === "landlord" && "Business details"}
            </h1>
            <p style={S.formSub}>Step {step} of {totalSteps}</p>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={S.fields}>
              <Field label="Email address">
                <input style={S.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>

              <Field label="Password">
                <div style={S.pwWrap}>
                  <input style={{ ...S.input, paddingRight: "44px" }} type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
                  <button style={S.eyeBtn} onClick={() => setShowPw(p => !p)} type="button">{showPw ? "🙈" : "👁"}</button>
                </div>
              </Field>

              <Field label="Confirm password">
                <input style={S.input} type={showPw ? "text" : "password"} placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </Field>

              <Field label="I am a…">
                <div style={S.roleRow}>
                  {["student", "landlord"].map(r => (
                    <button key={r} type="button"
                      style={{ ...S.roleBtn, ...(role === r ? S.roleBtnActive : {}) }}
                      onClick={() => setRole(r)}>
                      {r === "student" ? "🎓 Student" : "🏠 Landlord"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* ── STEP 2 – personal ── */}
          {step === 2 && (
            <div style={S.fields}>
              <Field label="Full name">
                <input style={S.input} placeholder="e.g. Tatenda Moyo" value={fullName} onChange={e => setFullName(e.target.value)} />
              </Field>

              <Field label="Phone number (optional)">
                <input style={S.input} placeholder="+263 77 …" value={phone} onChange={e => setPhone(e.target.value)} />
              </Field>

              <div style={S.row2}>
                <Field label="Gender">
                  <select style={S.input} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Date of birth (optional)">
                  <input style={S.input} type="date" value={dob} onChange={e => setDob(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 3 – student ── */}
          {step === 3 && role === "student" && (
            <div style={S.fields}>
              <Field label="Institution">
                <select style={S.input} value={institution} onChange={e => setInstitution(e.target.value)}>
                  <option value="">Select your institution…</option>
                  {INSTITUTIONS.map(i => <option key={i}>{i}</option>)}
                </select>
              </Field>

              <div style={S.row2}>
                <Field label="Course / Programme">
                  <input style={S.input} placeholder="e.g. Software Engineering" value={course} onChange={e => setCourse(e.target.value)} />
                </Field>
                <Field label="Year of study">
                  <select style={S.input} value={studyYear} onChange={e => setStudyYear(e.target.value)}>
                    <option value="">Select…</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Year {n}</option>)}
                    <option value="postgrad">Postgrad</option>
                  </select>
                </Field>
              </div>

              <Field label="Bio (optional)">
                <textarea style={{ ...S.input, minHeight: "72px", resize: "vertical" }} placeholder="Tell potential roommates a bit about yourself…" value={bio} onChange={e => setBio(e.target.value)} />
              </Field>

              <p style={S.prefHeading}>🛋 Lifestyle preferences <span style={S.prefNote}>(used for roommate matching)</span></p>

              <div style={S.row3}>
                <Field label="Sleep schedule">
                  <select style={S.input} value={sleepSchedule} onChange={e => setSleepSchedule(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="early_bird">Early bird</option>
                    <option value="night_owl">Night owl</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </Field>
                <Field label="Cleanliness">
                  <select style={S.input} value={cleanliness} onChange={e => setCleanliness(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="very_tidy">Very tidy</option>
                    <option value="moderate">Moderate</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </Field>
                <Field label="Social style">
                  <select style={S.input} value={socialStyle} onChange={e => setSocialStyle(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="quiet">Quiet / studious</option>
                    <option value="sociable">Sociable</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </Field>
              </div>

              <div style={S.toggleRow}>
                <Toggle label="I smoke" value={smoking} onChange={setSmoking} />
                <Toggle label="I have pets" value={pets} onChange={setPets} />
              </div>
            </div>
          )}

          {/* ── STEP 3 – landlord ── */}
          {step === 3 && role === "landlord" && (
            <div style={S.fields}>
              <Field label="Company / Trading name (optional)">
                <input style={S.input} placeholder="e.g. Moyo Properties" value={company} onChange={e => setCompany(e.target.value)} />
              </Field>
              <Field label="WhatsApp number">
                <input style={S.input} placeholder="+263 77 …" value={waNumber} onChange={e => setWaNumber(e.target.value)} />
              </Field>
              <Field label="Primary area of operation">
                <input style={S.input} placeholder="e.g. Avondale, Belgravia, Hatfield…" value={area} onChange={e => setArea(e.target.value)} />
              </Field>
            </div>
          )}

          {/* error */}
          {error && <div style={S.errorBox}>⚠ {error}</div>}

          {/* actions */}
          <div style={S.btnRow}>
            {step > 1 && (
              <button style={S.backBtn} onClick={back} type="button">← Back</button>
            )}
            {step < totalSteps
              ? <button style={S.nextBtn} onClick={next} type="button">Continue →</button>
              : <button style={{ ...S.nextBtn, ...(loading ? S.nextBtnLoading : {}) }} onClick={handleSubmit} type="button" disabled={loading}>
                  {loading ? "Creating account…" : "Create Account 🎉"}
                </button>
            }
          </div>

          <p style={S.loginPrompt}>
            Already have an account? <Link to="/login" style={S.loginLink}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(v => !v)}
      style={{ ...S.toggleBtn, ...(value ? S.toggleBtnOn : {}) }}>
      <div style={{ ...S.toggleThumb, ...(value ? S.toggleThumbOn : {}) }} />
      <span style={{ fontSize: "13px", fontWeight: 600, color: value ? "#7c3aed" : "#6b7280" }}>{label}</span>
    </button>
  );
}

/* ── styles ── */
const S = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif", flexWrap: "wrap" },

  /* left */
  leftPanel: {
    width: "400px",
    maxWidth: "400px",
    minWidth: "300px",
    background: "linear-gradient(160deg,#3b0764 0%,#4f46e5 100%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "48px 32px 0",
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    flex: "1 1 360px",
  },  
  leftContent: { position: "relative", zIndex: 2 },
  leftLogo: { fontSize: "22px", fontWeight: 900, color: "white", marginBottom: "40px" },
  leftHeading: { fontSize: "30px", fontWeight: 900, color: "white", lineHeight: 1.25, marginBottom: "12px" },
  leftSub: { fontSize: "15px", color: "rgba(255,255,255,0.7)", marginBottom: "36px" },
  leftBullets: { display: "flex", flexDirection: "column", gap: "14px" },
  leftBullet: { display: "flex", alignItems: "center", gap: "12px", color: "rgba(255,255,255,0.9)", fontSize: "15px" },
  leftBulletDot: { width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 },
  leftImg: { height: "220px", background: `url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80) center/cover`, borderRadius: "16px 16px 0 0", marginTop: "32px", opacity: 0.55 },

  /* right */
  rightPanel: {
    flex: "1 1 420px",
    minWidth: 0,
    overflowY: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 20px",
    background: "#faf9ff",
    boxSizing: "border-box",
  },  
  formWrap: { width: "100%", maxWidth: "520px" },

  /* progress */
  progressRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "36px",
    flexWrap: "wrap",
    gap: "8px",
  },  
  progressItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "1 1 100px",
    minWidth: "100px",
  },  
  progressCircle: { width: "30px", height: "30px", borderRadius: "50%", background: "#e5e7eb", color: "#9ca3af", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  progressActive: { background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" },
  progressDone: { background: "#7c3aed", color: "white" },
  progressLabel: { fontSize: "12px", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" },
  progressLabelActive: { color: "#7c3aed" },
  progressLine: { flex: 1, height: "2px", background: "#e5e7eb", margin: "0 4px" },
  progressLineDone: { background: "#7c3aed" },

  /* form header */
  formHeader: { marginBottom: "28px" },
  formTitle: { fontSize: "26px", fontWeight: 900, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.5px" },
  formSub: { fontSize: "14px", color: "#9ca3af", margin: 0 },

  /* fields */
  fields: { display: "flex", flexDirection: "column", gap: "18px", marginBottom: "24px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#374151" },
  input: { padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", background: "white", color: "#111827", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },

  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },  
  row3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  
  /* password */
  pwWrap: { position: "relative" },
  eyeBtn: { position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" },

  /* role toggle */
  roleRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  roleBtn: { padding: "14px", borderRadius: "12px", border: "2px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: "15px", fontWeight: 700, color: "#6b7280", transition: "all 0.15s" },
  roleBtnActive: { border: "2px solid #7c3aed", color: "#7c3aed", background: "#faf5ff" },

  /* lifestyle prefs */
  prefHeading: { fontSize: "14px", fontWeight: 800, color: "#374151", margin: "4px 0 0" },
  prefNote: { fontWeight: 500, color: "#9ca3af", fontSize: "12px" },

  /* toggles */
  toggleRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },  
  toggleBtn: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer" },
  toggleBtnOn: { border: "1.5px solid #ede9fe", background: "#faf5ff" },
  toggleThumb: { width: "32px", height: "18px", borderRadius: "9px", background: "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 },
  toggleThumbOn: { background: "#7c3aed" },

  /* error */
  errorBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "16px" },

  /* buttons */
  btnRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },  
  backBtn: { padding: "13px 20px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  nextBtn: { flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  nextBtnLoading: { opacity: 0.6, cursor: "not-allowed" },

  loginPrompt: { textAlign: "center", fontSize: "14px", color: "#6b7280" },
  loginLink: { color: "#7c3aed", fontWeight: 700, textDecoration: "none" },
};
