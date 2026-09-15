(() => {
  const input = document.querySelector('#fileInput');
  const dropZone = document.querySelector('#dropZone');
  const panel = document.querySelector('#previewPanel');
  const preview = document.querySelector('#preview');
  const info = document.querySelector('#fileInfo');
  const convertBtn = document.querySelector('#convertBtn');
  const resetBtn = document.querySelector('#resetBtn');
  const status = document.querySelector('#status');
  let file = null;
  let objectUrl = null;

  const setStatus = (text) => { status.textContent = text; };
  const loader = (show) => {
    if (!window.NexaurenLoader) return;
    show ? window.NexaurenLoader.show() : window.NexaurenLoader.hide();
  };
  const formatSize = (bytes) => bytes < 1048576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1048576).toFixed(2)} MB`;

  function useFile(selected) {
    if (!selected || selected.type !== 'image/webp') {
      setStatus('Please choose a WebP image.');
      return;
    }
    file = selected;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.onload = () => {
      info.textContent = `${file.name} · ${preview.naturalWidth} × ${preview.naturalHeight}px · ${formatSize(file.size)}`;
    };
    panel.classList.remove('hidden');
    setStatus('WebP ready. Convert when you are ready.');
  }

  input.addEventListener('change', () => useFile(input.files[0]));
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
  dropZone.addEventListener('drop', (event) => useFile(event.dataTransfer.files[0]));

  convertBtn.addEventListener('click', async () => {
    if (!file) return setStatus('Choose a WebP image first.');
    loader(true);
    convertBtn.disabled = true;
    setStatus('Converting WebP to PNG…');

    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('Conversion timed out.'));
        }, 20000);
        canvas.toBlob((result) => {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }, 'image/png');
      });
      if (!blob) throw new Error('PNG conversion is not supported.');

      const name = file.name.replace(/\.webp$/i, '') || 'image';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Done · PNG created (${formatSize(blob.size)}).`);
    } catch (error) {
      console.error(error);
      setStatus('We could not convert this WebP. Please try another image.');
    } finally {
      convertBtn.disabled = false;
      loader(false);
    }
  });

  resetBtn.addEventListener('click', () => {
    file = null;
    input.value = '';
    panel.classList.add('hidden');
    preview.removeAttribute('src');
    info.textContent = '';
    setStatus('');
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  });
})();
