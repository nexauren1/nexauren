const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const workspace = document.getElementById('workspace');
const preview = document.getElementById('preview');
const fileInfo = document.getElementById('fileInfo');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const lockRatio = document.getElementById('lockRatio');
const formatInput = document.getElementById('formatInput');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const resizeButton = document.getElementById('resizeButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const status = document.getElementById('status');

let currentImage = null;
let ratio = 1;
let sourceName = 'nexauren-image';

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Selecione um ficheiro de imagem válido.', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    currentImage = img;
    ratio = img.width / img.height;
    sourceName = file.name.replace(/\.[^/.]+$/, '') || 'nexauren-image';

    preview.src = url;
    widthInput.value = img.width;
    heightInput.value = img.height;
    fileInfo.textContent = `${file.name} • ${img.width} × ${img.height}px • ${formatBytes(file.size)}`;

    uploadArea.classList.add('hidden');
    workspace.classList.remove('hidden');
    downloadButton.classList.add('hidden');
    setStatus('Imagem carregada. Ajuste as dimensões e processe.');
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Não foi possível carregar esta imagem.', 'error');
  };

  img.src = url;
}

imageInput.addEventListener('change', () => {
  loadImage(imageInput.files[0]);
});

widthInput.addEventListener('input', () => {
  if (lockRatio.checked && ratio && widthInput.value) {
    heightInput.value = Math.max(1, Math.round(widthInput.value / ratio));
  }
});

heightInput.addEventListener('input', () => {
  if (lockRatio.checked && ratio && heightInput.value) {
    widthInput.value = Math.max(1, Math.round(heightInput.value * ratio));
  }
});

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

resizeButton.addEventListener('click', () => {
  if (!currentImage) return;

  const width = Number(widthInput.value);
  const height = Number(heightInput.value);

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    setStatus('Informe uma largura e uma altura válidas.', 'error');
    return;
  }

  if (width < 1 || height < 1) {
    setStatus('A largura e a altura devem ser maiores que zero.', 'error');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (formatInput.value === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(currentImage, 0, 0, width, height);

  const quality = Number(qualityInput.value) / 100;
  const extension = formatInput.value === 'image/png'
    ? 'png'
    : formatInput.value === 'image/webp'
      ? 'webp'
      : 'jpg';

  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Não foi possível gerar a imagem.', 'error');
      return;
    }

    const url = URL.createObjectURL(blob);
    downloadButton.href = url;
    downloadButton.download = `${sourceName}-${width}x${height}.${extension}`;
    downloadButton.classList.remove('hidden');

    preview.src = url;
    fileInfo.textContent = `Resultado • ${width} × ${height}px • ${formatBytes(blob.size)}`;
    setStatus('Imagem processada com sucesso.', 'success');
  }, formatInput.value, quality);
});

resetButton.addEventListener('click', () => {
  if (downloadButton.href.startsWith('blob:')) {
    URL.revokeObjectURL(downloadButton.href);
  }

  currentImage = null;
  imageInput.value = '';
  preview.removeAttribute('src');
  workspace.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  downloadButton.classList.add('hidden');
  setStatus('');
});
