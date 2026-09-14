const { PDFDocument } = PDFLib;

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
let previewUrls = [];

function clearPreviewUrls() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
}

function clearMessages() {
  status.hidden = true;
  errorBox.hidden = true;
  result.hidden = true;
}

function showError(message) {
  status.hidden = true;
  result.hidden = true;
  errorText.textContent = message;
  errorBox.hidden = false;
}

function setProgress(title, text) {
  statusTitle.textContent = title;
  statusText.textContent = text;
  status.hidden = false;
  errorBox.hidden = true;
  result.hidden = true;
}

function updateProgress(text) {
  statusText.textContent = text;
}

function render() {
  clearPreviewUrls();
  workspace.hidden = files.length === 0;

  if (!files.length) {
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = '';

  files.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.draggable = true;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = document.createElement('img');
    img.alt = file.name;
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    img.src = url;
    thumb.appendChild(img);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = `${index + 1}. ${file.name}`;
    name.title = file.name;

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.onclick = event => {
      event.stopPropagation();
      files.splice(index, 1);
      outputBlob = null;
      clearMessages();
      render();
    };

    footer.append(name, remove);
    card.append(thumb, footer);

    card.ondragstart = () => {
      draggedIndex = index;
      card.classList.add('dragging');
    };

    card.ondragend = () => {
      draggedIndex = null;
      card.classList.remove('dragging');
    };

    card.ondragover = event => event.preventDefault();

    card.ondrop = event => {
      event.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      const [moved] = files.splice(draggedIndex, 1);
      files.splice(index, 0, moved);
      draggedIndex = null;
      outputBlob = null;
      clearMessages();
      render();
    };

    grid.appendChild(card);
  });
}

function addFiles(list) {
  const incoming = Array.from(list);
  const rejected = incoming.filter(
    file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  );
  const accepted = incoming.filter(
    file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  );

  if (!accepted.length) {
    showError('Please choose JPG, PNG or WebP images.');
    return;
  }

  const unique = accepted.filter(file => !files.some(existing =>
    existing.name === file.name &&
    existing.size === file.size &&
    existing.lastModified === file.lastModified
  ));

  files.push(...unique);
  outputBlob = null;
  clearMessages();
  render();

  if (rejected.length) {
    showError(`${rejected.length} unsupported file${rejected.length === 1 ? '' : 's'} skipped. Use JPG, PNG or WebP.`);
  }
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) throw new Error(`Could not read ${file.name}.`);
    return { bytes, type: file.type };
  }

  const img = await readImage(file);
  const maxDimension = 2400;
  const scale = Math.min(
    1,
    maxDimension / Math.max(img.naturalWidth, img.naturalHeight)
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`Could not prepare ${file.name}.`);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      value => value ? resolve(value) : reject(
        new Error(`Could not prepare ${file.name}.`)
      ),
      'image/jpeg',
      0.92
    );
  });

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    type: 'image/jpeg'
  };
}

function pageDimensions(width, height) {
  const mode = sizeSelect.value;
  let pageWidth = width;
  let pageHeight = height;

  if (mode === 'a4') {
    pageWidth = 595.28;
    pageHeight = 841.89;
  } else if (mode === 'letter') {
    pageWidth = 612;
    pageHeight = 792;
  }

  if (mode !== 'fit') {
    const landscape = orientationSelect.value === 'landscape' ||
      (orientationSelect.value === 'auto' && width > height);

    if (landscape && pageHeight > pageWidth) {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }

    if (orientationSelect.value === 'portrait' && pageWidth > pageHeight) {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }
  }

  return [pageWidth, pageHeight];
}

async function createPdf() {
  if (!files.length) {
    showError('Add at least one image before creating the PDF.');
    return;
  }

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

      const [pageWidth, pageHeight] = pageDimensions(
        image.width,
        image.height
      );

      const page = pdf.addPage([pageWidth, pageHeight]);
      const maxWidth = Math.max(1, pageWidth - margin * 2);
      const maxHeight = Math.max(1, pageHeight - margin * 2);
      const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height
      );

      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

      page.drawImage(image, {
        x: (pageWidth - drawWidth) / 2,
        y: (pageHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
      });
    }

    updateProgress('Finalizing your PDF…', 'Almost done');

    const bytes = await pdf.save({ useObjectStreams: true });
    if (!bytes?.length) throw new Error('The PDF could not be created.');

    outputBlob = new Blob([bytes], { type: 'application/pdf' });
    status.hidden = true;
    resultText.textContent =
      `${files.length} image${files.length === 1 ? '' : 's'} combined · ` +
      `${(outputBlob.size / 1024 / 1024).toFixed(2)} MB`;
    result.hidden = false;
  } catch (error) {
    showError(error?.message || 'The images could not be converted. Try different files.');
  } finally {
    createBtn.disabled = false;
  }
}

function download() {
  if (!outputBlob) {
    showError('Create the PDF first.');
    return;
  }

  const url = URL.createObjectURL(outputBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nexauren-images-to-pdf.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reset() {
  clearPreviewUrls();
  files = [];
  outputBlob = null;
  draggedIndex = null;
  input.value = '';
  clearMessages();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

chooseBtn.onclick = event => {
  event.stopPropagation();
  input.click();
};

addBtn.onclick = event => {
  event.stopPropagation();
  input.click();
};

dropZone.onclick = event => {
  if (event.target.closest('button')) return;
  input.click();
};

dropZone.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    input.click();
  }
};

input.onchange = () => {
  addFiles(input.files);
  input.value = '';
};

dropZone.ondragover = event => {
  event.preventDefault();
  dropZone.classList.add('dragover');
};

dropZone.ondragleave = () => dropZone.classList.remove('dragover');

dropZone.ondrop = event => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(event.dataTransfer.files);
};

clearBtn.onclick = reset;
createBtn.onclick = createPdf;
downloadBtn.onclick = download;
resetBtn.onclick = reset;

// Always start in a clean state: no result, no status and no workspace.
files = [];
outputBlob = null;
input.value = '';
clearMessages();
render();