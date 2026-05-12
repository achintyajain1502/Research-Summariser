const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "20mb" }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

let paperChunks = [];
let paperText = "";
let paperName = "";

app.get("/", (req, res) => {
  res.send("AI Research Paper Summarizer backend is running");
});

function chunkText(text, size = 450) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }

  return chunks;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function cosineSimilarity(queryWords, chunkWords) {
  const queryMap = {};
  const chunkMap = {};

  queryWords.forEach((word) => {
    queryMap[word] = (queryMap[word] || 0) + 1;
  });

  chunkWords.forEach((word) => {
    chunkMap[word] = (chunkMap[word] || 0) + 1;
  });

  let dot = 0;
  let queryMag = 0;
  let chunkMag = 0;

  Object.keys(queryMap).forEach((word) => {
    dot += (queryMap[word] || 0) * (chunkMap[word] || 0);
    queryMag += queryMap[word] ** 2;
  });

  Object.keys(chunkMap).forEach((word) => {
    chunkMag += chunkMap[word] ** 2;
  });

  if (queryMag === 0 || chunkMag === 0) return 0;

  return dot / (Math.sqrt(queryMag) * Math.sqrt(chunkMag));
}

function vectorSearch(query, chunks, limit = 5) {
  const queryWords = tokenize(query);

  return chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: cosineSimilarity(queryWords, tokenize(chunk)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function extractCitationLines(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter(
      (line) =>
        /\[\d+\]/.test(line) ||
        /\(\d{4}\)/.test(line) ||
        /doi|ieee|springer|elsevier|arxiv|references/i.test(line)
    )
    .slice(0, 10);
}

async function generateOpenAIText(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OpenAI API key missing");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error?.message || `OpenAI request failed with ${response.status}`
    );
    error.statusCode = response.status;
    throw error;
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const text = data.output
    ?.flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("\n");

  return text || "";
}

app.post("/upload", upload.single("file"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file received" });
    }

    filePath = req.file.path;
    paperName = req.file.originalname;

    if (req.file.mimetype !== "application/pdf") {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Only PDF files are allowed" });
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: "No readable text found. Use a text-based research paper PDF.",
      });
    }

    paperText = pdfData.text;
    paperChunks = chunkText(paperText);

    fs.unlinkSync(filePath);

    return res.json({
      message: "Research paper uploaded successfully",
      fileName: paperName,
      chunks: paperChunks.length,
      pages: pdfData.numpages,
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.status(500).json({
      error: "Upload failed",
      details: error.message,
    });
  }
});

app.post("/analyze", async (req, res) => {
  try {
    if (!paperText || paperChunks.length === 0) {
      return res.status(400).json({ error: "Upload a research paper first" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key missing" });
    }

    const topChunks = vectorSearch(
      "abstract introduction methodology results conclusion future work contribution",
      paperChunks,
      8
    );

    const context = topChunks.map((item) => item.chunk).join("\n\n");

    const citationLines = extractCitationLines(paperText);

    const prompt = `
You are an AI Research Paper Summarizer.

Analyze the research paper content below and return the answer in this exact format:

## Summary
Write 5-7 clear points.

## Key Points
Write important technical points in bullet points.

## Methodology
Explain the approach/method used in the paper.

## Future Scope
Give possible future improvements.

## Quiz Questions
Create 5 quiz questions with short answers.

## Citations Extracted
Mention citation/reference-like lines if available. If not available, say "No clear citations found."

Paper Name:
${paperName}

Relevant Paper Content:
${context}

Citation-like lines:
${citationLines.join("\n")}
`;

    const analysis = await generateOpenAIText(prompt);

    return res.json({
      analysis,
      fileName: paperName,
      chunksUsed: topChunks.length,
      citations: citationLines,
    });
  } catch (error) {
    if (error.statusCode === 429 || (error.message && error.message.includes("429"))) {
      return res.status(429).json({
        error:
          "OpenAI quota exceeded. Try again later or use another OpenAI API key.",
      });
    }

    return res.status(error.statusCode || 500).json({
      error: "Analysis failed",
      details: error.message,
    });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!paperText || paperChunks.length === 0) {
      return res.status(400).json({ error: "Upload a research paper first" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key missing" });
    }

    const relevant = vectorSearch(question, paperChunks, 5);
    const context = relevant.map((item) => item.chunk).join("\n\n");

    const prompt = `
Answer the question using only the research paper content below.
Give answer in clear points.

Research Paper Content:
${context}

Question:
${question}
`;

    const answer = await generateOpenAIText(prompt);

    return res.json({
      answer,
    });
  } catch (error) {
    if (error.statusCode === 429 || (error.message && error.message.includes("429"))) {
      return res.status(429).json({
        error:
          "OpenAI quota exceeded. Try again later or use another OpenAI API key.",
      });
    }

    return res.status(error.statusCode || 500).json({
      error: "Question answering failed",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
