import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Sparkles, Code2, Eye, Download, Smartphone, Globe, FolderOpen, Settings2, Plus, LoaderCircle, Copy, Check, Rocket, Menu, X, Languages, AlertCircle, FileCode2 } from "lucide-react";
import "./styles.css";

const starter = "Create a beautiful, responsive task manager with a dashboard, project filters, task cards, add-task modal, and local storage persistence.";
const starterFiles = [{ path: "README.md", content: "# Your project\\n\\nGenerate an app with Amar Create AI to see your source files here." }];

function App() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("both");
  const [language, setLanguage] = useState("English");
  const [project, setProject] = useState(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [view, setView] = useState("preview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("amar-projects") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(d => setConfigured(d.configured)).catch(() => setConfigured(false));
  }, []);
  useEffect(() => { localStorage.setItem("amar-projects", JSON.stringify(history.slice(0, 12))); }, [history]);

  const currentFile = project?.files?.[selectedFile];
  const previewHtml = useMemo(() => {
    if (!project?.files) return "";
    const htmlFile = project.files.find(f => f.path.toLowerCase().endsWith(".html"));
    if (!htmlFile) return "";
    return htmlFile.content;
  }, [project]);

  async function generate() {
    if (prompt.trim().length < 8) { setError("Describe the app you want to build (at least 8 characters)."); return; }
    setBusy(true); setError(""); setProject(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform, level: "professional", language })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate project.");
      setProject(data); setSelectedFile(0); setView("preview");
      setHistory(old => [{ name: data.projectName || "New project", summary: data.summary || prompt, files: data.files, date: new Date().toISOString() }, ...old].slice(0, 12));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function exportProject() {
    if (!project?.files?.length) return;
    try {
      const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: project.files }) });
      if (!response.ok) throw new Error("ZIP export failed.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${(project.projectName || "amar-project").replace(/[^a-z0-9-_]/gi, "-")}.zip`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  }

  async function copyCode() {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.content);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  function openHistory(item) { setProject(item); setSelectedFile(0); setView("preview"); setMobileMenu(false); }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => { setProject(null); setMobileMenu(false); }}>
        <span className="brand-mark"><Sparkles size={19}/></span><span>Amar <b>Create</b><small>AI APP BUILDER</small></span>
      </button>
      <div className="top-actions">
        <span className={`status ${configured === false ? "offline" : ""}`}><i/> {configured === null ? "Connecting" : configured ? "AI ready" : "AI setup needed"}</span>
        <button className="icon-btn mobile-only" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menu">{mobileMenu ? <X/> : <Menu/>}</button>
        <button className="new-btn" onClick={() => { setProject(null); setPrompt(""); setError(""); }}><Plus size={16}/> New project</button>
      </div>
    </header>

    <div className="workspace">
      <aside className={`sidebar ${mobileMenu ? "show" : ""}`}>
        <div className="side-label">WORKSPACE</div>
        <button className="nav-item active"><Sparkles size={17}/> AI Builder <span className="nav-pill">NEW</span></button>
        <button className="nav-item" onClick={() => { setProject(null); setPrompt(starter); }}><FolderOpen size={17}/> Start from template</button>
        <div className="side-label recent-label">RECENT PROJECTS</div>
        {history.length ? history.map((item, i) => <button className="history-item" key={i} onClick={() => openHistory(item)}><FileCode2 size={15}/><span>{item.name}</span></button>) : <p className="empty-history">Your generated projects will appear here.</p>}
        <div className="sidebar-bottom"><div className="avatar">A</div><div><b>Amar Create</b><small>Professional workspace</small></div><Settings2 size={16}/></div>
      </aside>

      <main className="main">
        {!project ? <section className="builder">
          <div className="hero-chip"><span className="pulse"/> YOUR IDEA. BUILT WITH AI.</div>
          <h1>What do you want<br/><span>to create today?</span></h1>
          <p className="hero-sub">Turn your idea into a working web or mobile app. Describe it in plain language — Amar Create handles the code.</p>
          <div className="prompt-card">
            <div className="prompt-head"><span><Sparkles size={16}/> Describe your app</span><span className="prompt-hint">Be as specific as you like</span></div>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="I want to build an app that..." rows={5}/>
            <div className="prompt-foot">
              <div className="selectors">
                <label><Globe size={15}/><select value={platform} onChange={e => setPlatform(e.target.value)}><option value="both">Web + iOS + Android</option><option value="web">Web app</option><option value="mobile">iOS + Android</option></select></label>
                <label><Languages size={15}/><select value={language} onChange={e => setLanguage(e.target.value)}><option>English</option><option>Amharic</option><option>Afaan Oromoo</option></select></label>
              </div>
              <button className="generate-btn" onClick={generate} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17}/> Building...</> : <><Sparkles size={17}/> Generate app <span>→</span></>}</button>
            </div>
          </div>
          {error && <div className="error"><AlertCircle size={17}/>{error}</div>}
          {configured === false && <div className="setup-note"><AlertCircle size={18}/><div><b>One-time AI setup required</b><p>Add your OpenAI API key to the server's <code>.env</code> file. Your key stays on the server and is never exposed in the browser. See README for setup.</p></div></div>}
          <div className="ideas"><span>TRY AN IDEA</span><button onClick={() => setPrompt("Build a modern online store with product categories, search, product details, shopping cart, and checkout UI.")}>Online store</button><button onClick={() => setPrompt("Build a personal finance dashboard with income, expenses, budgets, charts, and transaction management.")}>Finance dashboard</button><button onClick={() => setPrompt(starter)}>Task manager</button></div>
          <div className="features"><div><span><Code2/></span><b>Real source code</b><small>Readable files you can edit</small></div><div><span><Eye/></span><b>Live preview</b><small>See your app as you build</small></div><div><span><Smartphone/></span><b>Web + mobile</b><small>Responsive and Capacitor-ready</small></div></div>
        </section> : <section className="project-workspace">
          <div className="project-heading"><div><div className="crumb">WORKSPACE / <span>PROJECT</span></div><h2>{project.projectName || "Your new app"}</h2><p>{project.summary}</p></div><button className="export-btn" onClick={exportProject}><Download size={16}/> Download ZIP</button></div>
          <div className="work-tabs"><button className={view === "preview" ? "chosen" : ""} onClick={() => setView("preview")}><Eye size={16}/> Preview</button><button className={view === "code" ? "chosen" : ""} onClick={() => setView("code")}><Code2 size={16}/> Code</button><span className="file-count">{project.files.length} files generated</span></div>
          <div className="work-area">
            <div className="file-list"><div className="file-title">PROJECT FILES</div>{project.files.map((file, i) => <button key={file.path} className={selectedFile === i ? "selected" : ""} onClick={() => { setSelectedFile(i); setView("code"); }}><FileCode2 size={14}/>{file.path}</button>)}</div>
            <div className="work-content">
              {view === "preview" ? <div className="preview-wrap"><div className="preview-bar"><span><i/> Preview</span><span className="preview-size">Responsive preview</span></div>{previewHtml ? <iframe title="Generated app preview" sandbox="allow-scripts allow-forms" srcDoc={previewHtml}/> : <div className="no-preview"><Eye size={28}/><b>No HTML preview file found</b><p>Open the source files to inspect this project.</p><button onClick={() => setView("code")}>View code</button></div>}</div> :
                <div className="code-wrap"><div className="code-bar"><span>{currentFile?.path || "Select a file"}</span><button onClick={copyCode}><Copy size={14}/>{copied ? "Copied" : "Copy"}</button></div><pre><code>{currentFile?.content || ""}</code></pre></div>}
            </div>
          </div>
          {error && <div className="error"><AlertCircle size={17}/>{error}</div>}
          <div className="project-bottom"><span><Check size={15}/> Project files saved in this browser</span><button onClick={() => { setProject(null); setPrompt(""); }}>Build another app <span>→</span></button></div>
        </section>}
      </main>
    </div>
    <footer>AMAR CREATE AI <span>•</span> BUILT FOR YOUR IDEAS <span className="footer-right">Your code. Your project. Your control.</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
