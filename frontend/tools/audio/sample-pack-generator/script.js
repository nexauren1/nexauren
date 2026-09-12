(() => {
  const $ = id => document.getElementById(id);
  const fileInput = $("sampleFile");
  const dropZone = $("dropZone");
  const preview = $("preview");
  const fileText = $("fileText");
  const amount = $("amount");
  const amountHint = $("amountHint");
  const variation = $("variation");
  const variationValue = $("variationValue");
  const baseName = $("baseName");
  const sampleType = $("sampleType");
  const progressBox = $("progressBox");
  const progressBar = $("progressBar");
  const progressText = $("progressText");
  const resultBox = $("resultBox");
  const resultMeta = $("resultMeta");
  const downloadBtn = $("downloadBtn");
  const planName = $("planName");
  const planMeta = $("planMeta");
  const planBox = $("planBox");
  const generateBtn = $("generateBtn");

  let sourceFile = null;
  let finalZip = null;
  let limits = null;

  const names = [
    "Deep", "Bright", "Punch", "Warm",
    "Clean", "Wide", "Dark", "Tight",
    "Crunch", "Soft", "Sharp", "Air",
    "Heavy", "Dry", "Space", "Classic"
  ];
  const keys = [
    "C", "C#", "D", "D#", "E", "F",
    "F#", "G", "G#", "A", "A#", "B"
  ];

  $("chooseBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

  ["dragenter", "dragover"].forEach(type =>
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.add("drag");
    })
  );

  ["dragleave", "drop"].forEach(type =>
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.remove("drag");
    })
  );

  dropZone.addEventListener("drop", e =>
    loadFile(e.dataTransfer.files[0])
  );

  variation.addEventListener("input", () => {
    variationValue.textContent = `${variation.value}%`;
  });

  sampleType.addEventListener("change", () => {
    if (!baseName.dataset.edited) {
      baseName.value = sampleType.value;
    }
  });

  baseName.addEventListener("input", () => {
    baseName.dataset.edited = "1";
  });

  amount.addEventListener("input", () => {
    const max = limits?.max_samples || 500;
    let value = Number(amount.value || 1);
    value = Math.max(1, Math.min(max, value));
    amount.value = value;
  });

  async function loadLimits() {
    try {
      const response = await fetch(
        "/api/tools/sample-pack/limits",
        { credentials: "same-origin" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        planName.textContent = "Login necessário";
        planMeta.textContent = "Entre na sua conta para usar o gerador.";
        generateBtn.disabled = true;
        return;
      }

      limits = data;
      amount.max = String(data.max_samples);

      const current = Number(amount.value || 1);
      if (current > data.max_samples) {
        amount.value = data.max_samples;
      }

      planName.textContent = `${data.plan_name} · até ${data.max_samples} samples`;
      planMeta.textContent =
        `${data.available_credits} créditos disponíveis · 1 crédito por sample`;
      amountHint.textContent =
        `Máximo do plano: ${data.max_samples} samples por geração.`;
      planBox.dataset.plan = data.plan;
    } catch (error) {
      planName.textContent = "Não foi possível verificar o plano";
      planMeta.textContent = "Tente atualizar a página.";
      generateBtn.disabled = true;
    }
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("audio/")) {
      alert("Escolha um ficheiro de áudio válido.");
      return;
    }

    sourceFile = file;
    fileText.textContent =
      `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    resultBox.hidden = true;
  }

  generateBtn.addEventListener("click", generatePack);

  downloadBtn.addEventListener("click", () => {
    if (!finalZip) return;
    const url = URL.createObjectURL(finalZip);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      `${safeName(baseName.value || sampleType.value)}-Nexauren-Pack.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });

  async function authorizeGeneration(count) {
    const response = await fetch(
      "/api/tools/sample-pack/consume",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ count })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      const error = new Error(
        data.error || "Não foi possível autorizar a geração."
      );
      error.code = data.code;
      error.data = data;
      throw error;
    }

    limits.available_credits = data.remaining_credits;
    planMeta.textContent =
      `${data.remaining_credits} créditos disponíveis · 1 crédito por sample`;
    return data;
  }

  async function generatePack() {
    if (!sourceFile) {
      alert("Envie primeiro um sample.");
      return;
    }

    if (!window.JSZip) {
      alert("O módulo ZIP ainda está a carregar. Tente novamente em alguns segundos.");
      return;
    }

    if (!limits) {
      await loadLimits();
      if (!limits) return;
    }

    const count = Number(amount.value);
    const max = Number(limits.max_samples);

    if (!Number.isInteger(count) || count < 1 || count > max) {
      alert(`Escolha entre 1 e ${max} samples.`);
      return;
    }

    if (count > Number(limits.available_credits)) {
      alert(
        `Você tem ${limits.available_credits} créditos, ` +
        `mas esta geração precisa de ${count}.`
      );
      return;
    }

    generateBtn.disabled = true;
    progressBox.hidden = false;
    resultBox.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "A verificar créditos…";

    if (window.NexaurenLoader) {
      NexaurenLoader.showProcessing(
        `A reservar ${count} créditos…`
      );
    }

    try {
      await authorizeGeneration(count);

      if (window.NexaurenLoader) {
        NexaurenLoader.setText(`A gerar sample 1/${count}…`);
      }

      const arrayBuffer = await sourceFile.arrayBuffer();
      const AudioCtx =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioCtx) {
        throw new Error(
          "Web Audio não é suportado neste navegador."
        );
      }

      const decodeCtx = new AudioCtx();
      const sourceBuffer =
        await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
      await decodeCtx.close();

      const zip = new JSZip();
      const folder = zip.folder("samples");
      const used = new Set();
      const generated = [];

      for (let i = 1; i <= count; i++) {
        progressText.textContent =
          `A criar variação ${i} de ${count}`;
        progressBar.style.width =
          `${Math.round((i / count) * 100)}%`;

        if (window.NexaurenLoader) {
          NexaurenLoader.setText(
            `A gerar sample ${i}/${count}…`
          );
        }

        const settings = randomSettings(
          Number(variation.value) / 100,
          i
        );
        const rendered = await renderVariant(
          sourceBuffer,
          settings
        );
        const key = keys[settings.keyIndex];
        const descriptor = settings.descriptor;
        const filename = uniqueName(
          `${safeName(baseName.value || sampleType.value)}-` +
          `${key}-${descriptor}-${String(i).padStart(3, "0")}.wav`,
          used
        );

        folder.file(
          filename,
          audioBufferToWav(rendered)
        );
        generated.push({ filename, settings });
        await new Promise(requestAnimationFrame);
      }

      const name =
        baseName.value || sampleType.value;
      const readme = buildReadme(
        generated.length,
        name
      );
      const info = buildInfo(generated);

      if ($("includeReadme").checked) {
        zip.file("README-NEXAUREN.txt", readme);
      }

      if ($("includeInfo").checked) {
        zip.file("PACK-INFO.txt", info);
      }

      zip.file(
        "LICENSE-NEXAUREN.txt",
        buildLicense()
      );

      finalZip = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        },
        meta => {
          progressText.textContent =
            `A preparar ZIP… ${Math.round(meta.percent)}%`;
          progressBar.style.width =
            `${Math.round(meta.percent)}%`;
        }
      );

      resultMeta.textContent =
        `${generated.length} samples • ZIP pronto • ` +
        `${limits.available_credits} créditos restantes`;
      resultBox.hidden = false;
      progressBox.hidden = true;
    } catch (error) {
      console.error(error);

      if (error.code === "PLAN_LIMIT") {
        alert(error.message);
      } else if (error.code === "INSUFFICIENT_CREDITS") {
        alert(
          `${error.message} Disponíveis: ` +
          `${error.data?.available_credits || 0}.`
        );
      } else if (error.code === "BALANCE_CHANGED") {
        alert(error.message);
        await loadLimits();
      } else {
        alert(
          `Não foi possível gerar o pack: ` +
          `${error.message || "erro desconhecido"}`
        );
      }

      progressBox.hidden = true;
    } finally {
      generateBtn.disabled = false;
      if (window.NexaurenLoader) {
        NexaurenLoader.hideProcessing(160);
      }
    }
  }

  function randomSettings(strength, index) {
    const signed = value =>
      (Math.random() * 2 - 1) * value;
    const pitch = signed(0.035 * strength);

    return {
      keyIndex: Math.floor(
        Math.random() * keys.length
      ),
      playbackRate: Math.max(
        0.93,
        Math.min(1.07, 1 + pitch)
      ),
      gain: Math.pow(
        10,
        signed(3.5 * strength) / 20
      ),
      filterFreq:
        1200 + Math.random() * 10000,
      filterType:
        Math.random() > 0.5
          ? "lowpass"
          : "highpass",
      drive:
        Math.random() * 0.55 * strength,
      wet:
        Math.random() * 0.28 * strength,
      pan: signed(0.55 * strength),
      descriptor:
        names[
          (index - 1 +
            Math.floor(
              Math.random() * names.length
            )) % names.length
        ]
    };
  }

  async function renderVariant(buffer, s) {
    const duration = Math.max(
      0.05,
      buffer.duration / s.playbackRate + 0.06
    );
    const sampleRate = buffer.sampleRate;
    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.ceil(duration * sampleRate),
      sampleRate
    );
    const source =
      offline.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value =
      s.playbackRate;

    const filter =
      offline.createBiquadFilter();
    filter.type = s.filterType;
    filter.frequency.value = s.filterFreq;
    filter.Q.value =
      0.35 + Math.random() * 2.5;

    const gain = offline.createGain();
    gain.gain.value = s.gain;

    const shaper =
      offline.createWaveShaper();
    shaper.curve = makeDriveCurve(s.drive);
    shaper.oversample = "2x";

    const panner =
      offline.createStereoPanner
        ? offline.createStereoPanner()
        : null;

    if (panner) {
      panner.pan.value = s.pan;
    }

    const delay = offline.createDelay(0.15);
    delay.delayTime.value =
      0.018 + Math.random() * 0.045;

    const delayGain = offline.createGain();
    delayGain.gain.value = s.wet;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(shaper);

    if (panner) {
      shaper.connect(panner);
      panner.connect(offline.destination);
      shaper.connect(delay);
    } else {
      shaper.connect(offline.destination);
      shaper.connect(delay);
    }

    delay.connect(delayGain);
    delayGain.connect(offline.destination);
    source.start(0);

    return offline.startRendering();
  }

  function makeDriveCurve(amount) {
    const n = 512;
    const curve = new Float32Array(n);
    const k = 1 + amount * 18;

    for (let i = 0; i < n; i++) {
      const x =
        i * 2 / (n - 1) - 1;
      curve[i] =
        Math.tanh(k * x) /
        Math.tanh(k);
    }

    return curve;
  }

  function audioBufferToWav(buffer) {
    const channels =
      buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytes =
      44 + length * channels * 2;
    const array = new ArrayBuffer(bytes);
    const view = new DataView(array);

    writeString(view, 0, "RIFF");
    view.setUint32(
      4,
      36 + length * channels * 2,
      true
    );
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(
      28,
      sampleRate * channels * 2,
      true
    );
    view.setUint16(
      32,
      channels * 2,
      true
    );
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(
      40,
      length * channels * 2,
      true
    );

    let offset = 44;

    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const sample = Math.max(
          -1,
          Math.min(
            1,
            buffer.getChannelData(ch)[i]
          )
        );
        view.setInt16(
          offset,
          sample < 0
            ? sample * 32768
            : sample * 32767,
          true
        );
        offset += 2;
      }
    }

    return new Blob([array], {
      type: "audio/wav"
    });
  }

  function writeString(view, offset, text) {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(
        offset + i,
        text.charCodeAt(i)
      );
    }
  }

  function uniqueName(name, used) {
    let value = name;
    let n = 2;

    while (used.has(value)) {
      value = name.replace(
        /\.wav$/i,
        `-${n++}.wav`
      );
    }

    used.add(value);
    return value;
  }

  function safeName(value) {
    return String(value)
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-"
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "Sample";
  }

  function buildReadme(count, name) {
    return `NEXAUREN — SAMPLE PACK GENERATOR\n\nPack: ${name}\nSamples gerados: ${count}\n\nObrigado por usar o Nexauren.\n\nEste pack foi criado a partir do sample enviado pelo utilizador. O Nexauren aplicou variações de processamento para criar versões diferentes, mantendo o processo no navegador.\n\nDICAS\n• Ouça cada variação antes de a usar num projeto.\n• Combine diferentes versões para criar grooves e camadas.\n• Guarde o ZIP original para manter a organização do pack.\n\nDIREITOS\nO Nexauren não reivindica propriedade sobre o áudio original enviado pelo utilizador nem sobre as variações geradas. O utilizador é responsável por garantir que possui os direitos necessários sobre o material de origem e por respeitar as licenças aplicáveis.\n\nVOLTE AO NEXAUREN\nExplore mais ferramentas para áudio, imagem, texto, produtividade e criação.\n\nNexauren — ferramentas para criar, trabalhar e produzir melhor.\n`;
  }

  function buildInfo(items) {
    return "NEXAUREN — PACK INFO\n\n" +
      items.map(x =>
        `${x.filename}\n` +
        `  pitch rate: ${x.settings.playbackRate.toFixed(4)}\n` +
        `  gain: ${x.settings.gain.toFixed(4)}\n` +
        `  filter: ${x.settings.filterType} ` +
        `${Math.round(x.settings.filterFreq)} Hz\n` +
        `  drive: ${x.settings.drive.toFixed(3)}\n` +
        `  wet: ${x.settings.wet.toFixed(3)}\n`
      ).join("\n");
  }

  function buildLicense() {
    return `NEXAUREN — DIREITOS E USO\n\nO Nexauren não reivindica a propriedade do sample de origem nem do conteúdo criado pelo utilizador. A utilização do resultado depende dos direitos que o utilizador possui sobre o material de origem.\n\nSe o sample original pertence a outra pessoa, uma transformação automática não elimina a licença, copyright ou outras restrições existentes. Verifique sempre a licença antes de distribuir ou vender o resultado.\n\nEste ficheiro é informativo e não substitui aconselhamento jurídico.\n`;
  }

  loadLimits();
})();
