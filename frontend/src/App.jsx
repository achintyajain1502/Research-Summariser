import { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:8000";

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Upload a research paper PDF to begin.");
  const [loading, setLoading] = useState("");

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setStatus(selectedFile?.name || "No file selected");
  };

  const uploadPaper = async () => {
    try {
      if (!file) return alert("Please select a PDF first");

      setLoading("upload");
      setStatus("Reading your research paper...");
      setOutput("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API_URL}/upload`, formData);

      setStatus(`Uploaded: ${res.data.fileName} | Pages: ${res.data.pages}`);
    } catch (error) {
      setStatus(error.response?.data?.error || "Upload failed");
    } finally {
      setLoading("");
    }
  };

  const analyzePaper = async () => {
    try {
      setLoading("analyze");
      setStatus("AI is analyzing your paper...");
      setOutput("");

      const res = await axios.post(`${API_URL}/analyze`);

      setOutput(res.data.analysis);
      setStatus("Analysis completed.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Analysis failed");
    } finally {
      setLoading("");
    }
  };

  const askQuestion = async () => {
    try {
      if (!question.trim()) return alert("Enter a question");

      setLoading("ask");
      setStatus("Searching inside paper...");
      setOutput("");

      const res = await axios.post(`${API_URL}/ask`, {
        question,
      });

      setOutput(res.data.answer);
      setStatus("Answer generated.");
    } catch (error) {
      setStatus(error.response?.data?.error || "Answer failed");
    } finally {
      setLoading("");
    }
  };

  const downloadPDF = () => {
    if (!output) return alert("No content to download");

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("AI Research Paper Summary", 10, 20);

    doc.setFontSize(12);

    const lines = doc.splitTextToSize(output, 180);

    doc.text(lines, 10, 35);
    doc.save("research-summary.pdf");
  };

  const renderOutput = () => {
    if (!output) {
      return (
        <div className="empty-output">
          <div className="empty-output__glow">
            <Sparkles size={72} strokeWidth={1.75} />
          </div>

          <p className="empty-output__title">
            Your generated summary, quiz, future scope, and answers will appear
            here.
          </p>

          <p className="empty-output__subtitle">
            Upload a paper and click analyze to get started
          </p>
        </div>
      );
    }

    return output.split("\n").map((line, index) => {
      if (line.startsWith("##")) {
        return (
          <h3 key={index} className="output-heading">
            {line.replace("##", "").trim()}
          </h3>
        );
      }

      return line.trim() ? (
        <p key={index} className="output-line">
          {line}
        </p>
      ) : null;
    });
  };

  return (
    <div className="app-shell">
      <header className="hero-section">
        <div className="hero-inner">
          <div className="hero-title-row">
            <div className="hero-icon" aria-hidden="true">
              <FileText size={58} strokeWidth={2.5} />
            </div>

            <h1>AI Research Paper Summarizer</h1>
          </div>

          <p className="hero-copy">
            Harness the power of AI to analyze research papers, generate
            comprehensive summaries, create quiz questions, and explore future
            research scope.
          </p>

          <div className="hero-pills" aria-label="Product capabilities">
            <span>
              <Sparkles size={22} />
              AI Powered
            </span>
            <span>
              <Brain size={22} />
              Smart Analysis
            </span>
            <span>
              <CheckCircle2 size={22} />
              Instant Results
            </span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="action-grid" aria-label="Research paper actions">
          <article className="action-card">
            <div className="card-heading">
              <div className="icon-tile icon-tile--upload">
                <Upload size={34} />
              </div>
              <h2>Upload Paper</h2>
            </div>

            <p className="card-copy">
              Upload a text-based research paper PDF to begin analysis.
            </p>

            <label
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFileSelect(event.dataTransfer.files?.[0] || null);
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) =>
                  handleFileSelect(event.target.files?.[0] || null)
                }
              />

              <FileText size={48} />
              <span>{file ? file.name : "Click to select PDF"}</span>
              <small>or drag and drop</small>
            </label>

            <button
              className="primary-button primary-button--upload"
              onClick={uploadPaper}
              disabled={loading === "upload"}
            >
              {loading === "upload" ? (
                <Loader2 className="spin" size={22} />
              ) : (
                "Upload PDF"
              )}
              <ArrowRight size={23} />
            </button>
          </article>

          <article className="action-card action-card--highlight">
            <div className="corner-accent" aria-hidden="true" />

            <div className="card-heading">
              <div className="icon-tile icon-tile--analyze">
                <Brain size={34} />
              </div>
              <h2>Analyze</h2>
            </div>

            <p className="card-copy">
              Generate comprehensive summary, methodology, key points, quiz, and
              future scope.
            </p>

            <button
              className="primary-button primary-button--analyze"
              onClick={analyzePaper}
              disabled={loading === "analyze"}
            >
              {loading === "analyze" ? (
                <Loader2 className="spin" size={22} />
              ) : (
                "Generate Analysis"
              )}
              <ArrowRight size={23} />
            </button>
          </article>

          <article className="action-card">
            <div className="card-heading">
              <div className="icon-tile icon-tile--ask">
                <Search size={36} />
              </div>
              <h2>Ask Paper</h2>
            </div>

            <p className="card-copy">
              Ask specific questions from the uploaded research paper.
            </p>

            <input
              className="question-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What is the methodology?"
            />

            <button
              className="primary-button primary-button--ask"
              onClick={askQuestion}
              disabled={loading === "ask"}
            >
              {loading === "ask" ? (
                <Loader2 className="spin" size={22} />
              ) : (
                "Ask Question"
              )}
              <ArrowRight size={23} />
            </button>
          </article>
        </section>

        <section className="status-panel" aria-live="polite">
          <div className="status-dot" />
          <div>
            <h2>Status</h2>
            <p>{status}</p>
          </div>
        </section>

        <section className="output-card">
          <div className="output-header">
            <div className="output-title">
              <div className="icon-tile icon-tile--output">
                <Sparkles size={38} />
              </div>

              <div>
                <h2>Generated Output</h2>
                <p>AI-powered analysis and insights</p>
              </div>
            </div>

            {output && (
              <button className="download-button" onClick={downloadPDF}>
                <Download size={20} />
                Download PDF
              </button>
            )}
          </div>

          <div className="output-body">{renderOutput()}</div>
        </section>
      </main>
    </div>
  );
}

export default App;
