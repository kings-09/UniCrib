import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&auto=format&fit=crop&q=80",
];

const FEATURES = [
  {
    icon: "🔍",
    title: "Smart Search",
    desc: "Filter by price, institution proximity, and availability — find the right place in seconds.",
  },
  {
    icon: "📍",
    title: "Near Your Campus",
    desc: "See properties within walking distance of HIT, UZ, BTTC and more Harare institutions.",
  },
  {
    icon: "🛡️",
    title: "Verified Listings",
    desc: "Every property is reviewed and approved before going live. No scams, no surprises.",
  },
  {
    icon: "💳",
    title: "Secure Payments",
    desc: "Pay your deposit safely through our platform. Full payment history at your fingertips.",
  },
  {
    icon: "👥",
    title: "Roommate Matching",
    desc: "Find compatible flatmates studying at the same institution — coming soon.",
  },
  {
    icon: "⭐",
    title: "Honest Reviews",
    desc: "Read real reviews from students who have lived there. Rate your own stay.",
  },
];

const LISTINGS = [
  {
    img: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&auto=format&fit=crop&q=80",
    title: "Modern Studio near HIT",
    price: 180,
    badge: "AVAILABLE",
    dist: "0.4 km from HIT",
  },
  {
    img: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&auto=format&fit=crop&q=80",
    title: "Cosy 2-Bed Flat near UZ",
    price: 250,
    badge: "AVAILABLE",
    dist: "0.9 km from UZ",
  },
  {
    img: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&auto=format&fit=crop&q=80",
    title: "En-Suite Room near BTTC",
    price: 130,
    badge: "FULL",
    dist: "0.2 km from BTTC",
  },
];

const STEPS = [
  { n: "01", title: "Create your account", desc: "Sign up as a student or landlord in under a minute." },
  { n: "02", title: "Browse & filter", desc: "Search listings by campus, price range, and availability." },
  { n: "03", title: "Request & pay", desc: "Send a booking request and pay your deposit securely online." },
  { n: "04", title: "Move in!", desc: "Get approved, collect your keys, and settle into your new home." },
];


export default function Home() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={S.page}>
      {/* ── NAVBAR ── */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <span style={S.navLogo}>🏠 UniCrib</span>
          <div style={S.navLinks}>
            <a href="#features" style={S.navLink}>Features</a>
            <a href="#listings" style={S.navLink}>Listings</a>
            <a href="#how" style={S.navLink}>How it works</a>
          </div>
          <div style={S.navCta}>
            <Link to="/login"><button style={S.navBtnOutline}>Login</button></Link>
            <Link to="/signup"><button style={S.navBtnFill}>Sign Up</button></Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={S.hero}>
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            style={{
              ...S.heroBg,
              backgroundImage: `url(${src})`,
              opacity: heroIdx === i ? 1 : 0,
              transition: "opacity 1.2s ease",
            }}
          />
        ))}
        <div style={S.heroOverlay} />
        <div style={{ ...S.heroContent, opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(24px)", transition: "all 0.8s ease" }}>
          <span style={S.heroBadge}>🎓 Built for students in Harare</span>
          <h1 style={S.heroTitle}>
            Find your perfect<br />student home
          </h1>
          <p style={S.heroSub}>
            Verified accommodation near HIT, UZ, BTTC and more —<br />
            searched, booked, and paid for entirely online.
          </p>
          <div style={S.heroButtons}>
            <Link to="/signup">
              <button style={S.heroPrimaryBtn}>Get Started Free →</button>
            </Link>
            <a href="#listings">
              <button style={S.heroOutlineBtn}>Browse Listings</button>
            </a>
          </div>
          <div style={S.heroStats}>
            {[["200+", "Listings"], ["5", "Institutions"], ["100%", "Verified"]].map(([v, l]) => (
              <div key={l} style={S.heroStat}>
                <span style={S.heroStatVal}>{v}</span>
                <span style={S.heroStatLabel}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* dots */}
        <div style={S.heroDots}>
          {HERO_IMAGES.map((_, i) => (
            <button key={i} onClick={() => setHeroIdx(i)}
              style={{ ...S.heroDot, opacity: heroIdx === i ? 1 : 0.4, transform: heroIdx === i ? "scale(1.3)" : "scale(1)" }} />
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={S.section}>
        <div style={S.sectionInner}>
          <p style={S.sectionEyebrow}>WHY UNICRIB</p>
          <h2 style={S.sectionTitle}>Everything you need to find your next home</h2>
          <div style={S.featuresGrid}>
            {FEATURES.map(f => (
              <div key={f.title} style={S.featureCard}>
                <span style={S.featureIcon}>{f.icon}</span>
                <h3 style={S.featureTitle}>{f.title}</h3>
                <p style={S.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LISTINGS PREVIEW ── */}
      <section id="listings" style={{ ...S.section, backgroundColor: "#f8f7ff" }}>
        <div style={S.sectionInner}>
          <p style={S.sectionEyebrow}>SAMPLE LISTINGS</p>
          <h2 style={S.sectionTitle}>Properties near your campus</h2>
          <div style={S.listingsGrid}>
            {LISTINGS.map(l => (
              <div key={l.title} style={S.listingCard}>
                <div style={S.listingImgWrap}>
                  <img src={l.img} alt={l.title} style={S.listingImg} />
                  <span style={l.badge === "FULL" ? S.badgeRed : S.badgeGreen}>{l.badge}</span>
                </div>
                <div style={S.listingBody}>
                  <h3 style={S.listingTitle}>{l.title}</h3>
                  <p style={S.listingDist}>📍 {l.dist}</p>
                  <div style={S.listingFooter}>
                    <span style={S.listingPrice}>${l.price}<span style={S.listingPriceSub}>/mo</span></span>
                    <Link to="/signup">
                      <button style={S.listingBtn}>View →</button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "36px" }}>
            <Link to="/signup">
              <button style={S.heroPrimaryBtn}>Sign up to see all listings →</button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={S.section}>
        <div style={S.sectionInner}>
          <p style={S.sectionEyebrow}>HOW IT WORKS</p>
          <h2 style={S.sectionTitle}>Renting made ridiculously easy</h2>
          <div style={S.stepsGrid}>
            {STEPS.map((step, i) => (
              <div key={step.n} style={S.stepCard}>
                <div style={S.stepNum}>{step.n}</div>
                {i < STEPS.length - 1 && <div style={S.stepConnector} />}
                <h3 style={S.stepTitle}>{step.title}</h3>
                <p style={S.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={S.ctaBanner}>
        <div style={S.ctaInner}>
          <h2 style={S.ctaTitle}>Ready to find your new home?</h2>
          <p style={S.ctaSub}>Join hundreds of students already using UniCrib across Harare.</p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/signup"><button style={S.ctaPrimaryBtn}>Create Free Account</button></Link>
            <Link to="/login"><button style={S.ctaOutlineBtn}>I already have an account</button></Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={S.footer}>
        <span style={S.footerLogo}>🏠 UniCrib</span>
        <p style={S.footerText}>© {new Date().getFullYear()} UniCrib · Built for students in Harare, Zimbabwe</p>
      </footer>
    </div>
  );
}

const S = {
  page: { fontFamily: "'Segoe UI', sans-serif", backgroundColor: "#ffffff", color: "#111827", overflowX: "hidden" },

  /* Nav */
  nav: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e5e7eb" },
  navInner: { maxWidth: "1180px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  navLogo: { fontSize: "20px", fontWeight: 800, color: "#7c3aed" },
  navLinks: { display: "flex", gap: "28px" },
  navLink: { textDecoration: "none", color: "#374151", fontWeight: 500, fontSize: "15px" },
  navCta: { display: "flex", gap: "10px" },
  navBtnOutline: { padding: "8px 18px", border: "1.5px solid #7c3aed", borderRadius: "10px", background: "transparent", color: "#7c3aed", fontWeight: 700, cursor: "pointer", fontSize: "14px" },
  navBtnFill: { padding: "8px 18px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "14px" },

  /* Hero */
  hero: { position: "relative", height: "100vh", minHeight: "600px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroBg: { position: "absolute", inset: 0, backgroundSize: "cover", backgroundPosition: "center" },
  heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(44,20,90,0.78) 0%, rgba(30,27,75,0.65) 100%)" },
  heroContent: { position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px", maxWidth: "760px" },
  heroBadge: { display: "inline-block", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: "100px", padding: "6px 16px", fontSize: "14px", fontWeight: 600, marginBottom: "24px" },
  heroTitle: { fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 900, color: "white", lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-1px" },
  heroSub: { fontSize: "18px", color: "rgba(255,255,255,0.82)", lineHeight: 1.7, margin: "0 0 36px" },
  heroButtons: { display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginBottom: "48px" },
  heroPrimaryBtn: { padding: "14px 28px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", border: "none", borderRadius: "12px", fontWeight: 800, fontSize: "16px", cursor: "pointer" },
  heroOutlineBtn: { padding: "14px 28px", background: "rgba(255,255,255,0.12)", color: "white", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "12px", fontWeight: 700, fontSize: "16px", cursor: "pointer" },
  heroStats: { display: "flex", gap: "40px", justifyContent: "center" },
  heroStat: { display: "flex", flexDirection: "column", alignItems: "center" },
  heroStatVal: { fontSize: "28px", fontWeight: 900, color: "white" },
  heroStatLabel: { fontSize: "13px", color: "rgba(255,255,255,0.65)", fontWeight: 500 },
  heroDots: { position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "8px", zIndex: 3 },
  heroDot: { width: "8px", height: "8px", borderRadius: "50%", background: "white", border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0 },

  /* Sections */
  section: { padding: "88px 24px" },
  sectionInner: { maxWidth: "1180px", margin: "0 auto" },
  sectionEyebrow: { fontSize: "12px", fontWeight: 800, color: "#7c3aed", letterSpacing: "0.12em", marginBottom: "12px" },
  sectionTitle: { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#111827", margin: "0 0 48px", lineHeight: 1.2, letterSpacing: "-0.5px" },

  /* Features */
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" },
  featureCard: { background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: "16px", padding: "28px 24px" },
  featureIcon: { fontSize: "32px", display: "block", marginBottom: "16px" },
  featureTitle: { fontSize: "17px", fontWeight: 800, color: "#111827", margin: "0 0 8px" },
  featureDesc: { fontSize: "15px", color: "#6b7280", lineHeight: 1.65, margin: 0 },

  /* Listings */
  listingsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" },
  listingCard: { background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.07)", overflow: "hidden" },
  listingImgWrap: { position: "relative", height: "200px" },
  listingImg: { width: "100%", height: "100%", objectFit: "cover" },
  badgeGreen: { position: "absolute", top: "12px", right: "12px", background: "#16a34a", color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  badgeRed: { position: "absolute", top: "12px", right: "12px", background: "#dc2626", color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  listingBody: { padding: "18px" },
  listingTitle: { fontSize: "16px", fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  listingDist: { fontSize: "13px", color: "#2563eb", margin: "0 0 14px" },
  listingFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  listingPrice: { fontSize: "22px", fontWeight: 900, color: "#7c3aed" },
  listingPriceSub: { fontSize: "13px", color: "#9ca3af", fontWeight: 400 },
  listingBtn: { padding: "8px 18px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer", fontSize: "14px" },

  /* Steps */
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "24px" },
  stepCard: { position: "relative", padding: "28px 20px 20px", background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: "16px" },
  stepNum: { fontSize: "36px", fontWeight: 900, color: "#ede9fe", marginBottom: "12px", lineHeight: 1 },
  stepConnector: { display: "none" },
  stepTitle: { fontSize: "16px", fontWeight: 800, color: "#111827", margin: "0 0 8px" },
  stepDesc: { fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: 0 },

  /* CTA */
  ctaBanner: { background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)", padding: "80px 24px" },
  ctaInner: { maxWidth: "680px", margin: "0 auto", textAlign: "center" },
  ctaTitle: { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "white", margin: "0 0 16px", letterSpacing: "-0.5px" },
  ctaSub: { fontSize: "18px", color: "rgba(255,255,255,0.8)", margin: "0 0 36px" },
  ctaPrimaryBtn: { padding: "14px 28px", background: "white", color: "#7c3aed", border: "none", borderRadius: "12px", fontWeight: 800, fontSize: "16px", cursor: "pointer" },
  ctaOutlineBtn: { padding: "14px 28px", background: "transparent", color: "white", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "12px", fontWeight: 700, fontSize: "16px", cursor: "pointer" },

  /* Footer */
  footer: { background: "#111827", padding: "32px 24px", textAlign: "center" },
  footerLogo: { fontSize: "18px", fontWeight: 800, color: "#7c3aed", display: "block", marginBottom: "8px" },
  footerText: { color: "#6b7280", fontSize: "14px", margin: 0 },
};
