import decode from "https://esm.sh/@audio/decode";
import encode from "https://esm.sh/@audio/encode";

const fileInput = document.querySelector("#audioFile");
const dropZone = document.querySelector("#dropZone");
const filePanel = document.querySelector("#filePanel");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const removeFile = document.querySelector("#removeFile");
const settings = document.querySelector("#settings");
const formatSelect = document.querySelector("#format");
const convertButton = document.querySelector("#convertButton");
const processing = document.querySelector("#processing");
const processingTitle = document.querySelector("#processingTitle");
const processingText = document.querySelector("#processingText");
const resultPanel = document.querySelector("#resultPanel");
const resultName = document.querySelector("#resultName");
const resultSize = document.querySelector("#resultSize");
const downloadButton = document.querySelector("#downloadButton");
const notice = document.querySelector("#notice");

let selectedFile = null;
let resultUrl = null;

const OUTPUTS = {
  mp3: {
    extension: "mp3",
    mime: "audio/mpeg",
    options: { bitrate: 192 }
  },
  wav: {
    extension: "wav",
    mime: "audio/wav",
    options: { bitDepth: 16 }
  },
  ogg: {
    extension: "ogg",
    mime: "audio/ogg",
    options: { quality: 5 }
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

function setFile(file) {
  if (!file) return;

  const looksLikeAudio =
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|aiff|caf)$/i.test(file.name);

  if (!looksLikeAudio) {
    showNotice("Selecione um ficheiro de áudio válido.", "error");
    return;
  }

  if (file.size > 250 * 1024 * 1024) {
    showNotice(
      "Para uma conversão mais estável no navegador, use ficheiros até 250 MB.",
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
  processing.hidden = true;
  convertButton.disabled = false;
  clearResult();
  notice.hidden = true;
  dropZone.classList.remove("dragover");
}

async function convertAudio() {
  if (!selectedFile) return;

  const output = OUTPUTS[formatSelect.value] || OUTPUTS.mp3;
  const originalBase = selectedFile.name.replace(/\.[^/.]+$/, "");
  const finalName = `${originalBase || "audio"}.${output.extension}`;

  clearResult();
  notice.hidden = true;
  processing.hidden = false;
  convertButton.disabled = true;

  try {
    processingTitle.textContent = "A converter…";
    processingText.textContent = "";

    const { channelData, sampleRate } = await decode(selectedFile);
    const bytes = await encode[output.extension](channelData, {
      sampleRate,
      ...output.options
    });

    const blob = new Blob([bytes], { type: output.mime });
    resultUrl = URL.createObjectURL(blob);

    resultName.textContent = finalName;
    resultSize.textContent = `${formatSize(blob.size)} · ${
      output.extension.toUpperCase()
    }`;
    downloadButton.href = resultUrl;
    downloadButton.download = finalName;
    resultPanel.hidden = false;

    showNotice(
      `Conversão concluída para ${output.extension.toUpperCase()}.`,
      "success"
    );
  } catch (error) {
    console.error("Nexauren Audio Converter:", error);
    showNotice(
      "Não foi possível converter este áudio. Tente outro ficheiro ou formato.",
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
  processing.hidden = true;
  convertButton.disabled = true;
  clearResult();
  notice.hidden = true;
});

convertButton.addEventListener("click", convertAudio);
