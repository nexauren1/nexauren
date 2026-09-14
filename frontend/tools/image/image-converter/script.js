const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const workspace = document.getElementById('workspace');
const preview = document.getElementById('preview');
const fileMeta = document.getElementById('fileMeta');
const formatInput = document.getElementById('formatInput');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const qualityGroup = document.getElementById('qualityGroup');
const formatNote = document.getElementById('formatNote');
const convertButton = document.getElementById('convertButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const status = document.getElementById('status');

let currentImage = null;
let sourceName = 'nexauren-image';
let sourceUrl = null;
let resultUrl = null;

const formatNames = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP'
};

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extensionFor(type) {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
}

function updateFormatUI() {
  const type = formatInput.value;
  const isLossy = type !== 'image/png';
  qualityGroup.classList.toggle('hidden', !isLossy);

  if (type === 'image/png') {
    formatNote.textContent = 'PNG preserves transparency and uses lossless encoding. Quality is not adjustable.';
  } else if (type === 'image/jpeg') {
    formatNote.textContent = 'JPG is ideal for photographs. Transparent areas will be placed on a white background.';
  } else {
    formatNote.textContent = 'WebP is a modern format with strong compression and transparency support.';
  }
}

function loadImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setStatus('Please choose a JPG, PNG or WebP image.', 'error');
    return;
  }

  window.NexaurenLoader?.showProcessing('Loading image…');
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    currentImage = img;
    sourceName = file.name.replace(/\.[^/.]+$/, '') || 'nexauren-image';
    preview.src = sourceUrl;
    fileMeta.textContent = `${file.name} · ${img.width} × ${img.height}px · ${formatBytes(file.size)}`;
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    downloadButton.classList.add('hidden');
    setStatus(`Ready to convert from ${formatNames[file.type] || 'image'}.`);
    window.NexaurenLoader?.hideProcessing();
  };
  img.onerror = () => {
    setStatus('We could not read this image.', 'error');
    window.NexaurenLoader?.hideProcessing();
    URL.revokeObjectURL(sourceUrl);
    sourceUrl = null;
  };
  img.src = sourceUrl;
}

function handleFiles(files) {
  if (files && files.length) loadImage(files[0]);
}

imageInput.addEventListener('change', () => handleFiles(imageInput.files));

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(event.dataTransfer.files);
});

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

formatInput.addEventListener('change', updateFormatUI);

convertButton.addEventListener('click', () => {
  if (!currentImage) return;

  window.NexaurenLoader?.showProcessing('Converting image…');
  convertButton.disabled = true;
  setStatus('Converting locally…');

  const type = formatInput.value;
  const canvas = document.createElement('canvas');
  canvas.width = currentImage.naturalWidth || currentImage.width;
  canvas.height = currentImage.naturalHeight || currentImage.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    setStatus('Your browser could not create the conversion canvas.', 'error');
    convertButton.disabled = false;
    window.NexaurenLoader?.hideProcessing();
    return;
  }

  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(currentImage, 0, 0);

  const quality = Number(qualityInput.value) / 100;
  canvas.toBlob((blob) => {
    convertButton.disabled = false;

    if (!blob) {
      setStatus(`This browser could not export ${formatNames[type]}.`, 'error');
      window.NexaurenLoader?.hideProcessing();
      return;
    }

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    preview.src = resultUrl;
    downloadButton.href = resultUrl;
    downloadButton.download = `${sourceName}.${extensionFor(type)}`;
    downloadButton.classList.remove('hidden');
    fileMeta.textContent = `Result · ${formatNames[type]} · ${canvas.width} × ${canvas.height}px · ${formatBytes(blob.size)}`;
    setStatus(`Converted successfully to ${formatNames[type]}.`, 'success');
    window.NexaurenLoader?.hideProcessing();
  }, type, quality);
});

resetButton.addEventListener('click', () => {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  sourceUrl = null;
  resultUrl = null;
  currentImage = null;
  imageInput.value = '';
  preview.removeAttribute('src');
  workspace.classList.add('hidden');
  dropZone.classList.remove('hidden');
  downloadButton.classList.add('hidden');
  setStatus('');
});

updateFormatUI();
