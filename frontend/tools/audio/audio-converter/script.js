import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

const fileInput = document.querySelector("#audioFile");
const dropZone = document.querySelector("#dropZone");
const filePanel = document.querySelector("#filePanel");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const removeFile = document.querySelector("#removeFile");
const settings = document.querySelector("#settings");
const formatSelect = document.querySelector("#format");
const convertButton = document.querySelector("#convertButton");
const enginePanel = document.querySelector("#enginePanel");
const engineStatus = document.querySelector("#engineStatus");
const progressBar = document.querySelector("#progressBar");
const processing = document.querySelector("#processing");
const processingTitle = document.querySelector("#processingTitle");
const processingText = document.querySelector("#processingText");
const resultPanel = document.querySelector("#resultPanel");
const resultName = document.querySelector("#resultName");
const resultSize = document.querySelector("#resultSize");
const downloadButton = document.querySelector("#downloadButton");
const notice = document.querySelector("#notice");

const ffmpeg = new FFmpeg();
let selectedFile = null;
let resultUrl = null;
let engineLoaded = false;
let engineLoading = null;

const OUTPUTS = {
  mp3: {
    extension: "mp3",
    mime: "audio/mpeg",
    args: ["-vn", "-codec:a", "libmp3lame", "-q:a", "2"]
  },
  wav: {
    extension: "wav",
    mime: "audio/wav",
    args: ["-vn", "-codec:a", "pcm_s16le"]
  },
  ogg: {
    extension: "ogg",
    mime: "audio/ogg",
    args: ["-vn", "-codec:a", "libvorbis", "-q:a", "5"]
  },
  m4a: {
    extension: "m4a",
    mime: "audio/mp4",
    args: ["-vn", "-codec:a", "aac", "-b:a", "192k"]
  }
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function showNotice(text, type = "") {
  notice.textContent = text;
  notice.dataset.type = type;
  notice.hidden = false;
}

function clearResult() {
  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }

  resultPanel.hidden = true;
  downloadButton.removeAttribute("href");
}

function setProgress(value) {
  const safeValue = Math.max(0, Math.min(100, value));
  progressBar.style.width = `${safeValue}%`;
}

async function loadEngine() {
  if (engineLoaded) return ffmpeg;
  if (engineLoading) return engineLoading;

  enginePanel.hidden = false;
  engineStatus.textContent = "A carregar o motor…";
  setProgress(5);

  engineLoading = (async () => {
    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      )
    });

    engineLoaded = true;
    engineStatus.textContent = "Motor pronto";
    setProgress(100);
    return ffmpeg;
  })();

  try {
    return await engineLoading;
  } catch (error) {
    engineLoading = null;
    engineStatus.textContent = "Falha ao carregar";
    setProgress(0);
    throw error;
  }
}

ffmpeg.on("progress", ({ progress }) => {
  if (!Number.isFinite(progress)) return;
  setProgress(Math.round(progress * 100));
});

ffmpeg.on("log", ({ message }) => {
  if (message) console.debug("[Nexauren Audio Converter]", message);
});

function setFile(file) {
  if (!file) return;

  const looksLikeAudio =
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i.test(file.name);

  if (!looksLikeAudio) {
    showNotice("Selecione um ficheiro de áudio válido.", "error");
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    showNotice(
      "Para uma conversão mais rápida no dispositivo, use ficheiros até 100 MB.",
      "error"
    );
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = `${formatSize(file.size)} · ${
    file.type ? file.type.replace("audio/", "").toUpperCase() : "ÁUDIO"
  }`;
  filePanel.hidden = false;
  settings.hidden = false;
  enginePanel.hidden = true;
  convertButton.disabled = false;
  processing.hidden = true;
  clearResult();
  notice.hidden = true;
  dropZone.classList.remove("dragover");
}

async function convertAudio() {
  if (!selectedFile) return;

  const output = OUTPUTS[formatSelect.value] || OUTPUTS.mp3;
  const inputName = `input-${Date.now()}.${
    selectedFile.name.split(".").pop() || "audio"
  }`;
  const outputName = `nexauren-${Date.now()}.${output.extension}`;

  clearResult();
  notice.hidden = true;
  processing.hidden = false;
  convertButton.disabled = true;
  enginePanel.hidden = false;
  setProgress(0);

  try {
    processingTitle.textContent = "A preparar o conversor…";
    processingText.textContent =
      "Na primeira conversão, o motor FFmpeg precisa de ser carregado.";

    const engine = await loadEngine();

    processingTitle.textContent = "A converter o áudio…";
    processingText.textContent =
      "O ficheiro é processado localmente no navegador.";

    await engine.writeFile(inputName, new Uint8Array(await selectedFile.arrayBuffer()));
    setProgress(0);

    await engine.exec([
      "-i",
      inputName,
      ...output.args,
      outputName
    ]);

    const data = await engine.readFile(outputName);
    const bytes = data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
    const blob = new Blob([bytes], { type: output.mime });

    resultUrl = URL.createObjectURL(blob);
    const originalBase = selectedFile.name.replace(/\.[^/.]+$/, "");
    const finalName = `${originalBase || "audio"}.${output.extension}`;

    resultName.textContent = finalName;
    resultSize.textContent = `${formatSize(blob.size)} · ${
      output.extension.toUpperCase()
    }`;
    downloadButton.href = resultUrl;
    downloadButton.download = finalName;
    resultPanel.hidden = false;

    showNotice(
      `Conversão concluída para ${output.extension.toUpperCase()}. O ficheiro está pronto para baixar.`,
      "success"
    );

    await engine.deleteFile(inputName);
    await engine.deleteFile(outputName);
    setProgress(100);
  } catch (error) {
    console.error(error);
    showNotice(
      "Não foi possível converter este áudio. Tente outro ficheiro ou outro formato de saída.",
      "error"
    );
  } finally {
    processing.hidden = true;
    convertButton.disabled = false;
  }
}

fileInput.addEventListener("change", () => {
  setFile(fileInput.files?.[0]);
});

["dragenter", "dragover"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();

    if (
      eventName === "dragleave" &&
      !dropZone.contains(event.relatedTarget)
    ) {
      dropZone.classList.remove("dragover");
    }

    if (eventName === "drop") {
      setFile(event.dataTransfer.files?.[0]);
    }
  });
});

removeFile.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  filePanel.hidden = true;
  settings.hidden = true;
  enginePanel.hidden = true;
  processing.hidden = true;
  convertButton.disabled = true;
  clearResult();
  notice.hidden = true;
});

convertButton.addEventListener("click", convertAudio);
