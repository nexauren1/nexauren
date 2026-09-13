import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import {
  fetchFile,
  toBlobURL
} from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

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
let lastLog = "";

const outputInfo = {
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  wav: { ext: "wav", mime: "audio/wav" },
  flac: { ext: "flac", mime: "audio/flac" },
  ogg: { ext: "ogg", mime: "audio/ogg" },
  m4a: { ext: "m4a", mime: "audio/mp4" }
};

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
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
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

function inputExtension(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext;
  return "bin";
}

async function loadEngine() {
  if (engineReady) return;

  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    ffmpeg.on("progress", ({ progress }) => {
      setProgress(
        Math.round(progress * 100),
        "Converting audio…",
        "Processing your file locally in the browser"
      );
    });

    ffmpeg.on("log", ({ message }) => {
      lastLog = message || "";
      console.debug("[Nexauren Audio Converter]", message);
    });
  }

  setProgress(
    8,
    "Preparing converter…",
    "Loading the audio engine"
  );

  const base =
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${base}/ffmpeg-core.js`,
      "text/javascript"
    ),
    wasmURL: await toBlobURL(
      `${base}/ffmpeg-core.wasm`,
      "application/wasm"
    )
  });

  engineReady = true;
}

async function removeTempFile(name) {
  if (!ffmpeg) return;
  try {
    await ffmpeg.deleteFile(name);
  } catch (_) {
    // File may not exist.
  }
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

  selectedFile = file;

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);

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

function conversionArgs(input, output, target) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-i",
    input,
    "-vn",
    "-map",
    "0:a:0"
  ];

  if (target === "mp3") {
    args.push(
      "-c:a",
      "libmp3lame",
      "-b:a",
      quality.value
    );
  }

  if (target === "ogg") {
    args.push(
      "-c:a",
      "libvorbis",
      "-b:a",
      quality.value
    );
  }

  if (target === "flac") {
    args.push("-c:a", "flac");
  }

  if (target === "wav") {
    args.push(
      "-c:a",
      "pcm_s16le",
      "-ar",
      "44100"
    );
  }

  if (target === "m4a") {
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      quality.value,
      "-movflags",
      "+faststart"
    );
  }

  args.push("-y", output);
  return args;
}

async function convert() {
  if (!selectedFile) {
    setStatus("Choose an audio file first.", true);
    return;
  }

  const info = outputInfo[format.value];
  if (!info) {
    setStatus("Choose a valid output format.", true);
    return;
  }

  convertBtn.disabled = true;
  show(progressBox);
  hide(resultBox);
  lastLog = "";

  const input = `input.${inputExtension(selectedFile)}`;
  const output = `output.${info.ext}`;

  try {
    await loadEngine();

    await removeTempFile(input);
    await removeTempFile(output);

    setProgress(
      15,
      "Reading audio…",
      "Preparing your selected file"
    );

    await ffmpeg.writeFile(
      input,
      await fetchFile(selectedFile)
    );

    const args = conversionArgs(
      input,
      output,
      format.value
    );

    setProgress(
      20,
      "Converting audio…",
      "Processing locally in your browser"
    );

    const exitCode = await ffmpeg.exec(args);

    if (exitCode !== 0) {
      throw new Error(
        lastLog ||
        `FFmpeg conversion failed with code ${exitCode}.`
      );
    }

    setProgress(
      96,
      "Finishing…",
      "Preparing your download"
    );

    const data = await ffmpeg.readFile(output);

    if (!data || !data.length) {
      throw new Error("FFmpeg returned an empty output file.");
    }

    const blob = new Blob([data], {
      type: info.mime
    });

    if (resultUrl) URL.revokeObjectURL(resultUrl);

    resultUrl = URL.createObjectURL(blob);
    resultPlayer.src = resultUrl;
    downloadBtn.href = resultUrl;
    downloadBtn.download =
      `${cleanName(selectedFile.name)}.${info.ext}`;

    resultMeta.textContent =
      `${info.ext.toUpperCase()} · ` +
      `${formatBytes(blob.size)} · processed locally`;

    show(resultBox);
    setProgress(
      100,
      "Conversion complete",
      "Your audio is ready to download"
    );
    setStatus("Conversion complete.");
  } catch (error) {
    console.error("Audio conversion error:", error);

    const message = String(
      error?.message || error || "Unknown error"
    );

    if (/Unknown encoder/i.test(message)) {
      setStatus(
        "This format is not available in the current converter engine.",
        true
      );
    } else if (/Invalid data|No such file|could not find/i.test(message)) {
      setStatus(
        "The audio file could not be decoded. Try another audio file.",
        true
      );
    } else {
      setStatus(
        "Conversion failed. Please try another file or format.",
        true
      );
    }
  } finally {
    await removeTempFile(input);
    await removeTempFile(output);
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