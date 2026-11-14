import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import archiver from "archiver";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("dist"));

const port = Number(process.env.PORT || 8787);
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(client), model: process.env.OPENAI_MODEL || "gpt-4.1-mini" });
});

const SYSTEM_PROMPT = `You are Amar Create AI, a senior full-stack product engineer. Generate complete, runnable app projects from user requirements.
Return ONLY valid JSON with this exact shape:
{"projectName":"short-name","summary":"one sentence","files":[{"path":"index.html","content":"..."}],"runInstructions":["..."]}
Rules:
- For web apps, prefer a self-contained responsive HTML/CSS/JavaScript app unless the user explicitly asks for a framework.
- Include all necessary source files; no placeholders, TODOs, fake buttons, or omitted core features.
- Make layouts polished, accessible, responsive, and mobile-first.
- Do not include secrets or API keys in generated client-side files.
- If a feature needs a server or external credentials, create a safe server-side implementation and explain required environment variables.
- Use relative paths, no absolute local paths.
- Include README.md with setup, run, deployment, and security notes.
- If user requests Android/iOS, include Capacitor setup/config and clear native build instructions; explain that native signing/building requires Android Studio or Xcode.
- Do not claim the app was deployed or tested unless that happened.
- Keep files practical and concise, but complete.`;

app.post("/api/generate", async (req, res) => {
  try {
    if (!client) return res.status(503).json({ error: "AI is not configured. Add OPENAI_API_KEY to the server .env file, then restart the server." });
    const { prompt, platform = "both", level = "professional", language = "English" } = req.body || {};
    if (typeof prompt !== "string" || prompt.trim().length < 8) {
      return res.status(400).json({ error: "Please describe the app in at least 8 characters." });
    }
    if (prompt.length > 12000) return res.status(400).json({ error: "Prompt is too long (maximum 12,000 characters)." });

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Build this ${level} app for ${platform}. Respond in ${language} where appropriate. Requirements:\n${prompt}` }
      ]
    });
    const raw = response.choices?.[0]?.message?.content || "{}";
    const project = JSON.parse(raw);
    if (!Array.isArray(project.files) || !project.files.length) throw new Error("The AI returned no project files. Please try again.");
    project.files = project.files.filter(f => f && typeof f.path === "string" && typeof f.content === "string")
      .map(f => ({ path: f.path.replace(/^\/+/, "").replace(/\.\./g, "_"), content: f.content }));
    res.json(project);
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err?.message || "Generation failed. Please try again." });
  }
});

app.post("/api/export", (req, res) => {
  const files = req.body?.files;
  if (!Array.isArray(files) || !files.length || files.length > 100) return res.status(400).json({ error: "Invalid project files." });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="amar-create-project.zip"');
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", err => { if (!res.headersSent) res.status(500).end(); });
  archive.pipe(res);
  for (const file of files) {
    if (typeof file.path === "string" && typeof file.content === "string") {
      const safePath = file.path.replace(/^\/+/, "").replace(/\.\./g, "_");
      archive.append(file.content, { name: safePath });
    }
  }
  archive.finalize();
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found." });
  res.sendFile(process.cwd() + "/dist/index.html", err => err && next(err));
});

app.listen(port, () => console.log(`Amar Create AI server listening on http://localhost:${port}`));
