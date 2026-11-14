
import "dotenv/config";
import express from "express";
import cors from "cors";
import archiver from "archiver";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("dist"));

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(apiKey),
    provider: "Google Gemini",
    model
  });
});

const SYSTEM_PROMPT = `You are Amar Create AI, a senior full-stack product engineer.

Generate complete, runnable app projects from user requirements.

Return ONLY valid JSON with this structure:
{
  "projectName": "short-name",
  "summary": "one sentence",
  "files": [
    {"path": "index.html", "content": "..."}
  ],
  "runInstructions": ["..."]
}

Rules:
- Generate complete working applications.
- No fake buttons or placeholder features.
- Use responsive, mobile-first designs.
- Never expose API keys in client-side code.
- Include all necessary project files.
- Include README.md with setup instructions.
- For Android/iOS use Capacitor configuration.
- Explain native build requirements.
- Never claim deployment or testing unless performed.`;

function safePath(value) {
  if (typeof value !== "string") return null;

  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/");

  if (
    !normalized ||
    normalized.includes(":") ||
    parts.some(p => !p || p === "." || p === "..")
  ) {
    return null;
  }

  return normalized;
}

app.post("/api/generate", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(503).json({
        error: "Gemini API is not configured. Add GEMINI_API_KEY in Render Environment."
      });
    }

    const {
      prompt,
      platform = "both",
      level = "professional",
      language = "English"
    } = req.body || {};

    if (typeof prompt !== "string" || prompt.trim().length < 8) {
      return res.status(400).json({
        error: "Please describe your app in at least 8 characters."
      });
    }

    if (prompt.length > 12000) {
      return res.status(400).json({
        error: "Prompt is too long. Maximum 12,000 characters."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model,
          system_instruction: SYSTEM_PROMPT,
          input:
            "Build this " + level +
            " app for " + platform +
            ". Respond in " + language +
            " where appropriate. Requirements:\n" + prompt,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: {
              type: "object",
              properties: {
                projectName: { type: "string" },
                summary: { type: "string" },
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      content: { type: "string" }
                    },
                    required: ["path", "content"]
                  }
                },
                runInstructions: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: [
                "projectName",
                "summary",
                "files",
                "runInstructions"
              ]
            }
          }
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Gemini API error:", response.status, result);

      const message = response.status === 429
        ? "Gemini API quota reached. Check your Google AI Studio limits."
        : response.status === 401 || response.status === 403
          ? "Gemini API key rejected. Check Render Environment."
          : result?.error?.message || "Gemini request failed.";

      return res.status(
        response.status === 429 ? 429 : 502
      ).json({ error: message });
    }

    const raw = result.steps
      ?.filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("")
      .trim();

    if (!raw) {
      console.error("Gemini returned no model output:", result);
      return res.status(502).json({
        error: "Gemini returned an empty response. Try again."
      });
    }

    let project;

    try {
      project = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      project = JSON.parse(cleaned);
    }

    if (!Array.isArray(project.files) || !project.files.length) {
      throw new Error("AI returned no project files.");
    }

    project.files = project.files
      .filter(file => file && typeof file.content === "string")
      .map(file => ({
        path: safePath(file.path),
        content: file.content
      }))
      .filter(file => file.path);

    if (!project.files.length) {
      throw new Error("No valid project files were returned.");
    }

    res.json(project);

  } catch (err) {
    console.error("Generate error:", err);

    res.status(500).json({
      error: err?.message || "Generation failed."
    });
  }
});

app.post("/api/export", (req, res) => {
  const files = req.body?.files;

  if (!Array.isArray(files) || !files.length || files.length > 100) {
    return res.status(400).json({
      error: "Invalid project files."
    });
  }

  const archive = archiver("zip", {
    zlib: { level: 9 }
  });

  archive.on("error", err => {
    console.error("ZIP error:", err);
    if (!res.headersSent) res.status(500).end();
  });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="amar-create-project.zip"'
  );

  archive.pipe(res);

  for (const file of files) {
    const path = safePath(file?.path);

    if (path && typeof file.content === "string") {
      archive.append(file.content, { name: path });
    }
  }

  archive.finalize();
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route not found."
    });
  }

  res.sendFile(
    process.cwd() + "/dist/index.html",
    err => err && next(err)
  );
});

app.listen(port, () => {
  console.log(
    "Amar Create AI Gemini server running on port " + port
  );
});
