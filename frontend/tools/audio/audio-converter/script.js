const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const dropZone = $("dropZone");
const chooseBtn = $("chooseBtn");
const removeBtn = $("removeBtn");
const filePanel = $("filePanel");
const fileName = $("fileName");
const fileMeta = $("fileMeta");
const sourcePlayer = $("sourcePlayer");
const settings = $("settings");
const format = $("format");
const convertBtn = $("convertBtn");
const status = $("status");
const progressBox = $("progressBox");
const progressTitle = $("progressTitle");
const progressText = $("progressText");
const progressBar = $("progressBar");
const resultBox = $("resultBox");
const resultPlayer = $("resultPlayer");
const resultMeta = $("resultMeta");
const downloadBtn = $("downloadBtn");

let selectedFile = null;
let sourceUrl = null;
let resultUrl = null;

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function cleanName(name) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .trim() || "converted-audio";
}

function setProgress(percent, title, text) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressTitle.textContent = title;
  progressText.textContent = text;
}

function setFile(file) {
  if (!file) return;

  if (file.size > 100 * 1024 * 1024) {
    setStatus(
      "Please choose an audio file up to 100 MB.",
      true
    );
    return;
  }

  if (file.type && !file.type.startsWith("audio/")) {
    setStatus(
      "Please choose an audio file.",
      true
    );
    return;
  }

  selectedFile = file;

  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
  }

  sourceUrl = URL.createObjectURL(file);
  fileName.textContent = file.name;
  fileMeta.textContent =
    `${formatBytes(file.size)} · ${file.type || "audio file"}`;
  sourcePlayer.src = sourceUrl;

  show(filePanel);
  show(sourcePlayer);
  show(settings);
  show(convertBtn);
  hide(resultBox);
  setStatus("Ready to convert to WAV.");
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";

  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
  }

  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
  }

  sourceUrl = null;
  resultUrl = null;
  sourcePlayer.removeAttribute("src");
  resultPlayer.removeAttribute("src");
  downloadBtn.removeAttribute("href");

  hide(filePanel);
  hide(sourcePlayer);
  hide(settings);
  hide(convertBtn);
  hide(resultBox);
  setStatus("");
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWav(audioBuffer) {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const channelData = [];

  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * blockAlign,
    true
  );
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      let sample = channelData[channel][frame];
      sample = Math.max(-1, Math.min(1, sample));

      const value = sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

      view.setInt16(offset, value, true);
      offset += 2;
    }
  }

  return new Blob([buffer], {
    type: "audio/wav"
  });
}

async function decodeAudio(file) {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error(
      "Audio decoding is not supported by this browser."
    );
  }

  const context = new AudioContextClass();

  try {
    const data = await file.arrayBuffer();
    return await context.decodeAudioData(data);
  } finally {
    await context.close().catch(() => {});
  }
}

async function convert() {
  if (!selectedFile) {
    setStatus("Choose an audio file first.", true);
    return;
  }

  if (format.value !== "wav") {
    setStatus("WAV is the current native browser format.", true);
    return;
  }

  convertBtn.disabled = true;
  show(progressBox);
  hide(resultBox);

  try {
    setProgress(
      12,
      "Reading audio…",
      "Preparing your selected file"
    );

    const audioBuffer = await decodeAudio(selectedFile);

    setProgress(
      55,
      "Creating WAV…",
      "Encoding uncompressed PCM audio locally"
    );

    const blob = encodeWav(audioBuffer);

    if (!blob.size) {
      throw new Error("The WAV output is empty.");
    }

    setProgress(
      92,
      "Finishing…",
      "Preparing your download"
    );

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
    }

    resultUrl = URL.createObjectURL(blob);
    resultPlayer.src = resultUrl;
    downloadBtn.href = resultUrl;
    downloadBtn.download =
      `${cleanName(selectedFile.name)}.wav`;

    resultMeta.textContent =
      `WAV · ${formatBytes(blob.size)} · ` +
      `${audioBuffer.numberOfChannels} channel(s) · ` +
      `${audioBuffer.sampleRate} Hz · processed locally`;

    show(resultBox);

    setProgress(
      100,
      "Conversion complete",
      "Your WAV file is ready to download"
    );

    setStatus("Conversion complete.");
  } catch (error) {
    console.error("Native audio conversion error:", error);

    const message = String(
      error?.message || error || "Unknown error"
    );

    if (/decode|data|format|supported/i.test(message)) {
      setStatus(
        "This audio format is not supported by your browser. Try MP3 or WAV.",
        true
      );
    } else {
      setStatus(
        "Conversion failed. Please try another audio file.",
        true
      );
    }
  } finally {
    convertBtn.disabled = false;
    setTimeout(() => hide(progressBox), 1200);
  }
}

chooseBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  setFile(fileInput.files?.[0]);
});

removeBtn.addEventListener("click", clearFile);
convertBtn.addEventListener("click", convert);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  setFile(event.dataTransfer.files?.[0]);
});
