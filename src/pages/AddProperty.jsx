import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import L from "leaflet";

const AMENITIES = [
  { key: "wifi",      label: "WiFi",         icon: "📶" },
  { key: "water",     label: "Water",         icon: "💧" },
  { key: "electric",  label: "Electricity",   icon: "⚡" },
  { key: "kitchen",   label: "Kitchen",       icon: "🍳" },
  { key: "laundry",   label: "Laundry",       icon: "🧺" },
  { key: "parking",   label: "Parking",       icon: "🚗" },
  { key: "security",  label: "Security",      icon: "🔒" },
  { key: "furnished", label: "Furnished",     icon: "🛋️" },
  { key: "garden",    label: "Garden",        icon: "🌿" },
  { key: "ac",        label: "Air Con",       icon: "❄️" },
  { key: "pool",      label: "Swimming Pool", icon: "🏊" },
];

const PROPERTY_TYPES = ["Single Room", "Double Room", "En-suite Room", "Studio", "1-Bedroom Flat", "2-Bedroom Flat", "Shared House"];

const STEPS = ["Details", "Amenities", "Location & Photos"];

export default function AddProperty() {
  const navigate = useNavigate();

  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [submitted, setSubmitted] = useState(false);

  /* step 1 */
  const [title, setTitle]           = useState("");
  const [propType, setPropType]     = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice]           = useState("");
  const [rooms, setRooms]           = useState("1");
  const [maxOccupants, setMaxOccupants] = useState("1");

  /* step 2 */
  const [amenities, setAmenities] = useState([]);

  /* step 3 */
  const [address, setAddress]   = useState("");
  const [location, setLocation] = useState(null);
  const [images, setImages]     = useState([]);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  const toggleAmenity = (key) => {
    setAmenities(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleImages = (e) => {
    const files = [...e.target.files];
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFindLocation = async () => {
    if (!address.trim()) { setError("Please enter an address first."); return; }
    setError("");
    try {
      const search = async (q) => {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=zw&limit=1&q=${encodeURIComponent(q)}`);
        return r.json();
      };
      let data = await search(address);
      if (!data.length) data = await search(address.replace(/[0-9]/g, "").trim());
      if (data.length) {
        setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        setError("Location not found. Click the map to pin manually.");
      }
    } catch {
      setError("Error finding location. Click the map to pin manually.");
    }
  };

  const validate = () => {
    if (step === 1) {
      if (!title.trim())       return "Please enter a property title.";
      if (!propType)           return "Please select a property type.";
      if (!description.trim()) return "Please add a description.";
      if (!price || isNaN(Number(price)) || Number(price) <= 0) return "Please enter a valid price.";
    }
    if (step === 3) {
      if (!location) return "Please pin a location on the map.";
    }
    return "";
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setStep(s => s + 1);
  };

  const back = () => { setError(""); setStep(s => s - 1); };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("You must be logged in."); setLoading(false); return; }

      // ── upload images ──
      let imageUrls = [];
      for (const img of images) {
        const fileName = `${user.id}-${Date.now()}-${img.name}`;
        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(fileName, img);
        if (uploadError) { setError(uploadError.message); setLoading(false); return; }
        const { data } = supabase.storage.from("property-images").getPublicUrl(fileName);
        imageUrls.push(data.publicUrl);
      }

      // ── insert property and get it back ──
      const { data: insertedProperty, error: insertError } = await supabase
        .from("properties")
        .insert([{
          title:         title.trim(),
          description:   description.trim(),
          price:         Number(price),
          latitude:      location.lat,
          longitude:     location.lng,
          user_id:       user.id,
          is_full:       false,
          is_approved:   false,
          image_urls:    imageUrls,
          property_type: propType,
          rooms:         Number(rooms),
          max_occupants: Number(maxOccupants),
          amenities,
          address:       address.trim(),
        }])
        .select()
        .single(); // ✅ returns the inserted row

      if (insertError) { setError(insertError.message); setLoading(false); return; }

      // ── auto-generate rooms ──
      const roomsToInsert = Array.from({ length: Number(rooms) }, (_, i) => ({
        property_id: insertedProperty.id,
        room_number: `Room ${i + 1}`,
        max_occupants: Number(maxOccupants),
        current_occupants: 0,
        is_occupied: false,
      }));

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("verification_status")
        .eq("id", user.id)
        .single();

      if (profile?.verification_status !== "verified") {
        setError("You must complete identity verification before listing properties. Go to Verify Identity in your dashboard.");
        setLoading(false);
        return;
      }

      const { error: roomError } = await supabase
        .from("property_rooms")
        .insert(roomsToInsert);

      if (roomError) { setError(roomError.message); setLoading(false); return; }

      setSubmitted(true);

    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };
  
  if (submitted) {
    return <SuccessScreen onBack={() => navigate("/dashboard")} />;
  }
  
  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={S.topBar}>
        <button style={S.backLink} onClick={() => navigate("/dashboard")}>← Dashboard</button>
        <span style={S.topBarLogo}>🏠 UniCrib</span>
        <span />
      </div>

      <div style={S.layout}>
        {/* ── SIDEBAR ── */}
        <aside style={S.sidebar}>
          <h2 style={S.sidebarTitle}>List a Property</h2>
          <p style={S.sidebarSub}>Fill in the details below and your listing will be reviewed within 24 hours.</p>

          <div style={S.stepList}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={label} style={S.stepRow}>
                  <div style={{ ...S.stepCircle, ...(done ? S.stepDone : active ? S.stepActive : {}) }}>
                    {done ? "✓" : n}
                  </div>
                  <div>
                    <p style={{ ...S.stepLabel, ...(active ? { color: "#7c3aed" } : {}) }}>{label}</p>
                    <p style={S.stepHint}>
                      {n === 1 && "Title, type, price, description"}
                      {n === 2 && "What's included in the property"}
                      {n === 3 && "Map pin, address & photos"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={S.sidebarTip}>
            <p style={S.tipTitle}>💡 Tips for better listings</p>
            <ul style={S.tipList}>
              <li>Use clear, well-lit photos</li>
              <li>Be specific about what's included</li>
              <li>Set a competitive price</li>
              <li>Pin the exact location</li>
            </ul>
          </div>
        </aside>

        {/* ── FORM ── */}
        <main style={S.main}>
          <div style={S.formCard}>
            <div style={S.formCardHeader}>
              <h3 style={S.formCardTitle}>
                {step === 1 && "Property Details"}
                {step === 2 && "Amenities & Features"}
                {step === 3 && "Location & Photos"}
              </h3>
              <span style={S.stepBadge}>Step {step} of {STEPS.length}</span>
            </div>

            {/* progress bar */}
            <div style={S.progressBg}>
              <div style={{ ...S.progressFill, width: `${(step / STEPS.length) * 100}%` }} />
            </div>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div style={S.fields}>
                <Field label="Property Title *">
                  <input style={S.input} placeholder="e.g. Modern En-suite near HIT" value={title} onChange={e => setTitle(e.target.value)} />
                </Field>

                <Field label="Property Type *">
                  <div style={S.typeGrid}>
                    {PROPERTY_TYPES.map(t => (
                      <button key={t} type="button"
                        style={{ ...S.typeBtn, ...(propType === t ? S.typeBtnActive : {}) }}
                        onClick={() => setPropType(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={S.row2}>
                  <Field label="Monthly Rent (USD) *">
                    <div style={S.priceWrap}>
                      <span style={S.priceDollar}>$</span>
                      <input style={{ ...S.input, paddingLeft: "28px" }} type="number" placeholder="150" value={price} onChange={e => setPrice(e.target.value)} />
                    </div>
                  </Field>
                  <Field label="No. of Rooms">
                    <input
                      style={S.input}
                      type="number"
                      min="1"
                      placeholder="e.g. 8"
                      value={rooms}
                      onChange={e => setRooms(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Max Occupants per Room">
                  <input
                    style={S.input}
                    type="number"
                    min="1"
                    placeholder="e.g. 2"
                    value={maxOccupants}
                    onChange={e => setMaxOccupants(e.target.value)}
                  />
                </Field>

                <Field label="Description *">
                  <textarea style={{ ...S.input, minHeight: "110px", resize: "vertical" }}
                    placeholder="Describe the property — size, nearby landmarks, transport links, house rules…"
                    value={description} onChange={e => setDescription(e.target.value)} />
                </Field>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div style={S.fields}>
                <p style={S.amenitiesHint}>Select all amenities that are included with this property.</p>
                <div style={S.amenitiesGrid}>
                  {AMENITIES.map(a => {
                    const on = amenities.includes(a.key);
                    return (
                      <button key={a.key} type="button"
                        style={{ ...S.amenityBtn, ...(on ? S.amenityBtnOn : {}) }}
                        onClick={() => toggleAmenity(a.key)}>
                        <span style={{ fontSize: "22px" }}>{a.icon}</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: on ? "#7c3aed" : "#374151" }}>{a.label}</span>
                        {on && <span style={S.amenityCheck}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p style={S.amenitiesCount}>{amenities.length} amenit{amenities.length === 1 ? "y" : "ies"} selected</p>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div style={S.fields}>
                <Field label="Street Address">
                  <div style={S.addressRow}>
                    <input style={{ ...S.input, flex: 1 }} placeholder="e.g. 14 Fife Ave, Belvedere, Harare"
                      value={address} onChange={e => setAddress(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleFindLocation()} />
                    <button type="button" style={S.findBtn} onClick={handleFindLocation}>📍 Find</button>
                  </div>
                  <p style={S.mapHint}>Or click directly on the map to drop a pin.</p>
                </Field>

                <div style={S.mapWrap}>
                  <MapContainer center={[-17.8252, 31.0335]} zoom={13} style={{ height: "320px", width: "100%", borderRadius: "12px" }}>
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationPicker setLocation={setLocation} />
                    {location && <RecenterMap location={location} />}
                    {location && (
                      <Marker position={location} icon={new L.Icon({
                        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
                        iconSize: [36, 36],
                        iconAnchor: [18, 36],
                      })} />
                    )}
                  </MapContainer>
                  {location && (
                    <div style={S.pinConfirm}>
                      ✅ Pinned at {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    </div>
                  )}
                </div>

                <Field label="Property Photos">
                  <label style={S.uploadZone}>
                    <input type="file" multiple accept="image/*" onChange={handleImages} style={{ display: "none" }} />
                    <span style={{ fontSize: "28px" }}>📷</span>
                    <span style={{ fontWeight: 700, color: "#374151" }}>Click to upload photos</span>
                    <span style={{ fontSize: "13px", color: "#9ca3af" }}>JPEG, PNG, WebP — up to 10 files</span>
                  </label>

                  {previews.length > 0 && (
                    <div style={S.previewGrid}>
                      {previews.map((src, i) => (
                        <div key={i} style={S.previewWrap}>
                          <img src={src} alt="" style={S.previewImg} />
                          <button type="button" style={S.removeImg} onClick={() => removeImage(i)}>✕</button>
                          {i === 0 && <span style={S.coverBadge}>Cover</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            )}

            {/* error */}
            {error && <div style={S.errorBox}>⚠ {error}</div>}

            {/* actions */}
            <div style={S.btnRow}>
              {step > 1 && (
                <button type="button" style={S.backBtn} onClick={back}>← Back</button>
              )}
              {step < STEPS.length
                ? <button type="button" style={S.nextBtn} onClick={next}>Continue →</button>
                : <button type="button"
                    style={{ ...S.nextBtn, ...(loading ? S.nextBtnLoading : {}) }}
                    onClick={handleSubmit} disabled={loading}>
                    {loading ? "Submitting…" : "🏠 Submit Listing"}
                  </button>
              }
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── map helpers ── */
function LocationPicker({ setLocation }) {
  useMapEvents({ click(e) { setLocation(e.latlng); } });
  return null;
}
function RecenterMap({ location }) {
  const map = useMap();
  if (location) map.setView([location.lat, location.lng], 17);
  return null;
}

/* ── success screen ── */
function SuccessScreen({ onBack }) {
  return (
    <div style={{ ...S.page, alignItems: "center", justifyContent: "center" }}>
      <div style={S.successCard}>
        <div style={S.successIcon}>🏠</div>
        <h2 style={S.successTitle}>Listing Submitted!</h2>
        <p style={S.successSub}>
          Your property has been submitted for review. Our team will approve it within 24 hours and students will be able to see it right away.
        </p>
        <div style={S.successChecks}>
          {["Property details saved", "Photos uploaded", "Pending admin approval"].map(item => (
            <div key={item} style={S.successCheck}>
              <span style={S.successCheckIcon}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <button style={S.nextBtn} onClick={onBack}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

/* ── field wrapper ── */
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

/* ── styles ── */
const S = {
  page: { minHeight: "100vh", background: "#f8f7ff", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },

  topBar: { background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 32px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  backLink: { background: "none", border: "none", color: "#7c3aed", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  topBarLogo: { fontSize: "18px", fontWeight: 900, color: "#7c3aed" },

  layout: { display: "flex", flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "32px 24px", gap: "32px", alignItems: "flex-start" },

  /* sidebar */
  sidebar: { width: "260px", minWidth: "220px", position: "sticky", top: "24px" },
  sidebarTitle: { fontSize: "20px", fontWeight: 900, color: "#111827", margin: "0 0 6px" },
  sidebarSub: { fontSize: "13px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 28px" },
  stepList: { display: "flex", flexDirection: "column", gap: "20px", marginBottom: "28px" },
  stepRow: { display: "flex", alignItems: "flex-start", gap: "14px" },
  stepCircle: { width: "28px", height: "28px", borderRadius: "50%", background: "#e5e7eb", color: "#9ca3af", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" },
  stepActive: { background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" },
  stepDone: { background: "#7c3aed", color: "white" },
  stepLabel: { margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "#374151" },
  stepHint: { margin: 0, fontSize: "12px", color: "#9ca3af" },
  sidebarTip: { background: "#faf5ff", border: "1px solid #ede9fe", borderRadius: "12px", padding: "16px" },
  tipTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "#7c3aed" },
  tipList: { margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#6b7280", lineHeight: 2 },

  /* main form card */
  main: { flex: 1 },
  formCard: { background: "white", borderRadius: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", overflow: "hidden" },
  formCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 28px 0" },
  formCardTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  stepBadge: { background: "#ede9fe", color: "#7c3aed", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 },
  progressBg: { height: "4px", background: "#f3f4f6", margin: "16px 0 0" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#7c3aed,#4f46e5)", transition: "width 0.4s ease", borderRadius: "0 2px 2px 0" },

  fields: { padding: "24px 28px", display: "flex", flexDirection: "column", gap: "22px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#374151" },
  input: { padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", background: "white", color: "#111827", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },

  /* type selector */
  typeGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  typeBtn: { padding: "8px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", fontSize: "13px", fontWeight: 600, color: "#374151", cursor: "pointer" },
  typeBtnActive: { border: "1.5px solid #7c3aed", background: "#faf5ff", color: "#7c3aed" },

  /* price */
  priceWrap: { position: "relative" },
  priceDollar: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontWeight: 700, fontSize: "14px" },

  /* occupants */
  occupantRow: { display: "flex", gap: "8px" },
  occupantBtn: { width: "40px", height: "40px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", fontSize: "15px", fontWeight: 700, color: "#374151", cursor: "pointer" },
  occupantBtnActive: { border: "1.5px solid #7c3aed", background: "#faf5ff", color: "#7c3aed" },

  /* amenities */
  amenitiesHint: { fontSize: "14px", color: "#6b7280", margin: 0 },
  amenitiesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" },
  amenityBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "14px 8px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", position: "relative" },
  amenityBtnOn: { border: "1.5px solid #ede9fe", background: "#faf5ff" },
  amenityCheck: { position: "absolute", top: "6px", right: "8px", fontSize: "11px", color: "#7c3aed", fontWeight: 800 },
  amenitiesCount: { fontSize: "13px", color: "#7c3aed", fontWeight: 700, margin: 0 },

  /* location */
  addressRow: { display: "flex", gap: "10px" },
  findBtn: { padding: "11px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" },
  mapHint: { fontSize: "12px", color: "#9ca3af", margin: "4px 0 0" },
  mapWrap: { borderRadius: "12px", overflow: "hidden", border: "1.5px solid #e5e7eb" },
  pinConfirm: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: "13px", fontWeight: 600, padding: "10px 14px" },

  /* image upload */
  uploadZone: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "28px", border: "2px dashed #e5e7eb", borderRadius: "12px", cursor: "pointer", background: "#fafafa" },
  previewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px", marginTop: "12px" },
  previewWrap: { position: "relative", borderRadius: "10px", overflow: "hidden" },
  previewImg: { width: "100%", height: "90px", objectFit: "cover", display: "block" },
  removeImg: { position: "absolute", top: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" },
  coverBadge: { position: "absolute", bottom: "4px", left: "4px", background: "#7c3aed", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" },

  /* error */
  errorBox: { margin: "0 28px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px" },

  /* buttons */
  btnRow: { display: "flex", gap: "10px", padding: "0 28px 28px" },
  backBtn: { padding: "13px 20px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  nextBtn: { flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  nextBtnLoading: { opacity: 0.65, cursor: "not-allowed" },

  /* success */
  successCard: { background: "white", borderRadius: "20px", padding: "48px 40px", maxWidth: "480px", width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" },
  successIcon: { fontSize: "56px", marginBottom: "16px" },
  successTitle: { fontSize: "26px", fontWeight: 900, color: "#111827", margin: "0 0 12px" },
  successSub: { fontSize: "15px", color: "#6b7280", lineHeight: 1.7, margin: "0 0 28px" },
  successChecks: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", textAlign: "left" },
  successCheck: { display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "#374151" },
  successCheckIcon: { width: "24px", height: "24px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 },

};
