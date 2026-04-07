import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { StatCard, EmptyState, sharedStyles as S } from "../components/DashboardShared";

const SLEEP_LABELS = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible sleeper",
};

const CLEAN_LABELS = {
  very_tidy: "Very tidy",
  moderate: "Moderate",
  relaxed: "Relaxed",
};

const SOCIAL_LABELS = {
  quiet: "Quiet / studious",
  sociable: "Sociable",
  mixed: "Mixed social",
};

function StudentDashboard({ user: propUser }) {
  const [properties,       setProperties]       = useState([]);
  const [myRequests,       setMyRequests]       = useState([]);
  const [activeTab,        setActiveTab]        = useState("overview");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalImageIndex,  setModalImageIndex]  = useState(0);
  const [rating,           setRating]           = useState("");
  const [comment,          setComment]          = useState("");
  const [searchText,       setSearchText]       = useState("");
  const [minPrice,         setMinPrice]         = useState("");
  const [maxPrice,         setMaxPrice]         = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [userName,         setUserName]         = useState("Student");
  const [propertyRooms,    setPropertyRooms]    = useState([]);
  const [selectedRoom,     setSelectedRoom]     = useState(null);
  const [loadingRooms,     setLoadingRooms]     = useState(false);
  const [currentStudentProfile, setCurrentStudentProfile] = useState(null);
  const [roommateSuggestions, setRoommateSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const navigate = useNavigate();

  const institutions = [
    { name: "HIT",                          lat: -17.838612085884538, lng: 31.00754812976993  },
    { name: "University of Zimbabwe (UZ)",  lat: -17.78183175506087,  lng: 31.054553899064153 },
    { name: "Belvedere Teachers College (BTTC)", lat: -17.834281716986226, lng: 31.013810429768224 },
    { name: "TelOne Centre for Learning",   lat: -17.82851272662669,  lng: 31.021959299082567 },
    { name: "MSU Harare Campus",            lat: -17.828963366847574, lng: 31.040472445107934 },
  ];

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) setUserName(profile.full_name);

      const { data: props } = await supabase
        .from("properties")
        .select("*, reviews(*)")
        .eq("is_approved", true);
      setProperties(props || []);

      const { data: reqs } = await supabase
        .from("booking_requests")
        .select("*, properties(title), property_rooms(room_number), payment_deadline, warnings_sent")
        .eq("student_id", user.id);
      setMyRequests(reqs || []);
    };

    fetchAll();

    const channel = supabase
      .channel("booking-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "booking_requests" }, (payload) => {
        if (payload.new.status === "confirmed") alert("Your booking has been approved!");
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchRooms = async (propertyId) => {
    setLoadingRooms(true);
    setSelectedRoom(null);
    setPropertyRooms([]);

    const { data, error } = await supabase
      .from("property_rooms")
      .select("*")
      .eq("property_id", propertyId)
      .order("room_number");

    if (error) {
      console.error(error);
      setPropertyRooms([]);
    } else {
      setPropertyRooms(data || []);
    }

    setLoadingRooms(false);
  };

  const openProperty = async (p) => {
    setSelectedProperty(p);
    setModalImageIndex(0);
    setSelectedRoom(null);
    setSelectedMatch(null);

    await fetchRooms(p.id);
    await fetchRoommateSuggestions(p.id);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filteredProperties = properties.filter((p) => {
    if (searchText && !p.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (minPrice && p.price < Number(minPrice)) return false;
    if (maxPrice && p.price > Number(maxPrice)) return false;
    if (selectedInstitution) {
      if (calculateDistance(selectedInstitution.lat, selectedInstitution.lng, p.latitude, p.longitude) > 3) return false;
    }
    return true;
  });

  const fetchCurrentStudentProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, full_name, institution, course, study_year, bio, sleep_schedule, cleanliness, social_style, smoking, pets, gender")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    const hasPrefs =
      profile.sleep_schedule &&
      profile.cleanliness &&
      profile.social_style;

    setCurrentStudentProfile(profile);
    setProfileIncomplete(!hasPrefs);

    return profile;
  };

  const fetchRoommateSuggestions = async (propertyId) => {
    setLoadingSuggestions(true);
    setRoommateSuggestions([]);
    setSelectedMatch(null);

    try {
      const profile = currentStudentProfile || await fetchCurrentStudentProfile();
      if (!profile) {
        setLoadingSuggestions(false);
        return;
      }

      const hasPrefs =
        profile.sleep_schedule &&
        profile.cleanliness &&
        profile.social_style;

      if (!hasPrefs) {
        setLoadingSuggestions(false);
        return;
      }

      // 1. approved + paid tenants already in this property
      const { data: approvedTenants } = await supabase
        .from("booking_requests")
        .select("student_id, room_id, property_rooms(room_number)")
        .eq("property_id", propertyId)
        .eq("status", "confirmed")
        .eq("payment_status", "paid");

      // 2. pending / approved students also requesting this property
      const { data: otherRequests } = await supabase
        .from("booking_requests")
        .select("student_id, status")
        .eq("property_id", propertyId)
        .in("status", ["pending", "confirmed"]);

      const ids = [
        ...(approvedTenants || []).map(x => x.student_id),
        ...(otherRequests || []).map(x => x.student_id),
      ]
        .filter(Boolean)
        .filter(id => id !== profile.id);

      const uniqueIds = [...new Set(ids)];

      if (uniqueIds.length === 0) {
        setRoommateSuggestions([]);
        setLoadingSuggestions(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, institution, course, study_year, bio, sleep_schedule, cleanliness, social_style, smoking, pets, gender")
        .in("id", uniqueIds);

      const scored = (profiles || [])
        .map(p => {
          const existingTenant = (approvedTenants || []).find(t => t.student_id === p.id);
          const score = computeRoommateScore(profile, p);

          return {
            ...p,
            score,
            sharedTags: getSharedTags(profile, p),
            room_number: existingTenant?.property_rooms?.room_number || null,
            alreadyLivingHere: !!existingTenant,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRoommateSuggestions(scored);
    } catch (err) {
      console.error("Error loading roommate suggestions:", err);
    }

    setLoadingSuggestions(false);
  };

  const handleRequestProperty = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedProperty) return;

    if (!selectedMatch && !selectedRoom) {
      alert("Choose a suggested roommate or select an empty room.");
      return;
    }

    const { data: existing } = await supabase
      .from("booking_requests")
      .select("id")
      .eq("property_id", selectedProperty.id)
      .eq("student_id", user.id);

    if (existing?.length > 0) {
      alert("You have already requested this property.");
      return;
    }

    // If choosing empty room, confirm room is still open
    if (selectedRoom) {
      const { data: room } = await supabase
        .from("property_rooms")
        .select("current_occupants, max_occupants")
        .eq("id", selectedRoom)
        .single();

      if (!room) {
        alert("Room not found.");
        return;
      }

      if (room.current_occupants >= room.max_occupants) {
        alert("This room is now full. Please choose another.");
        fetchRooms(selectedProperty.id);
        return;
      }
    }

    const payload = {
      property_id: selectedProperty.id,
      student_id: user.id,
      status: "pending",
      room_id: selectedRoom || null,
      preferred_roommate_id: selectedMatch || null,
      request_type: selectedMatch ? "matched_roommate" : "empty_room",
    };

    const { error } = await supabase
      .from("booking_requests")
      .insert([payload]);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      selectedMatch
        ? "Request sent! The landlord will review your roommate preference."
        : "Request sent! Your selected room is reserved pending landlord approval."
    );

    setSelectedRoom(null);
    setSelectedMatch(null);
    setSelectedProperty(null);
  };

  const submitReview = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!rating) { alert("Please select a rating"); return; }

    const { data: booking } = await supabase
      .from("booking_requests")
      .select("id")
      .eq("property_id", selectedProperty.id)
      .eq("student_id", user.id)
      .eq("status", "confirmed")
      .eq("payment_status", "paid")
      .single();

    if (!booking) { alert("Only verified tenants can submit reviews."); return; }

    const { error } = await supabase
      .from("reviews")
      .insert({ property_id: selectedProperty.id, user_id: user.id, rating: Number(rating), comment });
    if (error) { alert(error.message); return; }
    alert("Review submitted!");
    setRating(""); setComment("");
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const pendingCount = myRequests.filter(r => r.status === "pending").length;
  const confirmedPaid = myRequests.find(r => r.status === "confirmed" && r.payment_status === "paid");

  const tabs = [
    { key: "overview",       label: "Overview"         },
    { key: "accommodations", label: "Accommodations"   },
    { key: "roommates",      label: "Roommates"        },
    { key: "requests",       label: "My Requests"      },
    { key: "rent",           label: "Rent & Payments"  },
  ];

  return (
    <div style={S.pageWrap}>
      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <span style={S.logoIcon}>🏠</span>
          <span style={S.logoText}>UniCrib</span>
        </div>

        <div style={S.sidebarProfile}>
          <div style={S.avatarCircle}>{userName.charAt(0).toUpperCase()}</div>
          <div>
            <p style={S.profileName}>{userName}</p>
            <p style={S.profileSub}>Update your profile</p>
          </div>
        </div>

        <nav style={S.navMenu}>
          {[
            { key: "overview",       icon: "🏠", label: "Dashboard"          },
            { key: "accommodations", icon: "🔍", label: "Find Accommodation"  },
            { key: "roommates",      icon: "👥", label: "Roommates"   },
            { key: "profile",        icon: "👤", label: "My Profile"          },
          ].map(({ key, icon, label }) => (
            <button key={key} style={activeTab === key ? S.navItemActive : S.navItem} onClick={() => setActiveTab(key)}>
              <span style={S.navIcon}>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div style={S.quickStats}>
          <p style={S.quickStatsTitle}>QUICK STATS</p>
          <div style={S.quickStatRow}>
            <span style={S.quickStatIcon}>📋</span>
            <span style={S.quickStatText}>{pendingCount} pending request{pendingCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <button style={S.logoutBtn} onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}>
          🚪 Logout
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main style={S.main}>
        <div style={S.headerBanner}>
          <div>
            <h1 style={S.greetingTitle}>{greeting}, {userName}!</h1>
            <p style={S.greetingSub}>Here's what's happening with your accommodation</p>
          </div>
          <div style={S.headerActions}>
            <button style={S.headerOutlineBtn} onClick={() => setActiveTab("profile")}>👤 Profile</button>
            <button style={S.headerPrimaryBtn} onClick={() => setActiveTab("accommodations")}>🔍 Find Accommodation</button>
          </div>
        </div>

        <div style={S.tabBar}>
          {tabs.map(t => (
            <button key={t.key} style={activeTab === t.key ? S.tabActive : S.tab} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={S.tabContent}>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <>
              <div style={S.statsGrid}>
                <StatCard icon="💰" label="Monthly Rent"      value={confirmedPaid ? `$${confirmedPaid.amount || "0.00"}` : "$0.00"} color="#fef3c7" />
                <StatCard icon="👥" label="Roommate Matches"  value="0"                    color="#ede9fe" />
                <StatCard icon="📋" label="Pending Requests"  value={pendingCount}         color="#fee2e2" />
                <StatCard icon="🏠" label="Available Listings" value={`${properties.length}+`} color="#dcfce7" />
              </div>

              <div style={S.section}>
                <div style={S.sectionHeader}>
                  <h2 style={S.sectionTitle}>🏠 Featured Accommodations</h2>
                  <button style={S.viewAllBtn} onClick={() => setActiveTab("accommodations")}>View All →</button>
                </div>
                {properties.length === 0 ? (
                  <EmptyState icon="🏡" text="No accommodations available yet." />
                ) : (
                  <div style={S.propertyGrid}>
                    {properties.slice(0, 4).map(p => (
                      <PropertyCard key={p.id} property={p}
                        selectedInstitution={selectedInstitution}
                        calculateDistance={calculateDistance}
                        onClick={() => openProperty(p)} />   // ✅ uses openProperty
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ACCOMMODATIONS ── */}
          {activeTab === "accommodations" && (
            <>
              <div style={S.filterBar}>
                <input style={S.filterInput} placeholder="🔍 Search by title…" value={searchText} onChange={e => setSearchText(e.target.value)} />
                <input style={S.filterInput} type="number" placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
                <input style={S.filterInput} type="number" placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
                <select style={S.filterSelect} onChange={e => setSelectedInstitution(institutions.find(i => i.name === e.target.value) || null)}>
                  <option value="">📍 All Institutions</option>
                  {institutions.map(i => <option key={i.name}>{i.name}</option>)}
                </select>
              </div>
              {selectedInstitution && (
                <div style={S.proximityBadge}>
                  <strong>{filteredProperties.length}</strong> {filteredProperties.length === 1 ? "property" : "properties"} within 3km of <strong>{selectedInstitution.name}</strong>
                </div>
              )}
              <div style={S.propertyGrid}>
                {filteredProperties.map(p => (
                  <PropertyCard key={p.id} property={p}
                    selectedInstitution={selectedInstitution}
                    calculateDistance={calculateDistance}
                    onClick={() => openProperty(p)} />   // ✅ uses openProperty
                ))}
              </div>
            </>
          )}

          {activeTab === "roommates" && <RoommateMatching />}

          {/* ── MY REQUESTS ── */}
          {activeTab === "requests" && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>📋 My Booking Requests</h2>
              {myRequests.length === 0
                ? <p style={{ color: "#9ca3af" }}>No booking requests yet.</p>
                : myRequests.map(req => (
                    <div key={req.id} style={S.requestCard}>
                      <div>
                        <p style={S.requestProp}>
                          {req.properties?.title}
                          {req.property_rooms?.room_number && (
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}> · {req.property_rooms.room_number}</span>
                          )}
                        </p>
                        <span style={req.status === "confirmed" ? S.badgeGreen : req.status === "rejected" ? S.badgeRed : S.badgeYellow}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {req.status === "confirmed" && req.payment_status === "unpaid" && req.payment_deadline && (
                            <p style={{
                                fontSize: "12px",
                                color: new Date(req.payment_deadline) < new Date(Date.now() + 24*60*60*1000) ? "#dc2626" : "#d97706",
                                fontWeight: 700,
                                margin: "4px 0 0"
                            }}> 
                                ⏰ Pay by {new Date(req.payment_deadline).toLocaleDateString("en-ZW", { weekday: "short", month: "short", day: "numeric" })}
                                {req.warnings_sent >= 1 && " — ⚠️ Warning sent"}
                                {req.warnings_sent >= 2 && " — 🚨 Final warning"}

                            </p>
                            
                        )}

                        {req.status === "confirmed" && req.payment_status === "unpaid" && (
                            <button style={S.payBtn} onClick={() => navigate(`/simulate-payment/${req.id}`)}>
                                Pay Deposit
                            </button>
                        )}

                        {req.payment_status === "paid" && (
                          <span style={S.badgeGreen}>Payment Completed ✓</span>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── RENT ── */}
          {activeTab === "rent" && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>💰 Rent & Payments</h2>
              {myRequests.filter(r => r.status === "confirmed").length === 0
                ? <EmptyState icon="💳" text="No active tenancies yet." />
                : myRequests.filter(r => r.status === "confirmed").map(req => (
                    <div key={req.id} style={S.requestCard}>
                      <div>
                        <p style={S.requestProp}>
                          {req.properties?.title}
                          {req.property_rooms?.room_number && (
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}> · {req.property_rooms.room_number}</span>
                          )}
                        </p>
                        <span style={req.payment_status === "paid" ? S.badgeGreen : S.badgeYellow}>
                          {req.payment_status === "paid" ? "PAID ✓" : "UNPAID"}
                        </span>
                      </div>
                      {req.payment_status === "unpaid" && (
                        <button style={S.payBtn} onClick={() => navigate(`/simulate-payment/${req.id}`)}>Pay Deposit</button>
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {activeTab === "profile" && (
            <StudentProfile onDeleted={() => { supabase.auth.signOut(); navigate("/"); }} />
          )}
        </div>
      </main>

      {/* ── MODAL ── */}
      {selectedProperty && (
        <div style={S.overlay} onClick={() => setSelectedProperty(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.closeBtn} onClick={() => setSelectedProperty(null)}>✕</button>

            {/* image carousel */}
            {selectedProperty.image_urls?.length > 0 && (
              <div style={S.modalImgWrap}>
                <img src={selectedProperty.image_urls[modalImageIndex]} alt="Property" style={S.modalImg} />
                {selectedProperty.image_urls.length > 1 && (
                  <>
                    <button style={S.arrowL} onClick={() => setModalImageIndex(i => i === 0 ? selectedProperty.image_urls.length - 1 : i - 1)}>◀</button>
                    <button style={S.arrowR} onClick={() => setModalImageIndex(i => i === selectedProperty.image_urls.length - 1 ? 0 : i + 1)}>▶</button>
                    <div style={S.dots}>
                      {selectedProperty.image_urls.map((_, idx) => (
                        <span key={idx} style={{ ...S.dot, opacity: modalImageIndex === idx ? 1 : 0.35 }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* map buttons */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${selectedProperty.latitude},${selectedProperty.longitude}`} target="_blank" rel="noopener noreferrer" style={S.mapBtn}>📍 View Location</a>
              {selectedInstitution && (
                <a href={`https://www.google.com/maps/dir/?api=1&origin=${selectedInstitution.lat},${selectedInstitution.lng}&destination=${selectedProperty.latitude},${selectedProperty.longitude}`} target="_blank" rel="noopener noreferrer" style={S.dirBtn}>🧭 Directions</a>
              )}
            </div>

            {/* title / price / description */}
            <h2 style={{ margin: "0 0 4px" }}>{selectedProperty.title}</h2>
            <p style={{ fontSize: "22px", fontWeight: 700, color: "#7c3aed", margin: "0 0 12px" }}>
              ${selectedProperty.price}<span style={{ fontSize: "14px", color: "#6b7280", fontWeight: 400 }}>/month</span>
            </p>
            <p style={{ color: "#4b5563", lineHeight: 1.6 }}>{selectedProperty.description}</p>
            <div style={{ margin: "12px 0" }}>
              <span style={selectedProperty.is_full ? S.badgeRed : S.badgeGreen}>
                {selectedProperty.is_full ? "FULL" : "AVAILABLE"}
              </span>
            </div>

            {/* ── ROOMMATE SUGGESTIONS ── */}
            {!selectedProperty.is_full && (
              <>
                <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

                <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>
                  👥 Suggested Roommates in this House
                </h3>

                {profileIncomplete ? (
                  <div style={S.reviewLocked}>
                    <span style={{ fontSize: "28px" }}>📝</span>
                    <p style={{ margin: "8px 0 0", fontWeight: 700, color: "#374151" }}>
                      Complete your lifestyle profile to unlock roommate suggestions
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9ca3af" }}>
                      Add your sleep schedule, cleanliness and social style in your profile.
                    </p>
                  </div>
                ) : loadingSuggestions ? (
                  <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading roommate suggestions…</p>
                ) : roommateSuggestions.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                    No roommate suggestions found for this house yet. You can choose an empty room below.
                  </p>
                ) : (
                  <div style={S.matchSuggestionGrid}>
                    {roommateSuggestions.map(match => {
                      const meta = scoreMeta(match.score);
                      return (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => {
                            setSelectedMatch(match.id === selectedMatch ? null : match.id);
                            setSelectedRoom(null);
                          }}
                          style={{
                            ...S.matchSuggestionCard,
                            ...(selectedMatch === match.id ? S.matchSuggestionCardSelected : {}),
                          }}
                        >
                          <div style={S.matchSuggestionTop}>
                            <div style={S.matchSuggestionAvatar}>
                              {match.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div style={{ ...S.matchSuggestionScore, background: meta.bg, color: meta.color }}>
                              {match.score}% · {meta.label}
                            </div>
                          </div>

                          <h4 style={S.matchSuggestionName}>{match.full_name || "Anonymous"}</h4>

                          {match.institution && (
                            <p style={S.matchSuggestionSub}>🎓 {match.institution}</p>
                          )}

                          {match.alreadyLivingHere && match.room_number && (
                            <p style={S.matchSuggestionRoom}>🏠 Already in {match.room_number}</p>
                          )}

                          {match.sharedTags?.length > 0 && (
                            <div style={S.matchSuggestionTags}>
                              {match.sharedTags.slice(0, 4).map((tag, i) => (
                                <span key={i} style={S.matchSuggestionTag}>
                                  {tag.icon} {tag.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {roommateSuggestions.length > 0 && (
                  <div style={S.orDivider}>
                    <span>Or choose an empty room instead</span>
                  </div>
                )}
              </>
            )}

            {/* ── ROOM PICKER ── */}
            {!selectedProperty.is_full && (
              <>
                <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
                <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>
                  🛏 Choose a Room
                </h3>

                {loadingRooms ? (
                  <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading rooms…</p>
                ) : propertyRooms.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: "14px" }}>No rooms listed for this property.</p>
                ) : (
                  <>
                    <div style={S.roomAvailBadge}>
                      {propertyRooms.filter(r => r.current_occupants < r.max_occupants).length} of {propertyRooms.length} rooms available
                    </div>

                    <div style={S.roomGrid}>
                      {propertyRooms.map(room => {
                        const roomFull = (room.current_occupants || 0) >= (room.max_occupants || 1);

                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={roomFull}
                            onClick={() => {
                              if (roomFull) return;
                              setSelectedRoom(room.id === selectedRoom ? null : room.id);
                              setSelectedMatch(null);
                            }}
                            style={{
                              ...S.roomBtn,
                              ...(roomFull ? S.roomBtnOccupied : {}),
                              ...(selectedRoom === room.id ? S.roomBtnSelected : {}),
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>{roomFull ? "🔴" : "🟢"}</span>
                            <span style={{ fontWeight: 700, fontSize: "14px" }}>{room.room_number}</span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: roomFull ? "#dc2626" : "#16a34a",
                                fontWeight: 600,
                              }}
                            >
                              {roomFull
                                ? `Full (${room.current_occupants || 0}/${room.max_occupants || 1})`
                                : `${room.current_occupants || 0} of ${room.max_occupants || 1} occupied`}
                            </span>
                            {room.description && (
                              <span style={{ fontSize: "11px", color: "#9ca3af" }}>{room.description}</span>
                            )}
                            {room.price && room.price !== selectedProperty.price && (
                              <span style={{ fontSize: "13px", fontWeight: 800, color: "#7c3aed" }}>
                                ${room.price}/mo
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleRequestProperty}
                      disabled={!selectedRoom && !selectedMatch}
                      style={selectedRoom || selectedMatch ? S.primaryBtn : S.disabledBtn}
                    >
                      {selectedMatch
                        ? `Request to stay with ${roommateSuggestions.find(r => r.id === selectedMatch)?.full_name || "this roommate"}`
                        : selectedRoom
                          ? `Request ${propertyRooms.find(r => r.id === selectedRoom)?.room_number}`
                          : "Choose a roommate or select a room"}
                    </button>
                  </>
                )}
              </>
            )}

            {selectedProperty.is_full && (
              <button style={S.disabledBtn} disabled>Property Full</button>
            )}

            {/* ── REVIEW SECTION ── */}
            <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

            {(() => {
              const confirmedBooking = myRequests.find(
                r => r.property_id === selectedProperty.id &&
                     r.status === "confirmed" &&
                     r.payment_status === "paid"
              );
              return confirmedBooking ? (
                <>
                  <h3 style={{ marginBottom: "12px" }}>Leave a Review</h3>
                  <select style={S.filterSelect} value={rating} onChange={e => setRating(e.target.value)}>
                    <option value="">Rate this property…</option>
                    {["5","4","3","2","1"].map(n => (
                      <option key={n} value={n}>{"⭐".repeat(Number(n))}</option>
                    ))}
                  </select>
                  <textarea placeholder="Write your review…" value={comment} onChange={e => setComment(e.target.value)} style={S.textarea} />
                  <button onClick={submitReview} style={S.primaryBtn}>Submit Review</button>
                </>
              ) : (
                <div style={S.reviewLocked}>
                  <span style={{ fontSize: "28px" }}>🔒</span>
                  <p style={{ margin: "8px 0 0", fontWeight: 700, color: "#374151" }}>Reviews are for verified tenants only</p>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9ca3af" }}>
                    You can review this property once your booking is approved and deposit is paid.
                  </p>
                </div>
              );
            })()}

            {/* existing reviews */}
            {selectedProperty.reviews?.length > 0 && (
              <>
                <h3 style={{ marginTop: "20px" }}>Reviews</h3>
                {selectedProperty.reviews.map(r => (
                  <div key={r.id} style={S.reviewCard}>
                    <p style={{ margin: "0 0 4px" }}>{"⭐".repeat(r.rating)}</p>
                    <p style={{ color: "#4b5563", margin: 0 }}>{r.comment}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function computeRoommateScore(a, b) {
  let score = 0;
  if (a?.institution && b?.institution && a.institution === b.institution) score += 30;
  if (a?.sleep_schedule && b?.sleep_schedule && a.sleep_schedule === b.sleep_schedule) score += 20;
  if (a?.cleanliness && b?.cleanliness && a.cleanliness === b.cleanliness) score += 20;
  if (a?.social_style && b?.social_style && a.social_style === b.social_style) score += 15;
  if (a?.smoking === b?.smoking) score += 10;
  if (a?.pets === b?.pets) score += 5;
  return score;
}

function getSharedTags(a, b) {
  const tags = [];
  if (a?.institution && b?.institution && a.institution === b.institution) {
    tags.push({ icon: "🎓", label: "Same institution" });
  }
  if (a?.sleep_schedule && b?.sleep_schedule && a.sleep_schedule === b.sleep_schedule) {
    tags.push({ icon: "😴", label: SLEEP_LABELS[a.sleep_schedule] });
  }
  if (a?.cleanliness && b?.cleanliness && a.cleanliness === b.cleanliness) {
    tags.push({ icon: "✨", label: CLEAN_LABELS[a.cleanliness] });
  }
  if (a?.social_style && b?.social_style && a.social_style === b.social_style) {
    tags.push({ icon: "👥", label: SOCIAL_LABELS[a.social_style] });
  }
  if (a?.smoking === b?.smoking) {
    tags.push({ icon: "🚬", label: a.smoking ? "Both smoke" : "Non-smoker" });
  }
  if (a?.pets === b?.pets) {
    tags.push({ icon: "🐾", label: a.pets ? "Both have pets" : "No pets" });
  }
  return tags;
}

function scoreMeta(score) {
  if (score >= 80) return { label: "Excellent match", color: "#16a34a", bg: "#dcfce7" };
  if (score >= 60) return { label: "Good match", color: "#7c3aed", bg: "#ede9fe" };
  if (score >= 40) return { label: "Fair match", color: "#d97706", bg: "#fef3c7" };
  return { label: "Low match", color: "#dc2626", bg: "#fee2e2" };
}
function RoommateMatching() {
    const [loading,         setLoading]         = useState(true);
    const [currentProfile,  setCurrentProfile]  = useState(null);
    const [currentProperty, setCurrentProperty] = useState(null);
    const [housemates,      setHousemates]      = useState([]);
    const [available,       setAvailable]       = useState([]);
    const [mode,            setMode]            = useState("matches");
    const [incomplete,      setIncomplete]      = useState(false);
    const [myBooking, setMyBooking] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

  // 1. Get current student's profile
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, institution, course, study_year, bio, sleep_schedule, cleanliness, social_style, smoking, pets, gender")
        .eq("id", user.id)
        .single();

    setCurrentProfile({ ...profile, id: user.id });

    const hasPrefs = profile?.sleep_schedule && profile?.cleanliness && profile?.social_style;
    if (!hasPrefs) { setIncomplete(true); setLoading(false); return; }

  // 2. Find this student's confirmed + paid booking
    const { data: myBookingData } = await supabase
        .from("booking_requests")
        .select(`
        property_id,
        room_id,
        properties(id, title, address, image_urls, price, rooms, max_occupants),
        property_rooms(room_number, current_occupants, max_occupants)
        `)
        .eq("student_id", user.id)
        .eq("status", "confirmed")
        .eq("payment_status", "paid")
        .maybeSingle();

    setMyBooking(myBookingData);

    if (myBookingData?.room_id) {
        setCurrentProperty(myBookingData.properties);

        const { data: roommates } = await supabase
        .from("booking_requests")
        .select("student_id")
        .eq("room_id", myBookingData.room_id)       
        .eq("status", "confirmed")
        .eq("payment_status", "paid")
        .neq("student_id", user.id);               

        if (roommates?.length > 0) {
        const ids = roommates.map(t => t.student_id);

        const { data: tenantProfiles } = await supabase
            .from("user_profiles")
            .select("id, full_name, institution, course, study_year, bio, sleep_schedule, cleanliness, social_style, smoking, pets, gender")
            .in("id", ids);

        const scored = (tenantProfiles || []).map(p => ({
            ...p,
            score:      computeRoommateScore(profile, p),  // ✅ use top-level function
            sharedTags: getSharedTags(profile, p),          // ✅ use top-level function
        })).sort((a, b) => b.score - a.score);

        setHousemates(scored);
        } else {
        setHousemates([]);
        }

    } else if (myBookingData?.property_id) {
        // Approved but no specific room assigned yet
        setCurrentProperty(myBookingData.properties);
        setHousemates([]);
        setMode("matches");
    } else {
        // No booking at all — show browse mode
        setMode("browse");
        const { data: props } = await supabase
        .from("properties")
        .select("*, reviews(*)")
        .eq("is_approved", true)
        .eq("is_full", false);
        setAvailable(props || []);
    }

    setLoading(false);
    };

  const scoreColor = (s) => {
    if (s >= 80) return { bg: "#dcfce7", color: "#16a34a", label: "Excellent" };
    if (s >= 60) return { bg: "#ede9fe", color: "#7c3aed", label: "Good"      };
    if (s >= 40) return { bg: "#fef3c7", color: "#d97706", label: "Fair"      };
    return               { bg: "#fee2e2", color: "#dc2626", label: "Low"       };
  };

  if (loading) return (
    <div style={RM.centered}>
      <div style={RM.spinner} />
      <p style={{ color: "#7c3aed", fontWeight: 600, margin: 0 }}>Finding your matches…</p>
    </div>
  );

  if (incomplete) return (
    <div style={RM.centered}>
      <div style={RM.emptyIllustration}>🛋️</div>
      <h3 style={RM.emptyTitle}>Complete your profile first</h3>
      <p style={RM.emptySub}>Fill in your lifestyle preferences — sleep schedule, cleanliness and social style — to unlock roommate matching.</p>
    </div>
  );

    const fetchAvailableProperties = async () => {
        const { data: props, error } = await supabase
            .from("properties")
            .select("*, reviews(*)")
            .eq("is_approved", true)
            .eq("is_full", false);

        if (error) {
            console.error("Available properties error:", error);
            setAvailable([]);
            return;
        }

        setAvailable(props || []);
    };

  return (
    <div style={RM.page}>
      <div style={RM.header}>
        <div>
          <h2 style={RM.headerTitle}>👥 My Roommates</h2>
            <p style={RM.headerSub}>
                {currentProperty
                    ? housemates.length > 0
                        ? `${housemates.length} roommate${housemates.length !== 1 ? "s" : ""} sharing ${myBooking?.property_rooms?.room_number || "your room"} at ${currentProperty.title}`
                        : `You don't have a roommate yet in ${myBooking?.property_rooms?.room_number || "your room"} at ${currentProperty.title}`
                    : "You're not in a property yet — browse available rooms below"}
            </p>
        </div>
        {currentProperty && <div style={RM.propertyChip}>🏠 {currentProperty.title}</div>}
      </div>

      {currentProfile && (
        <div style={RM.myPrefsCard}>
          <p style={RM.myPrefsTitle}>YOUR LIFESTYLE PROFILE</p>
          <div style={RM.myPrefsTags}>
            {currentProfile.sleep_schedule && <span style={RM.prefTag}>😴 {SLEEP_LABELS[currentProfile.sleep_schedule]}</span>}
            {currentProfile.cleanliness    && <span style={RM.prefTag}>✨ {CLEAN_LABELS[currentProfile.cleanliness]}</span>}
            {currentProfile.social_style   && <span style={RM.prefTag}>👥 {SOCIAL_LABELS[currentProfile.social_style]}</span>}
            <span style={RM.prefTag}>{currentProfile.smoking ? "🚬 Smoker" : "🚭 Non-smoker"}</span>
            <span style={RM.prefTag}>{currentProfile.pets    ? "🐾 Has pets" : "🐾 No pets"}</span>
          </div>
        </div>
      )}

      {mode === "matches" && (
        <>
          {housemates.length === 0 ? (
            <div style={RM.emptyCard}>
                <div style={RM.emptyIllustration}>🏠</div>
                <h3 style={RM.emptyTitle}>No roommate yet</h3>
                <p style={RM.emptySub}>
                You're currently the only one in <strong>{myBooking?.property_rooms?.room_number || "your room"}</strong> at <strong>{currentProperty?.title}</strong>. 
                Once another student books and pays for the same room, they'll appear here with a compatibility score.
                </p>
                <button
                    style={RM.secondaryBtn}
                    onClick={async () => {
                        setMode("browse");
                        await fetchAvailableProperties();
                    }}
                    >
                    🔍 Browse Other Available Rooms
                </button>
            </div>
          ) : (
            <>
              <p style={RM.resultsCount}>{housemates.length} housemate{housemates.length !== 1 ? "s" : ""} found</p>
              <div style={RM.matchGrid}>
                {housemates.map(m => {
                  const sc = scoreColor(m.score);
                  return (
                    <div key={m.id} style={RM.matchCard}>
                      <div style={RM.matchCardTop}>
                        <div style={RM.matchAvatar}>{m.full_name?.charAt(0)?.toUpperCase() || "?"}</div>
                        <div style={{ ...RM.scoreBadge, background: sc.bg, color: sc.color }}>
                          <span style={RM.scorePct}>{m.score}%</span>
                          <span style={RM.scoreLabel}>{sc.label} match</span>
                        </div>
                      </div>
                      <h4 style={RM.matchName}>{m.full_name || "Anonymous"}</h4>
                      {m.institution && <p style={RM.matchInstitution}>🎓 {m.institution}</p>}
                      {m.course      && <p style={RM.matchCourse}>{m.course}{m.study_year ? ` · Year ${m.study_year}` : ""}</p>}
                      <div style={RM.compatBarWrap}>
                        <div style={RM.compatBarBg}>
                          <div style={{ ...RM.compatBarFill, width: `${m.score}%`, background: sc.color }} />
                        </div>
                      </div>
                      {m.sharedTags?.length > 0 && (
                        <div style={RM.sharedTagsWrap}>
                          <p style={RM.sharedTagsTitle}>YOU BOTH…</p>
                          <div style={RM.sharedTags}>
                            {m.sharedTags.map((t, i) => (
                              <span key={i} style={RM.sharedTag}>{t.icon} {t.label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <button
                    style={RM.secondaryBtn}
                    onClick={async () => {
                        setMode("browse");
                        await fetchAvailableProperties();
                    }}
                    >
                    🔍 Browse Other Available Rooms Too
                </button>
              </div>
            </>
          )}
        </>
      )}

      {mode === "browse" && (
        <>
          {currentProperty && (
            <button style={RM.backBtn} onClick={() => setMode("matches")}>← Back to Housemates</button>
          )}
          <div style={RM.browseHeader}>
            <h3 style={RM.browseTitle}>🏠 Available Rooms</h3>
            <p style={RM.browseSub}>
              These properties have rooms with space available. Join a room with another student or choose one with fewer occupants.
            </p>
          </div>
          {available.length === 0 ? (
            <div style={RM.emptyCard}>
              <div style={RM.emptyIllustration}>🏡</div>
              <h3 style={RM.emptyTitle}>No available properties</h3>
              <p style={RM.emptySub}>Check back soon — new listings are added regularly.</p>
            </div>
          ) : (
            <div style={RM.browseGrid}>
              {available.map(p => {
                const avgRating = p.reviews?.length
                  ? (p.reviews.reduce((a, r) => a + r.rating, 0) / p.reviews.length).toFixed(1)
                  : null;
                return (
                  <div key={p.id} style={RM.browseCard}>
                    {p.image_urls?.length > 0 && (
                      <div style={RM.browseImgWrap}>
                        <img src={p.image_urls[0]} alt={p.title} style={RM.browseImg} />
                        <span style={RM.availableBadge}>AVAILABLE</span>
                      </div>
                    )}
                    <div style={RM.browseBody}>
                      <h4 style={RM.browseCardTitle}>{p.title}</h4>
                      {p.address && <p style={RM.browseAddress}>📍 {p.address}</p>}
                      <div style={RM.browseFooter}>
                        <div>
                          <span style={RM.browsePrice}>${p.price}</span>
                          <span style={RM.browsePriceSub}>/mo</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {avgRating && <span style={RM.ratingChip}>⭐ {avgRating}</span>}
                          {p.rooms   && <span style={RM.roomsChip}>🛏 {p.rooms} room{p.rooms > 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function StudentProfile({ onDeleted }) {
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [section,   setSection]   = useState("personal");
  const [saveMsg,   setSaveMsg]   = useState("");
  const [error,     setError]     = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone,    setPhone]    = useState("");
  const [gender,   setGender]   = useState("");
  const [dob,      setDob]      = useState("");
  const [institution, setInstitution] = useState("");
  const [course,      setCourse]      = useState("");
  const [studyYear,   setStudyYear]   = useState("");
  const [bio,         setBio]         = useState("");
  const [sleepSchedule, setSleepSchedule] = useState("");
  const [cleanliness,   setCleanliness]   = useState("");
  const [socialStyle,   setSocialStyle]   = useState("");
  const [smoking,       setSmoking]       = useState(false);
  const [pets,          setPets]          = useState(false);

  const INSTITUTIONS = [
    "Harare Institute of Technology (HIT)",
    "University of Zimbabwe (UZ)",
    "Belvedere Teachers College (BTTC)",
    "TelOne Centre for Learning",
    "Midlands State University – Harare Campus",
    "Zimbabwe Open University (ZOU)",
    "Other",
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name, phone, gender, dob, institution, course, study_year, bio, sleep_schedule, cleanliness, social_style, smoking, pets")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setGender(data.gender || "");
        setDob(data.dob || "");
        setInstitution(data.institution || "");
        setCourse(data.course || "");
        setStudyYear(data.study_year ? String(data.study_year) : "");
        setBio(data.bio || "");
        setSleepSchedule(data.sleep_schedule || "");
        setCleanliness(data.cleanliness || "");
        setSocialStyle(data.social_style || "");
        setSmoking(data.smoking || false);
        setPets(data.pets || false);
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(""); setSaveMsg("");
    if (!fullName.trim()) { setError("Full name is required."); setSaving(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from("user_profiles").update({
      full_name: fullName.trim(), phone: phone.trim() || null, gender: gender || null,
      dob: dob || null, institution: institution || null, course: course.trim() || null,
      study_year: studyYear ? Number(studyYear) : null, bio: bio.trim() || null,
      sleep_schedule: sleepSchedule || null, cleanliness: cleanliness || null,
      social_style: socialStyle || null, smoking, pets,
    }).eq("id", user.id);
    if (updateError) { setError(updateError.message); } else { setSaveMsg("Profile updated successfully!"); setTimeout(() => setSaveMsg(""), 3000); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (deleteInput !== "DELETE") { setError("Please type DELETE to confirm."); return; }
    setDeleting(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("user_profiles").delete().eq("id", user.id);
    await supabase.from("booking_requests").delete().eq("student_id", user.id);
    await supabase.from("reviews").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    onDeleted();
  };

  const sections = [
    { key: "personal",  icon: "👤", label: "Personal"  },
    { key: "academic",  icon: "🎓", label: "Academic"  },
    { key: "lifestyle", icon: "🛋️",  label: "Lifestyle" },
  ];

  const completionFields = [fullName, phone, gender, dob, institution, course, studyYear, sleepSchedule, cleanliness, socialStyle];
  const completionPct = Math.round((completionFields.filter(f => f && String(f).trim()).length / completionFields.length) * 100);

  if (loading) return (
    <div style={PS.loadingWrap}><div style={PS.spinner} /><p style={{ color: "#7c3aed", fontWeight: 600, margin: 0 }}>Loading your profile…</p></div>
  );

  return (
    <div style={PS.page}>
      <div style={PS.hero}>
        <div style={PS.heroInner}>
          <div style={PS.avatarWrap}>
            <div style={PS.avatar}>{fullName ? fullName.charAt(0).toUpperCase() : "?"}</div>
            <div style={PS.avatarOnline} />
          </div>
          <div style={PS.heroInfo}>
            <h2 style={PS.heroName}>{fullName || "Your Name"}</h2>
            <p style={PS.heroSub}>{institution || "No institution set"}{studyYear ? ` · Year ${studyYear}` : ""}</p>
            <p style={PS.heroCourse}>{course || "No course set"}</p>
          </div>
          <div style={PS.completionWrap}>
            <div style={PS.completionLabel}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Profile completion</span>
              <span style={{ fontSize: "13px", color: "white", fontWeight: 800 }}>{completionPct}%</span>
            </div>
            <div style={PS.completionBg}><div style={{ ...PS.completionFill, width: `${completionPct}%` }} /></div>
            {completionPct < 100 && <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", margin: "6px 0 0" }}>Complete your profile to unlock roommate matching</p>}
          </div>
        </div>
      </div>

      <div style={PS.sectionTabs}>
        {sections.map(s => (
          <button key={s.key} style={{ ...PS.sectionTab, ...(section === s.key ? PS.sectionTabActive : {}) }}
            onClick={() => { setSection(s.key); setError(""); setSaveMsg(""); }}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      <div style={PS.body}>
        {section === "personal" && (
          <div style={PS.card}>
            <h3 style={PS.cardTitle}>👤 Personal Details</h3>
            <p style={PS.cardSub}>This information is private and only visible to you and admins.</p>
            <div style={PS.fields}>
              <PField label="Full Name *"><input style={PS.input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Tatenda Moyo" /></PField>
              <PField label="Phone Number"><input style={PS.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263 77 …" /></PField>
              <div style={PS.row2}>
                <PField label="Gender">
                  <select style={PS.input} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="male">Male</option><option value="female">Female</option>
                    <option value="other">Other</option><option value="prefer_not">Prefer not to say</option>
                  </select>
                </PField>
                <PField label="Date of Birth"><input style={PS.input} type="date" value={dob} onChange={e => setDob(e.target.value)} /></PField>
              </div>
            </div>
            {error   && <div style={PS.errorBox}>⚠ {error}</div>}
            {saveMsg && <div style={PS.successBox}>✅ {saveMsg}</div>}
            <button style={{ ...PS.saveBtn, ...(saving ? PS.saveBtnLoading : {}) }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save Changes"}</button>
          </div>
        )}

        {section === "academic" && (
          <div style={PS.card}>
            <h3 style={PS.cardTitle}>🎓 Academic Details</h3>
            <p style={PS.cardSub}>Used to match nearby accommodation and for your profile.</p>
            <div style={PS.fields}>
              <PField label="Institution">
                <select style={PS.input} value={institution} onChange={e => setInstitution(e.target.value)}>
                  <option value="">Select your institution…</option>
                  {INSTITUTIONS.map(i => <option key={i}>{i}</option>)}
                </select>
              </PField>
              <div style={PS.row2}>
                <PField label="Course / Programme"><input style={PS.input} value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. Software Engineering" /></PField>
                <PField label="Year of Study">
                  <select style={PS.input} value={studyYear} onChange={e => setStudyYear(e.target.value)}>
                    <option value="">Select…</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Year {n}</option>)}
                    <option value="postgrad">Postgrad</option>
                  </select>
                </PField>
              </div>
              <PField label="Bio">
                <textarea style={{ ...PS.input, minHeight: "100px", resize: "vertical" }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell potential roommates about yourself…" />
              </PField>
            </div>
            {error   && <div style={PS.errorBox}>⚠ {error}</div>}
            {saveMsg && <div style={PS.successBox}>✅ {saveMsg}</div>}
            <button style={{ ...PS.saveBtn, ...(saving ? PS.saveBtnLoading : {}) }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save Changes"}</button>
          </div>
        )}

        {section === "lifestyle" && (
          <div style={PS.card}>
            <h3 style={PS.cardTitle}>🛋️ Lifestyle Preferences</h3>
            <p style={PS.cardSub}>Used exclusively for roommate matching.</p>
            <div style={PS.fields}>
              <PField label="Sleep Schedule">
                <div style={PS.optionRow}>
                  {[{v:"early_bird",label:"🌅 Early Bird"},{v:"night_owl",label:"🦉 Night Owl"},{v:"flexible",label:"🔄 Flexible"}].map(o => (
                    <button key={o.v} type="button" style={{ ...PS.optionBtn, ...(sleepSchedule === o.v ? PS.optionBtnActive : {}) }} onClick={() => setSleepSchedule(o.v)}>{o.label}</button>
                  ))}
                </div>
              </PField>
              <PField label="Cleanliness Level">
                <div style={PS.optionRow}>
                  {[{v:"very_tidy",label:"✨ Very Tidy"},{v:"moderate",label:"👌 Moderate"},{v:"relaxed",label:"😌 Relaxed"}].map(o => (
                    <button key={o.v} type="button" style={{ ...PS.optionBtn, ...(cleanliness === o.v ? PS.optionBtnActive : {}) }} onClick={() => setCleanliness(o.v)}>{o.label}</button>
                  ))}
                </div>
              </PField>
              <PField label="Social Style">
                <div style={PS.optionRow}>
                  {[{v:"quiet",label:"📚 Quiet / Studious"},{v:"sociable",label:"🎉 Sociable"},{v:"mixed",label:"⚖️ Mixed"}].map(o => (
                    <button key={o.v} type="button" style={{ ...PS.optionBtn, ...(socialStyle === o.v ? PS.optionBtnActive : {}) }} onClick={() => setSocialStyle(o.v)}>{o.label}</button>
                  ))}
                </div>
              </PField>
              <div style={PS.toggleRow}>
                <PToggle label="I smoke"     emoji="🚬" value={smoking} onChange={setSmoking} />
                <PToggle label="I have pets" emoji="🐾" value={pets}    onChange={setPets}    />
              </div>
            </div>
            {error   && <div style={PS.errorBox}>⚠ {error}</div>}
            {saveMsg && <div style={PS.successBox}>✅ {saveMsg}</div>}
            <button style={{ ...PS.saveBtn, ...(saving ? PS.saveBtnLoading : {}) }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save Changes"}</button>
          </div>
        )}

        <div style={PS.dangerCard}>
          <h3 style={PS.dangerTitle}>⚠️ Danger Zone</h3>
          <p style={PS.dangerSub}>Deleting your account is permanent and cannot be undone. All your booking requests, reviews, and profile data will be removed immediately.</p>
          {!showDeleteConfirm ? (
            <button style={PS.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>🗑 Delete My Account</button>
          ) : (
            <div style={PS.deleteConfirmBox}>
              <p style={PS.deleteConfirmTitle}>Are you absolutely sure? Type <strong>DELETE</strong> to confirm.</p>
              <input style={{ ...PS.input, border: "1.5px solid #fecaca", marginBottom: "12px" }} placeholder="Type DELETE here" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
              {error && <div style={{ ...PS.errorBox, marginBottom: "12px" }}>⚠ {error}</div>}
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={PS.cancelDeleteBtn} onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setError(""); }}>Cancel</button>
                <button style={{ ...PS.confirmDeleteBtn, ...(deleting ? { opacity: 0.6 } : {}) }} onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Yes, Delete My Account"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PField({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}><label style={PS.fieldLabel}>{label}</label>{children}</div>;
}
function PToggle({ label, emoji, value, onChange }) {
  return (
    <button type="button" style={{ ...PS.toggleBtn, ...(value ? PS.toggleBtnOn : {}) }} onClick={() => onChange(v => !v)}>
      <div style={{ ...PS.toggleTrack, ...(value ? PS.toggleTrackOn : {}) }}>
        <div style={{ ...PS.toggleThumb, ...(value ? PS.toggleThumbOn : {}) }} />
      </div>
      <span style={{ fontSize: "14px" }}>{emoji} {label}</span>
    </button>
  );
}

function PropertyCard({ property, selectedInstitution, calculateDistance, onClick }) {
  const avgRating = property.reviews?.length
    ? Math.round(property.reviews.reduce((a, r) => a + r.rating, 0) / property.reviews.length)
    : 0;
  return (
    <div style={S.card} onClick={onClick}>
      {property.image_urls?.length > 0 && (
        <div style={S.imgWrap}>
          <img src={property.image_urls[0]} alt="Property" style={S.cardImg} />
          <span style={property.is_full ? S.overlayBadgeRed : S.overlayBadgeGreen}>{property.is_full ? "FULL" : "AVAILABLE"}</span>
        </div>
      )}
      <div style={{ padding: "12px" }}>
        <h4 style={{ margin: "0 0 4px", fontSize: "15px", color: "#111827" }}>{property.title}</h4>
        <p style={{ color: "#7c3aed", fontWeight: 700, margin: "0 0 6px" }}>
          ${property.price}<span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 400 }}>/mo</span>
        </p>
        {selectedInstitution && (
          <p style={{ fontSize: "12px", color: "#2563eb", margin: "0 0 4px" }}>
            📍 {calculateDistance(selectedInstitution.lat, selectedInstitution.lng, property.latitude, property.longitude).toFixed(2)} km from {selectedInstitution.name}
          </p>
        )}
        {avgRating > 0 && <p style={{ fontSize: "12px", color: "#f59e0b", margin: 0 }}>{"⭐".repeat(avgRating)} ({property.reviews.length})</p>}
      </div>
    </div>
  );
}


/* ── Roommate matching styles ── */
const RM = {
  page: { padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: "20px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: "24px", flexWrap: "wrap", gap: "12px" },
  headerTitle: { fontSize: "20px", fontWeight: 900, color: "#111827", margin: "0 0 4px" },
  headerSub: { fontSize: "14px", color: "#6b7280", margin: 0 },
  propertyChip: { background: "#ede9fe", color: "#7c3aed", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 700 },
  myPrefsCard: { background: "white", borderRadius: "14px", border: "1px solid #e5e7eb", padding: "16px 20px" },
  myPrefsTitle: { fontSize: "12px", fontWeight: 800, color: "#9ca3af", letterSpacing: "0.08em", margin: "0 0 10px" },
  myPrefsTags: { display: "flex", flexWrap: "wrap", gap: "8px" },
  prefTag: { background: "#f5f3ff", color: "#7c3aed", padding: "5px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, border: "1px solid #ede9fe" },
  resultsCount: { fontSize: "13px", color: "#9ca3af", fontWeight: 600, margin: 0 },
  matchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" },
  matchCard: { background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" },
  matchCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" },
  matchAvatar: { width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontSize: "20px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  scoreBadge: { display: "flex", flexDirection: "column", alignItems: "flex-end", padding: "8px 12px", borderRadius: "12px" },
  scorePct: { fontSize: "20px", fontWeight: 900, lineHeight: 1 },
  scoreLabel: { fontSize: "11px", fontWeight: 700, marginTop: "2px" },
  matchName: { fontSize: "16px", fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  matchInstitution: { fontSize: "13px", color: "#2563eb", margin: "0 0 2px", fontWeight: 600 },
  matchCourse: { fontSize: "13px", color: "#9ca3af", margin: "0 0 14px" },
  compatBarWrap: { marginBottom: "14px" },
  compatBarBg: { height: "6px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" },
  compatBarFill: { height: "100%", borderRadius: "3px", transition: "width 0.6s ease" },
  sharedTagsWrap: { borderTop: "1px solid #f3f4f6", paddingTop: "12px" },
  sharedTagsTitle: { fontSize: "11px", fontWeight: 800, color: "#9ca3af", margin: "0 0 8px", letterSpacing: "0.06em" },
  sharedTags: { display: "flex", flexWrap: "wrap", gap: "6px" },
  sharedTag: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 },
  emptyCard: { background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "48px 32px", textAlign: "center" },
  emptyIllustration: { fontSize: "52px", marginBottom: "16px" },
  emptyTitle: { fontSize: "18px", fontWeight: 800, color: "#111827", margin: "0 0 8px" },
  emptySub: { fontSize: "14px", color: "#9ca3af", lineHeight: 1.7, margin: "0 0 24px", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: "16px", textAlign: "center" },
  primaryBtn: { padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  secondaryBtn: { padding: "11px 22px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  backBtn: { alignSelf: "flex-start", padding: "9px 18px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", color: "#7c3aed", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  browseHeader: { marginBottom: "4px" },
  browseTitle: { fontSize: "17px", fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  browseSub: { fontSize: "13px", color: "#9ca3af", margin: 0 },
  browseGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "18px" },
  browseCard: { background: "white", borderRadius: "14px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" },
  browseImgWrap: { position: "relative", height: "160px" },
  browseImg: { width: "100%", height: "100%", objectFit: "cover" },
  availableBadge: { position: "absolute", top: "10px", right: "10px", background: "#16a34a", color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  browseBody: { padding: "14px 16px" },
  browseCardTitle: { fontSize: "15px", fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  browseAddress: { fontSize: "12px", color: "#6b7280", margin: "0 0 12px" },
  browseFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  browsePrice: { fontSize: "20px", fontWeight: 900, color: "#7c3aed" },
  browsePriceSub: { fontSize: "12px", color: "#9ca3af", fontWeight: 400 },
  ratingChip: { background: "#fef3c7", color: "#d97706", padding: "3px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700 },
  roomsChip: { background: "#ede9fe", color: "#7c3aed", padding: "3px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700 },
  spinner: { width: "32px", height: "32px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
};

/* ── Student profile styles ── */
const PS = {
  page: { display: "flex", flexDirection: "column", minHeight: "100%" },
  hero: { background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)", padding: "32px 32px 48px" },
  heroInner: { display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" },
  avatarWrap: { position: "relative", flexShrink: 0 },
  avatar: { width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "3px solid rgba(255,255,255,0.5)", color: "white", fontSize: "28px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" },
  avatarOnline: { position: "absolute", bottom: "4px", right: "4px", width: "14px", height: "14px", borderRadius: "50%", background: "#34d399", border: "2px solid white" },
  heroInfo: { flex: 1 },
  heroName: { margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: "white" },
  heroSub: { margin: "0 0 2px", fontSize: "14px", color: "rgba(255,255,255,0.8)", fontWeight: 600 },
  heroCourse: { margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.65)" },
  completionWrap: { minWidth: "200px" },
  completionLabel: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  completionBg: { height: "8px", background: "rgba(255,255,255,0.2)", borderRadius: "4px", overflow: "hidden" },
  completionFill: { height: "100%", background: "white", borderRadius: "4px", transition: "width 0.5s ease" },
  sectionTabs: { display: "flex", background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 32px", marginTop: "-1px" },
  sectionTab: { padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer", fontSize: "14px", color: "#6b7280", fontWeight: 600, borderBottom: "2px solid transparent", display: "flex", alignItems: "center", gap: "6px" },
  sectionTabActive: { color: "#7c3aed", borderBottom: "2px solid #7c3aed" },
  body: { padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px" },
  card: { background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "28px" },
  cardTitle: { fontSize: "17px", fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  cardSub: { fontSize: "13px", color: "#9ca3af", margin: "0 0 24px" },
  fields: { display: "flex", flexDirection: "column", gap: "18px", marginBottom: "24px" },
  fieldLabel: { fontSize: "13px", fontWeight: 700, color: "#374151" },
  input: { padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", background: "white", color: "#111827", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  optionRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  optionBtn: { padding: "10px 16px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", fontSize: "14px", fontWeight: 600, color: "#374151", cursor: "pointer" },
  optionBtnActive: { border: "1.5px solid #7c3aed", background: "#faf5ff", color: "#7c3aed" },
  toggleRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
  toggleBtn: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer" },
  toggleBtnOn: { border: "1.5px solid #ede9fe", background: "#faf5ff", color: "#7c3aed" },
  toggleTrack: { width: "36px", height: "20px", borderRadius: "10px", background: "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 },
  toggleTrackOn: { background: "#7c3aed" },
  toggleThumb: { position: "absolute", top: "2px", left: "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 0.2s" },
  toggleThumbOn: { left: "18px" },
  saveBtn: { width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  saveBtnLoading: { opacity: 0.65, cursor: "not-allowed" },
  errorBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "16px" },
  successBox: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", color: "#16a34a", fontSize: "14px", marginBottom: "16px" },
  dangerCard: { background: "white", borderRadius: "16px", border: "1.5px solid #fecaca", padding: "28px" },
  dangerTitle: { fontSize: "16px", fontWeight: 800, color: "#dc2626", margin: "0 0 6px" },
  dangerSub: { fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 20px" },
  deleteBtn: { padding: "11px 24px", borderRadius: "10px", border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  deleteConfirmBox: { background: "#fef2f2", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column" },
  deleteConfirmTitle: { fontSize: "14px", color: "#374151", margin: "0 0 14px", lineHeight: 1.6 },
  cancelDeleteBtn: { flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  confirmDeleteBtn: { flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: "#dc2626", color: "white", fontWeight: 800, fontSize: "14px", cursor: "pointer" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "400px", gap: "16px" },
  spinner: { width: "32px", height: "32px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  matchSuggestionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  matchSuggestionCard: {
    border: "1.5px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    background: "white",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  matchSuggestionCardSelected: {
    border: "2px solid #7c3aed",
    background: "#faf5ff",
    boxShadow: "0 0 0 3px rgba(124,58,237,0.08)",
  },

  matchSuggestionTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },

  matchSuggestionAvatar: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "#ede9fe",
    color: "#7c3aed",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },

  matchSuggestionScore: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  matchSuggestionName: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    color: "#111827",
  },

  matchSuggestionSub: {
    margin: 0,
    fontSize: "13px",
    color: "#6b7280",
  },

  matchSuggestionRoom: {
    margin: 0,
    fontSize: "13px",
    color: "#16a34a",
    fontWeight: 700,
  },

  matchSuggestionTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },

  matchSuggestionTag: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "6px 8px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#4b5563",
  },

  orDivider: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "16px 0",
    fontSize: "12px",
    fontWeight: 800,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
};


export default StudentDashboard;