import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { StatCard, sharedStyles as S, ResponsiveSidebar } from "../components/DashboardShared";
import LandlordVerification from "../pages/LandlordVerification";

function LandlordDashboard({ user }) {
  const [properties,   setProperties]   = useState([]);
  const [requests,     setRequests]     = useState([]);

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

  const resubmitProperty = async (id) => {
    await supabase.from("properties").update({
      rejection_reason: null,
      is_approved: false,
      reviewed_at: null,
      admin_notes: null,
    }).eq("id", id);
    setProperties(prev => prev.map(p =>
      p.id === id ? { ...p, rejection_reason: null, is_approved: false } : p
    ));
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
          <button style={{ ...S.navItem, marginTop: "8px", border: "2px solid #7c3aed", color: "#7c3aed", borderRadius: "10px", fontWeight: 700 }} onClick={() => navigate("/add-property")}>
            <span style={S.navIcon}>➕</span> Add Property
          </button>

          {[{ key: "properties", icon: "🏠", label: "My Properties" },
            { key: "requests", icon: "📋", label: "Booking Requests" },
            { key: "verify", icon: "🛡", label: "Verify Identity" },
            { key: "profile",    icon: "👤", label: "My Profile" },
          ].map(({ key, icon, label }) => (
            <button key={key} style={activeTab === key ? S.navItemActive : S.navItem} onClick={() => setActiveTab(key)}>
              <span style={S.navIcon}>{icon}</span>{label}
            </button>
          ))}
          
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
                    <div style={{ padding: "12px" }}>
                      <h4 style={{ margin: "0 0 4px" }}>{property.title}</h4>
                      <p style={{ color: "#7c3aed", fontWeight: 700, margin: "0 0 4px" }}>${property.price}/mo</p>
                      {property.is_approved ? (
                        <p style={{ fontSize: "13px", color: "#16a34a", margin: 0 }}>✅ Approved</p>
                      ) : property.rejection_reason ? (
                        <div style={{ marginTop: "6px" }}>
                          <p style={{ fontSize: "13px", color: "#dc2626", fontWeight: 700, margin: "0 0 4px" }}>❌ Property Rejected</p>
                          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 10px", fontSize: "12px", color: "#7f1d1d", lineHeight: 1.5 }}>
                            <strong>Reason:</strong> {property.rejection_reason}
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: "13px", color: "#f59e0b", margin: 0 }}>⏳ Pending Approval</p>
                      )}
                    </div>
                    <div style={{ ...S.actionRow, padding: "0 12px 12px", flexWrap: "wrap", gap: "6px" }}>
                      {property.rejection_reason ? (
                        <>
                          <button style={S.editBtn} onClick={() => navigate("/add-property", { state: { property: property } })}>✏️ Edit</button>
                          <button style={S.deleteBtn} onClick={() => deleteProperty(property.id)}>Delete</button>
                          <button
                            style={{ flex: 2, padding: "8px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}
                            onClick={() => resubmitProperty(property.id)}
                          >🔄 Resubmit</button>
                        </>
                      ) : (
                        <>
                          <button style={S.editBtn} onClick={() => navigate("/add-property", { state: { property: property } })}>✏️ Edit</button>
                          <button style={S.deleteBtn} onClick={() => deleteProperty(property.id)}>Delete</button>
                          <button style={S.toggleBtn} onClick={() => toggleFull(property)}>{property.is_full ? "Mark Available" : "Mark Full"}</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "verify" && (
            <LandlordVerification onVerified={(status) => console.log("Status:", status)} />
          )}

          {activeTab === "profile" && <LandlordProfile />}

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

function LandlordProfile() {
  const navigate = useNavigate();
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [saveMsg,   setSaveMsg]   = useState("");
  const [error,     setError]     = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput,       setDeleteInput]       = useState("");

  const [fullName,          setFullName]          = useState("");
  const [phone,             setPhone]             = useState("");
  const [whatsapp,          setWhatsapp]          = useState("");
  const [gender,            setGender]            = useState("");
  const [company,           setCompany]           = useState("");
  const [area,              setArea]              = useState("");
  const [bio,               setBio]               = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name, phone, gender, landlord_whatsapp, landlord_company, landlord_area, bio")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setWhatsapp(data.landlord_whatsapp || "");
        setGender(data.gender || "");
        setCompany(data.landlord_company || "");
        setArea(data.landlord_area || "");
        setBio(data.bio || "");
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(""); setSaveMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("user_profiles").update({
      full_name:          fullName.trim(),
      phone:              phone.trim()   || null,
      gender:             gender         || null,
      landlord_whatsapp:  whatsapp.trim()|| null,
      landlord_company:   company.trim() || null,
      landlord_area:      area.trim()    || null,
      bio:                bio.trim()     || null,
    }).eq("id", user.id);
    if (err) { setError(err.message); }
    else { setSaveMsg("Profile updated!"); setTimeout(() => setSaveMsg(""), 3000); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (deleteInput !== "DELETE") { setError("Type DELETE to confirm."); return; }
    setDeleting(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("properties").delete().eq("user_id", user.id);
    await supabase.from("user_profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px" }}>
      <div style={{ width: "28px", height: "28px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading profile…</p>
    </div>
  );

  const F = ({ label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );

  const input = {
    padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb",
    fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box",
    fontFamily: "inherit", color: "#111827", background: "white",
  };

  return (
    <>
      <style>{`
        @media (max-width: 480px) {
          .lp-hero-avatar {
            width: 52px !important;
            height: 52px !important;
            fontSize: 20px !important;
          }
          .lp-hero-name {
            font-size: 17px !important;
          }
          .lp-save-btn {
            font-size: 14px !important;
          }
          .lp-delete-confirm {
            flex-direction: column !important;
          }
          .lp-delete-confirm button {
            flex: unset !important;
            width: 100% !important;
          }
        }
      `}</style>
    
      <div style={{ padding: "clamp(12px, 4vw, 32px) clamp(12px, 4vw, 32px) 40px", maxWidth: "640px", width: "100%", boxSizing: "border-box" }}>

        {/* ── HERO ── */}
        <div style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", borderRadius: "16px", padding: "clamp(16px, 4vw, 28px)", marginBottom: "20px", marginTop: "8px"}}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px, 3vw, 18px)", flexWrap: "wrap" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "3px solid rgba(255,255,255,0.5)", color: "white", fontSize: "26px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {fullName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="lp-hero-name" style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 900, color: "white" }}>{fullName || "Your Name"}</h2>
              <p style={{ margin: "0 0 2px", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{company || "Individual landlord"}</p>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>{area || "Area not set"}</p>
            </div>
          </div>
        </div>

        {/* ── PERSONAL ── */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "clamp(16px, 4vw, 24px)", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>👤 Personal Details</h3>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9ca3af" }}>Visible to students and admins when reviewing your listings.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <F label="Full Name *">
              <input style={input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Tinashe Moyo" />
            </F>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
              <F label="Phone Number">
                <input style={input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263 77…" />
              </F>
              <F label="WhatsApp Number">
                <input style={input} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+263 77…" />
              </F>
            </div>
            <F label="Gender">
              <select style={input} value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </F>
          </div>
        </div>

        {/* ── BUSINESS ── */}
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "clamp(16px, 4vw, 24px)", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>🏢 Business Details</h3>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9ca3af" }}>Helps students know who they're renting from.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <F label="Company / Trading Name">
              <input style={input} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Brightlight Properties" />
            </F>
            <F label="Operating Area">
              <input style={input} value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Belvedere, Harare" />
            </F>
            <F label="Bio / About">
              <textarea style={{ ...input, minHeight: "90px", resize: "vertical" }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell students a bit about yourself or your properties…" />
            </F>
          </div>
        </div>

        {/* ── MESSAGES ── */}
        {error   && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "16px" }}>⚠ {error}</div>}
        {saveMsg && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", color: "#16a34a", fontSize: "14px", marginBottom: "16px" }}>✅ {saveMsg}</div>}

        {/* ── SAVE ── */}
        <button
          className="lp-save-btn"
          style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer", marginBottom: "32px", opacity: saving ? 0.65 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "💾 Save Changes"}
        </button>

        {/* ── DANGER ZONE ── */}
        <div style={{ background: "white", borderRadius: "16px", border: "1.5px solid #fecaca", padding: "clamp(16px, 4vw, 24px)" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 800, color: "#dc2626" }}>⚠️ Danger Zone</h3>
          <p style={{ margin: "0 0 18px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
            Deleting your account permanently removes your profile and all your property listings. This cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              style={{ padding: "11px 24px", borderRadius: "10px", border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑 Delete My Account
            </button>
          ) : (
            <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>
                Type <strong>DELETE</strong> to permanently delete your account and all listings.
              </p>
              <input
                style={{ ...input, border: "1.5px solid #fecaca" }}
                placeholder="Type DELETE here"
                value={deleteInput}
                onChange={e => { setDeleteInput(e.target.value); setError(""); }}
              />
              {error && <p style={{ margin: 0, fontSize: "13px", color: "#dc2626", fontWeight: 600 }}>⚠ {error}</p>}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setError(""); }}
                >
                  Cancel
                </button>
                <button
                  className="lp-delete-confirm"
                  style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: "#dc2626", color: "white", fontWeight: 800, fontSize: "14px", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Yes, Delete Everything"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default LandlordDashboard;