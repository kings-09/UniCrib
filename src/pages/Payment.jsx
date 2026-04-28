import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useState, useEffect, useRef } from "react";

const METHODS = [
  {
    id:    "ecocash",
    label: "EcoCash",
    color: "#e8f5e9",
    border:"#4caf50",
    accent:"#2e7d32",
    hint:  "Enter your EcoCash number",
    placeholder: "077 XXX XXXX",
  },
  {
    id:    "innbucks",
    label: "InnBucks",
    color: "#fff8e1",
    border:"#ffb300",
    accent:"#e65100",
    hint:  "Enter your InnBucks number",
    placeholder: "077 XXX XXXX",
  },
];

export default function Payment() {
  const { bookingId } = useParams();
  const navigate      = useNavigate();

  const [booking,       setBooking]       = useState(null);
  const [propertyTitle, setPropertyTitle] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.00");
  const [method,        setMethod]        = useState("");
  const [phone,         setPhone]         = useState("");
  const [email,         setEmail]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [pageLoading,   setPageLoading]   = useState(true);
  const [error,         setError]         = useState("");
  const [stage,         setStage]         = useState("form");   // form | awaiting | success | failed
  const [instructions,  setInstructions]  = useState("");
  const [pollCount,     setPollCount]     = useState(0);
  const pollRef = useRef(null);

  // ── Fetch booking details ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: b } = await supabase
        .from("booking_requests")
        .select("*, properties(price, title)")
        .eq("id", bookingId)
        .single();

      if (b) {
        setBooking(b);
        setPropertyTitle(b.properties?.title || "Property");
        setDepositAmount(((b.properties?.price || 0) * 0.2).toFixed(2));
        if (b.payment_status === "paid") setStage("success");
      }

      // Pre-fill email from logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);

      setPageLoading(false);
    };
    load();
  }, [bookingId]);

  // ── Polling loop ──────────────────────────────────────────────────────
  const startPolling = () => {
    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      setPollCount(count);

      // Give up after 2 minutes (24 × 5s)
      if (count > 24) {
        clearInterval(pollRef.current);
        setStage("failed");
        setError("Payment timed out. Please try again.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/paynow-initiate`,
          {
            method:  "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "poll", booking_id: bookingId }),
          }
        );
        const data = await res.json();

        if (data.paid) {
          clearInterval(pollRef.current);
          // Delete all other pending/approved requests for this student
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: allReqs } = await supabase
              .from("booking_requests")
              .select("id")
              .eq("student_id", user.id)
              .neq("id", bookingId)
              .in("status", ["pending", "approved"]);
            if (allReqs?.length) {
              await supabase
                .from("booking_requests")
                .delete()
                .in("id", allReqs.map(r => r.id));
            }
          }
          setStage("success");
        } 
        else if (data.status === "cancelled" || data.status === "failed") {
          clearInterval(pollRef.current);
          setStage("failed");
          setError("Payment was cancelled or failed. Please try again.");
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Submit payment ────────────────────────────────────────────────────
  const handlePay = async () => {
    setError("");

    if (!method)  return setError("Please select a payment method.");
    if (!phone.replace(/\s/g, "") || phone.replace(/\D/g, "").length < 9)
      return setError("Please enter a valid mobile number.");
    if (!email || !email.includes("@"))
      return setError("Please enter your email address.");

    if (booking?.status !== "approved")
      return setError("This booking is not approved for payment.");
    if (booking?.payment_status === "paid")
      return setError("This booking has already been paid.");

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/paynow-initiate`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:     "initiate",
            booking_id: bookingId,
            phone:      phone.replace(/\s/g, ""),
            method,
            email,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Payment initiation failed. Please try again.");
        setLoading(false);
        return;
      }

      setInstructions(data.instructions);
      setStage("awaiting");
      startPolling();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    }

    setLoading(false);
  };

  const selectedMethod = METHODS.find(m => m.id === method);

  // ── Loading ───────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={S.page}>
        <div style={S.centred}>
          <div style={S.spinner} />
          <p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading payment details…</p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.successIcon}>✅</div>
          <h2 style={S.cardTitle}>Payment Confirmed!</h2>
          <p style={S.cardSub}>
            Your deposit of <strong>${depositAmount}</strong> for{" "}
            <strong>{propertyTitle}</strong> has been received.
          </p>
          <div style={S.successDetails}>
            <Row label="Amount paid"     value={`$${depositAmount}`} />
            <Row label="Property"        value={propertyTitle} />
            <Row label="Booking status"  value="✅ Confirmed" />
          </div>
          <p style={S.successNote}>
            The landlord has been notified. You will receive move-in instructions shortly.
          </p>
          <button style={S.primaryBtn} onClick={() => navigate("/dashboard")}>
            Back to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────
  if (stage === "failed") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.failIcon}>❌</div>
          <h2 style={S.cardTitle}>Payment Failed</h2>
          <p style={S.cardSub}>{error || "The payment was not completed."}</p>
          <button style={S.primaryBtn} onClick={() => { setStage("form"); setError(""); }}>
            Try Again
          </button>
          <button style={S.ghostBtn} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Awaiting ──────────────────────────────────────────────────────────
  if (stage === "awaiting") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.awaitingIcon}>
            {selectedMethod?.icon || "📱"}
          </div>
          <h2 style={S.cardTitle}>Awaiting Payment</h2>
          <p style={S.cardSub}>
            A payment request of <strong>${depositAmount}</strong> has been sent to{" "}
            <strong>{phone}</strong>
          </p>

          <div style={S.instructionBox}>
            <p style={S.instructionTitle}>📋 Instructions</p>
            <p style={S.instructionText}>{instructions}</p>
          </div>

          <div style={S.pollingRow}>
            <div style={S.pollDot} />
            <span style={S.pollText}>
              Checking payment status… ({pollCount * 5}s)
            </span>
          </div>

          <div style={S.timerBar}>
            <div style={{
              ...S.timerFill,
              width: `${Math.min((pollCount / 24) * 100, 100)}%`,
              background: pollCount > 18 ? "#ef4444" : "#7c3aed",
            }} />
          </div>
          <p style={S.timerHint}>
            {pollCount < 24
              ? `Payment window: ${120 - pollCount * 5}s remaining`
              : "Payment window expired"}
          </p>

          <button
            style={S.ghostBtn}
            onClick={() => { clearInterval(pollRef.current); setStage("form"); }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate("/dashboard")}>← Back</button>
          <span style={S.logo}>🏠 UniCrib</span>
          <span />
        </div>

        <h2 style={S.cardTitle}>Pay Deposit</h2>
        <p style={S.cardSub}>Secure your booking with a 20% deposit</p>

        {/* Summary */}
        <div style={S.summaryBox}>
          <div style={S.summaryRow}>
            <span style={S.summaryLabel}>Property</span>
            <span style={S.summaryValue}>{propertyTitle}</span>
          </div>
          <div style={S.summaryRow}>
            <span style={S.summaryLabel}>Monthly rent</span>
            <span style={S.summaryValue}>${booking?.properties?.price}/mo</span>
          </div>
          <div style={{ ...S.summaryRow, borderTop: "1px solid #e5e7eb", paddingTop: "10px", marginTop: "4px" }}>
            <span style={{ ...S.summaryLabel, fontWeight: 800, color: "#111827" }}>Deposit (20%)</span>
            <span style={{ ...S.summaryValue, fontSize: "20px", fontWeight: 900, color: "#7c3aed" }}>
              ${depositAmount}
            </span>
          </div>
        </div>

        {/* Method selection */}
        <p style={S.sectionLabel}>Payment Method</p>
        <div style={S.methodGrid}>
          {METHODS.map(m => (
            <button
              key={m.id}
              type="button"
              style={{
                ...S.methodBtn,
                background:   method === m.id ? m.color  : "white",
                borderColor:  method === m.id ? m.border : "#e5e7eb",
                boxShadow:    method === m.id ? `0 0 0 3px ${m.border}33` : "none",
              }}
              onClick={() => { setMethod(m.id); setError(""); }}
            >
              <span style={{ fontSize: "28px" }}>{m.icon}</span>
              <span style={{ ...S.methodLabel, color: method === m.id ? m.accent : "#374151" }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>

        {/* Phone input */}
        {method && (
          <div style={S.fieldWrap}>
            <label style={S.fieldLabel}>{selectedMethod.hint}</label>
            <div style={S.phoneWrap}>
              <span style={S.phonePrefix}>+263</span>
              <input
                style={S.phoneInput}
                type="tel"
                placeholder={selectedMethod.placeholder}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Email */}
        {method && (
          <div style={S.fieldWrap}>
            <label style={S.fieldLabel}>Email address (for receipt)</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={S.errorBox}>⚠ {error}</div>
        )}

        {/* Pay button */}
        <button
          style={{ ...S.primaryBtn, ...(loading || !method ? S.disabledBtn : {}) }}
          onClick={handlePay}
          disabled={loading || !method}
        >
          {loading
            ? "Initiating payment…"
            : `Pay $${depositAmount} via ${selectedMethod?.label || "..."}`}
        </button>

        <p style={S.secureNote}>
          🔒 Payments processed securely via Paynow Zimbabwe
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: "13px", color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{value}</span>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#f5f3ff 0%,#ede9fe 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif", padding: "24px",
    boxSizing: "border-box",
  },
  centred: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "16px",
  },
  spinner: {
    width: "36px", height: "36px",
    border: "4px solid #ede9fe", borderTop: "4px solid #7c3aed",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
  card: {
    background: "white", borderRadius: "24px",
    boxShadow: "0 8px 40px rgba(124,58,237,0.12)",
    padding: "clamp(20px,5vw,36px)",
    maxWidth: "440px", width: "100%",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  header: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "4px",
  },
  backBtn: {
    background: "none", border: "none",
    color: "#7c3aed", fontWeight: 700, fontSize: "14px",
    cursor: "pointer", padding: "4px 0",
  },
  logo: { fontSize: "16px", fontWeight: 900, color: "#1a1a2e" },
  cardTitle: {
    margin: 0, fontSize: "22px", fontWeight: 900,
    color: "#1a1a2e", textAlign: "center",
  },
  cardSub: {
    margin: 0, fontSize: "14px", color: "#6b7280",
    textAlign: "center", lineHeight: 1.5,
  },

  summaryBox: {
    background: "#faf5ff",
    border: "1px solid #ede9fe",
    borderRadius: "14px",
    padding: "16px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  summaryRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  summaryLabel: { fontSize: "13px", color: "#6b7280", fontWeight: 500 },
  summaryValue: { fontSize: "14px", fontWeight: 700, color: "#374151" },

  sectionLabel: {
    margin: 0, fontSize: "13px", fontWeight: 700, color: "#374151",
  },
  methodGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  methodBtn: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "8px",
    padding: "16px 12px",
    borderRadius: "14px",
    border: "2px solid",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  methodLabel: {
    fontSize: "14px", fontWeight: 800,
  },

  fieldWrap: {
    display: "flex", flexDirection: "column", gap: "7px",
  },
  fieldLabel: {
    fontSize: "13px", fontWeight: 700, color: "#374151",
  },
  phoneWrap: {
    display: "flex", alignItems: "center",
    border: "1.5px solid #e5e7eb", borderRadius: "10px",
    overflow: "hidden",
  },
  phonePrefix: {
    padding: "11px 12px",
    background: "#f9fafb",
    borderRight: "1.5px solid #e5e7eb",
    fontSize: "14px", fontWeight: 700, color: "#374151",
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1, padding: "11px 14px",
    border: "none", outline: "none",
    fontSize: "15px", fontFamily: "inherit",
    color: "#111827",
  },
  input: {
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    color: "#111827",
    outline: "none",
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13px", color: "#dc2626", fontWeight: 600,
  },

  primaryBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
    color: "white",
    fontWeight: 800, fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
  },
  disabledBtn: {
    opacity: 0.55, cursor: "not-allowed",
    boxShadow: "none",
  },
  ghostBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1.5px solid #e5e7eb",
    background: "white",
    color: "#374151",
    fontWeight: 700, fontSize: "14px",
    cursor: "pointer",
  },
  secureNote: {
    margin: 0, textAlign: "center",
    fontSize: "12px", color: "#9ca3af",
  },

  // Awaiting stage
  awaitingIcon: {
    fontSize: "52px", textAlign: "center",
    animation: "pulse 2s ease-in-out infinite",
  },
  instructionBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "12px",
    padding: "14px 16px",
  },
  instructionTitle: {
    margin: "0 0 6px",
    fontSize: "13px", fontWeight: 800, color: "#92400e",
  },
  instructionText: {
    margin: 0, fontSize: "13px", color: "#78350f", lineHeight: 1.6,
  },
  pollingRow: {
    display: "flex", alignItems: "center", gap: "10px",
    justifyContent: "center",
  },
  pollDot: {
    width: "10px", height: "10px",
    borderRadius: "50%",
    background: "#7c3aed",
    animation: "pulse 1s ease-in-out infinite",
  },
  pollText: {
    fontSize: "13px", color: "#7c3aed", fontWeight: 600,
  },
  timerBar: {
    height: "6px", background: "#f3f4f6",
    borderRadius: "3px", overflow: "hidden",
  },
  timerFill: {
    height: "100%", borderRadius: "3px",
    transition: "width 0.5s ease, background 0.5s ease",
  },
  timerHint: {
    margin: 0, fontSize: "12px",
    color: "#9ca3af", textAlign: "center",
  },

  // Success stage
  successIcon: { fontSize: "52px", textAlign: "center" },
  successDetails: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "12px 16px",
  },
  successNote: {
    margin: 0, fontSize: "13px",
    color: "#6b7280", textAlign: "center", lineHeight: 1.6,
  },

  // Failed stage
  failIcon: { fontSize: "52px", textAlign: "center" },
};
