import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { StatCard, sharedStyles as S } from "../components/DashboardShared";
import LandlordVerification from "../pages/LandlordVerification";

function LandlordDashboard({ user }) {
  const [properties,   setProperties]   = useState([]);
  const [requests,     setRequests]     = useState([]);
  const [editingId,    setEditingId]    = useState(null);
  const [editTitle,    setEditTitle]    = useState("");
  const [editPrice,    setEditPrice]    = useState("");
  const [imageIndexes, setImageIndexes] = useState({});
  const [activeTab,    setActiveTab]    = useState("properties");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      const { data: props } = await supabase.from("properties").select("*").eq("user_id", user.id);
      setProperties(props || []);
      const ids = (props || []).map(p => p.id);
      if (ids.length > 0) {
        const { data: reqs } = await supabase
          .from("booking_requests")
          .select("*, properties(title), property_rooms(room_number)")
          .in("property_id", ids);
        setRequests(reqs || []);
      }
    };
    fetchAll();
  }, [user]);

  const toggleFull = async (property) => {
    await supabase.from("properties").update({ is_full: !property.is_full }).eq("id", property.id);
    setProperties(prev => prev.map(p => p.id === property.id ? { ...p, is_full: !p.is_full } : p));
  };

  const deleteProperty = async (id) => {
    if (!window.confirm("Delete this property?")) return;
    await supabase.from("properties").delete().eq("id", id);
    setProperties(prev => prev.filter(p => p.id !== id));
  };

  const saveEdit = async (id) => {
    await supabase.from("properties").update({ title: editTitle, price: editPrice }).eq("id", id);
    setProperties(prev => prev.map(p => p.id === id ? { ...p, title: editTitle, price: editPrice } : p));
    setEditingId(null);
  };

  const updateRequestStatus = async (reqId, status) => {
    await supabase.from("booking_requests").update({ status }).eq("id", reqId);

    if (status === "approved") {
        const req = requests.find(r => r.id === reqId);

        if (req?.room_id) {
            const { data: room, error: roomFetchError } = await supabase
                .from("property_rooms")
                .select("id, property_id, current_occupants, max_occupants")
                .eq("id", req.room_id)
                .single();

            if (roomFetchError || !room) {
                alert("Could not load room details.");
                return;
            }

            const nextOccupants = (room.current_occupants || 0) + 1;
            const roomNowFull = nextOccupants >= room.max_occupants;

            const { error: roomUpdateError } = await supabase
                .from("property_rooms")
                .update({
                    current_occupants: nextOccupants,
                    is_occupied: roomNowFull,
                })
                .eq("id", room.id);

            if (roomUpdateError) {
                alert(roomUpdateError.message);
                return;
            }

            const { data: allRooms } = await supabase
                .from("property_rooms")
                .select("current_occupants, max_occupants")
                .eq("property_id", req.property_id);

            const propertyNowFull = allRooms?.every(
                r => (r.current_occupants || 0) >= (r.max_occupants || 1)
            );

            await supabase
                .from("properties")
                .update({ is_full: !!propertyNowFull })
                .eq("id", req.property_id);
        }

        const { data: { session } } = await supabase.auth.getSession();
        await fetch(
            `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/notify-booking-approved`,
            {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ booking_request_id: reqId }),
            }
        );

        alert("Booking approved! Student will receive an email notification.");
    }

    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status } : r));
  };

  const nextImg = (id, total) => setImageIndexes(p => ({ ...p, [id]: ((p[id] || 0) + 1) % total }));
  const prevImg = (id, total) => setImageIndexes(p => ({ ...p, [id]: (p[id] || 0) === 0 ? total - 1 : p[id] - 1 }));

  return (
    <div style={S.pageWrap}>
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}><span style={S.logoIcon}>🏠</span><span style={S.logoText}>UniCrib</span></div>
        <nav style={S.navMenu}>
          {[{ key: "properties", icon: "🏠", label: "My Properties" },
            { key: "requests", icon: "📋", label: "Booking Requests" },
            { key: "verify", icon: "🛡", label: "Verify Identity" }
          ].map(({ key, icon, label }) => (
            <button key={key} style={activeTab === key ? S.navItemActive : S.navItem} onClick={() => setActiveTab(key)}>
              <span style={S.navIcon}>{icon}</span>{label}
            </button>
          ))}
          <button style={{ ...S.navItem, marginTop: "8px", border: "2px solid #7c3aed", color: "#7c3aed", borderRadius: "10px", fontWeight: 700 }} onClick={() => navigate("/add-property")}>
            <span style={S.navIcon}>➕</span> Add Property
          </button>
          
        </nav>
        <button style={S.logoutBtn} onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}>🚪 Logout</button>
      </aside>

      <main style={S.main}>
        <div style={S.headerBanner}>
          <div>
            <h1 style={S.greetingTitle}>Landlord Dashboard 🏠</h1>
            <p style={S.greetingSub}>Manage your properties and booking requests</p>
          </div>
        </div>

        <div style={S.tabContent}>
          <div style={S.statsGrid}>
            <StatCard icon="🏠" label="Total Properties"  value={properties.length}                              color="#ede9fe" />
            <StatCard icon="🔴" label="Full Properties"   value={properties.filter(p => p.is_full).length}      color="#fee2e2" />
            <StatCard icon="📋" label="Pending Requests"  value={requests.filter(r => r.status === "pending").length} color="#fef3c7" />
            <StatCard icon="✅" label="Approved"          value={properties.filter(p => p.is_approved).length}  color="#dcfce7" />
          </div>

          {activeTab === "properties" && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>My Properties</h2>
              <div style={S.propertyGrid}>
                {properties.map(property => (
                  <div key={property.id} style={S.card}>
                    {property.image_urls?.length > 0 && (
                      <div style={S.imgWrap}>
                        <img src={property.image_urls[imageIndexes[property.id] || 0]} alt="Property" style={S.cardImg} />
                        {property.image_urls.length > 1 && (
                          <>
                            <button style={S.arrowL} onClick={() => prevImg(property.id, property.image_urls.length)}>◀</button>
                            <button style={S.arrowR} onClick={() => nextImg(property.id, property.image_urls.length)}>▶</button>
                          </>
                        )}
                        <span style={property.is_full ? S.overlayBadgeRed : S.overlayBadgeGreen}>{property.is_full ? "FULL" : "AVAILABLE"}</span>
                      </div>
                    )}
                    {editingId === property.id ? (
                      <div style={{ padding: "12px" }}>
                        <input style={S.filterInput} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                        <input style={{ ...S.filterInput, marginTop: "8px" }} value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Price" />
                        <button style={{ ...S.primaryBtn, marginTop: "8px" }} onClick={() => saveEdit(property.id)}>Save</button>
                      </div>
                    ) : (
                      <div style={{ padding: "12px" }}>
                        <h4 style={{ margin: "0 0 4px" }}>{property.title}</h4>
                        <p style={{ color: "#7c3aed", fontWeight: 700, margin: "0 0 4px" }}>${property.price}/mo</p>
                        <p style={{ fontSize: "13px", color: property.is_approved ? "#16a34a" : "#f59e0b", margin: 0 }}>
                          {property.is_approved ? "✅ Approved" : "⏳ Pending Approval"}
                        </p>
                      </div>
                    )}
                    <div style={{ ...S.actionRow, padding: "0 12px 12px" }}>
                      <button style={S.editBtn} onClick={() => { setEditingId(property.id); setEditTitle(property.title); setEditPrice(property.price); }}>Edit</button>
                      <button style={S.deleteBtn} onClick={() => deleteProperty(property.id)}>Delete</button>
                      <button style={S.toggleBtn} onClick={() => toggleFull(property)}>{property.is_full ? "Mark Available" : "Mark Full"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "verify" && (
            <LandlordVerification onVerified={(status) => console.log("Status:", status)} />
          )}

          {activeTab === "requests" && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Booking Requests</h2>
              {requests.length === 0 && <p style={{ color: "#9ca3af" }}>No booking requests yet.</p>}
              {requests.map(req => (
                <div key={req.id} style={S.requestCard}>
                  <div>
                    <p style={S.requestProp}>
                      {req.properties?.title}
                      {req.property_rooms?.room_number && (
                        <span style={{ color: "#7c3aed", fontWeight: 700 }}> · {req.property_rooms.room_number}</span>
                      )}
                    </p>
                    <span style={req.status === "approved" ? S.badgeGreen : req.status === "rejected" ? S.badgeRed : S.badgeYellow}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  {req.status === "pending" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <button style={S.acceptBtn} onClick={() => updateRequestStatus(req.id, "approved")}>Accept</button>
                      <button style={S.rejectBtn} onClick={() => updateRequestStatus(req.id, "rejected")}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ContactHelp />
    </div>
  );
}

export function ContactHelp() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("contact_messages").insert([{
      user_id: user?.id || null,
      name: name.trim() || "Anonymous",
      message: message.trim(),
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      alert("Failed to send message. Please contact us directly.");
    } else {
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        setName("");
        setOpen(false);
      }, 3000);
    }

    setSending(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 1000,
          width: "52px", height: "52px", borderRadius: "50%",
          background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
          fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        title="Help & Contact"
      >
        💬
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 2000, display: "flex", alignItems: "flex-end",
            justifyContent: "flex-end", padding: "24px",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "white", borderRadius: "20px", padding: "28px",
              width: "100%", maxWidth: "380px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              display: "flex", flexDirection: "column", gap: "16px",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 900, color: "#111827" }}>
                  💬 Help & Contact
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                  We usually respond within a few hours
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af", padding: "0" }}
              >✕</button>
            </div>

            {/* Direct contact info */}
            <div style={{
              background: "#f5f3ff", borderRadius: "12px", padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: "8px",
            }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#7c3aed", letterSpacing: "0.06em" }}>
                REACH US DIRECTLY
              </p>
              
                <a href="tel:+263786206633"
                style={{ display: "flex", alignItems: "center", gap: "8px", color: "#111827", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>

                📞 +263 78 620 6633
              </a>
              <a href="mailto:kinglevchanda@gmail.com" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#7c3aed", textDecoration: "none", fontSize: "14px", fontWeight: 600, wordBreak: "break-all" }}>

                ✉️ kinglevchanda@gmail.com
              </a>
            </div>

            {/* In-app message form */}
            {!sent ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#9ca3af", letterSpacing: "0.06em" }}>
                    OR SEND A MESSAGE
                  </p>
                  <input
                    style={{
                      padding: "10px 14px", borderRadius: "10px",
                      border: "1.5px solid #e5e7eb", fontSize: "14px",
                      outline: "none", fontFamily: "inherit",
                    }}
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                  <textarea
                    style={{
                      padding: "10px 14px", borderRadius: "10px",
                      border: "1.5px solid #e5e7eb", fontSize: "14px",
                      outline: "none", fontFamily: "inherit",
                      minHeight: "100px", resize: "vertical",
                    }}
                    placeholder="Describe your issue or question…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  style={{
                    padding: "12px", borderRadius: "12px", border: "none",
                    background: message.trim()
                      ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                      : "#e5e7eb",
                    color: message.trim() ? "white" : "#9ca3af",
                    fontWeight: 800, fontSize: "15px", cursor: message.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {sending ? "Sending…" : "Send Message 🚀"}
                </button>
              </>
            ) : (
              <div style={{
                textAlign: "center", padding: "24px 0",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              }}>
                <span style={{ fontSize: "40px" }}>✅</span>
                <p style={{ margin: 0, fontWeight: 800, color: "#111827", fontSize: "16px" }}>Message sent!</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>We'll get back to you soon.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default LandlordDashboard;