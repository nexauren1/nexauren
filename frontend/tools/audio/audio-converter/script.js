const fileInput = document.querySelector("#audioFile");
const dropZone = document.querySelector("#dropZone");
const filePanel = document.querySelector("#filePanel");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const removeFile = document.querySelector("#removeFile");
const settings = document.querySelector("#settings");
const convertButton = document.querySelector("#convertButton");
const processing = document.querySelector("#processing");
const notice = document.querySelector("#notice");
let selectedFile = null;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function showNotice(text) {
  notice.textContent = text;
  notice.hidden = false;
}

function setFile(file) {
  if (!file || !file.type.startsWith("audio/")) {
    showNotice("Selecione um ficheiro de áudio válido.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = `${formatSize(file.size)} · ${file.type.replace("audio/", "").toUpperCase()}`;
  filePanel.hidden = false;
  settings.hidden = false;
  convertButton.disabled = false;
  processing.hidden = true;
  notice.hidden = true;
  dropZone.classList.remove("dragover");
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
  notice.hidden = true;
});

convertButton.addEventListener("click", () => {
  if (!selectedFile) return;

  processing.hidden = false;
  notice.hidden = true;
  convertButton.disabled = true;

  window.setTimeout(() => {
    processing.hidden = true;
    convertButton.disabled = false;
    showNotice(
      "A interface está pronta. O motor de conversão real será ligado ao backend na próxima etapa."
    );
  }, 1400);
});
