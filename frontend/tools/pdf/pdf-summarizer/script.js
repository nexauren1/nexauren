const input = document.getElementById("pdfInput");
const dropZone = document.getElementById("dropZone");
const fileTitle = document.getElementById("fileTitle");
const fileMeta = document.getElementById("fileMeta");
const mode = document.getElementById("mode");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const statusText = document.getElementById("statusText");
const errorBox = document.getElementById("error");
const resultCard = document.getElementById("resultCard");
const resultTitle = document.getElementById("resultTitle");
const resultContent = document.getElementById("resultContent");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

let selectedFile = null;
let lastText = "";

const labels = {
  summary: "Quick summary",
  detailed: "Detailed summary",
  keypoints: "Key points",
  study: "Study notes",
  simple: "Simple explanation",
  qa: "Questions & answers",
  quiz: "Quiz"
};

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function setStatus(message, visible) {
  statusText.textContent = message;
  status.hidden = !visible;
}

function selectFile(file) {
  setError("");
  resultCard.hidden = true;
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    selectedFile = null;
    processBtn.disabled = true;
    setError("Please choose a PDF file.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    selectedFile = null;
    processBtn.disabled = true;
    setError("This PDF is larger than the 10 MB limit.");
    return;
  }
  selectedFile = file;
  processBtn.disabled = false;
  fileTitle.textContent = file.name;
  fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · PDF ready`;
}

input.addEventListener("change", () => selectFile(input.files[0]));

["dragenter", "dragover"].forEach(type => {
  dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach(type => {
  dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", event => selectFile(event.dataTransfer.files[0]));

function renderResult(data) {
  resultCard.hidden = false;
  resultTitle.textContent = labels[data.mode] || "AI result";
  resultContent.innerHTML = "";

  if (data.mode === "quiz" && data.result?.questions) {
    const questions = data.result.questions;
    questions.forEach((item, index) => {
      const box = document.createElement("div");
      box.className = "quiz-question";
      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${item.question}`;
      box.appendChild(title);
      const list = document.createElement("ol");
      list.type = "A";
      (item.options || []).forEach(option => {
        const li = document.createElement("li");
        li.textContent = option;
        list.appendChild(li);
      });
      box.appendChild(list);
      if (Number.isInteger(item.answer) && item.options?.[item.answer]) {
        const answer = document.createElement("p");
        answer.innerHTML = `<strong>Answer:</strong> ${escapeHtml(item.options[item.answer])}`;
        box.appendChild(answer);
      }
      if (item.explanation) {
        const explanation = document.createElement("p");
        explanation.textContent = item.explanation;
        box.appendChild(explanation);
      }
      resultContent.appendChild(box);
    });
    lastText = questions.map((q, i) => {
      const opts = (q.options || []).map((o, n) => `${String.fromCharCode(65 + n)}. ${o}`).join("\n");
      return `${i + 1}. ${q.question}\n${opts}\nAnswer: ${q.options?.[q.answer] || ""}\n${q.explanation || ""}`;
    }).join("\n\n");
    return;
  }

  const text = String(data.result || "");
  lastText = text;
  const fragment = document.createDocumentFragment();
  text.split(/\n\n+/).filter(Boolean).forEach(paragraph => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    fragment.appendChild(p);
  });
  resultContent.appendChild(fragment);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  }[char]));
}

processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  processBtn.disabled = true;
  setError("");
  resultCard.hidden = true;
  setStatus("Extracting your PDF…", true);

  try {
    const form = new FormData();
    form.append("file", selectedFile);
    form.append("mode", mode.value);

    setTimeout(() => {
      if (!status.hidden) setStatus("Nexauren AI is preparing your result…", true);
    }, 900);

    const response = await fetch("/api/pdf-summarizer", {
      method: "POST",
      body: form
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.detail
        ? `${data.error || "Não foi possível processar o PDF."}\n\n${data.detail}`
        : (data.error || "Não foi possível processar o PDF.");
      throw new Error(message);
    }

    setStatus("Result ready.", false);
    renderResult(data);
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus("", false);
    setError(error.message || "Something went wrong. Please try again.");
  } finally {
    processBtn.disabled = !selectedFile;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!lastText) return;
  try {
    await navigator.clipboard.writeText(lastText);
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = old; }, 1300);
  } catch {
    setError("Copy is not available in this browser.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!lastText) return;
  const blob = new Blob([lastText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedFile?.name?.replace(/\.pdf$/i, "") || "nexauren-result"}-${mode.value}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});
