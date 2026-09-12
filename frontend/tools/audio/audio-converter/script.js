const fileInput = document.querySelector("#audioFile");
const dropZone = document.querySelector("#dropZone");
const filePanel = document.querySelector("#filePanel");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const removeFile = document.querySelector("#removeFile");
const settings = document.querySelector("#settings");
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

  if (!file.type.startsWith("audio/")) {
    showNotice("Selecione um ficheiro de áudio válido.", "error");
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    showNotice("Para uma conversão mais rápida no dispositivo, use ficheiros até 100 MB.", "error");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = `${formatSize(file.size)} · ${file.type.replace("audio/", "").toUpperCase()}`;
  filePanel.hidden = false;
  settings.hidden = false;
  convertButton.disabled = false;
  processing.hidden = true;
  clearResult();
  notice.hidden = true;
  dropZone.classList.remove("dragover");
}

function makeWavBlob(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, value, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

async function convertToWav() {
  if (!selectedFile) return;

  clearResult();
  processing.hidden = false;
  convertButton.disabled = true;
  notice.hidden = true;
  processingTitle.textContent = "A descodificar o áudio…";
  processingText.textContent = "O processamento acontece localmente no seu navegador.";

  try {
    const arrayBuffer = await selectedFile.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("O navegador não suporta processamento de áudio.");
    }

    const audioContext = new AudioContextClass();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      processingTitle.textContent = "A criar o WAV…";
      processingText.textContent = `${audioBuffer.numberOfChannels} canal(is) · ${audioBuffer.sampleRate} Hz`;

      await new Promise(resolve => requestAnimationFrame(resolve));

      const wavBlob = makeWavBlob(audioBuffer);
      const originalBase = selectedFile.name.replace(/\.[^/.]+$/, "");
      const outputName = `${originalBase || "audio"}.wav`;

      resultUrl = URL.createObjectURL(wavBlob);
      resultName.textContent = outputName;
      resultSize.textContent = `${formatSize(wavBlob.size)} · WAV PCM`;
      downloadButton.href = resultUrl;
      downloadButton.download = outputName;
      resultPanel.hidden = false;

      showNotice("Conversão concluída. O seu ficheiro está pronto para baixar.", "success");
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    console.error(error);
    showNotice(
      "Não foi possível ler este áudio. Tente outro ficheiro ou um formato suportado pelo navegador.",
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

    if (eventName === "dragleave" && !dropZone.contains(event.relatedTarget)) {
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

convertButton.addEventListener("click", convertToWav);
