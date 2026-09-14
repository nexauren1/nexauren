(() => {
  const $ = (id) => document.getElementById(id);
  const dropzone = $('dropzone');
  const input = $('fileInput');
  const choose = $('chooseBtn');
  const filebar = $('filebar');
  const controls = $('controls');
  const fileName = $('fileName');
  const fileInfo = $('fileInfo');
  const remove = $('removeBtn');
  const compress = $('compressBtn');
  const status = $('status');
  const statusTitle = $('statusTitle');
  const statusText = $('statusText');
  const result = $('result');
  const beforeSize = $('beforeSize');
  const afterSize = $('afterSize');
  const reduction = $('reduction');
  const resultMessage = $('resultMessage');
  const download = $('downloadBtn');
  const restart = $('restartBtn');
  const error = $('error');

  let file = null;
  let outputBlob = null;
  let level = 'balanced';

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const presets = {
    balanced: { scale: 1.35, quality: 0.72 },
    strong: { scale: 1.05, quality: 0.56 },
    maximum: { scale: 0.82, quality: 0.42 }
  };

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  function fail(message) {
    error.textContent = message;
    show(error);
    hide(status);
  }
  function setProgress(text) {
    statusText.textContent = text;
  }

  function acceptFile(selected) {
    hide(error);
    hide(result);
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      fail('Please choose a valid PDF file.');
      return;
    }
    if (selected.size === 0) {
      fail('This PDF is empty. Please choose another file.');
      return;
    }
    file = selected;
    outputBlob = null;
    fileName.textContent = file.name;
    fileInfo.textContent = `${formatBytes(file.size)} · PDF ready`;
    hide(dropzone);
    show(filebar);
    show(controls);
  }

  choose.addEventListener('click', () => input.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target !== choose) input.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') input.click();
  });
  input.addEventListener('change', () => acceptFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((event) => {
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach((event) => {
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (e) => acceptFile(e.dataTransfer.files[0]));

  document.querySelectorAll('.level').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.level').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      level = button.dataset.level;
    });
  });

  remove.addEventListener('click', reset);
  restart.addEventListener('click', reset);

  async function compressPdf() {
    if (!file) return;
    hide(error);
    hide(result);
    show(status);
    compress.disabled = true;
    const originalName = file.name.replace(/\.pdf$/i, '');

    try {
      statusTitle.textContent = 'Loading PDF…';
      setProgress('Reading pages locally');
      const buffer = await file.arrayBuffer();
      const source = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const out = await PDFLib.PDFDocument.create();
      const preset = presets[level];

      for (let i = 1; i <= source.numPages; i++) {
        statusTitle.textContent = 'Compressing…';
        setProgress(`Rendering page ${i} of ${source.numPages}`);
        const page = await source.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: preset.scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', preset.quality);
        const jpg = await out.embedJpg(dataUrl);
        const outPage = out.addPage([baseViewport.width, baseViewport.height]);
        outPage.drawImage(jpg, {
          x: 0,
          y: 0,
          width: baseViewport.width,
          height: baseViewport.height
        });
        canvas.width = 1;
        canvas.height = 1;
      }

      statusTitle.textContent = 'Finalizing…';
      setProgress('Building the optimized PDF');
      const bytes = await out.save({ useObjectStreams: true });
      const candidate = new Blob([bytes], { type: 'application/pdf' });

      outputBlob = candidate;
      beforeSize.textContent = formatBytes(file.size);
      afterSize.textContent = formatBytes(candidate.size);
      const percent = file.size ? Math.max(0, (1 - candidate.size / file.size) * 100) : 0;
      reduction.textContent = `${percent.toFixed(1)}%`;

      hide(status);
      show(result);
      resultMessage.textContent = candidate.size < file.size
        ? `Saved ${formatBytes(file.size - candidate.size)} from the original file.`
        : 'This PDF was already highly optimized, so the new copy is not smaller.';
    } catch (err) {
      console.error(err);
      fail('We could not compress this PDF. It may be damaged, encrypted, or unsupported.');
    } finally {
      compress.disabled = false;
    }
  }

  compress.addEventListener('click', compressPdf);

  download.addEventListener('click', () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function reset() {
    file = null;
    outputBlob = null;
    input.value = '';
    fileName.textContent = 'document.pdf';
    fileInfo.textContent = '0 pages · 0 MB';
    hide(filebar);
    hide(controls);
    hide(status);
    hide(result);
    hide(error);
    show(dropzone);
  }
})();
