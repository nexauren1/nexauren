const input = document.getElementById('fileInput');
const drop = document.getElementById('dropZone');
const workspace = document.getElementById('workspace');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const tol = document.getElementById('tolerance');
const edge = document.getElementById('edge');
const tolVal = document.getElementById('toleranceValue');
const edgeVal = document.getElementById('edgeValue');
const bg = document.getElementById('background');
const sample = document.getElementById('sample');
const remove = document.getElementById('remove');
const download = document.getElementById('download');
const reset = document.getElementById('reset');
const status = document.getElementById('status');

let original = null;
let ready = false;

function setStatus(text) {
  status.textContent = text;
}

function loadFile(file) {
  if (!file) return;

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    setStatus('Please choose a JPG, PNG or WebP image.');
    return;
  }

  setStatus('Loading image…');
  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();

    image.onload = () => {
      try {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        original = ctx.getImageData(0, 0, canvas.width, canvas.height);

        workspace.classList.remove('hidden');
        ready = false;
        download.disabled = true;
        setStatus('Image ready. Choose a background color, then remove it.');
      } catch (error) {
        original = null;
        setStatus('Could not load this image. Try another file.');
      }
    };

    image.onerror = () => {
      setStatus('Could not read this image. Try another file.');
    };

    image.src = reader.result;
  };

  reader.onerror = () => {
    setStatus('Could not read this file.');
  };

  reader.readAsDataURL(file);
}

input.addEventListener('change', (event) => {
  loadFile(event.target.files && event.target.files[0]);
});

['dragenter', 'dragover'].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.add('drag');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.remove('drag');
  });
});

drop.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  loadFile(file);
});

tol.addEventListener('input', () => {
  tolVal.textContent = tol.value;
});

edge.addEventListener('input', () => {
  edgeVal.textContent = edge.value;
});

function hexRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

sample.addEventListener('click', () => {
  if (!original) {
    setStatus('Upload an image first.');
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const data = original.data;
  const points = [
    [0, 0],
    [Math.max(0, w - 1), 0],
    [0, Math.max(0, h - 1)],
    [Math.max(0, w - 1), Math.max(0, h - 1)]
  ];

  let r = 0;
  let g = 0;
  let b = 0;

  points.forEach(([x, y]) => {
    const index = (y * w + x) * 4;
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
  });

  r = Math.round(r / points.length);
  g = Math.round(g / points.length);
  b = Math.round(b / points.length);

  bg.value = '#' + [r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

  setStatus('Background color sampled from the corners.');
});

function processImage() {
  if (!original) {
    setStatus('Upload an image first.');
    return;
  }

  if (window.NexaurenLoader?.show) {
    window.NexaurenLoader.show();
  }

  setStatus('Removing background…');

  requestAnimationFrame(() => {
    try {
      const data = new Uint8ClampedArray(original.data);
      const [br, bgValue, bb] = hexRgb(bg.value);
      const tolerance = Number(tol.value) * 2.55;
      const softness = Math.max(1, Number(edge.value) * 2.55);

      for (let i = 0; i < data.length; i += 4) {
        const distance = Math.sqrt(
          (data[i] - br) ** 2 +
          (data[i + 1] - bgValue) ** 2 +
          (data[i + 2] - bb) ** 2
        );

        if (distance <= tolerance) {
          data[i + 3] = 0;
        } else if (distance < tolerance + softness) {
          data[i + 3] = Math.round(
            255 * (distance - tolerance) / softness
          );
        }
      }

      ctx.putImageData(
        new ImageData(data, canvas.width, canvas.height),
        0,
        0
      );

      ready = true;
      download.disabled = false;
      setStatus('Background removed. Download your transparent PNG.');
    } catch (error) {
      ready = false;
      download.disabled = true;
      setStatus('Could not process the image. Please try again.');
    } finally {
      if (window.NexaurenLoader?.hide) {
        window.NexaurenLoader.hide();
      }
    }
  });
}

remove.addEventListener('click', processImage);

download.addEventListener('click', () => {
  if (!ready) return;

  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Could not create the PNG.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nexauren-background-removed.png';
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

reset.addEventListener('click', () => {
  input.value = '';
  workspace.classList.add('hidden');
  original = null;
  ready = false;
  download.disabled = true;
  setStatus('');
});