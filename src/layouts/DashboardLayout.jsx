import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function DashboardLayout({ children }) {
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div style={styles.layout}>
      
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2>🏠 UniCrib</h2>

        <div style={styles.menu}>
          {role === 1 && (
            <>
              <button style={styles.menuButton}>Dashboard</button>
              <button style={styles.menuButton}>Find Accommodation</button>
            </>
          )}

          {role === 2 && (
            <>
              <button style={styles.menuButton}>My Properties</button>
              <button style={styles.menuButton}>Add Property</button>
            </>
          )}

          {role === 3 && (
            <>
              <button style={styles.menuButton}>Admin Panel</button>
            </>
          )}
        </div>

        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    flexWrap: "wrap",
    background: "#ffffff",
  },

  sidebar: {
    width: "100%",
    maxWidth: "250px",
    minWidth: "220px",
    background: "#f8fafc",
    padding: "20px",
    boxSizing: "border-box",
    borderRight: "1px solid #e5e7eb",
  },

  menu: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    margin: "20px 0",
  },

  menuButton: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: "8px",
    background: "white",
    color: "#111827",
    textAlign: "left",
    fontWeight: "600",
    cursor: "pointer",
  },

  logoutBtn: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: "8px",
    background: "#ef4444",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "12px",
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "20px",
    overflowY: "auto",
    boxSizing: "border-box",
  },
};