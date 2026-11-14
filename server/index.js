
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

const models = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

const SYSTEM_PROMPT = `You are Amar Create AI, a professional senior full-stack software engineer and app builder.

Your job is to generate complete, functional, production-quality application projects from user requirements.

Return ONLY valid JSON using this structure:

{
  "projectName": "project-name",
  "summary": "Project description",
  "files": [
    {
      "path": "index.html",
      "content": "complete file content"
    }
  ],
  "runInstructions": [
    "Step 1",
    "Step 2"
  ]
}

IMPORTANT RULES:

- Generate complete working applications.
- Never generate fake buttons or non-working features.
- Use professional modern UI designs.
- Make every application mobile-first and responsive.
- Support web, Android and iOS when requested.
- Include all necessary project files.
- Include README.md.
- Include package.json when needed.
- Use secure backend architecture.
- Never expose API keys in frontend code.
- Use environment variables for secrets.
- Include error handling.
- Do not omit important code.
- Never claim testing or deployment unless actually performed.
- Respect the user's requested language.
- Return valid JSON only.`;

function safePath(value) {
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const parts = normalized.split("/");

  if (
    !normalized ||
    normalized.includes(":") ||
    parts.some(p =>
      !p || p === "." || p === ".."
    )
  ) {
    return null;
  }

  return normalized;
}

function getModelOutput(result) {
  return result.steps
    ?.filter(step => step.type === "model_output")
    .flatMap(step => step.content || [])
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("")
    .trim();
}

function isTemporaryOrCapacityError(status, message) {
  const text = String(message || "").toLowerCase();

  return (
    status === 429 ||
    status === 503 ||
    text.includes("high demand") ||
    text.includes("overloaded") ||
    text.includes("temporarily unavailable") ||
    text.includes("capacity")
  );
}

async function generateWithFallback(input) {
  let lastError = null;

  for (const model of [...new Set(models)]) {
    try {
      console.log("Trying Gemini model:", model);

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
            input,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: {
                type: "object",
                properties: {
                  projectName: {
                    type: "string"
                  },
                  summary: {
                    type: "string"
                  },
                  files: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: {
                          type: "string"
                        },
                        content: {
                          type: "string"
                        }
                      },
                      required: [
                        "path",
                        "content"
                      ]
                    }
                  },
                  runInstructions: {
                    type: "array",
                    items: {
                      type: "string"
                    }
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
        const message =
          result?.error?.message ||
          "Gemini request failed.";

        console.error(
          "Gemini model failed:",
          model,
          response.status,
          message
        );

        lastError = {
          status: response.status,
          message
        };

        if (
          isTemporaryOrCapacityError(
            response.status,
            message
          )
        ) {
          console.log("Trying fallback model...");
          continue;
        }

        throw new Error(message);
      }

      const raw = getModelOutput(result);

      if (!raw) {
        lastError = {
          status: 502,
          message: "Gemini returned an empty response."
        };

        continue;
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

      if (
        !Array.isArray(project.files) ||
        !project.files.length
      ) {
        throw new Error(
          "AI returned no project files."
        );
      }

      project.files = project.files
        .filter(file =>
          file &&
          typeof file.content === "string"
        )
        .map(file => ({
          path: safePath(file.path),
          content: file.content
        }))
        .filter(file => file.path);

      if (!project.files.length) {
        throw new Error(
          "No valid project files were returned."
        );
      }

      project.usedModel = model;

      console.log("Generation successful:", model);

      return project;

    } catch (error) {
      if (error.message) {
        lastError = {
          status: lastError?.status || 502,
          message: error.message
        };
      }

      if (
        lastError &&
        !isTemporaryOrCapacityError(
          lastError.status,
          lastError.message
        )
      ) {
        throw error;
      }
    }
  }

  const error = new Error(
    lastError?.message ||
    "All Gemini models are currently unavailable. Please try again later."
  );

  error.status = lastError?.status || 503;

  throw error;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(apiKey),
    provider: "Google Gemini",
    models
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(503).json({
        error:
          "Gemini API is not configured. Add GEMINI_API_KEY in Render Environment."
      });
    }

    const {
      prompt,
      platform = "both",
      level = "professional",
      language = "English"
    } = req.body || {};

    if (
      typeof prompt !== "string" ||
      prompt.trim().length < 8
    ) {
      return res.status(400).json({
        error:
          "Please describe your app in at least 8 characters."
      });
    }

    if (prompt.length > 12000) {
      return res.status(400).json({
        error:
          "Prompt is too long. Maximum 12,000 characters."
      });
    }

    const input =
      "Build this " + level +
      " application for " + platform +
      ". Respond in " + language +
      " where appropriate.\n\nRequirements:\n" +
      prompt.trim();

    const project = await generateWithFallback(input);

    return res.json(project);

  } catch (error) {
    console.error("Generate error:", error);

    const status = error.status === 429 ||
      error.status === 503
      ? error.status
      : 502;

    return res.status(status).json({
      error:
        error.message ||
        "Generation failed. Please try again."
    });
  }
});

app.post("/api/export", (req, res) => {
  const files = req.body?.files;

  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > 100
  ) {
    return res.status(400).json({
      error: "Invalid project files."
    });
  }

  const archive = archiver("zip", {
    zlib: { level: 9 }
  });

  archive.on("error", error => {
    console.error("ZIP error:", error);

    if (!res.headersSent) {
      res.status(500).end();
    }
  });

  res.setHeader(
    "Content-Type",
    "application/zip"
  );

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="amar-create-project.zip"'
  );

  archive.pipe(res);

  for (const file of files) {
    const path = safePath(file?.path);

    if (
      path &&
      typeof file.content === "string"
    ) {
      archive.append(file.content, {
        name: path
      });
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
    error => {
      if (error) next(error);
    }
  );
});

app.listen(port, () => {
  console.log(
    "Amar Create AI server running on port " + port
  );
});
