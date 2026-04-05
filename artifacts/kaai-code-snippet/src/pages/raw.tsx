import { useState, useEffect } from "react";
import { useParams } from "wouter";

const API_BASE = "";

export default function RawView() {
  const params = useParams();
  const id = params.id as string;
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/snippets/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.code) {
          setCode(d.code);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <pre
        style={{
          margin: 0,
          padding: "2rem",
          background: "#000",
          color: "#666",
          fontFamily: "monospace",
          fontSize: "13px",
          minHeight: "100vh",
        }}
      >
        snippet not found
      </pre>
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: "2rem",
        background: "#000",
        color: "#d4d4d4",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        fontSize: "13px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        minHeight: "100vh",
        tabSize: 2,
      }}
    >
      {code ?? ""}
    </pre>
  );
}
