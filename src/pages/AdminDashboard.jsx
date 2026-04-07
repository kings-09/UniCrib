import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { StatCard, sharedStyles as S } from "../components/DashboardShared";
import { VerificationReview } from "../pages/LandlordVerification";

function AdminDashboard() {
  const navigate = useNavigate();
  const [pending,       setPending]       = useState([]);
  const [approved,      setApproved]      = useState([]);
  const [activeTab,     setActiveTab]     = useState("pending");
  const [selected,      setSelected]      = useState(null);
  const [imgIdx,        setImgIdx]        = useState(0);
  const [adminNote,     setAdminNote]     = useState("");
  const [rejectReason,  setRejectReason]  = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [landlordInfo,  setLandlordInfo]  = useState(null);
  const [isSuperAdmin,  setIsSuperAdmin]  = useState(false);
  const [admins,        setAdmins]        = useState([]);
  const [newAdminName,  setNewAdminName]  = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPw,    setNewAdminPw]    = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError]   = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [pendingVerifications, setPendingVerifications] = useState([]);

  useEffect(() => { fetchAll(); fetchAdminStatus(); fetchAdmins(); fetchPendingVerifications()}, []);

  const fetchAll = async () => {
    const { data: pend } = await supabase.from("properties").select("*").eq("is_approved", false).is("rejection_reason", null);
    const { data: appr } = await supabase.from("properties").select("*").eq("is_approved", true);
    setPending(pend || []); setApproved(appr || []);
  };

  const fetchAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_profiles").select("is_super_admin").eq("id", user.id).single();
    setIsSuperAdmin(data?.is_super_admin === true);
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from("user_profiles").select("id, full_name, role_id, is_super_admin").eq("role_id", 3);
    setAdmins(data || []);
  };

  const fetchPendingVerifications = async () => {
    const { data } = await supabase
      .from("landlord_verifications")
      .select("*")
      .eq("status", "pending");

    setPendingVerifications(data || []);
  };

  const openReview = async (property) => {
    setSelected(property); setImgIdx(0); setAdminNote(""); setRejectReason(""); setShowRejectBox(false); setLandlordInfo(null);
    const { data: profile } = await supabase.from("user_profiles").select("full_name, phone, gender, landlord_company, landlord_whatsapp, landlord_area").eq("id", property.user_id).single();
    setLandlordInfo(profile || {});
  };

  const handleApprove = async () => {
    if (!selected) return;
    setLoading(true);
    await supabase.from("properties").update({ is_approved: true, admin_notes: adminNote || null, reviewed_at: new Date().toISOString() }).eq("id", selected.id);
    await fetchAll(); setSelected(null); setLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("Please provide a rejection reason."); return; }
    setLoading(true);
    await supabase.from("properties").update({ is_approved: false, rejection_reason: rejectReason.trim(), admin_notes: adminNote || null, reviewed_at: new Date().toISOString() }).eq("id", selected.id);
    await fetchAll(); setSelected(null); setLoading(false);
  };

  const createAdmin = async () => {
    setCreateError(""); setCreateSuccess("");
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPw.trim()) { setCreateError("All fields are required."); return; }
    if (newAdminPw.length < 6) { setCreateError("Password must be at least 6 characters."); return; }
    setCreateLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-admin-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: newAdminEmail.trim(), password: newAdminPw, full_name: newAdminName.trim() }),
    });
    const result = await res.json();
    if (!res.ok) { setCreateError(result.error || "Failed to create admin."); }
    else { setCreateSuccess(`Admin account created for ${newAdminEmail}`); setNewAdminName(""); setNewAdminEmail(""); setNewAdminPw(""); await fetchAdmins(); }
    setCreateLoading(false);
  };

  const removeAdmin = async (userId) => {
    if (!window.confirm("Remove this admin? They will be set back to student role.")) return;
    await supabase.from("user_profiles").update({ role_id: 1 }).eq("id", userId);
    await fetchAdmins();
  };

  const AMENITY_LABELS = {
    wifi: "📶 WiFi", water: "💧 Water", electric: "⚡ Electricity", kitchen: "🍳 Kitchen",
    laundry: "🧺 Laundry", parking: "🚗 Parking", security: "🔒 Security", furnished: "🛋️ Furnished",
    garden: "🌿 Garden", ac: "❄️ Air Con", pool: "🏊 Swimming Pool",
  };

  const tabs = [
    { key: "pending",  label: "Pending Review", count: pending.length  },
    { key: "approved", label: "Approved",        count: approved.length },
    { key: "verifications", label: "Verify Landlords", count: pendingVerifications.length },
    ...(isSuperAdmin ? [{ key: "admins", label: "Manage Admins", count: admins.length }] : []),
  ];

  return (
    <div style={S.pageWrap}>
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}><span style={S.logoIcon}>🏠</span><span style={S.logoText}>UniCrib</span></div>
        <div style={S.adminBadge}>🛡 Admin Panel</div>
        <nav style={S.navMenu}>
          {tabs.map(t => (
            <button key={t.key} style={activeTab === t.key ? S.navItemActive : S.navItem} onClick={() => { setActiveTab(t.key); setSelected(null); }}>
              <span style={S.navIcon}>
                {t.key === "pending" ? "⏳" : t.key === "approved" ? "✅" : "👑"},
              </span>
              {t.label}
              {t.count > 0 && <span style={t.key === "pending" ? S.countBadgeOrange : S.countBadgeGreen}>{t.count}</span>}
            </button>
          ))}
        </nav>
        <button style={S.logoutBtn} onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}>🚪 Logout</button>
      </aside>

      <main style={S.main}>
        <div style={S.headerBanner}>
          <div><h1 style={S.greetingTitle}>🛡 Admin Dashboard</h1><p style={S.greetingSub}>Review and verify property listings before they go live</p></div>
        </div>

        <div style={S.statsGrid}>
          <StatCard icon="⏳" label="Pending Review" value={pending.length}                   color="#fef3c7" />
          <StatCard icon="✅" label="Approved"        value={approved.length}                  color="#dcfce7" />
          <StatCard icon="🏠" label="Total Listings"  value={pending.length + approved.length} color="#ede9fe" />
          {isSuperAdmin && <StatCard icon="👑" label="Total Admins" value={admins.length} color="#fce7f3" />}
        </div>

        {(activeTab === "pending" || activeTab === "approved") && (
          <div style={S.contentArea}>
            <div style={S.listPanel}>
              <h2 style={S.panelTitle}>{activeTab === "pending" ? "⏳ Awaiting Review" : "✅ Approved Properties"}</h2>
              {(activeTab === "pending" ? pending : approved).length === 0 && (
                <div style={S.emptyState}>
                  <p style={{ fontSize: "40px", margin: "0 0 12px" }}>{activeTab === "pending" ? "🎉" : "🏠"}</p>
                  <p style={{ color: "#9ca3af" }}>{activeTab === "pending" ? "All caught up! No pending listings." : "No approved listings yet."}</p>
                </div>
              )}
              {(activeTab === "pending" ? pending : approved).map(p => (
                <div key={p.id} style={{ ...S.listItem, ...(selected?.id === p.id ? S.listItemActive : {}) }} onClick={() => openReview(p)}>
                  <div style={S.listItemImg}>{p.image_urls?.length > 0 ? <img src={p.image_urls[0]} alt="" style={S.listThumb} /> : <span style={{ fontSize: "28px" }}>🏠</span>}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={S.listItemTitle}>{p.title}</p>
                    <p style={S.listItemSub}>${p.price}/mo · {p.property_type || "Property"}</p>
                    <p style={S.listItemSub}>{p.image_urls?.length || 0} photo{p.image_urls?.length !== 1 ? "s" : ""} uploaded</p>
                  </div>
                  <span style={p.is_approved ? S.badgeGreen : S.badgeOrange}>{p.is_approved ? "Live" : "Pending"}</span>
                </div>
              ))}
            </div>

            {selected ? (
              <div style={S.reviewPanel}>
                <div style={S.reviewHeader}>
                  <h2 style={S.reviewTitle}>{selected.title}</h2>
                  <button style={S.closeReviewBtn} onClick={() => setSelected(null)}>✕</button>
                </div>

                {selected.image_urls?.length > 0 ? (
                  <div style={S.gallery}>
                    <div style={S.galleryMain}>
                      <img src={selected.image_urls[imgIdx]} alt="Property" style={S.galleryMainImg} />
                      {selected.image_urls.length > 1 && (
                        <>
                          <button style={S.arrowL} onClick={() => setImgIdx(i => i === 0 ? selected.image_urls.length - 1 : i - 1)}>◀</button>
                          <button style={S.arrowR} onClick={() => setImgIdx(i => i === selected.image_urls.length - 1 ? 0 : i + 1)}>▶</button>
                          <div style={S.imgCounter}>{imgIdx + 1} / {selected.image_urls.length}</div>
                        </>
                      )}
                    </div>
                    {selected.image_urls.length > 1 && (
                      <div style={S.thumbRow}>
                        {selected.image_urls.map((url, i) => (
                          <img key={i} src={url} alt="" style={{ ...S.thumb, ...(imgIdx === i ? S.thumbActive : {}) }} onClick={() => setImgIdx(i)} />
                        ))}
                      </div>
                    )}
                    <p style={S.photoNote}>{selected.image_urls.length < 2 ? "⚠️ Only 1 photo uploaded." : `✅ ${selected.image_urls.length} photos uploaded.`}</p>
                  </div>
                ) : (
                  <div style={S.noPhotos}>
                    <p style={{ fontSize: "32px", margin: "0 0 8px" }}>📷</p>
                    <p style={{ color: "#dc2626", fontWeight: 700 }}>No photos uploaded</p>
                    <p style={{ color: "#9ca3af", fontSize: "13px" }}>Be cautious before approving.</p>
                  </div>
                )}

                <Section title="🏠 Property Details">
                  <Row label="Type"          value={selected.property_type || "—"} />
                  <Row label="Price"         value={`$${selected.price}/month`} />
                  <Row label="Rooms"         value={selected.rooms || "—"} />
                  <Row label="Max Occupants" value={selected.max_occupants || "—"} />
                  <Row label="Address"       value={selected.address || "—"} />
                  <Row label="Coordinates"   value={selected.latitude ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : "—"} />
                  {selected.latitude && <a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noopener noreferrer" style={S.mapLink}>📍 Verify location on Google Maps →</a>}
                </Section>

                <Section title="📝 Description"><p style={S.descText}>{selected.description || "No description provided."}</p></Section>

                {selected.amenities?.length > 0 && (
                  <Section title="✨ Amenities">
                    <div style={S.amenityChips}>{selected.amenities.map(a => <span key={a} style={S.amenityChip}>{AMENITY_LABELS[a] || a}</span>)}</div>
                  </Section>
                )}

                <Section title="👤 Landlord Information">
                  {landlordInfo === null ? <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading…</p> : (
                    <>
                      <Row label="Full Name" value={landlordInfo.full_name || "—"} />
                      <Row label="Phone"     value={landlordInfo.phone || "—"} />
                      <Row label="WhatsApp"  value={landlordInfo.landlord_whatsapp || "—"} />
                      <Row label="Company"   value={landlordInfo.landlord_company || "—"} />
                      <Row label="Area"      value={landlordInfo.landlord_area || "—"} />
                      {!landlordInfo.full_name && <p style={S.warningNote}>⚠️ Landlord has not completed their profile.</p>}
                    </>
                  )}
                </Section>

                <Section title="✅ Verification Checklist">
                  <CheckItem label="Photos uploaded"        ok={selected.image_urls?.length > 0} />
                  <CheckItem label="Multiple photos"        ok={selected.image_urls?.length >= 2} warn />
                  <CheckItem label="Location pinned"        ok={!!selected.latitude} />
                  <CheckItem label="Address provided"       ok={!!selected.address} />
                  <CheckItem label="Description written"    ok={!!selected.description} />
                  <CheckItem label="Property type set"      ok={!!selected.property_type} />
                  <CheckItem label="Landlord name on file"  ok={!!landlordInfo?.full_name} />
                  <CheckItem label="Landlord phone on file" ok={!!landlordInfo?.phone || !!landlordInfo?.landlord_whatsapp} />
                </Section>

                <Section title="🗒 Internal Notes (optional)">
                  <textarea style={S.notesArea} placeholder="Add internal notes (not visible to landlord)…" value={adminNote} onChange={e => setAdminNote(e.target.value)} />
                </Section>

                {!selected.is_approved && (
                  <div style={S.actionBox}>
                    {!showRejectBox ? (
                      <div style={S.actionRow}>
                        <button style={S.rejectBtn} onClick={() => setShowRejectBox(true)}>✕ Reject Listing</button>
                        <button style={{ ...S.approveBtn, ...(loading ? { opacity: 0.6 } : {}) }} onClick={handleApprove} disabled={loading}>{loading ? "Approving…" : "✅ Approve & Publish"}</button>
                      </div>
                    ) : (
                      <div style={S.rejectBox}>
                        <p style={S.rejectBoxTitle}>Provide a rejection reason <span style={{ color: "#dc2626" }}>*</span></p>
                        <p style={S.rejectBoxSub}>This will be visible to the landlord so they can fix and resubmit.</p>
                        <div style={S.rejectReasons}>
                          {["Photos are unclear or insufficient","Location appears incorrect on map","Description is too vague","Price seems unrealistic","Suspected duplicate listing","Unable to verify landlord identity"].map(r => (
                            <button key={r} type="button" style={{ ...S.reasonChip, ...(rejectReason === r ? S.reasonChipActive : {}) }} onClick={() => setRejectReason(r)}>{r}</button>
                          ))}
                        </div>
                        <textarea style={S.notesArea} placeholder="Or write a custom reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div style={S.actionRow}>
                          <button style={S.cancelBtn} onClick={() => setShowRejectBox(false)}>Cancel</button>
                          <button style={{ ...S.rejectBtn, ...(loading ? { opacity: 0.6 } : {}) }} onClick={handleReject} disabled={loading}>{loading ? "Rejecting…" : "Confirm Rejection"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selected.is_approved && <div style={S.alreadyApproved}>✅ This property is live and approved.</div>}
              </div>
            ) : (
              <div style={S.emptyReview}>
                <p style={{ fontSize: "48px", margin: "0 0 16px" }}>👈</p>
                <p style={{ fontWeight: 700, color: "#374151" }}>Select a listing to review</p>
                <p style={{ color: "#9ca3af", fontSize: "14px" }}>Click any property on the left to see its full details</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "verifications" && <VerificationReview />}

        {activeTab === "admins" && isSuperAdmin && (
          <div style={{ padding: "0 32px 32px" }}>
            <h2 style={{ ...S.sectionTitle, marginTop: "8px" }}>👑 Admin Management</h2>
            <div style={S.adminSearchCard}>
              <p style={S.adminSearchTitle}>➕ Create New Admin Account</p>
              <p style={S.adminSearchSub}>Creates a brand new UniCrib admin account. The person can log in immediately.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={S.fieldLabel}>Full Name</label>
                  <input style={S.fieldInput} placeholder="e.g. Chipo Ndlovu" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={S.fieldLabel}>Email Address</label>
                  <input style={S.fieldInput} type="email" placeholder="admin@unicrib.co.zw" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={S.fieldLabel}>Temporary Password</label>
                  <input style={S.fieldInput} type="password" placeholder="Min. 6 characters" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)} />
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>Share this with the new admin — they should change it after first login.</p>
                </div>
              </div>
              {createError   && <div style={S.createErrorBox}>⚠ {createError}</div>}
              {createSuccess && <div style={S.createSuccessBox}>✅ {createSuccess}</div>}
              <button style={{ ...S.approveBtn, width: "100%", padding: "13px", fontSize: "15px", ...(createLoading ? { opacity: 0.65, cursor: "not-allowed" } : {}) }} onClick={createAdmin} disabled={createLoading}>
                {createLoading ? "Creating account…" : "👑 Create Admin Account"}
              </button>
            </div>

            <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#374151", margin: "28px 0 14px" }}>Current Admins ({admins.length})</h3>
            {admins.length === 0 && <p style={{ color: "#9ca3af" }}>No admins found.</p>}
            {admins.map(a => (
              <div key={a.id} style={S.adminRow}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", minWidth: 0 }}>
                  <div style={S.adminAvatar}>{a.full_name?.charAt(0)?.toUpperCase() || "?"}</div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{a.full_name || "No name set"}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>{a.is_super_admin ? "⭐ Super Admin" : "Admin"}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {a.is_super_admin ? <span style={S.superBadge}>⭐ Super Admin</span> : <button style={S.removeAdminBtn} onClick={() => removeAdmin(a.id)}>Remove</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
function Section({ title, children }) {
  return <div style={S.section}><h3 style={S.sectionTitle}>{title}</h3>{children}</div>;
}
function Row({ label, value }) {
  return <div style={S.row}><span style={S.rowLabel}>{label}</span><span style={S.rowValue}>{value}</span></div>;
}
function CheckItem({ label, ok, warn }) {
  const color = ok ? "#16a34a" : warn ? "#d97706" : "#dc2626";
  const icon  = ok ? "✓" : warn ? "!" : "✕";
  return (
    <div style={S.checkItem}>
      <span style={{ ...S.checkIcon, background: ok ? "#dcfce7" : warn ? "#fef3c7" : "#fee2e2", color }}>{icon}</span>
      <span style={{ fontSize: "14px", color: ok ? "#374151" : "#dc2626" }}>{label}</span>
    </div>
  );
}


export default AdminDashboard;