const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const dropzone = $("dropzone");
const editor = $("editor");
const originalPreview = $("originalPreview");
const resultPreview = $("resultPreview");
const fileName = $("fileName");
const fileMeta = $("fileMeta");
const originalSize = $("originalSize");
const resultSize = $("resultSize");
const quality = $("quality");
const qualityValue = $("qualityValue");
const maxWidth = $("maxWidth");
const widthValue = $("widthValue");
const format = $("format");
const compress = $("compress");
const download = $("download");
const status = $("status");
const statusText = $("statusText");

let sourceFile = null;
let sourceImage = null;
let sourceUrl = null;
let resultBlob = null;
let resultUrl = null;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${units[i]}`;
}

function setStatus(message, kind = "") {
  status.className = `status ${kind}`;
  statusText.textContent = message;
}

function outputType() {
  if (format.value === "webp") return "image/webp";
  if (format.value === "jpeg") return "image/jpeg";
  if (format.value === "png") return "image/png";
  if (sourceFile?.type === "image/png") return "image/png";
  if (sourceFile?.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

function extension(type) {
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read."));
    };
    img.src = url;
  });
}

async function selectFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Please choose a supported image file.");
    return;
  }

  try {
    setStatus("Loading image…", "busy");
    sourceFile = file;
    sourceImage = await loadImage(file);

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    originalPreview.src = sourceUrl;
    resultPreview.removeAttribute("src");

    fileName.textContent = file.name;
    fileMeta.textContent = `${formatBytes(file.size)} · ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight}`;
    originalSize.textContent = formatBytes(file.size);
    resultSize.textContent = "Ready";
    editor.hidden = false;
    dropzone.hidden = true;
    download.hidden = true;
    resultBlob = null;

    setStatus("Adjust the settings, then compress your image.");
    compressImage();
  } catch (error) {
    setStatus("This image could not be processed in your browser.");
  }
}

function canvasSize() {
  let width = sourceImage.naturalWidth;
  let height = sourceImage.naturalHeight;
  const limit = Number(maxWidth.value);

  if (limit > 0 && width > limit) {
    height = Math.round(height * (limit / width));
    width = limit;
  }
  return { width, height };
}

function canvasBlob(canvas, type, qualityValueNumber) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, qualityValueNumber);
  });
}

async function compressImage() {
  if (!sourceImage) return;

  setStatus("Compressing…", "busy");
  compress.disabled = true;
  download.hidden = true;

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const { width, height } = canvasSize();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });

    if (outputType() === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceImage, 0, 0, width, height);

    const type = outputType();
    const qualityNumber = Number(quality.value) / 100;
    resultBlob = await canvasBlob(canvas, type, qualityNumber);

    if (!resultBlob) throw new Error("Compression failed");

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(resultBlob);
    resultPreview.src = resultUrl;
    resultSize.textContent = `${formatBytes(resultBlob.size)} · ${width} × ${height}`;

    const saved = sourceFile.size - resultBlob.size;
    const percent = sourceFile.size > 0 ? Math.round((saved / sourceFile.size) * 100) : 0;

    if (saved > 0) {
      setStatus(`Compressed by ${percent}% · ${formatBytes(saved)} smaller.`, "good");
    } else {
      setStatus("This setting is already larger than the original. Try lower quality or WebP.");
    }

    download.href = resultUrl;
    download.download = `${sourceFile.name.replace(/\.[^.]+$/, "")}-compressed.${extension(type)}`;
    download.hidden = false;
  } catch (error) {
    resultBlob = null;
    setStatus("Could not compress this image. Try another format or image.");
  } finally {
    compress.disabled = false;
  }
}

quality.addEventListener("input", () => {
  qualityValue.textContent = `${quality.value}%`;
});

maxWidth.addEventListener("change", () => {
  widthValue.textContent = maxWidth.value === "0" ? "Original" : `${maxWidth.value} px`;
  if (sourceImage) compressImage();
});

format.addEventListener("change", () => {
  if (sourceImage) compressImage();
});

quality.addEventListener("change", () => {
  if (sourceImage) compressImage();
});

compress.addEventListener("click", compressImage);
fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));

$("changeFile").addEventListener("click", () => fileInput.click());

$("reset").addEventListener("click", () => {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  sourceFile = null;
  sourceImage = null;
  sourceUrl = null;
  resultUrl = null;
  resultBlob = null;
  fileInput.value = "";
  editor.hidden = true;
  dropzone.hidden = false;
  download.hidden = true;
  quality.value = 80;
  qualityValue.textContent = "80%";
  maxWidth.value = "0";
  widthValue.textContent = "Original";
  format.value = "auto";
  setStatus("Choose an image to begin.");
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("drag");
  });
});

dropzone.addEventListener("drop", (event) => {
  selectFile(event.dataTransfer.files[0]);
});

dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

window.addEventListener("beforeunload", () => {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
});
