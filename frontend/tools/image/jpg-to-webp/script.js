const fileInput = document.getElementById('fileInput');
const chooseBtn = document.getElementById('chooseBtn');
const dropZone = document.getElementById('dropZone');
const workspace = document.getElementById('workspace');
const preview = document.getElementById('preview');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const quality = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const status = document.getElementById('status');

let currentFile = null;
let currentImage = null;

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function loader(show) {
  if (window.NexaurenLoader) {
    show ? window.NexaurenLoader.show() : window.NexaurenLoader.hide();
  }
}

function pickFile() { fileInput.click(); }
chooseBtn.addEventListener('click', pickFile);
dropZone.addEventListener('click', (event) => {
  if (event.target !== chooseBtn) pickFile();
});
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') pickFile();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

['dragenter', 'dragover'].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
});
['dragleave', 'drop'].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  });
});
dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (file) loadFile(file);
});

quality.addEventListener('input', () => {
  qualityValue.textContent = `${quality.value}%`;
});

function loadFile(file) {
  if (file.type !== 'image/jpeg') {
    setStatus('Please choose a JPG or JPEG image.', 'error');
    return;
  }

  currentFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      currentImage = image;
      preview.src = reader.result;
      fileName.textContent = file.name;
      fileMeta.textContent = `JPG · ${image.naturalWidth} × ${image.naturalHeight} · ${formatSize(file.size)}`;
      dropZone.hidden = true;
      workspace.hidden = false;
      setStatus('JPG ready. Adjust the quality and convert.');
    };
    image.onerror = () => setStatus('This JPG could not be read.', 'error');
    image.src = reader.result;
  };
  reader.onerror = () => setStatus('Could not read this file.', 'error');
  reader.readAsDataURL(file);
}

convertBtn.addEventListener('click', () => {
  if (!currentImage) return;
  loader(true);
  setStatus('Converting JPG to WebP…');
  convertBtn.disabled = true;

  requestAnimationFrame(() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = currentImage.naturalWidth;
      canvas.height = currentImage.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(currentImage, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) throw new Error('WebP is not supported by this browser.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName(currentFile.name)}.webp`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus(`WebP created successfully · ${formatSize(blob.size)}`, 'success');
        convertBtn.disabled = false;
        loader(false);
      }, 'image/webp', Number(quality.value) / 100);
    } catch (error) {
      console.error(error);
      setStatus('We could not convert this JPG. Please try another image.', 'error');
      convertBtn.disabled = false;
      loader(false);
    }
  });
});

resetBtn.addEventListener('click', () => {
  currentFile = null;
  currentImage = null;
  preview.removeAttribute('src');
  fileInput.value = '';
  workspace.hidden = true;
  dropZone.hidden = false;
  convertBtn.disabled = false;
  setStatus('');
});

function baseName(name) {
  return name.replace(/\.(jpe?g)$/i, '') || 'image';
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
