// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import StudentDashboard from "./StudentDashboard";
import LandlordDashboard from "./LandlordDashboard";
import AdminDashboard from "./AdminDashboard";

export default function Dashboard() {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("role_id")
          .eq("id", user.id)
          .single();
        setRole(data?.role_id ?? 0);
      }
    };
    getRole();
  }, []);

  if (role === null)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "16px", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ width: "36px", height: "36px", border: "4px solid #ede9fe", borderTop: "4px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading dashboard…</p>
      </div>
    );

  if (role === 1) return <StudentDashboard user={user} />;
  if (role === 2) return <LandlordDashboard user={user} />;
  if (role === 3) return <AdminDashboard />;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <p style={{ color: "#dc2626", fontWeight: 600 }}>Unknown role. Please contact support.</p>
    </div>
  );
}