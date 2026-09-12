const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const workspace = document.getElementById('workspace');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const fileInfo = document.getElementById('fileInfo');
const enhanceButton = document.getElementById('enhanceButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const status = document.getElementById('status');

const controls = {
  sharpness: document.getElementById('sharpness'),
  contrast: document.getElementById('contrast'),
  brightness: document.getElementById('brightness'),
  saturation: document.getElementById('saturation')
};

const values = {
  sharpness: document.getElementById('sharpnessValue'),
  contrast: document.getElementById('contrastValue'),
  brightness: document.getElementById('brightnessValue'),
  saturation: document.getElementById('saturationValue')
};

let sourceImage = null;
let sourceName = 'nexauren-image';
let downloadUrl = '';

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function updateLabels() {
  values.sharpness.textContent = `${controls.sharpness.value}%`;
  values.contrast.textContent = `${Number(controls.contrast.value) >= 0 ? '+' : ''}${controls.contrast.value}%`;
  values.brightness.textContent = `${Number(controls.brightness.value) >= 0 ? '+' : ''}${controls.brightness.value}%`;
  values.saturation.textContent = `${Number(controls.saturation.value) >= 0 ? '+' : ''}${controls.saturation.value}%`;
}

function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Selecione uma imagem JPG, PNG ou WebP.', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    sourceImage = img;
    sourceName = file.name.replace(/\.[^/.]+$/, '') || 'nexauren-image';
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    fileInfo.textContent = `${file.name} • ${img.naturalWidth} × ${img.naturalHeight}px • ${formatBytes(file.size)}`;
    uploadArea.classList.add('hidden');
    workspace.classList.remove('hidden');
    downloadButton.classList.add('hidden');
    setStatus('Imagem carregada. Ajuste os níveis e melhore a imagem.');
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Não foi possível carregar esta imagem.', 'error');
  };

  img.src = url;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function sharpen(imageData, amount) {
  if (amount <= 0) return imageData;

  const {data, width, height} = imageData;
  const source = new Uint8ClampedArray(data);
  const strength = amount / 100;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = source[i + channel] * (1 + 4 * strength)
          - source[i - 4 + channel] * strength
          - source[i + 4 + channel] * strength
          - source[i - width * 4 + channel] * strength
          - source[i + width * 4 + channel] * strength;
        data[i + channel] = clamp(value);
      }
    }
  }

  return imageData;
}

function enhance() {
  if (!sourceImage) return;

  enhanceButton.disabled = true;
  setStatus('A melhorar a imagem…');
  window.NexaurenLoader?.show();

  requestAnimationFrame(() => {
    try {
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;
      ctx.filter = `brightness(${100 + Number(controls.brightness.value)}%) contrast(${100 + Number(controls.contrast.value)}%) saturate(${100 + Number(controls.saturation.value)}%)`;
      ctx.drawImage(sourceImage, 0, 0);
      ctx.filter = 'none';

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      sharpen(data, Number(controls.sharpness.value));
      ctx.putImageData(data, 0, 0);

      canvas.toBlob(blob => {
        if (!blob) {
          setStatus('Não foi possível gerar o resultado.', 'error');
          return;
        }

        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(blob);
        downloadButton.href = downloadUrl;
        downloadButton.download = `${sourceName}-enhanced.png`;
        downloadButton.classList.remove('hidden');
        fileInfo.textContent = `Resultado • ${canvas.width} × ${canvas.height}px • ${formatBytes(blob.size)}`;
        setStatus('Imagem melhorada com sucesso.', 'success');
        window.NexaurenLoader?.hide(120);
      }, 'image/png');
    } catch (error) {
      setStatus('Não foi possível processar esta imagem.', 'error');
      window.NexaurenLoader?.hide(120);
    } finally {
      enhanceButton.disabled = false;
    }
  });
}

imageInput.addEventListener('change', () => loadImage(imageInput.files[0]));
enhanceButton.addEventListener('click', enhance);

Object.values(controls).forEach(control => {
  control.addEventListener('input', updateLabels);
});

resetButton.addEventListener('click', () => {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = '';
  sourceImage = null;
  imageInput.value = '';
  canvas.width = 1;
  canvas.height = 1;
  uploadArea.classList.remove('hidden');
  workspace.classList.add('hidden');
  downloadButton.classList.add('hidden');
  controls.sharpness.value = 40;
  controls.contrast.value = 10;
  controls.brightness.value = 5;
  controls.saturation.value = 5;
  updateLabels();
  setStatus('');
});

updateLabels();
