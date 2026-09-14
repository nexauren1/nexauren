const { PDFDocument, rgb } = PDFLib;
const input = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const chooseBtn = document.getElementById('chooseBtn');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const grid = document.getElementById('imageGrid');
const workspace = document.getElementById('workspace');
const createBtn = document.getElementById('createBtn');
const status = document.getElementById('status');
const statusTitle = document.getElementById('statusTitle');
const statusText = document.getElementById('statusText');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');
const result = document.getElementById('result');
const resultText = document.getElementById('resultText');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const sizeSelect = document.getElementById('sizeSelect');
const orientationSelect = document.getElementById('orientationSelect');
const marginSelect = document.getElementById('marginSelect');

let files = [];
let outputBlob = null;
let draggedIndex = null;

function addFiles(list) {
  const accepted = Array.from(list).filter(f =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
  );
  files.push(...accepted);
  files = files.filter((f, i, a) =>
    a.findIndex(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified) === i
  );
  render();
}

function render() {
  workspace.hidden = files.length === 0;
  if (!files.length) return;
  grid.innerHTML = '';
  files.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.draggable = true;
    card.dataset.index = index;
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    thumb.appendChild(img);
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = `${index + 1}. ${file.name}`;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', e => {
      e.stopPropagation();
      files.splice(index, 1);
      render();
    });
    footer.append(name, remove);
    card.append(thumb, footer);
    card.addEventListener('dragstart', () => {
      draggedIndex = index;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => e.preventDefault());
    card.addEventListener('drop', e => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      const [moved] = files.splice(draggedIndex, 1);
      files.splice(index, 0, moved);
      draggedIndex = null;
      render();
    });
    grid.appendChild(card);
  });
}

function showError(message) {
  errorText.textContent = message;
  errorBox.hidden = false;
}
function clearMessages() {
  errorBox.hidden = true;
  result.hidden = true;
  status.hidden = true;
}
function setProgress(title, text) {
  statusTitle.textContent = title;
  statusText.textContent = text;
  status.hidden = false;
}
function updateProgress(text) {
  statusText.textContent = text;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}.`));
    };
    img.src = url;
  });
}

async function imageForPdf(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type };
  }
  const img = await readImage(file);
  const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/jpeg' };
}

function pageDimensions(imageWidth, imageHeight) {
  const mode = sizeSelect.value;
  let pageW = imageWidth;
  let pageH = imageHeight;
  if (mode === 'a4') {
    pageW = 595.28; pageH = 841.89;
  } else if (mode === 'letter') {
    pageW = 612; pageH = 792;
  }
  const orientation = orientationSelect.value;
  if (mode !== 'fit') {
    const shouldLandscape = orientation === 'landscape' ||
      (orientation === 'auto' && imageWidth > imageHeight);
    if (shouldLandscape && pageH > pageW) [pageW, pageH] = [pageH, pageW];
    if (orientation === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
  }
  return [pageW, pageH];
}

async function createPdf() {
  if (!files.length) return;
  clearMessages();
  createBtn.disabled = true;
  setProgress('Creating your PDF…', `Preparing image 1 of ${files.length}`);
  try {
    const pdf = await PDFDocument.create();
    const margin = Number(marginSelect.value);

    for (let i = 0; i < files.length; i++) {
      updateProgress(`Processing image ${i + 1} of ${files.length}`);
      const source = await imageForPdf(files[i]);
      const image = source.type === 'image/png'
        ? await pdf.embedPng(source.bytes)
        : await pdf.embedJpg(source.bytes);
      const [pageW, pageH] = pageDimensions(image.width, image.height);
      const page = pdf.addPage([pageW, pageH]);
      const maxW = Math.max(1, pageW - margin * 2);
      const maxH = Math.max(1, pageH - margin * 2);
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      page.drawImage(image, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    updateProgress('Finalizing your PDF…', 'Almost done');
    const bytes = await pdf.save({ useObjectStreams: true });
    outputBlob = new Blob([bytes], { type: 'application/pdf' });
    status.hidden = true;
    resultText.textContent = `${files.length} image${files.length === 1 ? '' : 's'} combined · ${(outputBlob.size / 1024 / 1024).toFixed(2)} MB`;
    result.hidden = false;
  } catch (err) {
    status.hidden = true;
    showError(err?.message || 'The images could not be converted. Try different files.');
  } finally {
    createBtn.disabled = false;
  }
}

function download() {
  if (!outputBlob) return;
  const url = URL.createObjectURL(outputBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexauren-images-to-pdf.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reset() {
  files = [];
  outputBlob = null;
  input.value = '';
  clearMessages();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

chooseBtn.addEventListener('click', e => { e.stopPropagation(); input.click(); });
addBtn.addEventListener('click', () => input.click());
dropZone.addEventListener('click', () => input.click());
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') input.click();
});
input.addEventListener('change', () => addFiles(input.files));
dropZone.addEventListener('dragover', e => { e.preventDefault(); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});
clearBtn.addEventListener('click', reset);
createBtn.addEventListener('click', createPdf);
downloadBtn.addEventListener('click', download);
resetBtn.addEventListener('click', reset);
