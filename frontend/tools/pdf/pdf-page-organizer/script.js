const { PDFDocument } = PDFLib;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const input = document.getElementById('fileInput');
const drop = document.getElementById('dropZone');
const choose = document.getElementById('chooseBtn');
const clearBtn = document.getElementById('clearBtn');
const grid = document.getElementById('pageGrid');
const workspace = document.getElementById('workspace');
const meta = document.getElementById('fileMeta');
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

let sourceFile = null;
let sourceBytes = null;
let pages = [];
let dragged = null;
let output = null;

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

function showProgress(title, text) {
  errorBox.hidden = true;
  result.hidden = true;
  statusTitle.textContent = title;
  statusText.textContent = text;
  status.hidden = false;
}

function copyCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function renderPages() {
  grid.innerHTML = '';

  pages.forEach((page, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.draggable = true;

    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.appendChild(page.canvas);

    const info = document.createElement('div');
    info.className = 'page-info';

    const number = document.createElement('div');
    number.className = 'page-number';
    number.textContent = `Page ${index + 1}`;

    const actions = document.createElement('div');
    actions.className = 'page-actions';

    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.textContent = 'Duplicate';
    duplicate.onclick = () => {
      pages.splice(index, 0, {
        ref: page.ref,
        canvas: copyCanvas(page.canvas)
      });
      output = null;
      clearMessages();
      renderPages();
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.onclick = () => {
      pages.splice(index, 1);
      output = null;
      clearMessages();
      renderPages();
    };

    actions.append(duplicate, remove);
    info.append(number, actions);
    card.append(preview, info);

    card.ondragstart = () => {
      dragged = index;
      card.classList.add('dragging');
    };

    card.ondragend = () => {
      dragged = null;
      card.classList.remove('dragging');
    };

    card.ondragover = event => {
      event.preventDefault();
      card.classList.add('drag-over');
    };

    card.ondragleave = () => card.classList.remove('drag-over');

    card.ondrop = event => {
      event.preventDefault();
      card.classList.remove('drag-over');

      if (dragged === null || dragged === index) return;

      const [moved] = pages.splice(dragged, 1);
      pages.splice(index, 0, moved);
      dragged = null;
      output = null;
      clearMessages();
      renderPages();
    };

    grid.appendChild(card);
  });
}

async function load(file) {
  if (!file) return;

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showError('Please choose a valid PDF file.');
    return;
  }

  sourceFile = file;
  sourceBytes = null;
  output = null;
  pages = [];
  clearMessages();
  workspace.hidden = true;
  showProgress('Reading your PDF…', 'Preparing page previews');

  try {
    sourceBytes = new Uint8Array(await file.arrayBuffer());

    if (!sourceBytes.length) {
      throw new Error('The PDF file is empty.');
    }

    const document = await pdfjsLib.getDocument({
      data: sourceBytes
    }).promise;

    meta.textContent =
      `${document.numPages} page${document.numPages === 1 ? '' : 's'} · ` +
      `${(file.size / 1024 / 1024).toFixed(2)} MB`;

    workspace.hidden = false;

    for (let i = 1; i <= document.numPages; i++) {
      statusText.textContent =
        `Rendering page ${i} of ${document.numPages}`;

      const page = await document.getPage(i);
      const width = page.view[2] - page.view[0];
      const height = page.view[3] - page.view[1];
      const scale = Math.min(1.25, 250 / Math.max(width, height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise;

      pages.push({
        ref: i,
        canvas
      });
    }

    status.hidden = true;
    renderPages();
  } catch (error) {
    sourceFile = null;
    sourceBytes = null;
    pages = [];
    workspace.hidden = true;
    showError(
      error?.message ||
      'The PDF could not be read. Try another PDF file.'
    );
  }
}

async function create() {
  if (!sourceBytes || !sourceBytes.length) {
    showError('Please choose a PDF before creating the organized file.');
    return;
  }

  if (!pages.length) {
    showError('Keep at least one page before creating the PDF.');
    return;
  }

  createBtn.disabled = true;
  output = null;
  showProgress('Creating your PDF…', 'Applying the new page order');

  try {
    let pdf;

    try {
      pdf = await PDFDocument.load(sourceBytes, {
        ignoreEncryption: false,
        updateMetadata: false
      });
    } catch (parseError) {
      // Some PDFs are accepted by PDF.js but rejected by pdf-lib because
      // their header or internal structure is slightly non-standard.
      // In that case, rebuild a clean PDF from the already rendered pages.
      statusText.textContent = 'Rebuilding a clean PDF from the page previews';
      pdf = null;
    }

    if (pdf) {
      const organized = await PDFDocument.create();
      const indices = pages.map(page => page.ref - 1);
      const copied = await organized.copyPages(pdf, indices);

      copied.forEach(page => organized.addPage(page));

      const bytes = await organized.save({
        useObjectStreams: true
      });

      if (!bytes?.length) {
        throw new Error('The organized PDF was empty.');
      }

      output = new Blob([bytes], {
        type: 'application/pdf'
      });
    } else {
      const rebuilt = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        statusText.textContent =
          `Rebuilding page ${i + 1} of ${pages.length}`;

        const canvas = pages[i].canvas;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const image = await rebuilt.embedJpg(dataUrl);
        const ratio = image.width / image.height;
        const maxWidth = 595;
        const maxHeight = 842;
        let width = maxWidth;
        let height = width / ratio;

        if (height > maxHeight) {
          height = maxHeight;
          width = height * ratio;
        }

        const page = rebuilt.addPage([width, height]);
        page.drawImage(image, {
          x: (maxWidth - width) / 2,
          y: (maxHeight - height) / 2,
          width,
          height
        });
      }

      const bytes = await rebuilt.save({
        useObjectStreams: true
      });

      if (!bytes?.length) {
        throw new Error('The rebuilt PDF was empty.');
      }

      output = new Blob([bytes], {
        type: 'application/pdf'
      });
    }

    status.hidden = true;
    resultText.textContent =
      `${pages.length} page${pages.length === 1 ? '' : 's'} organized successfully`;
    result.hidden = false;
  } catch (error) {
    output = null;
    showError(
      error?.message ||
      'The PDF could not be organized. Try another PDF file.'
    );
  } finally {
    createBtn.disabled = false;
  }
}

function download() {
  if (!output) {
    showError('Create the organized PDF first.');
    return;
  }

  const url = URL.createObjectURL(output);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nexauren-organized.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reset() {
  sourceFile = null;
  sourceBytes = null;
  pages = [];
  dragged = null;
  output = null;
  input.value = '';
  workspace.hidden = true;
  grid.innerHTML = '';
  clearMessages();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

choose.onclick = event => {
  event.stopPropagation();
  input.click();
};

drop.onclick = event => {
  if (!event.target.closest('button')) input.click();
};

drop.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    input.click();
  }
};

input.onchange = () => {
  const file = input.files?.[0];
  input.value = '';
  load(file);
};

drop.ondragover = event => {
  event.preventDefault();
  drop.classList.add('dragover');
};

drop.ondragleave = () => drop.classList.remove('dragover');

drop.ondrop = event => {
  event.preventDefault();
  drop.classList.remove('dragover');
  load(event.dataTransfer.files?.[0]);
};

clearBtn.onclick = reset;
createBtn.onclick = create;
downloadBtn.onclick = download;
resetBtn.onclick = reset;

clearMessages();