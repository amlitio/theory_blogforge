"use client";

import { useState, useRef, useEffect } from "react";

const C = {
  bg: "#0a0a0f", surface: "#111118", border: "#1e1e2e",
  gold: "#d4a847", goldDim: "#8a6c2a", amber: "#f59e0b",
  green: "#22c55e", red: "#ef4444",
  muted: "#4a4a6a", text: "#e2e2f0", textDim: "#8888aa",
};

const AGENTS = [
  {
    id: "scriptor",
    icon: "✍",
    name: "REX SCRIPTOR",
    title: "Master Wordsmith",
    color: "#d4a847",
    glow: "rgba(212,168,71,0.3)",
    role: "Forges the first draft from your question",
    useSearch: false,
    searchLabel: null,
  },
  {
    id: "explorator",
    icon: "🔭",
    name: "REX EXPLORATOR",
    title: "Intelligence Scout",
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.3)",
    role: "Live web search — finds real sources & data",
    useSearch: true,
    searchLabel: "🌐 LIVE SEARCH",
  },
  {
    id: "veritas",
    icon: "⚖",
    name: "REX VERITAS",
    title: "Truth Arbiter",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.3)",
    role: "Live web search — verifies every claim",
    useSearch: true,
    searchLabel: "🌐 LIVE VERIFY",
  },
  {
    id: "curator",
    icon: "👑",
    name: "REX CURATOR",
    title: "Grand Publisher",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
    role: "Synthesises all intel into the final post",
    useSearch: false,
    searchLabel: null,
  },
] as const;

type AgentId = "scriptor" | "explorator" | "veritas" | "curator";
type Status = "idle" | "active" | "done" | "error";

// ── Prompts ────────────────────────────────────────────────────────────────
function scriptorPrompt(q: string) {
  return `You are REX SCRIPTOR of the BlogForge Council — a master content strategist and writer.

Write a complete, high-quality blog post draft for: "${q}"

Format your response EXACTLY like this:

[NARRATIVE]: (2 sentences in character — what you are forging and why it matters)

[TECHNICAL]:
# (Compelling, SEO-optimised title)
**Meta Description:** (150 chars, keyword-rich)
**Keywords:** primary, secondary, tertiary
**Read Time:** X min

---

## Introduction
(Hook — surprising stat or bold claim. 3–4 sentences.)

## (Section 2 Title)
(Core insight. 150 words of real substance.)

## (Section 3 Title)
(Deeper angle or practical advice. 150 words.)

## Key Takeaways
- Takeaway 1
- Takeaway 2
- Takeaway 3

## Conclusion
(Memorable close + clear CTA. 2–3 sentences.)

---
**Tone:** Professional | **Grade:** Expert`;
}

function exploratorPrompt(q: string, draft: string) {
  return `You are REX EXPLORATOR of the BlogForge Council — an intelligence scout. Use web search to find REAL, current sources for this blog post topic.

Topic: "${q}"
Draft summary: ${draft.slice(0, 400)}

Search the web to find:
1. 3–5 authoritative, real sources (major publications, research papers, .gov/.edu, industry leaders) that directly support this topic — include actual URLs
2. 2–3 recent statistics or data points with their sources
3. What competing articles exist and their angles
4. Any recent news or developments in the last 12 months

Format your response EXACTLY like this:

[NARRATIVE]: (2 sentences in character — describe what you found on the web)

[TECHNICAL]:
## 🌐 Live Sources Found
1. [Title](URL) — Publication | Key finding | Date
2. [Title](URL) — Publication | Key finding | Date
3. [Title](URL) — Publication | Key finding | Date

## 📊 Real Statistics Found
- Stat 1 with source
- Stat 2 with source
- Stat 3 with source

## 🔍 Competing Content Landscape
- Article angle 1 — gap we can exploit
- Article angle 2 — gap we can exploit

## 💡 Content Opportunities
(What unique angle or depth our post should own, 2–3 sentences)`;
}

function veritasPrompt(q: string, draft: string, sources: string) {
  return `You are REX VERITAS of the BlogForge Council — the uncompromising Truth Arbiter. Use web search to VERIFY the specific factual claims in this draft.

Topic: "${q}"
Draft to fact-check: ${draft.slice(0, 600)}
Sources already found: ${sources.slice(0, 300)}

Search the web to verify each specific claim — statistics, dates, named studies, attributed quotes, concrete assertions.

Format your response EXACTLY like this:

[NARRATIVE]: (2 sentences in character — describe your interrogation of the evidence)

[TECHNICAL]:
## ✅ Verified Claims
- Claim — Source: [Name](URL) — Confidence: HIGH/MED

## ⚠️ Needs Citation
- Claim — why it needs sourcing — suggested search

## ❌ Flagged / Incorrect
- Claim — what is wrong — corrected version with source

## 🔄 Outdated Information
- Any claims that have changed recently — current status

## Accuracy Score: (X/100)

## ✏️ Corrections for Curator
(Specific line-by-line edit instructions)`;
}

function curatorPrompt(q: string, draft: string, sources: string, factcheck: string) {
  return `You are REX CURATOR of the BlogForge Council — the Grand Publisher who seals the final artifact.

Topic: "${q}"
Original draft: ${draft.slice(0, 500)}
Live sources found: ${sources.slice(0, 350)}
Fact-check report: ${factcheck.slice(0, 350)}

Apply ALL corrections. Weave in the real sources as inline citations. Maximise SEO. Produce the definitive, publish-ready blog post.

Format your response EXACTLY like this:

[NARRATIVE]: (2 sentences declaring the post sealed and ready for publication)

[TECHNICAL]:
---FINAL POST START---

# (Final SEO-Optimised Title)
**Meta:** (150 chars) | **Slug:** /blog/(url-slug) | **Read:** X min | **Updated:** ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}

---

## Introduction
(Compelling hook with real stat, 3–4 sentences)

## (Section 2)
(150 words — cite sources inline as [Source Name](URL))

## (Section 3)
(150 words — deeper insight, more citations)

## Key Takeaways
- Point 1
- Point 2
- Point 3

## Conclusion
(Memorable close. Strong CTA.)

---FINAL POST END---

## 📊 SEO Scorecard
- **Title:** X/10 | **Keyword Density:** X% | **Readability:** Grade X | **Source Authority:** X/10 | **Overall:** X/100

## 🚀 Distribution Recommendations
1. (Platform + specific angle + suggested headline)
2. (Platform + specific angle + suggested headline)
3. (Email subject line suggestion)`;
}

// ── API ────────────────────────────────────────────────────────────────────
async function callAgent(prompt: string, useSearch: boolean): Promise<{ text: string; toolRounds?: number }> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, useSearch }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  if (!data.text?.trim()) {
    throw new Error("Agent returned empty response — please try again.");
  }

  return { text: data.text, toolRounds: data.toolRounds };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseSections(text: string) {
  const narMatch = text.match(/\[NARRATIVE\][:\s]*([\s\S]*?)(?=\[TECHNICAL\])/i);
  const techMatch = text.match(/\[TECHNICAL\][:\s]*([\s\S]*)$/i);
  return {
    narrative: narMatch ? narMatch[1].trim() : text.slice(0, 200),
    technical: techMatch ? techMatch[1].trim() : text,
  };
}

function extractFinal(text: string) {
  const m = text.match(/---FINAL POST START---([\s\S]*?)---FINAL POST END---/);
  return m ? m[1].trim() : null;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Badge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; color: string }> = {
    idle:   { label: "STANDBY",      bg: "#1e1e2e", color: C.muted  },
    active: { label: "DELIBERATING", bg: "#1a1a0a", color: C.amber  },
    done:   { label: "SEALED",       bg: "#0a1a0a", color: C.green  },
    error:  { label: "FAILED",       bg: "#1a0a0a", color: C.red    },
  };
  const s = map[status];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", background: s.bg, color: s.color, fontWeight: 700, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

function Dots() {
  const [d, setD] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setD(x => (x + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: C.amber, fontFamily: "monospace" }}>{"●".repeat(d)}{"○".repeat(3 - d)}</span>;
}

function AgentCard({ agent, status, narrative, technical, toolRounds }: {
  agent: typeof AGENTS[number];
  status: Status;
  narrative: string;
  technical: string;
  toolRounds?: number;
}) {
  const [tab, setTab] = useState<"narrative" | "technical">("narrative");
  const isActive = status === "active";
  const isDone = status === "done";

  return (
    <div style={{ background: C.surface, border: `1px solid ${isActive ? agent.color : C.border}`, borderRadius: 12, padding: "20px 22px", position: "relative", overflow: "hidden", boxShadow: isActive ? `0 0 24px ${agent.glow}` : "none", transition: "all 0.4s" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isDone ? agent.color : isActive ? agent.color : C.border, opacity: isActive || isDone ? 1 : 0.3, transition: "all 0.4s" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: isActive || isDone ? `${agent.color}18` : "#1a1a2e", border: `1px solid ${isActive || isDone ? agent.color : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: isActive ? `0 0 12px ${agent.glow}` : "none" }}>
          {agent.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: agent.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>{agent.name}</span>
            <Badge status={status} />
            {agent.searchLabel && (
              <span style={{ background: "#0a1520", border: "1px solid #06b6d440", color: "#06b6d4", padding: "1px 7px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.06em" }}>
                {agent.searchLabel}
              </span>
            )}
            {isDone && toolRounds !== undefined && toolRounds > 0 && (
              <span style={{ background: "#0a1520", border: "1px solid #06b6d430", color: "#06b6d4aa", padding: "1px 7px", borderRadius: 3, fontSize: 9, fontFamily: "monospace" }}>
                {toolRounds} search{toolRounds !== 1 ? "es" : ""}
              </span>
            )}
          </div>
          <div style={{ color: C.textDim, fontSize: 12, marginTop: 3 }}>{agent.title} — {agent.role}</div>
        </div>
      </div>

      {isActive && (
        <div style={{ color: C.textDim, fontSize: 12, fontFamily: "monospace", padding: "4px 0" }}>
          <Dots /> {agent.useSearch ? "Searching the web..." : "Deliberating..."}
        </div>
      )}

      {isDone && (narrative || technical) && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["narrative", "technical"] as const).map(v => (
              <button key={v} onClick={() => setTab(v)} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, background: tab === v ? `${agent.color}25` : "transparent", border: `1px solid ${tab === v ? agent.color : C.border}`, color: tab === v ? agent.color : C.muted, cursor: "pointer", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ background: "#0a0a12", borderRadius: 8, padding: 14, maxHeight: 300, overflowY: "auto", border: `1px solid ${C.border}`, fontFamily: tab === "narrative" ? "Georgia, serif" : "monospace", fontSize: tab === "narrative" ? 13 : 11, color: tab === "narrative" ? C.text : "#b0b0d0", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {tab === "narrative" ? narrative : technical}
          </div>
          <button onClick={() => navigator.clipboard.writeText(tab === "narrative" ? narrative : technical)} style={{ marginTop: 8, padding: "3px 10px", borderRadius: 4, fontSize: 10, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", fontFamily: "monospace" }}>
            ⎘ COPY
          </button>
        </div>
      )}
    </div>
  );
}

function FinalPost({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const rendered = content.split("\n").map((line, i) => {
    if (line.startsWith("# "))   return <h1 key={i} style={{ color: C.gold, fontFamily: "Georgia, serif", fontSize: 26, margin: "20px 0 10px", borderBottom: `1px solid ${C.goldDim}`, paddingBottom: 8 }}>{line.slice(2)}</h1>;
    if (line.startsWith("## "))  return <h2 key={i} style={{ color: "#c8c8e8", fontFamily: "Georgia, serif", fontSize: 20, margin: "18px 0 8px" }}>{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} style={{ color: C.textDim, fontSize: 15, margin: "14px 0 6px", fontFamily: "monospace" }}>{line.slice(4)}</h3>;
    if (line.startsWith("- "))   return <li key={i} style={{ color: C.text, margin: "5px 0 5px 20px", lineHeight: 1.7 }}>{line.slice(2)}</li>;
    if (line.startsWith("---"))  return <hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "16px 0" }} />;
    if (!line.trim())            return <div key={i} style={{ height: 10 }} />;
    return <p key={i} style={{ color: C.text, lineHeight: 1.8, margin: "7px 0", fontSize: 15 }}>{line}</p>;
  });

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.gold}50`, boxShadow: "0 0 50px rgba(212,168,71,0.1)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", background: "#0d0d16", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>👑</span>
          <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>FINAL SEALED ARTIFACT</span>
          <span style={{ background: "#0a1a0a", border: "1px solid #22c55e60", color: "#22c55e", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}>✓ PUBLISH READY</span>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ padding: "7px 16px", borderRadius: 6, cursor: "pointer", background: copied ? "#0a1a0a" : `${C.gold}20`, border: `1px solid ${copied ? "#22c55e" : C.gold}`, color: copied ? "#22c55e" : C.gold, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {copied ? "✓ COPIED" : "⎘ COPY FULL POST"}
        </button>
      </div>
      <div style={{ padding: "32px 40px", maxHeight: 700, overflowY: "auto" }}>
        {rendered}
      </div>
    </div>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ color: C.textDim, fontFamily: "monospace", fontSize: 11 }}>COUNCIL PROGRESS — STEP {step} OF {total}</span>
        <span style={{ color: C.amber, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: `linear-gradient(90deg,${C.gold},${C.amber})`, transition: "width 0.6s ease", boxShadow: `0 0 10px ${C.gold}` }} />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BlogForge() {
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [statuses,   setStatuses]   = useState<Record<AgentId, Status>>({ scriptor: "idle", explorator: "idle", veritas: "idle", curator: "idle" });
  const [narratives, setNarratives] = useState<Record<AgentId, string>>({ scriptor: "", explorator: "", veritas: "", curator: "" });
  const [technicals, setTechnicals] = useState<Record<AgentId, string>>({ scriptor: "", explorator: "", veritas: "", curator: "" });
  const [toolRoundsMap, setToolRoundsMap] = useState<Record<AgentId, number>>({ scriptor: 0, explorator: 0, veritas: 0, curator: 0 });
  const [finalPost, setFinalPost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (step > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [step, finalPost]);

  function markActive(id: AgentId) {
    setStatuses(p => ({ ...p, [id]: "active" }));
  }

  function markDone(id: AgentId, raw: string, toolRounds = 0) {
    const { narrative, technical } = parseSections(raw);
    setStatuses(p => ({ ...p, [id]: "done" }));
    setNarratives(p => ({ ...p, [id]: narrative }));
    setTechnicals(p => ({ ...p, [id]: technical }));
    setToolRoundsMap(p => ({ ...p, [id]: toolRounds }));
  }

  async function runCouncil() {
    if (!question.trim() || running) return;
    setRunning(true); setError(null); setFinalPost(null); setStep(0);
    setStatuses({ scriptor: "idle", explorator: "idle", veritas: "idle", curator: "idle" });
    setNarratives({ scriptor: "", explorator: "", veritas: "", curator: "" });
    setTechnicals({ scriptor: "", explorator: "", veritas: "", curator: "" });
    setToolRoundsMap({ scriptor: 0, explorator: 0, veritas: 0, curator: 0 });

    try {
      // 1 — Scriptor (no search)
      setStep(1); markActive("scriptor");
      const s = await callAgent(scriptorPrompt(question), false);
      markDone("scriptor", s.text, s.toolRounds);

      // 2 — Explorator (LIVE SEARCH)
      setStep(2); markActive("explorator");
      const e = await callAgent(exploratorPrompt(question, s.text), true);
      markDone("explorator", e.text, e.toolRounds);

      // 3 — Veritas (LIVE SEARCH)
      setStep(3); markActive("veritas");
      const v = await callAgent(veritasPrompt(question, s.text, e.text), true);
      markDone("veritas", v.text, v.toolRounds);

      // 4 — Curator (no search — synthesis only)
      setStep(4); markActive("curator");
      const c = await callAgent(curatorPrompt(question, s.text, e.text, v.text), false);
      markDone("curator", c.text, c.toolRounds);

      setFinalPost(extractFinal(c.text) || c.text);
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setQuestion(""); setStep(0); setFinalPost(null); setError(null);
    setStatuses({ scriptor: "idle", explorator: "idle", veritas: "idle", curator: "idle" });
    setNarratives({ scriptor: "", explorator: "", veritas: "", curator: "" });
    setTechnicals({ scriptor: "", explorator: "", veritas: "", curator: "" });
    setToolRoundsMap({ scriptor: 0, explorator: 0, veritas: 0, curator: 0 });
  }

  const suggestions = ["AI in construction", "Cash flow management tips", "Hydrovac industry trends"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Georgia, serif" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "24px 40px 20px", background: "linear-gradient(180deg,#0f0f18 0%,transparent 100%)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 5 }}>
              <span style={{ fontSize: 28 }}>📰</span>
              <h1 style={{ margin: 0, fontSize: 26, fontFamily: "Georgia, serif", color: C.gold, letterSpacing: "-0.02em" }}>BlogForge</h1>
              <span style={{ color: C.muted, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em" }}>COUNCIL OF KINGS v2</span>
            </div>
            <p style={{ margin: 0, color: C.textDim, fontSize: 12, fontFamily: "monospace" }}>
              4 specialist AI agents · 🌐 live web search · fact-check · SEO optimisation
            </p>
          </div>
          {step > 0 && (
            <button onClick={reset} style={{ padding: "7px 16px", borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, fontFamily: "monospace", fontSize: 11 }}>
              ↺ NEW SESSION
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 40px 80px" }}>

        {/* Input */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${running ? C.gold : C.border}`, padding: 24, marginBottom: 32, transition: "all 0.3s", boxShadow: running ? `0 0 30px rgba(212,168,71,0.07)` : "none" }}>
          <label style={{ color: C.textDim, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", display: "block", marginBottom: 12 }}>
            ⚡ ENTER YOUR QUESTION OR TOPIC
          </label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={running}
            placeholder="e.g. What is the future of AI in construction? / Best cash flow practices for small business..."
            rows={3}
            style={{ width: "100%", background: "#0a0a12", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: "Georgia, serif", fontSize: 15, padding: "14px 16px", resize: "vertical", lineHeight: 1.6, opacity: running ? 0.6 : 1, outline: "none", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setQuestion(s)} disabled={running} style={{ padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, fontFamily: "monospace", opacity: running ? 0.4 : 1 }}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={runCouncil} disabled={!question.trim() || running} style={{ padding: "11px 28px", borderRadius: 8, cursor: question.trim() && !running ? "pointer" : "not-allowed", background: question.trim() && !running ? `linear-gradient(135deg,${C.gold},${C.amber})` : C.border, border: "none", color: question.trim() && !running ? "#0a0a0f" : C.muted, fontFamily: "monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", boxShadow: question.trim() && !running ? `0 4px 20px ${C.gold}40` : "none" }}>
              {running ? "⚔ COUNCIL IN SESSION..." : "⚔ CONVENE COUNCIL"}
            </button>
          </div>
        </div>

        {step > 0 && step < 5 && <ProgressBar step={step} total={4} />}

        {step > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {AGENTS.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                status={statuses[agent.id]}
                narrative={narratives[agent.id]}
                technical={technicals[agent.id]}
                toolRounds={toolRoundsMap[agent.id]}
              />
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: "#1a0a0a", border: "1px solid #ef444450", borderRadius: 12, padding: 20, color: C.red, fontFamily: "monospace", fontSize: 13 }}>
            ⚠ COUNCIL FAILURE: {error}
          </div>
        )}

        {finalPost && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ color: C.gold, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em" }}>✦ SEALED BY THE COUNCIL ✦</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <FinalPost content={finalPost} />
          </div>
        )}

        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {AGENTS.map(a => (
              <div key={a.id} style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "18px 20px", borderLeft: `3px solid ${a.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span style={{ color: a.color, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{a.name}</span>
                  {a.searchLabel && <span style={{ background: "#0a1520", border: "1px solid #06b6d440", color: "#06b6d4", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontFamily: "monospace" }}>{a.searchLabel}</span>}
                </div>
                <p style={{ margin: 0, color: C.textDim, fontSize: 12, lineHeight: 1.6 }}>{a.role}</p>
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
