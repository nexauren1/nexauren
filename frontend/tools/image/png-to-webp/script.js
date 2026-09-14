(() => {
  const input = document.querySelector('#fileInput');
  const dropZone = document.querySelector('#dropZone');
  const panel = document.querySelector('#previewPanel');
  const preview = document.querySelector('#preview');
  const info = document.querySelector('#fileInfo');
  const quality = document.querySelector('#quality');
  const qualityValue = document.querySelector('#qualityValue');
  const convertBtn = document.querySelector('#convertBtn');
  const resetBtn = document.querySelector('#resetBtn');
  const status = document.querySelector('#status');

  let file = null;
  let objectUrl = null;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const loader = (show) => {
    if (!window.NexaurenLoader) return;
    show ? window.NexaurenLoader.show() : window.NexaurenLoader.hide();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const useFile = (selected) => {
    if (!selected || selected.type !== 'image/png') {
      setStatus('Please choose a PNG image.');
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
    setStatus('PNG ready. Choose the quality and convert.');
  };

  input.addEventListener('change', () => useFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    useFile(event.dataTransfer.files[0]);
  });

  quality.addEventListener('input', () => {
    qualityValue.value = quality.value;
    qualityValue.textContent = quality.value;
  });

  convertBtn.addEventListener('click', async () => {
    if (!file) {
      setStatus('Choose a PNG image first.');
      return;
    }

    loader(true);
    setStatus('Converting PNG to WebP…');
    convertBtn.disabled = true;

    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(resolve, 'image/webp', Number(quality.value) / 100);
        setTimeout(() => reject(new Error('Conversion timed out.')), 20000);
      });

      if (!blob) throw new Error('WebP is not supported by this browser.');

      const name = file.name.replace(/\.png$/i, '') || 'image';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}.webp`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus(`Done · WebP created (${formatSize(blob.size)}).`);
    } catch (error) {
      console.error(error);
      setStatus('We could not convert this PNG. Please try another image or browser.');
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
