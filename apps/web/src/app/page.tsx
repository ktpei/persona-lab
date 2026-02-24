"use client";

import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

// ─── Replace this with your actual YouTube video ID when ready ───
const YOUTUBE_VIDEO_ID = "YOUR_VIDEO_ID_HERE";

export default function LandingPage() {
  return (
    <div
      className={instrumentSerif.variable}
      style={{ backgroundColor: "#1F1A17", color: "#f5f2ef", minHeight: "100vh" }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          height: "52px",
          borderBottom: "1px solid rgba(58,53,48,0.6)",
          backgroundColor: "rgba(31,26,23,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              backgroundColor: "rgba(122,146,176,0.15)",
            }}
          >
            <FlaskConical size={14} color="#7A92B0" />
          </div>
          <span
            style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#f5f2ef",
            }}
          >
            Persona<em style={{ fontStyle: "italic" }}>Lab</em>
          </span>
        </div>

        {/* Nav link */}
        <Link
          href="/dashboard"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "rgba(245,242,239,0.45)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f2ef")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,242,239,0.45)")}
        >
          Enter App →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 52px)",
          padding: "80px 2rem 120px",
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        {/* Animated rings */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: "absolute",
              width: "720px",
              height: "720px",
              borderRadius: "50%",
              border: "1px dashed rgba(122,146,176,0.12)",
              animation: "land-ring-spin 90s linear infinite",
            }}
          />
          {/* Middle ring */}
          <div
            style={{
              position: "absolute",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              border: "1px dashed rgba(122,146,176,0.18)",
              animation: "land-ring-spin-reverse 65s linear infinite",
            }}
          />
          {/* Inner ring */}
          <div
            style={{
              position: "absolute",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              border: "1px solid rgba(122,146,176,0.10)",
              animation: "land-ring-spin 40s linear infinite",
            }}
          />
          {/* Center dot */}
          <div
            style={{
              position: "absolute",
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: "rgba(122,146,176,0.4)",
            }}
          />
          {/* Radial gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 30%, #1F1A17 75%)",
            }}
          />
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "760px" }}>
          {/* Overline */}
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.18em",
              color: "rgba(122,146,176,0.7)",
              textTransform: "uppercase",
              marginBottom: "28px",
              animation: "land-fade-up 0.7s ease both",
              animationDelay: "0.1s",
              opacity: 0,
            }}
          >
            AI · UX Simulation
          </p>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-display), 'Georgia', serif",
              fontStyle: "italic",
              fontSize: "clamp(48px, 7vw, 84px)",
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: "#f5f2ef",
              marginBottom: "28px",
              animation: "land-fade-up 0.7s ease both",
              animationDelay: "0.25s",
              opacity: 0,
            }}
          >
            See your product<br />
            through every<br />
            type of user.
          </h1>

          {/* Subline */}
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              lineHeight: 1.75,
              color: "rgba(245,242,239,0.45)",
              letterSpacing: "0.01em",
              marginBottom: "48px",
              animation: "land-fade-up 0.7s ease both",
              animationDelay: "0.4s",
              opacity: 0,
            }}
          >
            Upload screenshots. Define personas.<br />
            Get usability findings powered by AI.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
              animation: "land-fade-up 0.7s ease both",
              animationDelay: "0.55s",
              opacity: 0,
            }}
          >
            {/* Primary CTA */}
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                backgroundColor: "#7A92B0",
                color: "#141a1f",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.04em",
                borderRadius: "3px",
                textDecoration: "none",
                transition: "background-color 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#8fa3bf";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#7A92B0";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Sign Up
              <span style={{ opacity: 0.7 }}>→</span>
            </Link>

            {/* Secondary CTA */}
            <a
              href="#demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                color: "rgba(245,242,239,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                letterSpacing: "0.04em",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,242,239,0.75)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,242,239,0.4)")}
            >
              Watch demo ↓
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            animation: "land-fade-up 0.7s ease both",
            animationDelay: "0.9s",
            opacity: 0,
          }}
        >
          <div
            style={{
              width: "1px",
              height: "40px",
              background:
                "linear-gradient(to bottom, rgba(122,146,176,0.5), transparent)",
            }}
          />
        </div>
      </section>

      {/* ── Video Section ── */}
      <section
        id="demo"
        style={{
          padding: "100px 2rem 120px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(58,53,48,0.8)", maxWidth: "120px" }} />
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "rgba(122,146,176,0.6)",
              textTransform: "uppercase",
            }}
          >
            See it in action
          </p>
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(58,53,48,0.8)", maxWidth: "120px" }} />
        </div>

        {/* Video embed */}
        <div
          style={{
            width: "100%",
            maxWidth: "900px",
            aspectRatio: "16 / 9",
            borderRadius: "4px",
            border: "1px solid rgba(58,53,48,0.8)",
            overflow: "hidden",
            backgroundColor: "#141210",
          }}
        >
          {YOUTUBE_VIDEO_ID === "YOUR_VIDEO_ID_HERE" ? (
            // Placeholder shown before the YouTube ID is set
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  border: "1px solid rgba(122,146,176,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    borderLeft: "14px solid rgba(122,146,176,0.4)",
                    marginLeft: "3px",
                  }}
                />
              </div>
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  color: "rgba(245,242,239,0.2)",
                  letterSpacing: "0.06em",
                }}
              >
                Video coming soon
              </p>
            </div>
          ) : (
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`}
              title="PersonaLab Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid rgba(58,53,48,0.5)",
          padding: "24px 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            color: "rgba(245,242,239,0.2)",
            letterSpacing: "0.04em",
          }}
        >
          © 2026 PersonaLab
        </p>
        <Link
          href="/dashboard"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            color: "rgba(245,242,239,0.2)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,242,239,0.5)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,242,239,0.2)")}
        >
          Enter App →
        </Link>
      </footer>
    </div>
  );
}
