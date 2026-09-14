const input = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const workspace = document.getElementById('workspace');
const canvas = document.getElementById('canvas');
const canvasWrap = document.getElementById('canvasWrap');
const cropBox = document.getElementById('cropBox');
const ratioInput = document.getElementById('ratioInput');
const formatInput = document.getElementById('formatInput');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const cropSize = document.getElementById('cropSize');
const status = document.getElementById('status');
const cropButton = document.getElementById('cropButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');

const ctx = canvas.getContext('2d');
const image = new Image();
let fileName = 'cropped-image';
let imageReady = false;
let crop = { x: 0, y: 0, w: 0, h: 0 };
let display = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
let action = null;

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function showLoader(show) {
  if (typeof window.NexaurenLoader === 'object' && window.NexaurenLoader) {
    if (show && typeof window.NexaurenLoader.show === 'function') window.NexaurenLoader.show();
    if (!show && typeof window.NexaurenLoader.hide === 'function') window.NexaurenLoader.hide();
  }
}

function loadFile(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    setStatus('Please choose a JPG, PNG or WebP image.', 'error');
    return;
  }

  fileName = file.name.replace(/\.[^.]+$/, '') || 'cropped-image';
  setStatus('Loading image…');
  const url = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(url);
    imageReady = true;
    uploadArea.classList.add('hidden');
    workspace.classList.remove('hidden');
    setupCanvas();
    setStatus('Ready to crop.');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Could not read this image. Try another file.', 'error');
  };
  image.src = url;
}

function setupCanvas() {
  const maxW = Math.max(260, canvasWrap.clientWidth - 8);
  const maxH = 560;
  const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
  display.w = Math.round(image.naturalWidth * scale);
  display.h = Math.round(image.naturalHeight * scale);
  display.x = Math.round((canvasWrap.clientWidth - display.w) / 2);
  display.y = Math.round((canvasWrap.clientHeight - display.h) / 2);
  display.scale = scale;

  canvas.width = display.w;
  canvas.height = display.h;
  canvas.style.width = `${display.w}px`;
  canvas.style.height = `${display.h}px`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, display.w, display.h);

  const margin = Math.max(8, Math.round(Math.min(display.w, display.h) * 0.08));
  crop = { x: margin, y: margin, w: display.w - margin * 2, h: display.h - margin * 2 };
  applyRatio(true);
  renderCropBox();
}

function renderCropBox() {
  cropBox.style.left = `${display.x + crop.x}px`;
  cropBox.style.top = `${display.y + crop.y}px`;
  cropBox.style.width = `${crop.w}px`;
  cropBox.style.height = `${crop.h}px`;
  cropSize.textContent = `Crop: ${Math.max(1, Math.round(crop.w / display.scale))} × ${Math.max(1, Math.round(crop.h / display.scale))} px`;
}

function applyRatio(center = false) {
  if (ratioInput.value === 'free') {
    renderCropBox();
    return;
  }

  const ratio = Number(ratioInput.value);
  let w = crop.w;
  let h = w / ratio;
  if (h > display.h) {
    h = display.h;
    w = h * ratio;
  }
  if (w > display.w) {
    w = display.w;
    h = w / ratio;
  }

  if (center) {
    crop.x = (display.w - w) / 2;
    crop.y = (display.h - h) / 2;
  } else {
    crop.w = w;
    crop.h = h;
    crop.x = Math.min(crop.x, display.w - w);
    crop.y = Math.min(crop.y, display.h - h);
  }
  crop.w = w;
  crop.h = h;
  renderCropBox();
}

function pointFromEvent(event) {
  const rect = canvasWrap.getBoundingClientRect();
  return { x: event.clientX - rect.left - display.x, y: event.clientY - rect.top - display.y };
}

function clampCrop() {
  crop.w = Math.max(12, Math.min(crop.w, display.w));
  crop.h = Math.max(12, Math.min(crop.h, display.h));
  crop.x = Math.max(0, Math.min(crop.x, display.w - crop.w));
  crop.y = Math.max(0, Math.min(crop.y, display.h - crop.h));
}

function beginAction(event) {
  if (!imageReady) return;
  const p = pointFromEvent(event);
  if (p.x < crop.x || p.x > crop.x + crop.w || p.y < crop.y || p.y > crop.y + crop.h) return;

  const handle = event.target.classList.contains('handle') ? event.target : null;
  action = {
    type: handle ? 'resize' : 'move',
    startX: p.x,
    startY: p.y,
    start: { ...crop },
    handle: handle ? [...handle.classList].find(c => ['nw', 'ne', 'sw', 'se'].includes(c)) : null
  };
  cropBox.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveAction(event) {
  if (!action) return;
  const p = pointFromEvent(event);
  const dx = p.x - action.startX;
  const dy = p.y - action.startY;

  if (action.type === 'move') {
    crop.x = action.start.x + dx;
    crop.y = action.start.y + dy;
    clampCrop();
    renderCropBox();
    return;
  }

  let left = action.start.x;
  let top = action.start.y;
  let right = action.start.x + action.start.w;
  let bottom = action.start.y + action.start.h;
  const handle = action.handle;

  if (handle.includes('w')) left = Math.max(0, Math.min(right - 12, action.start.x + dx));
  if (handle.includes('e')) right = Math.min(display.w, Math.max(left + 12, action.start.x + action.start.w + dx));
  if (handle.includes('n')) top = Math.max(0, Math.min(bottom - 12, action.start.y + dy));
  if (handle.includes('s')) bottom = Math.min(display.h, Math.max(top + 12, action.start.y + action.start.h + dy));

  let w = right - left;
  let h = bottom - top;
  if (ratioInput.value !== 'free') {
    const ratio = Number(ratioInput.value);
    if (Math.abs(dx) >= Math.abs(dy)) h = w / ratio;
    else w = h * ratio;

    if (handle.includes('w')) left = action.start.x + action.start.w - w;
    if (handle.includes('n')) top = action.start.y + action.start.h - h;
    if (left < 0) { left = 0; w = action.start.x + action.start.w; h = w / ratio; }
    if (top < 0) { top = 0; h = action.start.y + action.start.h; w = h * ratio; }
    if (left + w > display.w) { w = display.w - left; h = w / ratio; }
    if (top + h > display.h) { h = display.h - top; w = h * ratio; }
  }

  crop = { x: left, y: top, w, h };
  clampCrop();
  renderCropBox();
}

function endAction() { action = null; }

function outputExtension(type) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

async function createCrop() {
  if (!imageReady) return;
  showLoader(true);
  cropButton.disabled = true;
  downloadButton.classList.add('hidden');
  setStatus('Creating cropped image…');

  try {
    const scaleX = image.naturalWidth / display.w;
    const scaleY = image.naturalHeight / display.h;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.max(1, Math.round(crop.w * scaleX));
    const sh = Math.max(1, Math.round(crop.h * scaleY));
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext('2d');

    if (formatInput.value === 'image/jpeg') {
      outCtx.fillStyle = '#fff';
      outCtx.fillRect(0, 0, sw, sh);
    }
    outCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise((resolve, reject) => {
      out.toBlob(result => result ? resolve(result) : reject(new Error('Canvas export failed.')), formatInput.value, Number(qualityInput.value) / 100);
    });
    const url = URL.createObjectURL(blob);
    downloadButton.href = url;
    downloadButton.download = `${fileName}-cropped.${outputExtension(formatInput.value)}`;
    downloadButton.classList.remove('hidden');
    setStatus(`Done — ${sw} × ${sh} px ready to download.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus('We could not create the cropped image. Please try again.', 'error');
  } finally {
    cropButton.disabled = false;
    showLoader(false);
  }
}

input.addEventListener('change', event => loadFile(event.target.files?.[0]));
['dragenter', 'dragover'].forEach(type => uploadArea.addEventListener(type, event => {
  event.preventDefault();
  uploadArea.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(type => uploadArea.addEventListener(type, event => {
  event.preventDefault();
  uploadArea.classList.remove('dragging');
}));
uploadArea.addEventListener('drop', event => loadFile(event.dataTransfer.files?.[0]));
ratioInput.addEventListener('change', () => applyRatio(true));
qualityInput.addEventListener('input', () => { qualityValue.textContent = `${qualityInput.value}%`; });
cropBox.addEventListener('pointerdown', beginAction);
window.addEventListener('pointermove', moveAction);
window.addEventListener('pointerup', endAction);
window.addEventListener('resize', () => { if (imageReady) setupCanvas(); });
cropButton.addEventListener('click', createCrop);
resetButton.addEventListener('click', () => {
  imageReady = false;
  input.value = '';
  workspace.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  downloadButton.classList.add('hidden');
  setStatus('');
});
