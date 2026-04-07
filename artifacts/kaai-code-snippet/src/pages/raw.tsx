import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Copy, Check, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = "";

export default function RawView() {
  const params = useParams();
  const id = params.id as string;
  const [code, setCode] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_BASE}/api/snippets/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.code) {
          setCode(d.code);
          setLanguage(d.language || "");
          setTitle(d.title || "");
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lines = code?.split("\n") ?? [];

  const baseStyle: React.CSSProperties = {
    margin: 0,
    padding: 0,
    background: "#0a0a0a",
    color: "#d4d4d4",
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'monospace'",
    fontSize: "13px",
    lineHeight: "1.65",
    minHeight: "100vh",
    tabSize: 2,
    overflowX: "auto",
  };

  if (loading) {
    return (
      <div style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#555" }}>
        <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
        <span>Loading...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#555", padding: "2rem" }}>
        <AlertCircle style={{ width: 20, height: 20 }} />
        <span style={{ fontSize: "14px" }}>Snippet tidak ditemukan atau belum disetujui.</span>
        <span style={{ fontSize: "11px", opacity: 0.5 }}>ID: {id}</span>
      </div>
    );
  }

  return (
    <div style={baseStyle}>
      {/* Toolbar */}
      <div style={{
        position: "sticky",
        top: 0,
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #1e1e1e",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace" }}>raw</span>
          <span style={{ color: "#333", fontSize: "11px" }}>·</span>
          {language && (
            <span style={{ fontSize: "11px", color: "#4a9eff", background: "rgba(74,158,255,0.08)", padding: "1px 7px", borderRadius: "4px", border: "1px solid rgba(74,158,255,0.15)" }}>
              {language}
            </span>
          )}
          {title && (
            <span style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "#444" }}>{lines.length} baris</span>
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: copied ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${copied ? "rgba(74,222,128,0.2)" : "#2a2a2a"}`,
              color: copied ? "#4ade80" : "#888",
              borderRadius: "6px",
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copied ? "Tersalin!" : "Salin"}
          </button>
        </div>
      </div>

      {/* Code with line numbers */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 42px)" }}>
        {/* Line numbers */}
        <div style={{
          userSelect: "none",
          padding: "16px 12px 16px 16px",
          minWidth: "52px",
          textAlign: "right",
          color: "#3a3a3a",
          fontSize: "12px",
          lineHeight: "1.65",
          borderRight: "1px solid #161616",
          flexShrink: 0,
        }}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code content */}
        <pre style={{
          margin: 0,
          padding: "16px 20px",
          flex: 1,
          color: "#d4d4d4",
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          whiteSpace: "pre",
          overflowX: "auto",
          wordBreak: "normal",
        }}>
          {code ?? ""}
        </pre>
      </div>
    </div>
  );
}
