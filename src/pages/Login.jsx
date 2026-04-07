import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(location.state?.message || "");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/dashboard");
    });
  }, []);

  const handleLogin = async () => {
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please fill in both fields.");
      return;
    }

    setLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password: password.trim(),
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError("Could not fetch user role. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/dashboard");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={S.page}>
      {/* ── LEFT PANEL ── */}
      <div style={S.leftPanel}>
        <div style={S.leftContent}>
          <div style={S.leftLogo}>🏠 UniCrib</div>
          <h2 style={S.leftHeading}>Welcome back</h2>
          <p style={S.leftSub}>
            Log in to browse verified accommodation, track your bookings, and pay your deposit — all in one place.
          </p>

          <div style={S.testimonial}>
            <p style={S.testimonialText}>
              "UniCrib helped me find a room near HIT in just two days. The whole process was smooth and I felt safe the entire time."
            </p>
            <div style={S.testimonialAuthor}>
              <div style={S.testimonialAvatar}>TM</div>
              <div>
                <p style={S.testimonialName}>Tatenda Moyo</p>
                <p style={S.testimonialRole}>Software Engineering · HIT, Year 2</p>
              </div>
            </div>
          </div>
        </div>
        <div style={S.leftImg} />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={S.rightPanel}>
        <div style={S.formWrap}>

          <div style={S.formHeader}>
            <h1 style={S.formTitle}>Log in to your account</h1>
            <p style={S.formSub}>
              Don't have one?{" "}
              <Link to="/signup" style={S.inlineLink}>Create a free account →</Link>
            </p>
          </div>

          {/* success banner (from signup redirect) */}
          {success && (
            <div style={S.successBox}>
              ✅ {success}
            </div>
          )}

          {/* error */}
          {error && (
            <div style={S.errorBox}>
              ⚠ {error}
            </div>
          )}

          <div style={S.fields}>
            {/* email */}
            <div style={S.fieldGroup}>
              <label style={S.label}>Email address</label>
              <input
                style={S.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            {/* password */}
            <div style={S.fieldGroup}>
              <div style={S.labelRow}>
                <label style={S.label}>Password</label>
                <button style={S.forgotBtn} type="button">Forgot password?</button>
              </div>
              <div style={S.pwWrap}>
                <input
                  style={{ ...S.input, paddingRight: "44px" }}
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
                <button
                  style={S.eyeBtn}
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>
          </div>

          {/* submit */}
          <button
            style={{ ...S.loginBtn, ...(loading ? S.loginBtnLoading : {}) }}
            onClick={handleLogin}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <span style={S.spinnerRow}>
                <span style={S.spinner} /> Logging in…
              </span>
            ) : "Log In →"}
          </button>

          {/* divider */}
          <div style={S.divider}>
            <div style={S.dividerLine} />
            <span style={S.dividerText}>New to UniCrib?</span>
            <div style={S.dividerLine} />
          </div>

          <Link to="/signup" style={{ textDecoration: "none" }}>
            <button style={S.signupBtn} type="button">
              Create a free account
            </button>
          </Link>

        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
  },

  /* ── Left panel ── */
  leftPanel: {
    width: "420px",
    minWidth: "340px",
    background: "linear-gradient(160deg,#3b0764 0%,#4f46e5 100%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "48px 40px 0",
    overflow: "hidden",
    position: "relative",
  },
  leftContent: { position: "relative", zIndex: 2 },
  leftLogo: {
    fontSize: "22px",
    fontWeight: 900,
    color: "white",
    marginBottom: "48px",
  },
  leftHeading: {
    fontSize: "34px",
    fontWeight: 900,
    color: "white",
    lineHeight: 1.2,
    margin: "0 0 14px",
    letterSpacing: "-0.5px",
  },
  leftSub: {
    fontSize: "15px",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.7,
    margin: "0 0 48px",
  },
  testimonial: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "16px",
    padding: "24px",
  },
  testimonialText: {
    fontSize: "15px",
    color: "rgba(255,255,255,0.9)",
    lineHeight: 1.7,
    margin: "0 0 20px",
    fontStyle: "italic",
  },
  testimonialAuthor: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  testimonialAvatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.25)",
    color: "white",
    fontSize: "13px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  testimonialName: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
    color: "white",
  },
  testimonialRole: {
    margin: 0,
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
  },
  leftImg: {
    height: "200px",
    background:
      "url(https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80) center/cover",
    borderRadius: "16px 16px 0 0",
    marginTop: "40px",
    opacity: 0.5,
  },

  /* ── Right panel ── */
  rightPanel: {
    flex: 1,
    background: "#faf9ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    overflowY: "auto",
  },
  formWrap: {
    width: "100%",
    maxWidth: "440px",
  },

  formHeader: { marginBottom: "28px" },
  formTitle: {
    fontSize: "28px",
    fontWeight: 900,
    color: "#111827",
    margin: "0 0 8px",
    letterSpacing: "-0.5px",
  },
  formSub: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  inlineLink: {
    color: "#7c3aed",
    fontWeight: 700,
    textDecoration: "none",
  },

  /* banners */
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#16a34a",
    fontSize: "14px",
    marginBottom: "20px",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#dc2626",
    fontSize: "14px",
    marginBottom: "20px",
  },

  /* fields */
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    marginBottom: "24px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotBtn: {
    background: "none",
    border: "none",
    color: "#7c3aed",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  input: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    background: "white",
    color: "#111827",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  pwWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: 0,
  },

  /* login button */
  loginBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
    color: "white",
    fontWeight: 800,
    fontSize: "16px",
    cursor: "pointer",
    marginBottom: "24px",
  },
  loginBtnLoading: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  spinnerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },

  /* divider */
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "#e5e7eb",
  },
  dividerText: {
    fontSize: "13px",
    color: "#9ca3af",
    whiteSpace: "nowrap",
  },

  /* signup cta button */
  signupBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: "12px",
    border: "1.5px solid #e5e7eb",
    background: "white",
    color: "#374151",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
  },
};
