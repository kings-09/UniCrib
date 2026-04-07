import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

/* ─────────────────────────────────────────────────────────────
   LANDLORD VERIFICATION — KYC component
───────────────────────────────────────────────────────────── */

export default function LandlordVerification({ onVerified }) {
  const [status,    setStatus]    = useState(null); // null | "unverified" | "pending" | "verified" | "rejected"
  const [note,      setNote]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [step,      setStep]      = useState(1);    // 1 = intro | 2 = national ID | 3 = proof of residence | 4 = submitted

  const [idPhoto,   setIdPhoto]   = useState(null); // blob URL
  const [porPhoto,  setPorPhoto]  = useState(null); // blob URL
  const [idFile,    setIdFile]    = useState(null);
  const [porFile,   setPorFile]   = useState(null);

  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    return () => {
      if (idPhoto) URL.revokeObjectURL(idPhoto);
      if (porPhoto) URL.revokeObjectURL(porPhoto);
    };
  }, [idPhoto, porPhoto]);

  const fetchStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("verification_status, verification_note")
      .eq("id", user.id)
      .single();
    setStatus(data?.verification_status || "unverified");
    setNote(data?.verification_note || "");
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!idFile || !porFile) {
      setError("Both photos are required.");
      return;
    }
    setUploading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    // Upload national ID
    const idName  = `${user.id}/national_id_${Date.now()}.jpg`;
    const porName = `${user.id}/proof_of_residence_${Date.now()}.jpg`;

    const { error: idErr } = await supabase.storage
      .from("verification-docs")
      .upload(idName, idFile, { upsert: true });

    if (idErr) { setError(idErr.message); setUploading(false); return; }

    const { error: porErr } = await supabase.storage
      .from("verification-docs")
      .upload(porName, porFile, { upsert: true });

    if (porErr) { setError(porErr.message); setUploading(false); return; }

    // Get signed URLs (private bucket)
    const { data: idUrl }  = await supabase.storage.from("verification-docs").createSignedUrl(idName,  60 * 60 * 24 * 365);
    const { data: porUrl } = await supabase.storage.from("verification-docs").createSignedUrl(porName, 60 * 60 * 24 * 365);

    // Save to user_profiles
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({
        national_id_url:        idUrl.signedUrl,
        proof_of_residence_url: porUrl.signedUrl,
        verification_status:    "pending",
        verification_note:      null,
      })
      .eq("id", user.id);

    if (updateErr) { setError(updateErr.message); setUploading(false); return; }

    setStatus("pending");
    setStep(4);
    setUploading(false);
    if (onVerified) onVerified("pending");
  };

  if (loading) return (
    <div style={V.centered}>
      <div style={V.spinner} />
      <p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading verification status…</p>
    </div>
  );

  // ── ALREADY VERIFIED ──
  if (status === "verified") return (
    <div style={V.page}>
      <div style={V.successCard}>
        <div style={V.successBadge}>✅</div>
        <h2 style={V.successTitle}>Identity Verified</h2>
        <p style={V.successSub}>Your identity has been verified by UniCrib. You can list properties and accept bookings.</p>
        <div style={V.verifiedPill}>🛡 Verified Landlord</div>
      </div>
    </div>
  );

  // ── PENDING REVIEW ──
  if (status === "pending") return (
    <div style={V.page}>
      <div style={V.pendingCard}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>🕐</div>
        <h2 style={V.pendingTitle}>Documents Under Review</h2>
        <p style={V.pendingSub}>
          Your National ID and proof of residence have been submitted. Our team will review them within 24 hours.
          You'll be notified once verification is complete.
        </p>
        <div style={V.pendingSteps}>
          <div style={V.pendingStep}><span style={V.stepDone}>✓</span> National ID uploaded</div>
          <div style={V.pendingStep}><span style={V.stepDone}>✓</span> Proof of residence uploaded</div>
          <div style={V.pendingStep}><span style={V.stepPending}>⏳</span> Admin review in progress</div>
        </div>
      </div>
    </div>
  );

  // ── REJECTED ──
  if (status === "rejected") return (
    <div style={V.page}>
      <div style={V.rejectedCard}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>❌</div>
        <h2 style={V.rejectedTitle}>Verification Rejected</h2>
        {note && (
          <div style={V.rejectionNote}>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#dc2626" }}>Reason:</p>
            <p style={{ margin: 0, color: "#374151" }}>{note}</p>
          </div>
        )}
        <p style={V.pendingSub}>Please retake your photos and resubmit.</p>
        <button style={V.retryBtn} onClick={() => { setStatus("unverified"); setStep(1); setIdPhoto(null); setPorPhoto(null); }}>
          🔄 Resubmit Documents
        </button>
      </div>
    </div>
  );

  // ── VERIFICATION FLOW ──
  return (
    <div style={V.page}>

      {/* progress */}
      <div style={V.progressRow}>
        {["Intro", "National ID", "Proof of Residence", "Done"].map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} style={V.progressItem}>
              <div style={{ ...V.progressCircle, ...(step > n ? V.progressDone : step === n ? V.progressActive : {}) }}>
                {step > n ? "✓" : n}
              </div>
              <span style={{ ...V.progressLabel, ...(step === n ? { color: "#7c3aed" } : {}) }}>{label}</span>
              {i < 3 && <div style={{ ...V.progressLine, ...(step > n ? V.progressLineDone : {}) }} />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: INTRO ── */}
      {step === 1 && (
        <div style={V.card}>
          <div style={V.introIcon}>🛡</div>
          <h2 style={V.cardTitle}>Identity Verification Required</h2>
          <p style={V.cardSub}>
            To protect students and maintain trust on UniCrib, all landlords must verify their identity before listing properties.
            This process takes about 2 minutes.
          </p>

          <div style={V.requirementList}>
            <div style={V.requirement}>
              <div style={V.reqIcon}>🪪</div>
              <div>
                <p style={V.reqTitle}>National ID</p>
                <p style={V.reqSub}>Your Zimbabwe National ID card — both sides visible, well-lit, no blur</p>
              </div>
            </div>
            <div style={V.requirement}>
              <div style={V.reqIcon}>📄</div>
              <div>
                <p style={V.reqTitle}>Proof of Residence</p>
                <p style={V.reqSub}>ZESA bill, water bill, or title deeds — name and address must be visible</p>
              </div>
            </div>
          </div>

          <div style={V.warningBox}>
            <span style={{ fontSize: "20px" }}>📸</span>
            <p style={{ margin: 0, fontSize: "14px", color: "#92400e" }}>
              <strong>Camera only</strong> — you must take live photos. Uploading from storage is not allowed to prevent fraud.
            </p>
          </div>

          <button style={V.primaryBtn} onClick={() => setStep(2)}>
            Start Verification →
          </button>
        </div>
      )}

      {/* ── STEP 2: NATIONAL ID ── */}
      {step === 2 && (
        <div style={V.card}>
          <h2 style={V.cardTitle}>📷 Take a Photo of Your National ID</h2>
          <p style={V.cardSub}>
            Place your National ID on a flat surface in good lighting. Make sure your name, ID number and photo are clearly visible.
          </p>

          <CameraCapture
            label="National ID"
            icon="🪪"
            photo={idPhoto}
            onCapture={(blob, url) => { setIdFile(blob); setIdPhoto(url); }}
            onRetake={() => {
              if (idPhoto) URL.revokeObjectURL(idPhoto);
              setIdFile(null);
              setIdPhoto(null);
            }}
            tips={[
              "Lay ID flat on a dark surface",
              "Ensure all text is readable",
              "Avoid glare and shadows",
              "Include all 4 corners of the ID",
            ]}
          />

          {error && <div style={V.errorBox}>⚠ {error}</div>}

          <div style={V.btnRow}>
            <button style={V.backBtn} onClick={() => setStep(1)}>← Back</button>
            <button
              style={{ ...V.primaryBtn, ...(idPhoto ? {} : V.disabledBtn) }}
              disabled={!idPhoto}
              onClick={() => { setError(""); setStep(3); }}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PROOF OF RESIDENCE ── */}
      {step === 3 && (
        <div style={V.card}>
          <h2 style={V.cardTitle}>📷 Take a Photo of Proof of Residence</h2>
          <p style={V.cardSub}>
            Use a ZESA bill, water bill, or title deed. Your <strong>full name and address</strong> must match your National ID.
          </p>

          <CameraCapture
            label="Proof of Residence"
            icon="📄"
            photo={porPhoto}
            onCapture={(blob, url) => { setPorFile(blob); setPorPhoto(url); }}
            onRetake={() => {
              if (porPhoto) URL.revokeObjectURL(porPhoto);
              setPorFile(null);
              setPorPhoto(null);
            }}
            tips={[
              "Full document must be visible",
              "Name and address must be readable",
              "Accepted: ZESA, water bill, title deed",
              "Must be issued within 3 months",
            ]}
          />

          {error && <div style={V.errorBox}>⚠ {error}</div>}

          <div style={V.btnRow}>
            <button style={V.backBtn} onClick={() => setStep(2)}>← Back</button>
            <button
              style={{ ...V.primaryBtn, ...(porPhoto && !uploading ? {} : V.disabledBtn) }}
              disabled={!porPhoto || uploading}
              onClick={handleSubmit}>
              {uploading ? "Uploading…" : "Submit for Review ✓"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: SUBMITTED ── */}
      {step === 4 && (
        <div style={V.card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
            <h2 style={V.cardTitle}>Documents Submitted!</h2>
            <p style={V.cardSub}>
              Your National ID and proof of residence have been sent for review.
              You'll be able to list properties once an admin verifies your identity — usually within 24 hours.
            </p>
            <div style={V.pendingSteps}>
              <div style={V.pendingStep}><span style={V.stepDone}>✓</span> National ID photo taken</div>
              <div style={V.pendingStep}><span style={V.stepDone}>✓</span> Proof of residence photo taken</div>
              <div style={V.pendingStep}><span style={V.stepPending}>⏳</span> Awaiting admin review</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CAMERA CAPTURE COMPONENT
   Forces camera — no file picker from storage
───────────────────────────────────────────────────────────── */
function CameraCapture({ label, icon, photo, onCapture, onRetake, tips }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [cameraOn,  setCameraOn]  = useState(false);
  const [error,     setError]     = useState("");
  const [facingMode,setFacingMode]= useState("environment"); // rear camera default

  const startCamera = async () => {
    setError("");
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera: " + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not access camera canvas.");
      return;
    }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not capture photo. Please try again.");
        return;
      }

      const url = URL.createObjectURL(blob);
      onCapture(blob, url);
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  const flipCamera = async () => {
    setFacingMode(f => f === "environment" ? "user" : "environment");
    stopCamera();
    // restart with new facing mode after state update
    setTimeout(() => startCamera(), 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div style={C.wrap}>

      {/* tips */}
      <div style={C.tipsCard}>
        <p style={C.tipsTitle}>📋 Requirements</p>
        <div style={C.tipsList}>
          {tips.map((t, i) => (
            <div key={i} style={C.tip}>
              <span style={C.tipDot}>✓</span>
              <span style={{ fontSize: "13px", color: "#374151" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* camera / preview area */}
      {photo ? (
        // ── PREVIEW ──
        <div style={C.previewWrap}>
          <img src={photo} alt={label} style={C.previewImg} />
          <div style={C.previewOverlay}>
            <span style={C.previewCheck}>✅ {label} captured</span>
          </div>
          <button style={C.retakeBtn} onClick={() => { onRetake(); setError(""); }}>
            🔄 Retake Photo
          </button>
        </div>
      ) : cameraOn ? (
        // ── LIVE CAMERA ──
        <div style={C.cameraWrap}>
          <video ref={videoRef} style={C.video} playsInline muted />

          {error && (
            <div style={C.cameraErrorBox}>
              ⚠ {error}
            </div>
          )}

          <div style={C.viewfinder}>
            <div style={C.corner} />
          </div>

          <div style={C.cameraControls}>
            <button style={C.flipBtn} onClick={flipCamera} title="Flip camera">🔄</button>
            <button style={C.captureBtn} onClick={capture}>
              <div style={C.captureInner} />
            </button>
            <button style={C.cancelBtn} onClick={stopCamera}>✕</button>
          </div>

          <p style={C.cameraHint}>Tap the white button to capture</p>
        </div>
      ) : (
        // ── PROMPT ──
        <div style={C.promptWrap}>
          <div style={C.promptIcon}>{icon}</div>
          <h3 style={C.promptTitle}>Take a photo of your {label}</h3>
          <p style={C.promptSub}>Your device camera will open. No files from storage are accepted.</p>

          {error && <div style={C.errorBox}>⚠ {error}</div>}

          <button style={C.openCameraBtn} onClick={startCamera}>
            📷 Open Camera
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   VERIFICATION REVIEW — for AdminDashboard
   Paste <VerificationReview /> into your admin dashboard
   as a new "Verify Landlords" tab
───────────────────────────────────────────────────────────── */
export function VerificationReview() {
  const [pending,  setPending]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [activeTab,setActiveTab]= useState("pending"); // "pending" | "verified" | "rejected"
  const [verified, setVerified] = useState([]);
  const [rejected, setRejected] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: pend } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, landlord_company, landlord_area, national_id_url, proof_of_residence_url, verification_status, verification_note")
      .eq("role_id", 2)
      .eq("verification_status", "pending");

    const { data: ver } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, verification_status, verified_at")
      .eq("role_id", 2)
      .eq("verification_status", "verified");

    const { data: rej } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, verification_status, verification_note")
      .eq("role_id", 2)
      .eq("verification_status", "rejected");

    setPending(pend || []);
    setVerified(ver || []);
    setRejected(rej || []);
  };

  const handleVerify = async (userId) => {
    setLoading(true);
    await supabase
      .from("user_profiles")
      .update({
        verification_status: "verified",
        verification_note:   null,
        verified_at:         new Date().toISOString(),
      })
      .eq("id", userId);
    await fetchAll();
    setSelected(null);
    setLoading(false);
  };

  const handleReject = async (userId) => {
    if (!note.trim()) { alert("Please provide a rejection reason."); return; }
    setLoading(true);
    await supabase
      .from("user_profiles")
      .update({
        verification_status: "rejected",
        verification_note:   note.trim(),
      })
      .eq("id", userId);
    await fetchAll();
    setSelected(null);
    setNote("");
    setLoading(false);
  };

  const list = activeTab === "pending" ? pending : activeTab === "verified" ? verified : rejected;

  return (
    <div style={VR.wrap}>
      <div style={VR.tabs}>
        {[
          { key: "pending",  label: "⏳ Pending",  count: pending.length  },
          { key: "verified", label: "✅ Verified",  count: verified.length },
          { key: "rejected", label: "❌ Rejected",  count: rejected.length },
        ].map(t => (
          <button key={t.key}
            style={{ ...VR.tab, ...(activeTab === t.key ? VR.tabActive : {}) }}
            onClick={() => { setActiveTab(t.key); setSelected(null); }}>
            {t.label} <span style={VR.tabCount}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={VR.layout}>
        {/* list */}
        <div style={VR.list}>
          {list.length === 0 && (
            <div style={VR.empty}>
              <p style={{ fontSize: "36px", margin: "0 0 8px" }}>
                {activeTab === "pending" ? "🎉" : activeTab === "verified" ? "✅" : "📋"}
              </p>
              <p style={{ color: "#9ca3af" }}>
                {activeTab === "pending" ? "No pending verifications." : activeTab === "verified" ? "No verified landlords yet." : "No rejections."}
              </p>
            </div>
          )}
          {list.map(l => (
            <div key={l.id}
              style={{ ...VR.listItem, ...(selected?.id === l.id ? VR.listItemActive : {}) }}
              onClick={() => { setSelected(l); setNote(""); }}>
              <div style={VR.listAvatar}>{l.full_name?.charAt(0)?.toUpperCase() || "?"}</div>
              <div style={{ flex: 1 }}>
                <p style={VR.listName}>{l.full_name || "No name"}</p>
                <p style={VR.listSub}>{l.phone || "No phone"}</p>
              </div>
              <span style={
                l.verification_status === "verified" ? VR.badgeGreen :
                l.verification_status === "rejected" ? VR.badgeRed   : VR.badgeOrange
              }>
                {l.verification_status}
              </span>
            </div>
          ))}
        </div>

        {/* review panel */}
        {selected ? (
          <div style={VR.reviewPanel}>
            <div style={VR.reviewHeader}>
              <h3 style={VR.reviewName}>{selected.full_name}</h3>
              <button style={VR.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* landlord info */}
            <div style={VR.infoGrid}>
              <InfoRow label="Phone"   value={selected.phone             || "—"} />
              <InfoRow label="Company" value={selected.landlord_company  || "—"} />
              <InfoRow label="Area"    value={selected.landlord_area     || "—"} />
            </div>

            {/* documents */}
            <div style={VR.docsSection}>
              <h4 style={VR.docsTitle}>📋 Submitted Documents</h4>

              <div style={VR.docsGrid}>
                <DocViewer
                  title="🪪 National ID"
                  url={selected.national_id_url}
                  hint="Check: name, ID number, photo visible"
                />
                <DocViewer
                  title="📄 Proof of Residence"
                  url={selected.proof_of_residence_url}
                  hint="Check: name matches ID, address visible, recent date"
                />
              </div>

              <div style={VR.matchCheck}>
                <p style={VR.matchCheckTitle}>✅ What to verify:</p>
                <div style={VR.checkList}>
                  <CheckRow text="Full name on National ID matches proof of residence" />
                  <CheckRow text="ID photo matches the landlord's profile name" />
                  <CheckRow text="Address on proof of residence is in Zimbabwe" />
                  <CheckRow text="Documents are clear, unaltered and readable" />
                  <CheckRow text="Proof of residence is recent (within 3 months)" />
                </div>
              </div>
            </div>

            {/* actions (only for pending) */}
            {selected.verification_status === "pending" && (
              <div style={VR.actions}>
                <div style={VR.noteWrap}>
                  <label style={VR.noteLabel}>Rejection reason (required if rejecting)</label>
                  <textarea
                    style={VR.noteArea}
                    placeholder="e.g. Name on ID does not match proof of residence…"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
                <div style={VR.actionBtns}>
                  <button
                    style={{ ...VR.rejectBtn, ...(loading ? { opacity: 0.6 } : {}) }}
                    onClick={() => handleReject(selected.id)}
                    disabled={loading}>
                    ❌ Reject
                  </button>
                  <button
                    style={{ ...VR.approveBtn, ...(loading ? { opacity: 0.6 } : {}) }}
                    onClick={() => handleVerify(selected.id)}
                    disabled={loading}>
                    ✅ Verify Landlord
                  </button>
                </div>
              </div>
            )}

            {selected.verification_status === "verified" && (
              <div style={VR.alreadyVerified}>✅ This landlord is verified.</div>
            )}

            {selected.verification_status === "rejected" && (
              <div style={VR.alreadyRejected}>
                <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Rejection reason:</p>
                <p style={{ margin: 0 }}>{selected.verification_note}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={VR.emptyPanel}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>👈</p>
            <p style={{ fontWeight: 700, color: "#374151" }}>Select a landlord to review</p>
            <p style={{ fontSize: "13px", color: "#9ca3af" }}>
              Compare their National ID with their proof of residence
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DocViewer({ title, url, hint }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <div style={VR.docCard}>
      <p style={VR.docTitle}>{title}</p>
      {url ? (
        <>
          <div style={VR.docImgWrap} onClick={() => setEnlarged(true)}>
            <img src={url} alt={title} style={VR.docImg} />
            <div style={VR.docZoomHint}>🔍 Click to enlarge</div>
          </div>
          <p style={VR.docHint}>{hint}</p>
          {enlarged && (
            <div style={VR.lightbox} onClick={() => setEnlarged(false)}>
              <img src={url} alt={title} style={VR.lightboxImg} />
              <p style={VR.lightboxClose}>Click anywhere to close</p>
            </div>
          )}
        </>
      ) : (
        <div style={VR.docMissing}>⚠️ Not uploaded</div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={VR.infoRow}>
      <span style={VR.infoLabel}>{label}</span>
      <span style={VR.infoValue}>{value}</span>
    </div>
  );
}

function CheckRow({ text }) {
  return (
    <div style={VR.checkRow}>
      <span style={VR.checkBox}>☐</span>
      <span style={{ fontSize: "13px", color: "#374151" }}>{text}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const V = {
  page:       { padding: "28px 32px", display: "flex", flexDirection: "column",flexWrap: "wrap", gap: "24px", maxWidth: "680px", margin: "0 auto" },
  centered:   { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "16px" },
  spinner:    { width: "32px", height: "32px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  progressRow:       { display: "flex", alignItems: "center", marginBottom: "8px" },
  progressItem:      { display: "flex", alignItems: "center", gap: "8px", flex: 1 },
  progressCircle:    { width: "30px", height: "30px", borderRadius: "50%", background: "#e5e7eb", color: "#9ca3af", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  progressActive:    { background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" },
  progressDone:      { background: "#7c3aed", color: "white" },
  progressLabel:     { fontSize: "12px", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" },
  progressLine:      { flex: 1, height: "2px", background: "#e5e7eb", margin: "0 4px" },
  progressLineDone:  { background: "#7c3aed" },

  card:       { background: "white", borderRadius: "20px", border: "1px solid #e5e7eb", padding: "32px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
  cardTitle:  { fontSize: "20px", fontWeight: 900, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.3px" },
  cardSub:    { fontSize: "14px", color: "#6b7280", lineHeight: 1.7, margin: "0 0 24px" },
  introIcon:  { fontSize: "48px", marginBottom: "16px" },

  requirementList: { display: "flex", flexDirection: "column",flexWrap: "wrap", gap: "16px", marginBottom: "24px" },
  requirement:     { display: "flex", alignItems: "flex-start",flexWrap: "wrap", gap: "14px", padding: "16px", background: "#f8f7ff", borderRadius: "12px", border: "1px solid #ede9fe" },
  reqIcon:         { fontSize: "28px", flexShrink: 0 },
  reqTitle:        { margin: "0 0 4px", fontWeight: 700, fontSize: "15px", color: "#111827" },
  reqSub:          { margin: 0, fontSize: "13px", color: "#6b7280" },

  warningBox: { display: "flex", alignItems: "flex-start",flexWrap: "wrap", gap: "12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "14px 16px", marginBottom: "24px" },

  primaryBtn:  { width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  disabledBtn: { background: "#d1d5db", cursor: "not-allowed" },
  backBtn:     { padding: "13px 20px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  btnRow:      { display: "flex",flexWrap: "wrap", gap: "10px", marginTop: "20px" },
  errorBox:    { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", margin: "12px 0" },
  retryBtn:    { padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", marginTop: "16px" },

  successCard:  { background: "white", borderRadius: "20px", border: "1px solid #bbf7d0", padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
  successBadge: { fontSize: "56px", marginBottom: "16px" },
  successTitle: { fontSize: "24px", fontWeight: 900, color: "#111827", margin: "0 0 10px" },
  successSub:   { fontSize: "15px", color: "#6b7280", lineHeight: 1.7, margin: "0 0 24px" },
  verifiedPill: { display: "inline-block", background: "#dcfce7", color: "#16a34a", padding: "10px 24px", borderRadius: "100px", fontWeight: 800, fontSize: "15px" },

  pendingCard:  { background: "white", borderRadius: "20px", border: "1px solid #e5e7eb", padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
  pendingTitle: { fontSize: "22px", fontWeight: 900, color: "#111827", margin: "0 0 10px" },
  pendingSub:   { fontSize: "14px", color: "#6b7280", lineHeight: 1.7, margin: "0 0 28px" },
  pendingSteps: { display: "flex", flexDirection: "column",flexWrap: "wrap", gap: "12px", textAlign: "left", maxWidth: "320px", margin: "0 auto" },
  pendingStep:  { display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "#374151" },
  stepDone:     { width: "24px", height: "24px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex",flexWrap: "wrap", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 },
  stepPending:  { width: "24px", height: "24px", borderRadius: "50%", background: "#fef3c7", color: "#d97706", display: "flex",flexWrap: "wrap", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 },

  rejectedCard:  { background: "white", borderRadius: "20px", border: "1.5px solid #fecaca", padding: "48px 32px", textAlign: "center" },
  rejectedTitle: { fontSize: "22px", fontWeight: 900, color: "#dc2626", margin: "0 0 10px" },
  rejectionNote: { background: "#fef2f2", borderRadius: "12px", padding: "16px", margin: "0 0 16px", textAlign: "left" },
};

const C = {
  wrap:        { display: "flex", flexDirection: "column",flexWrap: "wrap", gap: "20px" },
  tipsCard:    { background: "#f8f7ff", border: "1px solid #ede9fe", borderRadius: "12px", padding: "16px" },
  tipsTitle:   { fontSize: "13px", fontWeight: 800, color: "#7c3aed", margin: "0 0 10px" },
  tipsList:    { display: "flex", flexDirection: "column",flexWrap: "wrap", gap: "8px" },
  tip:         { display: "flex", alignItems: "flex-start", gap: "8px" },
  tipDot:      { color: "#16a34a", fontWeight: 700, fontSize: "13px", flexShrink: 0 },

  promptWrap:  { background: "#f9fafb", borderRadius: "16px", border: "2px dashed #e5e7eb", padding: "40px 24px", textAlign: "center" },
  promptIcon:  { fontSize: "48px", marginBottom: "12px" },
  promptTitle: { fontSize: "17px", fontWeight: 800, color: "#111827", margin: "0 0 8px" },
  promptSub:   { fontSize: "13px", color: "#9ca3af", margin: "0 0 20px" },
  errorBox:    { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", color: "#dc2626", fontSize: "13px", margin: "0 0 16px" },
  openCameraBtn: { padding: "12px 28px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "15px", cursor: "pointer" },

  cameraWrap:   { position: "relative", borderRadius: "16px", overflow: "hidden", background: "#000", aspectRatio: "4/3" },
  video:        { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  viewfinder:   { position: "absolute", inset: "10%", border: "2px solid rgba(255,255,255,0.6)", borderRadius: "12px", pointerEvents: "none" },
  corner:       { position: "absolute", top: "-2px", left: "-2px", width: "20px", height: "20px", borderTop: "3px solid white", borderLeft: "3px solid white", borderRadius: "4px 0 0 0" },
  cameraControls: { position: "absolute", bottom: "16px", left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: "24px" },
  flipBtn:      { width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", fontSize: "20px", cursor: "pointer" },
  captureBtn:   { width: "68px", height: "68px", borderRadius: "50%", background: "white", border: "4px solid rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  captureInner: { width: "52px", height: "52px", borderRadius: "50%", background: "white", border: "3px solid #ddd" },
  cancelBtn:    { width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", fontSize: "18px", cursor: "pointer" },
  cameraHint:   { position: "absolute", top: "12px", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 600 },

  previewWrap:    { position: "relative", borderRadius: "16px", overflow: "hidden" },
  previewImg:     { width: "100%", display: "block", borderRadius: "16px" },
  previewOverlay: { position: "absolute", top: "12px", left: "12px", background: "rgba(0,0,0,0.6)", borderRadius: "8px", padding: "6px 12px" },
  previewCheck:   { color: "white", fontSize: "13px", fontWeight: 700 },
  retakeBtn:      { position: "absolute", bottom: "12px", right: "12px", padding: "8px 16px", borderRadius: "10px", border: "none", background: "rgba(0,0,0,0.7)", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer" },

  cameraErrorBox: {
    position: "absolute",
    top: "48px",
    left: "12px",
    right: "12px",
    zIndex: 5,
    background: "rgba(127, 29, 29, 0.92)",
    border: "1px solid rgba(252, 165, 165, 0.9)",
    borderRadius: "10px",
    padding: "10px 12px",
    color: "white",
    fontSize: "13px",
    fontWeight: 600,
  },
};

const VR = {
  wrap:        { display: "flex", flexDirection: "column", gap: "0" },
  tabs:        { display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "0" },
  tab:         { padding: "12px 20px", border: "none", background: "transparent", cursor: "pointer", fontSize: "14px", color: "#6b7280", fontWeight: 600, borderBottom: "2px solid transparent" },
  tabActive:   { color: "#7c3aed", borderBottom: "2px solid #7c3aed", background: "transparent" },
  tabCount:    { background: "#f3f4f6", color: "#6b7280", borderRadius: "20px", padding: "2px 8px", fontSize: "12px", marginLeft: "6px" },

  layout:      { display: "flex", gap: "0", alignItems: "flex-start", minHeight: "500px" },
  list:        { width: "280px", minWidth: "240px", borderRight: "1px solid #e5e7eb", padding: "16px" },
  listItem:    { display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "10px", cursor: "pointer", marginBottom: "6px", border: "1px solid transparent" },
  listItemActive: { background: "#faf5ff", border: "1px solid #ede9fe" },
  listAvatar:  { width: "40px", height: "40px", borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0 },
  listName:    { margin: "0 0 2px", fontWeight: 700, fontSize: "14px", color: "#111827" },
  listSub:     { margin: 0, fontSize: "12px", color: "#9ca3af" },
  badgeGreen:  { background: "#dcfce7", color: "#16a34a", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" },
  badgeRed:    { background: "#fee2e2", color: "#dc2626", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" },
  badgeOrange: { background: "#fef3c7", color: "#d97706", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" },

  reviewPanel: { flex: 1, padding: "20px 24px", overflowY: "auto" },
  reviewHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  reviewName:  { margin: 0, fontSize: "18px", fontWeight: 800, color: "#111827" },
  closeBtn:    { background: "#f3f4f6", border: "none", width: "28px", height: "28px", borderRadius: "50%", cursor: "pointer" },

  infoGrid:    { display: "flex", flexDirection: "column", gap: "8px", background: "#f9fafb", borderRadius: "12px", padding: "14px", marginBottom: "20px" },
  infoRow:     { display: "flex", justifyContent: "space-between" },
  infoLabel:   { fontSize: "12px", color: "#9ca3af", fontWeight: 600 },
  infoValue:   { fontSize: "13px", color: "#111827", fontWeight: 600 },

  docsSection: { marginBottom: "20px" },
  docsTitle:   { fontSize: "15px", fontWeight: 800, color: "#374151", margin: "0 0 14px" },
  docsGrid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" },
  docCard:     { background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" },
  docTitle:    { margin: 0, padding: "10px 12px", fontSize: "13px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" },
  docImgWrap:  { position: "relative", cursor: "zoom-in" },
  docImg:      { width: "100%", display: "block", maxHeight: "180px", objectFit: "cover" },
  docZoomHint: { position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "11px", padding: "3px 8px", borderRadius: "6px" },
  docHint:     { fontSize: "11px", color: "#9ca3af", padding: "8px 12px", margin: 0 },
  docMissing:  { padding: "32px", textAlign: "center", color: "#dc2626", fontWeight: 700 },

  lightbox:      { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "zoom-out" },
  lightboxImg:   { maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", objectFit: "contain" },
  lightboxClose: { color: "rgba(255,255,255,0.6)", fontSize: "13px", marginTop: "12px" },

  matchCheck:     { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "14px 16px" },
  matchCheckTitle:{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "#16a34a" },
  checkList:      { display: "flex", flexDirection: "column", gap: "8px" },
  checkRow:       { display: "flex", alignItems: "flex-start", gap: "10px" },
  checkBox:       { fontSize: "16px", color: "#9ca3af", flexShrink: 0, marginTop: "1px" },

  actions:      { borderTop: "1px solid #e5e7eb", paddingTop: "16px" },
  noteWrap:     { marginBottom: "14px" },
  noteLabel:    { fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" },
  noteArea:     { width: "100%", minHeight: "80px", borderRadius: "10px", border: "1.5px solid #e5e7eb", padding: "10px", fontSize: "14px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  actionBtns:   { display: "flex", gap: "10px" },
  rejectBtn:    { flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "14px", cursor: "pointer" },
  approveBtn:   { flex: 2, padding: "12px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", fontWeight: 800, fontSize: "14px", cursor: "pointer" },

  alreadyVerified: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "16px", color: "#16a34a", fontWeight: 700, textAlign: "center" },
  alreadyRejected: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "16px", color: "#dc2626", fontSize: "14px" },

  empty:       { textAlign: "center", padding: "40px 20px" },
  emptyPanel:  { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" },
};

