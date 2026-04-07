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
              <button>Dashboard</button>
              <button>Find Accommodation</button>
            </>
          )}

          {role === 2 && (
            <>
              <button>My Properties</button>
              <button>Add Property</button>
            </>
          )}

          {role === 3 && (
            <>
              <button>Admin Panel</button>
            </>
          )}
        </div>

        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  layout: { display: "flex", height: "100vh" },
  sidebar: { width: "250px", background: "#f8fafc", padding: "20px" },
  main: { flex: 1, padding: "20px", overflowY: "auto" },
};