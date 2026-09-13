import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

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
const quality = $("quality");
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
let ffmpeg = null;
let engineReady = false;

const outputInfo = {
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  wav: { ext: "wav", mime: "audio/wav" },
  flac: { ext: "flac", mime: "audio/flac" },
  ogg: { ext: "ogg", mime: "audio/ogg" },
  m4a: { ext: "m4a", mime: "audio/mp4" }
};

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function cleanName(name) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9-_ ]/gi, "").trim() || "converted-audio";
}
function setProgress(percent, title, text) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressTitle.textContent = title;
  progressText.textContent = text;
}

async function loadEngine() {
  if (engineReady) return;
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      setProgress(Math.round(progress * 100), "Converting audio…", "Processing your file locally in the browser");
    });
  }
  setProgress(8, "Preparing converter…", "Loading the audio engine");
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
  await ffmpeg.load({ coreURL, wasmURL });
  engineReady = true;
}

function setFile(file) {
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    setStatus("Please choose an audio file up to 100 MB.", true);
    return;
  }
  selectedFile = file;
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  fileName.textContent = file.name;
  fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "audio file"}`;
  sourcePlayer.src = sourceUrl;
  show(filePanel);
  show(sourcePlayer);
  show(settings);
  show(convertBtn);
  hide(resultBox);
  setStatus("Ready to convert.");
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
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

async function convert() {
  if (!selectedFile) return setStatus("Choose an audio file first.", true);
  convertBtn.disabled = true;
  show(progressBox);
  hide(resultBox);
  try {
    await loadEngine();
    setProgress(15, "Reading audio…", "Preparing your selected file");
    const inputExt = selectedFile.name.split(".").pop()?.toLowerCase() || "audio";
    const safeInput = `input.${inputExt}`;
    const info = outputInfo[format.value];
    const output = `output.${info.ext}`;
    await ffmpeg.writeFile(safeInput, await fetchFile(selectedFile));

    const args = ["-i", safeInput];
    if (format.value === "mp3") {
      args.push("-codec:a", "libmp3lame", "-b:a", quality.value);
    } else if (format.value === "ogg") {
      args.push("-codec:a", "libvorbis", "-b:a", quality.value);
    } else if (format.value === "flac") {
      args.push("-codec:a", "flac");
    } else if (format.value === "wav") {
      args.push("-codec:a", "pcm_s16le");
    } else if (format.value === "m4a") {
      args.push("-codec:a", "aac", "-b:a", quality.value, "-movflags", "+faststart");
    }
    args.push("-y", output);

    setProgress(20, "Converting audio…", "Processing locally in your browser");
    await ffmpeg.exec(args);
    setProgress(96, "Finishing…", "Preparing your download");
    const data = await ffmpeg.readFile(output);
    const blob = new Blob([data.buffer], { type: info.mime });

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultPlayer.src = resultUrl;
    downloadBtn.href = resultUrl;
    downloadBtn.download = `${cleanName(selectedFile.name)}.${info.ext}`;
    resultMeta.textContent = `${info.ext.toUpperCase()} · ${formatBytes(blob.size)} · processed locally`;
    show(resultBox);
    setProgress(100, "Conversion complete", "Your audio is ready to download");
    setStatus("Conversion complete.");
  } catch (error) {
    console.error(error);
    setStatus("Conversion failed. Try another file or output format.", true);
  } finally {
    convertBtn.disabled = false;
    setTimeout(() => hide(progressBox), 900);
  }
}

chooseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));
removeBtn.addEventListener("click", clearFile);
convertBtn.addEventListener("click", convert);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  setFile(event.dataTransfer.files?.[0]);
});
