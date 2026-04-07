import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const getUserAndRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role_id);
      }

      setLoading(false);
    };

    getUserAndRole();
    

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUserAndRole();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  const handleLogout = async() => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    navigate("/login");
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logo}>UniCrib</div>

        {user && role === 1 && (
          <>
            <Link to="/map" style={styles.link}>Map</Link>
            <Link to="/dashboard" style={styles.link}>Dashboard</Link>
          </>
        )}

        {user && role === 2 && (
          <>
            <Link to="/dashboard" style={styles.link}>My Properties</Link>
            <Link to="/add-property" style={styles.link}>Add Property</Link>
          </>
        )}

        {user && role === 3 && (
          <Link to="/dashboard" style={styles.link}>Admin Panel</Link>
        )}
      </div>

      <div style={styles.right}>
        {user && (
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
const styles = {
  nav: {
    backgroundColor: "white",
    padding: "15px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },

  left: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    minWidth: 0,
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    minWidth: 0,
  },

  logo: {
    fontWeight: "bold",
    fontSize: "20px",
    textDecoration: "none",
    color: "#2563eb",
    whiteSpace: "nowrap",
  },

  link: {
    textDecoration: "none",
    color: "#333",
    fontWeight: "500",
    padding: "6px 10px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
  },

  logoutBtn: {
    padding: "8px 14px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
};

