(() => {
  const $ = (id) => document.getElementById(id);
  const input = $('fileInput'), zone = $('uploadZone'), workspace = $('workspace');
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const text = $('text'), position = $('position'), size = $('size'), opacity = $('opacity');
  const rotation = $('rotation'), color = $('color'), format = $('format'), status = $('status');
  const sizeOut = $('sizeOut'), opacityOut = $('opacityOut'), rotationOut = $('rotationOut');
  let image = null, file = null, sourceUrl = null;

  const setStatus = (message) => { status.textContent = message; };
  const loader = (show) => {
    if (!window.NexaurenLoader) return;
    show ? window.NexaurenLoader.show() : window.NexaurenLoader.hide();
  };
  const ext = () => ({'image/jpeg':'jpg','image/webp':'webp','image/png':'png'})[format.value];

  function draw() {
    if (!image) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0);
    const scale = Math.max(image.naturalWidth, image.naturalHeight) / 1200;
    const fontSize = Number(size.value) * Math.max(1, scale);
    const label = text.value || 'NEXAUREN';
    ctx.save();
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const metrics = ctx.measureText(label);
    const pad = fontSize * .45;
    const w = metrics.width + pad * 2;
    const h = fontSize + pad;
    const margin = Math.max(24, fontSize * .65);
    const pos = {
      tl:[margin+w/2,margin+h/2], tc:[canvas.width/2,margin+h/2], tr:[canvas.width-margin-w/2,margin+h/2],
      ml:[margin+w/2,canvas.height/2], mc:[canvas.width/2,canvas.height/2], mr:[canvas.width-margin-w/2,canvas.height/2],
      bl:[margin+w/2,canvas.height-margin-h/2], bc:[canvas.width/2,canvas.height-margin-h/2], br:[canvas.width-margin-w/2,canvas.height-margin-h/2]
    }[position.value];
    ctx.translate(pos[0], pos[1]);
    ctx.rotate(Number(rotation.value) * Math.PI / 180);
    ctx.globalAlpha = Number(opacity.value) / 100;
    ctx.fillStyle = color.value;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  function loadFile(selected) {
    if (!selected || !['image/jpeg','image/png','image/webp'].includes(selected.type)) {
      setStatus('Please choose a JPG, PNG or WebP image.'); return;
    }
    file = selected;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    image = new Image();
    image.onload = () => { workspace.classList.remove('hidden'); draw(); setStatus('Watermark ready. Adjust the controls and download.'); };
    image.onerror = () => setStatus('We could not read this image.');
    image.src = sourceUrl;
  }

  $('chooseBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => loadFile(input.files[0]));
  ['dragenter','dragover'].forEach((eventName) => zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.add('dragging'); }));
  ['dragleave','drop'].forEach((eventName) => zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.remove('dragging'); }));
  zone.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  [text,position,size,opacity,rotation,color].forEach((control) => control.addEventListener('input', () => {
    sizeOut.textContent = `${size.value}px`; opacityOut.textContent = `${opacity.value}%`; rotationOut.textContent = `${rotation.value}°`; draw();
  }));
  position.addEventListener('change', draw);

  $('downloadBtn').addEventListener('click', () => {
    if (!image) return;
    loader(true); setStatus('Creating your watermarked image…');
    requestAnimationFrame(() => {
      try {
        draw();
        const mime = format.value;
        canvas.toBlob((blob) => {
          if (!blob) throw new Error('Could not create output.');
          const url = URL.createObjectURL(blob), a = document.createElement('a');
          const base = file.name.replace(/\.[^.]+$/, '') || 'image';
          a.href = url; a.download = `${base}-watermarked.${ext()}`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setStatus('Done. Your watermarked image is ready.'); loader(false);
        }, mime, mime === 'image/png' ? undefined : .92);
      } catch (error) { console.error(error); setStatus('We could not create the image.'); loader(false); }
    });
  });

  $('resetBtn').addEventListener('click', () => {
    file = null; image = null; input.value = ''; workspace.classList.add('hidden');
    if (sourceUrl) { URL.revokeObjectURL(sourceUrl); sourceUrl = null; }
    setStatus('');
  });
})();
