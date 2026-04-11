import { useState, useEffect} from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { supabase } from "../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { CameraCapture } from "./LandlordVerification";
import L from "leaflet";

const AMENITIES = [
  { key: "wifi",      label: "WiFi",          icon: "📶" },
  { key: "water",     label: "Water",          icon: "💧" },
  { key: "electric",  label: "Electricity",    icon: "⚡" },
  { key: "kitchen",   label: "Kitchen",        icon: "🍳" },
  { key: "laundry",   label: "Laundry",        icon: "🧺" },
  { key: "parking",   label: "Parking",        icon: "🚗" },
  { key: "security",  label: "Security",       icon: "🔒" },
  { key: "furnished", label: "Furnished",      icon: "🛋️" },
  { key: "garden",    label: "Garden",         icon: "🌿" },
  { key: "ac",        label: "Air Con",        icon: "❄️" },
  { key: "pool",      label: "Pool",           icon: "🏊" },
];

const PROPERTY_TYPES = [
  "Single Room", "Double Room", "En-suite Room",
  "Studio", "1-Bedroom Flat", "2-Bedroom Flat", "Shared House",
];

const STEPS = [
  { label: "Details",   hint: "Title, type, price"       },
  { label: "Amenities", hint: "What's included"          },
  { label: "Location",  hint: "Map pin & address"        },
  { label: "Photos",    hint: "At least 3 clear photos"  },
  { label: "Ownership", hint: "Live photo of proof of ownership" },
];

export default function AddProperty() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const editData   = location.state?.property || null;   // existing property if editing
  const isEdit     = !!editData;

  const [step,      setStep]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  /* step 1 */
  const [title,        setTitle]        = useState(editData?.title        || "");
  const [propType,     setPropType]     = useState(editData?.property_type || "");
  const [genderPolicy, setGenderPolicy] = useState(editData?.gender_policy || "");
  const [description,  setDescription]  = useState(editData?.description  || "");
  const [price,        setPrice]        = useState(editData?.price        ? String(editData.price) : "");
  const [rooms,        setRooms]        = useState(editData?.rooms        ? String(editData.rooms) : "1");
  const [maxOccupants, setMaxOccupants] = useState(editData?.max_occupants ? String(editData.max_occupants) : "1");
  const [amenities, setAmenities] = useState(editData?.amenities || []);
  const [address,  setAddress]  = useState(editData?.address || "");
  const [location2, setLocation2] = useState(
    editData?.latitude && editData?.longitude
      ? { lat: editData.latitude, lng: editData.longitude }
      : null
  );
  const [existingUrls, setExistingUrls] = useState(editData?.image_urls || []);
  const [images,       setImages]       = useState([]);
  const [previews,     setPreviews]     = useState([]);
  const [ownershipPhoto, setOwnershipPhoto] = useState(null);
  const [ownershipFile,  setOwnershipFile]  = useState(null);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const toggleAmenity = (key) =>
    setAmenities(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  const handleImages = (e) => {
    const files = [...e.target.files];
    if (existingUrls.length + images.length + files.length > 10) {
      setError("Maximum 10 photos allowed."); return;
    }
    setImages(p => [...p, ...files]);
    setPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
    setError("");
  };

  const removeExistingUrl = (idx) => {
    setExistingUrls(p => p.filter((_, i) => i !== idx));
  };

  const removeImage = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setImages(p => p.filter((_, i) => i !== idx));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const handleFindLocation = async () => {
    if (!address.trim()) { setError("Enter an address first."); return; }
    setError("");
    try {
      const search = async (q) => {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=zw&limit=1&q=${encodeURIComponent(q)}`
        );
        return r.json();
      };
      let data = await search(address);
      if (!data.length) data = await search(address.replace(/[0-9]/g, "").trim());
      if (data.length) {
        setLocation2({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        setError("Address not found — click the map to pin manually.");
      }
    } catch {
      setError("Error finding location — click the map to pin manually.");
    }
  };

  const validate = () => {
    if (step === 1) {
      if (!title.trim())   return "Please enter a property title.";
      if (!propType)       return "Please select a property type.";
      if (!genderPolicy) return "Please select who this property is for.";
      if (!description.trim() || description.trim().length < 30)
        return "Please write a description (at least 30 characters).";
      if (!price || isNaN(Number(price)) || Number(price) <= 0)
        return "Please enter a valid monthly price.";
      if (!rooms || Number(rooms) < 1)
        return "Please enter the number of rooms (minimum 1).";
    }

    if (step === 2) {
      if (amenities.length === 0)
        return "Please select at least one amenity.";
    }

    if (step === 3) {
      if (!location2)
        return "Please pin your property location on the map.";
    }

    if (step === 4) {
      if (existingUrls.length + images.length < 3)
        return "Please have at least 3 photos of the property.";
    }

    if (step === 5) {
      if (!ownershipFile)
        return "Please take a live photo of your proof of ownership document.";
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

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("verification_status")
        .eq("id", user.id)
        .single();

      if (profile?.verification_status !== "verified") {
        setError("You must complete identity verification before listing properties.");
        setLoading(false);
        return;
      }

      // Upload any new image files
      let newUrls = [];
      for (const img of images) {
        const fileName = `${user.id}-${Date.now()}-${img.name}`;
        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(fileName, img);
        if (uploadError) { setError(uploadError.message); setLoading(false); return; }
        const { data } = supabase.storage.from("property-images").getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }

      // Upload proof of ownership
      let ownershipUrl = null;
      if (ownershipFile) {
        const fileName = `ownership-${user.id}-${Date.now()}.jpg`;
        const { error: ownershipUploadError } = await supabase.storage
          .from("property-images")
          .upload(fileName, ownershipFile, { contentType: "image/jpeg" });
        if (ownershipUploadError) { setError(ownershipUploadError.message); setLoading(false); return; }
        const { data: ownershipData } = supabase.storage.from("property-images").getPublicUrl(fileName);
        ownershipUrl = ownershipData.publicUrl;
      }

      // Combine kept existing URLs with newly uploaded ones
      const finalImageUrls = [...existingUrls, ...newUrls];

      const propertyPayload = {
        title:         title.trim(),
        description:   description.trim(),
        price:         Number(price),
        latitude:      location2.lat,
        longitude:     location2.lng,
        image_urls:    finalImageUrls,
        property_type: propType,
        gender_policy: genderPolicy,
        rooms:         Number(rooms),
        max_occupants: Number(maxOccupants),
        amenities,
        address:       address.trim(),
        ownership_proof_url: ownershipUrl,
      };

      if (isEdit) {
        // UPDATE — also clear rejection and resubmit for review
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            ...propertyPayload,
            is_approved:      false,
            rejection_reason: null,
            reviewed_at:      null,
            admin_notes:      null,
          })
          .eq("id", editData.id);

        if (updateError) { setError(updateError.message); setLoading(false); return; }

      } else {
        // INSERT new property
        const { data: insertedProperty, error: insertError } = await supabase
          .from("properties")
          .insert([{ ...propertyPayload, user_id: user.id, is_full: false, is_approved: false }])
          .select()
          .single();

        if (insertError) { setError(insertError.message); setLoading(false); return; }

        const roomsToInsert = Array.from({ length: Number(rooms) }, (_, i) => ({
          property_id:       insertedProperty.id,
          room_number:       `Room ${i + 1}`,
          max_occupants:     Number(maxOccupants),
          current_occupants: 0,
          is_occupied:       false,
        }));

        const { error: roomError } = await supabase
          .from("property_rooms")
          .insert(roomsToInsert);

        if (roomError) { setError(roomError.message); setLoading(false); return; }
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (submitted) return (
    <SuccessScreen
      isEdit={isEdit}
      onBack={() => navigate("/dashboard")}
    />
  );

  const progress = ((step - 1) / STEPS.length) * 100;

  return (
    <div style={S.page}>
      {/* ── TOP BAR ── */}
      <header style={S.topBar}>
        <button style={S.backLink} onClick={() => navigate("/dashboard")}>
          <span style={S.backArrow}>←</span> Dashboard
        </button>
        <span style={S.topBarLogo}>🏠 {isEdit ? "Edit Property" : "Add Property"}</span>
        <div style={S.topBarRight}>
          <span style={S.stepCounter}>{step} / {STEPS.length}</span>
        </div>
      </header>

      {/* ── PROGRESS BAR ── */}
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${progress}%` }} />
      </div>

      <div style={S.layout}>
        {/* ── LEFT SIDEBAR ── */}
        <aside style={S.sidebar}>
          <div style={S.sidebarInner}>
            <p style={S.sidebarHeading}>Your listing</p>

            {STEPS.map(({ label, hint }, i) => {
              const n      = i + 1;
              const done   = step > n;
              const active = step === n;
              return (
                <div key={label} style={S.stepItem}>
                  <div style={{
                    ...S.stepDot,
                    ...(done ? S.stepDotDone : active ? S.stepDotActive : {}),
                  }}>
                    {done ? "✓" : n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ ...S.stepName, ...(active ? { color: "#1a1a2e" } : {}) }}>{label}</p>
                    <p style={S.stepHint}>{hint}</p>
                  </div>
                  {n < STEPS.length && <div style={S.stepConnector} />}
                </div>
              );
            })}

            <div style={S.tipBox}>
              <p style={S.tipHead}>💡 Quick tips</p>
              <p style={S.tipItem}>✓ Use natural light for photos</p>
              <p style={S.tipItem}>✓ Mention nearby landmarks</p>
              <p style={S.tipItem}>✓ Set a competitive price</p>
              <p style={S.tipItem}>✓ Pin the exact entrance</p>
            </div>
          </div>
        </aside>

        {/* ── MAIN FORM ── */}
        <main style={S.main}>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <h2 style={S.cardTitle}>{STEPS[step - 1].label}</h2>
                <p style={S.cardSub}>{STEPS[step - 1].hint}</p>
              </div>
              <div style={S.stepPill}>Step {step} of {STEPS.length}</div>
            </div>

            {/* ── STEP 1: Details ── */}
            {step === 1 && (
              <div style={S.fields}>
                <Field label="Property Title *">
                  <input
                    style={S.input}
                    placeholder="e.g. Modern En-suite near HIT, Westgate"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </Field>

                <Field label="Property Type *">
                  <div style={S.typeGrid}>
                    {PROPERTY_TYPES.map(t => (
                      <button key={t} type="button"
                        style={{ ...S.typeChip, ...(propType === t ? S.typeChipActive : {}) }}
                        onClick={() => setPropType(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Who is this property for? *">
                  <div style={S.typeGrid}>
                    {[
                      { value: "girls_only", label: "👧 Girls Only" },
                      { value: "boys_only",  label: "👦 Boys Only"  },
                      { value: "mixed",      label: "🤝 Mixed"       },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        style={{ ...S.typeChip, ...(genderPolicy === opt.value ? S.typeChipActive : {}) }}
                        onClick={() => setGenderPolicy(opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={S.row2}>
                  <Field label="Monthly Rent (USD) *">
                    <div style={{ position: "relative" }}>
                      <span style={S.currencySymbol}>$</span>
                      <input
                        style={{ ...S.input, paddingLeft: "28px" }}
                        type="number" min="0"
                        placeholder="150"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Number of Rooms *">
                    <input
                      style={S.input}
                      type="number" min="1"
                      placeholder="e.g. 8"
                      value={rooms}
                      onChange={e => setRooms(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Max Occupants per Room">
                  <input
                    style={S.input}
                    type="number" min="1"
                    placeholder="e.g. 2"
                    value={maxOccupants}
                    onChange={e => setMaxOccupants(e.target.value)}
                  />
                </Field>

                <Field label={`Description * (${description.length}/30 min chars)`}>
                  <textarea
                    style={{ ...S.input, minHeight: "110px", resize: "vertical" }}
                    placeholder="Describe the property — size, nearby landmarks, transport links, house rules, what makes it special…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  {description.length > 0 && description.length < 30 && (
                    <p style={S.charHint}>{30 - description.length} more characters needed</p>
                  )}
                </Field>
              </div>
            )}

            {/* ── STEP 2: Amenities ── */}
            {step === 2 && (
              <div style={S.fields}>
                <div style={S.amenitiesHeader}>
                  <p style={S.amenitiesIntro}>Select everything that's available at this property.</p>
                  {amenities.length > 0 && (
                    <span style={S.amenityCount}>{amenities.length} selected</span>
                  )}
                </div>
                <div style={S.amenitiesGrid}>
                  {AMENITIES.map(a => {
                    const on = amenities.includes(a.key);
                    return (
                      <button key={a.key} type="button"
                        style={{ ...S.amenityBtn, ...(on ? S.amenityBtnOn : {}) }}
                        onClick={() => toggleAmenity(a.key)}>
                        <span style={S.amenityIcon}>{a.icon}</span>
                        <span style={{ ...S.amenityLabel, ...(on ? { color: "#1a1a2e" } : {}) }}>
                          {a.label}
                        </span>
                        {on && <span style={S.amenityTick}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                {amenities.length === 0 && (
                  <div style={S.amenityWarning}>
                    ⚠ Select at least one amenity to continue
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Location ── */}
            {step === 3 && (
              <div style={S.fields}>
                <Field label="Street Address">
                  <div style={S.addressRow}>
                    <input
                      style={{ ...S.input, flex: 1 }}
                      placeholder="e.g. 14 Fife Ave, Belvedere, Harare"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleFindLocation()}
                    />
                    <button type="button" style={S.findBtn} onClick={handleFindLocation}>
                      📍 Find
                    </button>
                  </div>
                  <p style={S.mapHint}>Or click directly on the map to drop a pin</p>
                </Field>

                <div style={S.mapWrap}>
                  <MapContainer
                    center={[-17.8252, 31.0335]} zoom={13}
                    style={{ height: "300px", width: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationPicker setLocation={setLocation2} />
                    {location2 && <RecenterMap location={location2} />}
                    {location2 && (
                      <Marker position={location2} icon={new L.Icon({
                        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
                        iconSize: [36, 36], iconAnchor: [18, 36],
                      })} />
                    )}
                  </MapContainer>
                </div>

                {location2 ? (
                  <div style={S.pinConfirm}>
                    <span style={{ fontSize: "18px" }}>📍</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "#166534" }}>Location pinned!</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#4ade80" }}>
                        {location2.lat.toFixed(5)}, {location2.lng.toFixed(5)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={S.pinMissing}>
                    <span>📍</span> Click the map or use Find to pin your property location
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 4: Photos ── */}
            {step === 4 && (
              <div style={S.fields}>
                <div style={S.photosHeader}>
                  <div>
                    <p style={S.photosIntro}>Upload at least <strong>3 photos</strong> of your property.</p>
                    <p style={S.photosSub}>Clear, well-lit photos get 3× more bookings.</p>
                  </div>
                  <div style={{
                    ...S.photoCounter,
                    ...((existingUrls.length + images.length) >= 3 ? S.photoCounterGood : S.photoCounterBad),
                  }}>
                    {existingUrls.length + images.length} / 10
                  </div>
                </div>

                {/* Existing photos (edit mode) */}
                {existingUrls.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
                      CURRENT PHOTOS — click ✕ to remove
                    </p>
                    <div style={S.previewGrid}>
                      {existingUrls.map((src, i) => (
                        <div key={i} style={S.previewItem}>
                          <img src={src} alt="" style={S.previewImg} />
                          <button type="button" style={S.removeBtn} onClick={() => removeExistingUrl(i)}>✕</button>
                          {i === 0 && images.length === 0 && <span style={S.coverBadge}>Cover</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload zone */}
                <label style={{ ...S.uploadZone, ...((existingUrls.length + images.length) > 0 ? S.uploadZoneSmall : {}) }}>
                  <input type="file" multiple accept="image/*" onChange={handleImages} style={{ display: "none" }} />
                  <span style={{ fontSize: "32px" }}>📷</span>
                  <span style={S.uploadLabel}>
                    {(existingUrls.length + images.length) === 0 ? "Click to upload photos" : "Add more photos"}
                  </span>
                  <span style={S.uploadSub}>JPEG · PNG · WebP · up to 10 files</span>
                </label>

                {/* New photo previews */}
                {previews.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
                      NEW PHOTOS
                    </p>
                    <div style={S.previewGrid}>
                      {previews.map((src, i) => (
                        <div key={i} style={S.previewItem}>
                          <img src={src} alt="" style={S.previewImg} />
                          <button type="button" style={S.removeBtn} onClick={() => removeImage(i)}>✕</button>
                          {existingUrls.length === 0 && i === 0 && <span style={S.coverBadge}>Cover</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(existingUrls.length + images.length) < 3 && (existingUrls.length + images.length) > 0 && (
                  <div style={S.photoWarning}>
                    ⚠ Add {3 - existingUrls.length - images.length} more photo{(3 - existingUrls.length - images.length) > 1 ? "s" : ""} to continue
                  </div>
                )}
                {(existingUrls.length + images.length) === 0 && (
                  <div style={S.photoWarning}>
                    ⚠ At least 3 photos are required
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div style={S.fields}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "14px", color: "#374151" }}>
                    Take a <strong>live photo</strong> of one of the following documents:
                  </p>
                  {[
                    "Title deed",
                    "Rates bill or utility bill in your name",
                    "Agreement of sale",
                  ].map(opt => (
                    <div key={opt} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", background: "#ede9fe", fontSize: "13px", color: "#4c1d95" }}>
                      <span style={{ fontWeight: 700 }}>✓</span> {opt}
                    </div>
                  ))}
                </div>

                <CameraCapture
                  label="Proof of Ownership"
                  icon="📄"
                  photo={ownershipPhoto}
                  onCapture={(blob, url) => { setOwnershipFile(blob); setOwnershipPhoto(url); }}
                  onRetake={() => { setOwnershipFile(null); setOwnershipPhoto(null); }}
                  tips={[
                    "Lay the document flat in good lighting",
                    "All text must be clearly readable",
                    "Include all edges of the document",
                    "Avoid glare, blur, and shadows",
                  ]}
                />

                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#92400e", fontWeight: 600 }}>
                  ⚠ File uploads not accepted — photo must be taken live using your camera.
                </div>
              </div>
            )}
            {/* ── ERROR ── */}
            {error && (
              <div style={S.errorBox}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* ── ACTIONS ── */}
            <div style={S.btnRow}>
              {step > 1 && (
                <button type="button" style={S.backBtn} onClick={back}>← Back</button>
              )}
              {step < STEPS.length ? (
                <button type="button" style={S.nextBtn} onClick={next}>
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  style={{ ...S.nextBtn, ...(loading ? S.nextBtnLoading : {}) }}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Saving…" : isEdit ? "💾 Save & Resubmit" : "🏠 Submit Listing"}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Map helpers ── */
function LocationPicker({ setLocation }) {
  useMapEvents({ click(e) { setLocation(e.latlng); } });
  return null;
}
function RecenterMap({ location }) {
  const map = useMap();
  if (location) map.setView([location.lat, location.lng], 17);
  return null;
}

/* ── Success screen ── */
function SuccessScreen({ isEdit, onBack }) {
  return (
    <div style={S.successPage}>
      <div style={S.successCard}>
        <div style={S.successIcon}>🏠</div>
        <h2 style={S.successTitle}>{isEdit ? "Changes Saved!" : "Listing Submitted!"}</h2>
        <p style={S.successSub}>
          {isEdit
            ? "Your property has been updated and resubmitted for review. It will go live once approved by our team."
            : "Your property has been submitted for review. Our team will approve it within 24 hours — students will be able to see it right away once approved."
          }
        </p>
        <div style={S.successChecks}>
          {(isEdit
            ? ["Changes saved successfully", "Photos updated", "Resubmitted for admin review"]
            : ["Property details saved", "Photos uploaded successfully", "Pending admin approval"]
          ).map(item => (
            <div key={item} style={S.successCheck}>
              <span style={S.successCheckIcon}>✓</span>
              <span style={{ fontSize: "14px", color: "#374151" }}>{item}</span>
            </div>
          ))}
        </div>
        <button style={S.successBtn} onClick={onBack}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

/* ── Field wrapper ── */
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

/* ── Styles ── */
const PURPLE  = "#6c2bd9";
const PURPLE2 = "#4f46e5";
const DARK    = "#1a1a2e";

const S = {
  page: {
    minHeight: "100vh",
    background: "#f4f3fb",
    fontFamily: "'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },

  /* top bar */
  topBar: {
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 20px",
    height: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  backLink: {
    background: "none", border: "none",
    color: PURPLE, fontWeight: 700, fontSize: "14px",
    cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 10px", borderRadius: "8px",
    transition: "background 0.15s",
  },
  backArrow: { fontSize: "16px" },
  topBarLogo: { fontSize: "18px", fontWeight: 900, color: DARK },
  topBarRight: { minWidth: "80px", display: "flex", justifyContent: "flex-end" },
  stepCounter: {
    background: "#ede9fe", color: PURPLE,
    padding: "4px 12px", borderRadius: "20px",
    fontSize: "12px", fontWeight: 800,
  },

  /* progress */
  progressTrack: {
    height: "3px", background: "#e5e7eb", position: "relative",
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE2})`,
    transition: "width 0.4s ease",
  },

  /* layout */
  layout: {
    display: "flex",
    flexWrap: "wrap",
    flex: 1,
    maxWidth: "1060px",
    margin: "0 auto",
    width: "100%",
    padding: "28px 16px",
    gap: "24px",
    alignItems: "flex-start",
    boxSizing: "border-box",
  },

  /* sidebar */
  sidebar: {
    flex: "0 0 240px",
    width: "240px",
    position: "sticky",
    top: "80px",
  },
  sidebarInner: {
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    border: "1px solid #f0eeff",
  },
  sidebarHeading: {
    margin: "0 0 20px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#9ca3af",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "18px",
    position: "relative",
  },
  stepDot: {
    width: "26px", height: "26px",
    borderRadius: "50%",
    background: "#f3f4f6",
    color: "#9ca3af",
    fontSize: "11px", fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    border: "2px solid #e5e7eb",
  },
  stepDotActive: {
    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE2})`,
    color: "white",
    border: `2px solid ${PURPLE}`,
    boxShadow: `0 0 0 3px rgba(108,43,217,0.15)`,
  },
  stepDotDone: {
    background: "#f0fdf4",
    color: "#16a34a",
    border: "2px solid #bbf7d0",
  },
  stepName: {
    margin: "0 0 2px",
    fontSize: "13px", fontWeight: 700,
    color: "#9ca3af",
  },
  stepHint: {
    margin: 0,
    fontSize: "11px", color: "#c4b5fd",
  },
  stepConnector: {
    position: "absolute",
    left: "12px", top: "30px",
    width: "2px", height: "14px",
    background: "#f3f4f6",
  },
  tipBox: {
    marginTop: "8px",
    background: "#faf5ff",
    border: "1px solid #ede9fe",
    borderRadius: "12px",
    padding: "14px",
  },
  tipHead: {
    margin: "0 0 10px",
    fontSize: "12px", fontWeight: 800,
    color: PURPLE,
  },
  tipItem: {
    margin: "0 0 6px",
    fontSize: "12px", color: "#6b7280",
  },

  /* main */
  main: {
    flex: "1 1 480px",
    minWidth: 0,
  },

  /* card */
  card: {
    background: "white",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
    overflow: "hidden",
    border: "1px solid #f0eeff",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 24px 0",
    flexWrap: "wrap",
    gap: "10px",
  },
  cardTitle: {
    margin: "0 0 4px",
    fontSize: "22px", fontWeight: 900, color: DARK,
    letterSpacing: "-0.3px",
  },
  cardSub: {
    margin: 0,
    fontSize: "13px", color: "#9ca3af",
  },
  stepPill: {
    background: "#ede9fe",
    color: PURPLE,
    padding: "5px 14px", borderRadius: "20px",
    fontSize: "12px", fontWeight: 800,
    whiteSpace: "nowrap",
  },

  /* fields */
  fields: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  label: {
    fontSize: "13px", fontWeight: 700,
    color: "#374151",
  },
  input: {
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e5e7eb",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    color: DARK,
    outline: "none",
    transition: "border-color 0.15s",
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "14px",
  },
  currencySymbol: {
    position: "absolute",
    left: "12px", top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af", fontWeight: 700,
    pointerEvents: "none",
  },
  charHint: {
    margin: "4px 0 0",
    fontSize: "12px", color: "#f59e0b",
    fontWeight: 600,
  },

  /* type chips */
  typeGrid: {
    display: "flex", flexWrap: "wrap", gap: "8px",
  },
  typeChip: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1.5px solid #e5e7eb",
    background: "white",
    fontSize: "13px", fontWeight: 600,
    cursor: "pointer", color: "#374151",
    transition: "all 0.15s",
  },
  typeChipActive: {
    border: `1.5px solid ${PURPLE}`,
    background: "#faf5ff",
    color: PURPLE,
  },

  /* amenities */
  amenitiesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amenitiesIntro: {
    margin: 0,
    fontSize: "14px", color: "#6b7280",
  },
  amenityCount: {
    background: "#ede9fe", color: PURPLE,
    padding: "3px 10px", borderRadius: "20px",
    fontSize: "12px", fontWeight: 800,
  },
  amenitiesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "10px",
  },
  amenityBtn: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "6px",
    padding: "14px 8px",
    borderRadius: "12px",
    border: "1.5px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    position: "relative",
    transition: "all 0.15s",
  },
  amenityBtnOn: {
    border: `1.5px solid ${PURPLE}`,
    background: "#faf5ff",
    boxShadow: `0 0 0 3px rgba(108,43,217,0.08)`,
  },
  amenityIcon: { fontSize: "22px" },
  amenityLabel: {
    fontSize: "12px", fontWeight: 600,
    color: "#6b7280", textAlign: "center",
  },
  amenityTick: {
    position: "absolute", top: "6px", right: "8px",
    fontSize: "10px", fontWeight: 900,
    color: PURPLE,
  },
  amenityWarning: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px", color: "#92400e", fontWeight: 600,
  },

  /* location */
  addressRow: {
    display: "flex", flexWrap: "wrap", gap: "10px",
  },
  findBtn: {
    padding: "11px 18px",
    borderRadius: "10px", border: "none",
    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE2})`,
    color: "white", fontWeight: 700,
    cursor: "pointer", fontSize: "14px",
    whiteSpace: "nowrap",
  },
  mapHint: {
    margin: "4px 0 0",
    fontSize: "12px", color: "#9ca3af",
  },
  mapWrap: {
    borderRadius: "14px",
    overflow: "hidden",
    border: "1.5px solid #e5e7eb",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  pinConfirm: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
  },
  pinMissing: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13px", color: "#92400e", fontWeight: 600,
    display: "flex", alignItems: "center", gap: "8px",
  },

  /* photos */
  photosHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  photosIntro: {
    margin: "0 0 4px",
    fontSize: "14px", color: "#374151",
  },
  photosSub: {
    margin: 0,
    fontSize: "12px", color: "#9ca3af",
  },
  photoCounter: {
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px", fontWeight: 800,
    flexShrink: 0,
  },
  photoCounterGood: { background: "#f0fdf4", color: "#16a34a" },
  photoCounterBad:  { background: "#fef2f2", color: "#dc2626" },
  uploadZone: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "8px",
    border: `2px dashed ${PURPLE}`,
    borderRadius: "14px",
    padding: "32px 20px",
    cursor: "pointer",
    background: "#faf5ff",
    transition: "background 0.15s",
  },
  uploadZoneSmall: {
    padding: "16px",
  },
  uploadLabel: {
    fontWeight: 700, fontSize: "15px", color: DARK,
  },
  uploadSub: {
    fontSize: "12px", color: "#9ca3af",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "10px",
  },
  previewItem: {
    position: "relative",
    borderRadius: "10px",
    overflow: "hidden",
    aspectRatio: "1",
    border: "1.5px solid #e5e7eb",
  },
  previewImg: {
    width: "100%", height: "100%",
    objectFit: "cover", display: "block",
  },
  removeBtn: {
    position: "absolute", top: "5px", right: "5px",
    background: "rgba(0,0,0,0.65)",
    border: "none", borderRadius: "50%",
    width: "22px", height: "22px",
    color: "white", fontSize: "10px",
    cursor: "pointer", fontWeight: 900,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  coverBadge: {
    position: "absolute", bottom: "5px", left: "5px",
    background: PURPLE, color: "white",
    fontSize: "10px", fontWeight: 800,
    padding: "2px 8px", borderRadius: "20px",
  },
  photoWarning: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px", color: "#92400e", fontWeight: 600,
  },

  /* error */
  errorBox: {
    margin: "0 24px 16px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#dc2626", fontSize: "14px",
    display: "flex", gap: "8px", alignItems: "center",
  },

  /* buttons */
  btnRow: {
    display: "flex", flexWrap: "wrap", gap: "10px",
    padding: "0 24px 24px",
  },
  backBtn: {
    padding: "13px 20px",
    borderRadius: "12px",
    border: "1.5px solid #e5e7eb",
    background: "white",
    fontWeight: 700, fontSize: "14px",
    cursor: "pointer", color: "#374151",
  },
  nextBtn: {
    flex: 1,
    padding: "13px",
    borderRadius: "12px",
    border: "none",
    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE2})`,
    color: "white",
    fontWeight: 800, fontSize: "15px",
    cursor: "pointer",
    boxShadow: `0 4px 14px rgba(108,43,217,0.3)`,
  },
  nextBtnLoading: {
    opacity: 0.6, cursor: "not-allowed",
  },

  /* success */
  successPage: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#f5f3ff,#ede9fe)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif", padding: "24px",
    boxSizing: "border-box",
  },
  successCard: {
    background: "white", borderRadius: "24px",
    boxShadow: "0 8px 40px rgba(108,43,217,0.12)",
    padding: "40px 32px",
    maxWidth: "460px", width: "100%",
    textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
  },
  successIcon: {
    width: "72px", height: "72px",
    borderRadius: "50%",
    background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "36px",
  },
  successTitle: {
    margin: 0, fontSize: "26px",
    fontWeight: 900, color: DARK,
  },
  successSub: {
    margin: 0, fontSize: "15px",
    color: "#6b7280", lineHeight: 1.6,
  },
  successChecks: {
    display: "flex", flexDirection: "column",
    gap: "10px", width: "100%",
  },
  successCheck: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "12px 16px",
  },
  successCheckIcon: {
    width: "22px", height: "22px",
    borderRadius: "50%",
    background: "#16a34a",
    color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: 900,
    flexShrink: 0,
  },
  successBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE2})`,
    color: "white",
    fontWeight: 800, fontSize: "15px",
    cursor: "pointer",
    boxShadow: `0 4px 14px rgba(108,43,217,0.3)`,
  },
};
