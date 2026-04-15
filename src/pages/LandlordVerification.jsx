import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function LandlordVerification({ onVerified }) {
  const [status,    setStatus]    = useState(null);
  const [note,      setNote]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [step,      setStep]      = useState(1);
  const [idPhoto,   setIdPhoto]   = useState(null);
  const [porPhoto,  setPorPhoto]  = useState(null);
  const [idFile,    setIdFile]    = useState(null);
  const [porFile,   setPorFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => { fetchStatus(); }, []);

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
    if (!idFile || !porFile) { setError("Both photos are required."); return; }
    setUploading(true); setError("");

    const { data: { user } } = await supabase.auth.getUser();
    const idName  = `${user.id}/national_id_${Date.now()}.jpg`;
    const porName = `${user.id}/proof_of_residence_${Date.now()}.jpg`;

    const { error: idErr } = await supabase.storage.from("verification-docs").upload(idName, idFile, { upsert: true });
    if (idErr) { setError(idErr.message); setUploading(false); return; }

    const { error: porErr } = await supabase.storage.from("verification-docs").upload(porName, porFile, { upsert: true });
    if (porErr) { setError(porErr.message); setUploading(false); return; }

    // Store paths (not signed URLs) — fresh URLs generated at review time
    const { error: profileErr } = await supabase.from("user_profiles").update({
      national_id_url:        idName,
      proof_of_residence_url: porName,
      verification_status:    "pending",
      verification_note:      null,
    }).eq("id", user.id);

    if (profileErr) { setError(profileErr.message); setUploading(false); return; }

    // Also insert into landlord_verifications for admin review panel
    const { error: verErr } = await supabase.from("landlord_verifications").upsert({
      user_id:      user.id,
      status:       "pending",
      id_front_url: idName,
      id_back_url:  porName,
    }, { onConflict: "user_id" });

    if (verErr) { setError(verErr.message); setUploading(false); return; }

    setStatus("pending"); setStep(4); setUploading(false);
    if (onVerified) onVerified("pending");
  };

  if (loading) return (
    <div style={V.centered}><div style={V.spinner} /><p style={{ color: "#7c3aed", fontWeight: 600 }}>Loading…</p></div>
  );

  if (status === "verified") return (
    <div style={V.page}>
      <div style={V.successCard}>
        <div style={V.successBadge}>✅</div>
        <h2 style={V.successTitle}>Identity Verified</h2>
        <p style={V.successSub}>Your identity has been verified. You can list properties and accept bookings.</p>
        <div style={V.verifiedPill}>🛡 Verified Landlord</div>
      </div>
    </div>
  );

  if (status === "pending") return (
    <div style={V.page}>
      <div style={V.pendingCard}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>🕐</div>
        <h2 style={V.pendingTitle}>Documents Under Review</h2>
        <p style={V.pendingSub}>Our team will review your documents within 24 hours.</p>
        <div style={V.pendingSteps}>
          <div style={V.pendingStep}><span style={V.stepDone}>✓</span> National ID uploaded</div>
          <div style={V.pendingStep}><span style={V.stepDone}>✓</span> Proof of residence uploaded</div>
          <div style={V.pendingStep}><span style={V.stepPending}>⏳</span> Admin review in progress</div>
        </div>
      </div>
    </div>
  );

  if (status === "rejected") return (
    <div style={V.page}>
      <div style={V.rejectedCard}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>❌</div>
        <h2 style={V.rejectedTitle}>Verification Rejected</h2>
        {note && <div style={V.rejectionNote}><p style={{ margin: "0 0 4px", fontWeight: 700, color: "#dc2626" }}>Reason:</p><p style={{ margin: 0, color: "#374151" }}>{note}</p></div>}
        <p style={V.pendingSub}>Please retake your photos and resubmit.</p>
        <button style={V.retryBtn} onClick={() => { setStatus("unverified"); setStep(1); setIdPhoto(null); setPorPhoto(null); }}>🔄 Resubmit Documents</button>
      </div>
    </div>
  );

  return (
    <div style={V.page}>
      {/* Progress */}
      <div style={V.progressRow} className="verify-progress-row">
        {["Intro", "National ID", "Proof of Residence", "Done"].map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} style={V.progressItem}>
              <div style={{ ...V.progressCircle, ...(step > n ? V.progressDone : step === n ? V.progressActive : {}) }}>
                {step > n ? "✓" : n}
              </div>
              <span className="verify-progress-label" style={{ ...V.progressLabel, ...(step === n ? { color: "#7c3aed" } : {}) }}>{label}</span>
              {i < 3 && <div style={{ ...V.progressLine, ...(step > n ? V.progressLineDone : {}) }} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div style={V.card}>
          <div style={V.introIcon}>🛡</div>
          <h2 style={V.cardTitle}>Identity Verification Required</h2>
          <p style={V.cardSub}>To protect students and maintain trust, all landlords must verify their identity before listing properties. Takes about 2 minutes.</p>
          <div style={V.requirementList}>
            <div style={V.requirement}><div style={V.reqIcon}>🪪</div><div><p style={V.reqTitle}>National ID</p><p style={V.reqSub}>Your Zimbabwe National ID card — visible, well-lit, no blur</p></div></div>
            <div style={V.requirement}><div style={V.reqIcon}>📄</div><div><p style={V.reqTitle}>Proof of Residence</p><p style={V.reqSub}>ZESA bill, water bill, or title deed — name and address must be visible</p></div></div>
          </div>
          <div style={V.warningBox}>
            <span style={{ fontSize: "20px" }}>📸</span>
            <p style={{ margin: 0, fontSize: "14px", color: "#92400e" }}><strong>Camera only</strong> — live photos required. No uploads from storage.</p>
          </div>
          <button style={V.primaryBtn} onClick={() => setStep(2)}>Start Verification →</button>
        </div>
      )}

      {step === 2 && (
        <div style={V.card}>
          <h2 style={V.cardTitle}>📷 Take a Photo of Your National ID</h2>
          <p style={V.cardSub}>Place your National ID on a flat surface in good lighting. All text must be clearly visible.</p>
          <CameraCapture
            label="National ID" icon="🪪" photo={idPhoto}
            onCapture={(blob, url) => { setIdFile(blob); setIdPhoto(url); }}
            onRetake={() => { setIdFile(null); setIdPhoto(null); }}
            tips={["Lay ID flat on a dark surface", "Ensure all text is readable", "Avoid glare and shadows", "Include all 4 corners"]}
          />
          {error && <div style={V.errorBox}>⚠ {error}</div>}
          <div style={V.btnRow}>
            <button style={V.backBtn} onClick={() => setStep(1)}>← Back</button>
            <button style={{ ...V.primaryBtn, flex: 1, ...(idPhoto ? {} : V.disabledBtn) }} disabled={!idPhoto} onClick={() => { setError(""); setStep(3); }}>Continue →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={V.card}>
          <h2 style={V.cardTitle}>📷 Take a Photo of Proof of Residence</h2>
          <p style={V.cardSub}>Use a ZESA bill, water bill, or title deed. Your <strong>full name and address</strong> must match your National ID.</p>
          <CameraCapture
            label="Proof of Residence" icon="📄" photo={porPhoto}
            onCapture={(blob, url) => { setPorFile(blob); setPorPhoto(url); }}
            onRetake={() => { setPorFile(null); setPorPhoto(null); }}
            tips={["Full document must be visible", "Name and address must be readable", "Accepted: ZESA, water bill, title deed", "Must be issued within 3 months"]}
          />
          {error && <div style={V.errorBox}>⚠ {error}</div>}
          <div style={V.btnRow}>
            <button style={V.backBtn} onClick={() => setStep(2)}>← Back</button>
            <button style={{ ...V.primaryBtn, flex: 1, ...(porPhoto && !uploading ? {} : V.disabledBtn) }} disabled={!porPhoto || uploading} onClick={handleSubmit}>
              {uploading ? "Uploading…" : "Submit for Review ✓"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={V.card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
            <h2 style={V.cardTitle}>Documents Submitted!</h2>
            <p style={V.cardSub}>Your documents have been sent for review. You'll be able to list properties once verified — usually within 24 hours.</p>
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

/* ─── CAMERA CAPTURE ─── */
export function CameraCapture({ label, icon, photo, onCapture, onRetake, tips }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn,   setCameraOn]   = useState(false);
  const [camError,   setCamError]   = useState("");
  const [facingMode, setFacingMode] = useState("environment");

  /* ── KEY FIX: attach stream to video AFTER element is in DOM ── */
  const attachStream = (stream) => {
    streamRef.current = stream;
    // Use a small timeout to ensure the video element has rendered
    const tryAttach = (attempts = 0) => {
      if (videoRef.current) {
        videoRef.current.srcObject = null; // clear first
        videoRef.current.srcObject = stream;
        // Must call play() explicitly and handle the promise
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            // Autoplay blocked — user must interact, usually fine on mobile
            console.warn("Video play() was prevented:", err);
          });
        }
      } else if (attempts < 10) {
        setTimeout(() => tryAttach(attempts + 1), 100);
      }
    };
    tryAttach();
  };

  const startCamera = async (mode) => {
    setCamError("");
    const facing = mode || facingMode;

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setCameraOn(true); // mount video element first

    try {
      // Try with ideal constraints first
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback: minimal constraints (fixes black screen on some browsers)
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      attachStream(stream);
    } catch (err) {
      setCameraOn(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCamError("Camera permission denied. Please allow camera access and try again.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCamError("No camera found on this device.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCamError("Camera is in use by another app. Please close other apps and try again.");
      } else {
        setCamError("Could not start camera: " + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  const flipCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Use actual video dimensions
    const w = video.videoWidth  || 1280;
    const h = video.videoHeight || 720;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(blob => {
      if (!blob) { setCamError("Could not capture photo. Please try again."); return; }
      const url = URL.createObjectURL(blob);
      onCapture(blob, url);
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div style={C.wrap}>
      <div style={C.tipsCard}>
        <p style={C.tipsTitle}>📋 Requirements</p>
        {tips.map((t, i) => (
          <div key={i} style={C.tip}><span style={C.tipDot}>✓</span><span style={{ fontSize: "13px", color: "#374151" }}>{t}</span></div>
        ))}
      </div>

      {photo ? (
        <div style={C.previewWrap}>
          <img src={photo} alt={label} style={C.previewImg} />
          <div style={C.previewOverlay}><span style={C.previewCheck}>✅ {label} captured</span></div>
          <button style={C.retakeBtn} onClick={() => { onRetake(); setCamError(""); }}>🔄 Retake</button>
        </div>
      ) : cameraOn ? (
        <div style={C.cameraWrap}>
          {/* ── KEY FIX: autoPlay + playsInline + muted all required ── */}
          <video
            ref={videoRef}
            style={C.video}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              // Extra safety: play once metadata is loaded
              videoRef.current?.play().catch(() => {});
            }}
          />
          <div style={C.viewfinder} />
          {camError && <div style={C.camErrBox}>⚠ {camError}</div>}
          <div style={C.cameraControls}>
            <button style={C.flipBtn} onClick={flipCamera} title="Flip camera">🔄</button>
            <button style={C.captureBtn} onClick={capture}><div style={C.captureInner} /></button>
            <button style={C.cancelBtn} onClick={stopCamera}>✕</button>
          </div>
          <p style={C.cameraHint}>Tap the white button to capture</p>
        </div>
      ) : (
        <div style={C.promptWrap}>
          <div style={C.promptIcon}>{icon}</div>
          <h3 style={C.promptTitle}>Take a photo of your {label}</h3>
          <p style={C.promptSub}>Your device camera will open. No files from storage are accepted.</p>
          {camError && <div style={C.errorBox}>⚠ {camError}</div>}
          <button style={C.openCameraBtn} onClick={() => startCamera()}>📷 Open Camera</button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

/* ─── VERIFICATION REVIEW (Admin) ─── */
export function VerificationReview() {
  const [pending,   setPending]   = useState([]);
  const [verified,  setVerified]  = useState([]);
  const [rejected,  setRejected]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [note,      setNote]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: pend} = await supabase
      .from("landlord_verifications")
      .select("*")
      .eq("status", "pending");

    const { data: ver } = await supabase
      .from("landlord_verifications")
      .select("*")
      .eq("status", "approved");

    const { data: rej } = await supabase
      .from("landlord_verifications")
      .select("*")
      .eq("status", "rejected");


    // Enrich each record with profile info + fresh signed URLs
    const freshen = async (list) => Promise.all((list || []).map(async (l) => {
      // Get profile info
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, phone, landlord_company, landlord_area")
        .eq("id", l.user_id)
        .single();

      // Generate fresh signed URLs
      const sign = async (path) => {
        if (!path) return null;
        const cleanPath = path.startsWith("http")
          ? decodeURIComponent(path.split("/verification-docs/")[1]?.split("?")[0] || "")
          : path;
        if (!cleanPath) return null;
        const { data } = await supabase.storage
          .from("verification-docs")
          .createSignedUrl(cleanPath, 7200);
        return data?.signedUrl || null;
      };

      return {
        ...l,
        full_name:             profile?.full_name,
        phone:                 profile?.phone,
        landlord_company:      profile?.landlord_company,
        landlord_area:         profile?.landlord_area,
        national_id_url:       await sign(l.id_front_url),
        proof_of_residence_url: await sign(l.id_back_url),
        verification_status:   l.status,
      };
    }));

    setPending(await freshen(pend));
    setVerified(await freshen(ver));
    setRejected(await freshen(rej));
  };

  const handleVerify = async (id) => {
    setLoading(true);
    // Update verifications table
    await supabase.from("landlord_verifications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    // Keep user_profiles in sync
    const item = pending.find(p => p.id === id);
    if (item?.user_id) {
      await supabase.from("user_profiles")
        .update({ verification_status: "verified", verified_at: new Date().toISOString() })
        .eq("id", item.user_id);
    }
    await fetchAll(); setSelected(null); setLoading(false);
  };

  const handleReject = async (id) => {
    if (!note.trim()) { alert("Please provide a rejection reason."); return; }
    setLoading(true);
    const item = pending.find(p => p.id === id);
    await supabase.from("landlord_verifications")
      .update({ status: "rejected", rejection_note: note.trim(), reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (item?.user_id) {
      await supabase.from("user_profiles")
        .update({ verification_status: "rejected", verification_note: note.trim() })
        .eq("id", item.user_id);
    }
    await fetchAll(); setSelected(null); setNote(""); setLoading(false);
  };

  const list = activeTab === "pending" ? pending : activeTab === "verified" ? verified : rejected;

  return (
    <div style={VR.wrap}>
      <div style={VR.tabs}>
        {[{ key: "pending", label: "⏳ Pending", count: pending.length }, { key: "verified", label: "✅ Verified", count: verified.length }, { key: "rejected", label: "❌ Rejected", count: rejected.length }].map(t => (
          <button key={t.key} style={{ ...VR.tab, ...(activeTab === t.key ? VR.tabActive : {}) }} onClick={() => { setActiveTab(t.key); setSelected(null); }}>
            {t.label} <span style={VR.tabCount}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={VR.layout} className="vr-layout">
        <div style={VR.list} className="vr-list">
          {list.length === 0 && <div style={VR.empty}><p style={{ fontSize: "36px", margin: "0 0 8px" }}>{activeTab === "pending" ? "🎉" : "📋"}</p><p style={{ color: "#9ca3af" }}>No {activeTab} verifications.</p></div>}
          {list.map(l => (
            <div key={l.id} style={{ ...VR.listItem, ...(selected?.id === l.id ? VR.listItemActive : {}) }} onClick={() => { setSelected(l); setNote(""); }}>
              <div style={VR.listAvatar}>{l.full_name?.charAt(0)?.toUpperCase() || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={VR.listName}>{l.full_name || "No name"}</p>
                <p style={VR.listSub}>{l.phone || "No phone"}</p>
              </div>
                <span style={l.status === "approved" ? VR.badgeGreen : l.status === "rejected" ? VR.badgeRed : VR.badgeOrange}>
                  {l.status === "approved" ? "verified" : l.status}
                </span>
            </div>
          ))}
        </div>

        {selected ? (
          <div style={VR.reviewPanel}>
            <div style={VR.reviewHeader}>
              <h3 style={VR.reviewName}>{selected.full_name}</h3>
              <button style={VR.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={VR.infoGrid}>
              <InfoRow label="Phone"   value={selected.phone || "—"} />
              <InfoRow label="Company" value={selected.landlord_company || "—"} />
              <InfoRow label="Area"    value={selected.landlord_area || "—"} />
            </div>
            <div style={VR.docsSection}>
              <h4 style={VR.docsTitle}>📋 Submitted Documents</h4>
              <div style={VR.docsGrid} className="admin-docs-grid">
                <DocViewer title="🪪 National ID" url={selected.national_id_url} hint="Check: name, ID number, photo visible" />
                <DocViewer title="📄 Proof of Residence" url={selected.proof_of_residence_url} hint="Check: name matches ID, address visible, recent date" />
              </div>
              <div style={VR.matchCheck}>
                <p style={VR.matchCheckTitle}>✅ What to verify:</p>
                <div style={VR.checkList}>
                  {["Full name on National ID matches proof of residence", "ID photo matches landlord's profile name", "Address on proof of residence is in Zimbabwe", "Documents are clear and unaltered", "Proof of residence is recent (within 3 months)"].map((t, i) => (
                    <div key={i} style={VR.checkRow}><span style={VR.checkBox}>☐</span><span style={{ fontSize: "13px", color: "#374151" }}>{t}</span></div>
                  ))}
                </div>
              </div>
            </div>
            {selected.verification_status === "pending" && (
              <div style={VR.actions}>
                <div style={VR.noteWrap}>
                  <label style={VR.noteLabel}>Rejection reason (required if rejecting)</label>
                  <textarea style={VR.noteArea} placeholder="e.g. Name on ID does not match proof of residence…" value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <div style={VR.actionBtns}>
                  <button style={{ ...VR.rejectBtn,  ...(loading ? { opacity: 0.6 } : {}) }} onClick={() => handleReject(selected.id)} disabled={loading}>❌ Reject</button>
                  <button style={{ ...VR.approveBtn, ...(loading ? { opacity: 0.6 } : {}) }} onClick={() => handleVerify(selected.id)} disabled={loading}>✅ Verify Landlord</button>
                </div>
              </div>
            )}
            {selected.verification_status === "verified"  && <div style={VR.alreadyVerified}>✅ This landlord is verified.</div>}
            {selected.verification_status === "rejected"  && <div style={VR.alreadyRejected}><p style={{ margin: "0 0 4px", fontWeight: 700 }}>Rejection reason:</p><p style={{ margin: 0 }}>{selected.verification_note}</p></div>}
          </div>
        ) : (
          <div style={VR.emptyPanel}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>👈</p>
            <p style={{ fontWeight: 700, color: "#374151" }}>Select a landlord to review</p>
            <p style={{ fontSize: "13px", color: "#9ca3af" }}>Compare their National ID with their proof of residence</p>
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
            <div style={VR.docZoomHint}>🔍 Tap to enlarge</div>
          </div>
          <p style={VR.docHint}>{hint}</p>
          {enlarged && (
            <div style={VR.lightbox} onClick={() => setEnlarged(false)}>
              <img src={url} alt={title} style={VR.lightboxImg} />
              <p style={VR.lightboxClose}>Tap anywhere to close</p>
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
  return <div style={VR.infoRow}><span style={VR.infoLabel}>{label}</span><span style={VR.infoValue}>{value}</span></div>;
}

/* ─── STYLES ─── */
const V = {
  page:       { padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px)", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "680px", margin: "0 auto", width: "100%" },
  centered:   { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "16px" },
  spinner:    { width: "32px", height: "32px", border: "3px solid #ede9fe", borderTop: "3px solid #7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  progressRow: { display: "flex", alignItems: "center" },
  progressItem: { display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 },
  progressCircle: { width: "28px", height: "28px", borderRadius: "50%", background: "#e5e7eb", color: "#9ca3af", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  progressActive: { background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" },
  progressDone:   { background: "#7c3aed", color: "white" },
  progressLabel:  { fontSize: "11px", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  progressLine:   { flex: 1, height: "2px", background: "#e5e7eb", margin: "0 4px", minWidth: "8px" },
  progressLineDone: { background: "#7c3aed" },
  card:         { background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "clamp(20px, 4vw, 32px)", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
  cardTitle:    { fontSize: "clamp(16px, 3vw, 20px)", fontWeight: 900, color: "#111827", margin: "0 0 8px" },
  cardSub:      { fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 20px" },
  introIcon:    { fontSize: "44px", marginBottom: "12px" },
  requirementList: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" },
  requirement:  { display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", background: "#f8f7ff", borderRadius: "12px", border: "1px solid #ede9fe" },
  reqIcon:      { fontSize: "24px", flexShrink: 0 },
  reqTitle:     { margin: "0 0 4px", fontWeight: 700, fontSize: "14px", color: "#111827" },
  reqSub:       { margin: 0, fontSize: "12px", color: "#6b7280" },
  warningBox:   { display: "flex", alignItems: "flex-start", gap: "10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px 14px", marginBottom: "20px" },
  primaryBtn:   { width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 800, fontSize: "15px", cursor: "pointer" },
  disabledBtn:  { background: "#d1d5db", cursor: "not-allowed" },
  backBtn:      { padding: "12px 18px", borderRadius: "12px", border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  btnRow:       { display: "flex", gap: "10px", marginTop: "20px" },
  errorBox:     { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 14px", color: "#dc2626", fontSize: "13px", margin: "12px 0" },
  retryBtn:     { padding: "11px 22px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "14px", cursor: "pointer", marginTop: "16px" },
  successCard:  { background: "white", borderRadius: "16px", border: "1px solid #bbf7d0", padding: "clamp(28px, 6vw, 48px) clamp(20px, 4vw, 32px)", textAlign: "center" },
  successBadge: { fontSize: "52px", marginBottom: "14px" },
  successTitle: { fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 900, color: "#111827", margin: "0 0 10px" },
  successSub:   { fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 20px" },
  verifiedPill: { display: "inline-block", background: "#dcfce7", color: "#16a34a", padding: "10px 22px", borderRadius: "100px", fontWeight: 800, fontSize: "14px" },
  pendingCard:  { background: "white", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "clamp(28px, 6vw, 48px) clamp(20px, 4vw, 32px)", textAlign: "center" },
  pendingTitle: { fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 900, color: "#111827", margin: "0 0 10px" },
  pendingSub:   { fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" },
  pendingSteps: { display: "flex", flexDirection: "column", gap: "12px", textAlign: "left", maxWidth: "320px", margin: "0 auto" },
  pendingStep:  { display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "#374151" },
  stepDone:     { width: "24px", height: "24px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 },
  stepPending:  { width: "24px", height: "24px", borderRadius: "50%", background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 },
  rejectedCard: { background: "white", borderRadius: "16px", border: "1.5px solid #fecaca", padding: "clamp(28px, 6vw, 48px) clamp(20px, 4vw, 32px)", textAlign: "center" },
  rejectedTitle:{ fontSize: "clamp(16px, 3vw, 22px)", fontWeight: 900, color: "#dc2626", margin: "0 0 10px" },
  rejectionNote:{ background: "#fef2f2", borderRadius: "12px", padding: "14px", margin: "0 0 14px", textAlign: "left" },
};

const C = {
  wrap:       { display: "flex", flexDirection: "column", gap: "16px" },
  tipsCard:   { background: "#f8f7ff", border: "1px solid #ede9fe", borderRadius: "12px", padding: "14px" },
  tipsTitle:  { fontSize: "12px", fontWeight: 800, color: "#7c3aed", margin: "0 0 8px" },
  tip:        { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" },
  tipDot:     { color: "#16a34a", fontWeight: 700, fontSize: "12px", flexShrink: 0, marginTop: "1px" },
  promptWrap: { background: "#f9fafb", borderRadius: "14px", border: "2px dashed #e5e7eb", padding: "clamp(24px, 5vw, 40px) 20px", textAlign: "center" },
  promptIcon: { fontSize: "44px", marginBottom: "10px" },
  promptTitle:{ fontSize: "16px", fontWeight: 800, color: "#111827", margin: "0 0 6px" },
  promptSub:  { fontSize: "13px", color: "#9ca3af", margin: "0 0 18px" },
  errorBox:   { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 12px", color: "#dc2626", fontSize: "13px", margin: "0 0 14px" },
  openCameraBtn: { padding: "12px 26px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, fontSize: "15px", cursor: "pointer" },
  /* ── Camera wrapper: use min-height instead of aspect-ratio for browser compat ── */
  cameraWrap: { position: "relative", borderRadius: "14px", overflow: "hidden", background: "#000", minHeight: "240px", display: "flex", alignItems: "center", justifyContent: "center" },
  video:      { width: "100%", height: "100%", minHeight: "240px", objectFit: "cover", display: "block" },
  viewfinder: { position: "absolute", inset: "10%", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "10px", pointerEvents: "none" },
  camErrBox:  { position: "absolute", top: "44px", left: "10px", right: "10px", background: "rgba(127,29,29,0.92)", border: "1px solid rgba(252,165,165,0.8)", borderRadius: "8px", padding: "8px 12px", color: "white", fontSize: "12px", fontWeight: 600, zIndex: 5 },
  cameraControls: { position: "absolute", bottom: "14px", left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: "20px" },
  flipBtn:    { width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "white", fontSize: "18px", cursor: "pointer" },
  captureBtn: { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "4px solid rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  captureInner: { width: "48px", height: "48px", borderRadius: "50%", background: "white", border: "3px solid #ccc" },
  cancelBtn:  { width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "white", fontSize: "16px", cursor: "pointer" },
  cameraHint: { position: "absolute", top: "10px", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: "12px", fontWeight: 600 },
  previewWrap:    { position: "relative", borderRadius: "14px", overflow: "hidden" },
  previewImg:     { width: "100%", display: "block" },
  previewOverlay: { position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.65)", borderRadius: "8px", padding: "5px 10px" },
  previewCheck:   { color: "white", fontSize: "12px", fontWeight: 700 },
  retakeBtn:      { position: "absolute", bottom: "10px", right: "10px", padding: "7px 14px", borderRadius: "9px", border: "none", background: "rgba(0,0,0,0.7)", color: "white", fontWeight: 700, fontSize: "12px", cursor: "pointer" },
};

const VR = {
  wrap:        { display: "flex", flexDirection: "column" },
  tabs:        { display: "flex", borderBottom: "1px solid #e5e7eb", overflowX: "auto" },
  tab:         { padding: "11px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#6b7280", fontWeight: 600, borderBottom: "2px solid transparent", whiteSpace: "nowrap" },
  tabActive:   { color: "#7c3aed", borderBottom: "2px solid #7c3aed" },
  tabCount:    { background: "#f3f4f6", color: "#6b7280", borderRadius: "20px", padding: "1px 7px", fontSize: "11px", marginLeft: "5px" },
  layout:      { display: "flex", alignItems: "flex-start", minHeight: "400px" },
  list:        { width: "260px", minWidth: "220px", borderRight: "1px solid #e5e7eb", padding: "14px" },
  listItem:    { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "10px", cursor: "pointer", marginBottom: "6px", border: "1px solid transparent" },
  listItemActive: { background: "#faf5ff", border: "1px solid #ede9fe" },
  listAvatar:  { width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", flexShrink: 0 },
  listName:    { margin: "0 0 2px", fontWeight: 700, fontSize: "13px", color: "#111827" },
  listSub:     { margin: 0, fontSize: "11px", color: "#9ca3af" },
  badgeGreen:  { background: "#dcfce7", color: "#16a34a", padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" },
  badgeRed:    { background: "#fee2e2", color: "#dc2626", padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" },
  badgeOrange: { background: "#fef3c7", color: "#d97706", padding: "2px 7px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" },
  reviewPanel: { flex: 1, padding: "18px 20px", overflowY: "auto", minWidth: 0 },
  reviewHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
  reviewName:  { margin: 0, fontSize: "17px", fontWeight: 800, color: "#111827" },
  closeBtn:    { background: "#f3f4f6", border: "none", width: "28px", height: "28px", borderRadius: "50%", cursor: "pointer" },
  infoGrid:    { display: "flex", flexDirection: "column", gap: "6px", background: "#f9fafb", borderRadius: "10px", padding: "12px", marginBottom: "16px" },
  infoRow:     { display: "flex", justifyContent: "space-between", gap: "8px" },
  infoLabel:   { fontSize: "11px", color: "#9ca3af", fontWeight: 600 },
  infoValue:   { fontSize: "12px", color: "#111827", fontWeight: 600, textAlign: "right" },
  docsSection: { marginBottom: "16px" },
  docsTitle:   { fontSize: "14px", fontWeight: 800, color: "#374151", margin: "0 0 12px" },
  docsGrid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" },
  docCard:     { background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: "hidden" },
  docTitle:    { margin: 0, padding: "8px 10px", fontSize: "12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" },
  docImgWrap:  { position: "relative", cursor: "zoom-in" },
  docImg:      { width: "100%", display: "block", maxHeight: "160px", objectFit: "cover" },
  docZoomHint: { position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" },
  docHint:     { fontSize: "10px", color: "#9ca3af", padding: "6px 10px", margin: 0 },
  docMissing:  { padding: "24px", textAlign: "center", color: "#dc2626", fontWeight: 700, fontSize: "13px" },
  lightbox:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "zoom-out", padding: "16px" },
  lightboxImg: { maxWidth: "100%", maxHeight: "85vh", borderRadius: "10px", objectFit: "contain" },
  lightboxClose: { color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "10px" },
  matchCheck:  { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 14px" },
  matchCheckTitle: { margin: "0 0 8px", fontSize: "12px", fontWeight: 800, color: "#16a34a" },
  checkList:   { display: "flex", flexDirection: "column", gap: "6px" },
  checkRow:    { display: "flex", alignItems: "flex-start", gap: "8px" },
  checkBox:    { fontSize: "14px", color: "#9ca3af", flexShrink: 0 },
  actions:     { borderTop: "1px solid #e5e7eb", paddingTop: "14px" },
  noteWrap:    { marginBottom: "12px" },
  noteLabel:   { fontSize: "12px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "5px" },
  noteArea:    { width: "100%", minHeight: "70px", borderRadius: "9px", border: "1.5px solid #e5e7eb", padding: "9px", fontSize: "13px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  actionBtns:  { display: "flex", gap: "8px" },
  rejectBtn:   { flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "13px", cursor: "pointer" },
  approveBtn:  { flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white", fontWeight: 800, fontSize: "13px", cursor: "pointer" },
  alreadyVerified: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px", color: "#16a34a", fontWeight: 700, textAlign: "center", fontSize: "14px" },
  alreadyRejected: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px", color: "#dc2626", fontSize: "13px" },
  empty:       { textAlign: "center", padding: "32px 16px" },
  emptyPanel:  { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", textAlign: "center" },
};
