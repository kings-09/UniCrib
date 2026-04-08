import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { StatCard, sharedStyles as S, ResponsiveSidebar } from "../components/DashboardShared";
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
      <ResponsiveSidebar>
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
      </ResponsiveSidebar>

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
                    <div style={{ display: "flex", gap: "8px" }}>
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
    </div>
  );
}

export default LandlordDashboard;