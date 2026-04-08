// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import StudentDashboard from "./StudentDashboard";
import LandlordDashboard from "./LandlordDashboard";
import AdminDashboard from "./AdminDashboard";
import LandlordVerification from "./LandlordVerification";

export default function Dashboard() {
  const [role,               setRole]               = useState(null);
  const [user,               setUser]               = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data } = await supabase
        .from("user_profiles")
        .select("role_id, verification_status")
        .eq("id", user.id)
        .single();
      setRole(data?.role_id ?? 0);
      setVerificationStatus(data?.verification_status ?? "unverified");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Realtime: watch this landlord's verification_status so the page
  // unlocks automatically the moment an admin approves them.
  useEffect(() => {
    if (!user || role !== 2) return;

    const channel = supabase
      .channel("landlord-verification-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.verification_status;
          if (newStatus) setVerificationStatus(newStatus);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, role]);

  /* loading */
  if (role === null) {
    return (
      <div style={loadingWrap}>
        <div style={spinner} />
        <p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading dashboard...</p>
      </div>
    );
  }

  /* students and admins go straight through */
  if (role === 1) return <StudentDashboard user={user} />;
  if (role === 3) return <AdminDashboard />;

  /* landlord gate */
  if (role === 2) {
    if (verificationStatus === "unverified" || verificationStatus === "rejected") {
      return (
        <LandlordVerification
          onVerified={(status) => setVerificationStatus(status)}
        />
      );
    }

    if (verificationStatus === "pending") {
      return <PendingApprovalScreen />;
    }

    if (verificationStatus === "verified") {
      return <LandlordDashboard user={user} />;
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <p style={{ color: "#dc2626", fontWeight: 600 }}>Unknown role. Please contact support.</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Waiting screen shown after docs are uploaded
───────────────────────────────────────────────────────────── */
function PendingApprovalScreen() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={pendingPage}>
      <div style={pendingCard}>
        <div style={pendingLogo}>🏠 <span style={{ color: "#7c3aed" }}>UniCrib</span></div>

        <div style={clockWrap}>
          <span style={{ fontSize: "40px" }}>🕐</span>
        </div>

        <h1 style={pendingTitle}>Verification Under Review</h1>
        <p style={pendingSub}>
          Your documents have been submitted and our team is reviewing them.
          This usually takes <strong>less than 24 hours</strong>.
        </p>

        <div style={stepsWrap}>
          <Step done label="Account created"          />
          <Step done label="Documents uploaded"        />
          <Step wait label="Admin review in progress"  />
          <Step lock label="Dashboard access granted"  />
        </div>

        <div style={infoBox}>
          <span style={{ fontSize: "18px" }}>💡</span>
          <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
            This page will automatically unlock as soon as your account is approved — no need to refresh.
          </p>
        </div>

        <button style={logoutBtn} onClick={handleLogout}>
          🚪 Log out
        </button>
      </div>
    </div>
  );
}

function Step({ done, wait, lock, label }) {
  const icon   = done ? "✅" : wait ? "⏳" : "🔒";
  const color  = done ? "#16a34a" : wait ? "#d97706" : "#9ca3af";
  const bg     = done ? "#f0fdf4" : wait ? "#fffbeb" : "#f9fafb";
  const border = done ? "#bbf7d0" : wait ? "#fde68a" : "#e5e7eb";
  return (
    <div style={{ ...stepRow, background: bg, border: `1px solid ${border}` }}>
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <span style={{ fontSize: "14px", fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

/* styles */
const loadingWrap = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", height: "100vh", gap: "16px",
  fontFamily: "'Segoe UI', sans-serif",
};
const spinner = {
  width: "36px", height: "36px",
  border: "4px solid #ede9fe", borderTop: "4px solid #7c3aed",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
const pendingPage = {
  minHeight: "100vh",
  background: "linear-gradient(160deg,#f5f3ff 0%,#ede9fe 100%)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "'Segoe UI', sans-serif", padding: "24px",
  boxSizing: "border-box",
};
const pendingCard = {
  background: "white", borderRadius: "24px",
  boxShadow: "0 8px 40px rgba(124,58,237,0.12)",
  padding: "clamp(24px,5vw,48px)",
  maxWidth: "480px", width: "100%",
  display: "flex", flexDirection: "column", alignItems: "center",
  textAlign: "center", gap: "20px",
};
const pendingLogo  = { fontSize: "22px", fontWeight: 900, color: "#111827" };
const clockWrap    = {
  width: "80px", height: "80px", borderRadius: "50%",
  background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const pendingTitle = { margin: 0, fontSize: "clamp(20px,4vw,26px)", fontWeight: 900, color: "#111827" };
const pendingSub   = { margin: 0, fontSize: "15px", color: "#6b7280", lineHeight: 1.6 };
const stepsWrap    = { display: "flex", flexDirection: "column", gap: "10px", width: "100%" };
const stepRow      = { display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px" };
const infoBox      = {
  display: "flex", gap: "12px", alignItems: "flex-start",
  background: "#fffbeb", border: "1px solid #fde68a",
  borderRadius: "12px", padding: "14px 16px", width: "100%",
  textAlign: "left", boxSizing: "border-box",
};
const logoutBtn    = {
  background: "#fef2f2", border: "none", borderRadius: "10px",
  padding: "10px 24px", cursor: "pointer", color: "#dc2626",
  fontWeight: 700, fontSize: "14px",
};
