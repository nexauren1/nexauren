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
  const costBox = $("costBox");
  const costText = $("costText");
  const costHint = $("costHint");
  const creditSourceBox = $("creditSourceBox");
  const planCreditBtn = $("planCreditBtn");
  const purchasedCreditBtn = $("purchasedCreditBtn");
  const planCreditBalance = $("planCreditBalance");
  const purchasedCreditBalance = $("purchasedCreditBalance");
  const sourceStatus = $("sourceStatus");

  let sourceFile = null;
  let finalZip = null;
  let limits = null;
  let selectedSource = null;

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

  amount.addEventListener("input", updateCost);

  planCreditBtn.addEventListener("click", () => {
    selectSource("plan");
  });

  purchasedCreditBtn.addEventListener("click", () => {
    selectSource("purchased");
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
        planMeta.textContent =
          "Entre na sua conta para usar o gerador.";
        generateBtn.disabled = true;
        return false;
      }

      limits = data;
      amount.max = String(data.max_samples || 500);

      const current = Number(amount.value || 1);
      if (current > Number(data.max_samples || 500)) {
        amount.value = data.max_samples || 500;
      }

      planName.textContent =
        `${data.plan_name} · ${data.included_samples} samples incluídos`;
      planMeta.textContent =
        `${data.plan_credits} créditos do plano · ` +
        `${data.purchased_credits} créditos comprados`;
      amountHint.textContent =
        `${data.included_samples} samples incluídos sem custo. ` +
        `Até ${data.max_samples} samples por geração.`;
      planBox.dataset.plan = data.plan;

      updateBalances(data);
      updateCost();
      return true;
    } catch (error) {
      console.error(error);
      planName.textContent =
        "Não foi possível verificar o plano";
      planMeta.textContent = "Tente atualizar a página.";
      generateBtn.disabled = true;
      return false;
    }
  }

  function updateBalances(data) {
    planCreditBalance.textContent =
      `${Number(data.plan_credits || 0)} disponíveis`;
    purchasedCreditBalance.textContent =
      `${Number(data.purchased_credits || 0)} disponíveis`;

    planCreditBtn.disabled =
      Number(data.plan_credits || 0) <= 0;
    purchasedCreditBtn.disabled =
      Number(data.purchased_credits || 0) <= 0;
  }

  function updateCost() {
    if (!limits) return;

    const max = Number(limits.max_samples || 500);
    let count = Number(amount.value || 1);
    count = Math.max(1, Math.min(max, count));
    amount.value = count;

    const included = Number(limits.included_samples || 0);
    const extra = Math.max(0, count - included);

    costText.textContent =
      `${extra} crédito${extra === 1 ? "" : "s"}`;

    if (extra === 0) {
      costHint.textContent =
        `${count} samples estão dentro do limite incluído do seu plano.`;
      creditSourceBox.hidden = true;
      selectedSource = null;
      clearSourceSelection();
      generateBtn.disabled = false;
      return;
    }

    costHint.textContent =
      `${count} pedidos − ${included} incluídos = ` +
      `${extra} samples extra.`;
    creditSourceBox.hidden = false;

    const available = selectedSource === "plan"
      ? Number(limits.plan_credits || 0)
      : selectedSource === "purchased"
        ? Number(limits.purchased_credits || 0)
        : 0;

    if (selectedSource) {
      sourceStatus.textContent =
        available >= extra
          ? `Selecionado: ${sourceLabel(selectedSource)} · ` +
            `${extra} crédito${extra === 1 ? "" : "s"} será${extra === 1 ? "" : "ão"} gasto${extra === 1 ? "" : "s"}.`
          : `A fonte selecionada tem ${available} créditos, ` +
            `mas são necessários ${extra}.`;
      generateBtn.disabled = available < extra;
    } else {
      sourceStatus.textContent =
        `Escolha uma fonte para gastar os ${extra} créditos extra.`;
      generateBtn.disabled = true;
    }
  }

  function sourceLabel(source) {
    return source === "plan"
      ? "🟡 Créditos do plano"
      : "🔵 Créditos comprados";
  }

  function selectSource(source) {
    selectedSource = source;
    clearSourceSelection();

    if (source === "plan") {
      planCreditBtn.classList.add("selected");
    } else {
      purchasedCreditBtn.classList.add("selected");
    }

    updateCost();
  }

  function clearSourceSelection() {
    planCreditBtn.classList.remove("selected");
    purchasedCreditBtn.classList.remove("selected");
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

  async function authorizeGeneration(count, creditSource) {
    const response = await fetch(
      "/api/tools/sample-pack/consume",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          count,
          credit_source: creditSource
        })
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
    limits.plan_credits = data.plan_credits;
    limits.purchased_credits = data.purchased_credits;
    updateBalances(limits);
    planMeta.textContent =
      `${data.plan_credits} créditos do plano · ` +
      `${data.purchased_credits} créditos comprados`;
    return data;
  }

  async function generatePack() {
    if (!sourceFile) {
      alert("Envie primeiro um sample.");
      return;
    }

    if (!window.JSZip) {
      alert(
        "O módulo ZIP ainda está a carregar. " +
        "Tente novamente em alguns segundos."
      );
      return;
    }

    if (!limits) {
      const loaded = await loadLimits();
      if (!loaded) return;
    }

    const count = Number(amount.value);
    const max = Number(limits.max_samples || 500);
    const included = Number(limits.included_samples || 0);
    const extra = Math.max(0, count - included);

    if (!Number.isInteger(count) || count < 1 || count > max) {
      alert(`Escolha entre 1 e ${max} samples.`);
      return;
    }

    if (extra > 0) {
      if (!selectedSource) {
        alert("Escolha créditos do plano ou créditos comprados.");
        return;
      }

      const available = selectedSource === "plan"
        ? Number(limits.plan_credits || 0)
        : Number(limits.purchased_credits || 0);

      if (available < extra) {
        alert(
          `Você selecionou ${sourceLabel(selectedSource)}, ` +
          `mas tem ${available} créditos e precisa de ${extra}.`
        );
        updateCost();
        return;
      }
    }

    generateBtn.disabled = true;
    progressBox.hidden = false;
    resultBox.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "A preparar o áudio…";

    if (window.NexaurenLoader) {
      NexaurenLoader.showProcessing(
        extra > 0
          ? `A preparar ${extra} créditos…`
          : "A preparar geração gratuita…"
      );
    }

    try {
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

      const name = baseName.value || sampleType.value;
      const readme = buildReadme(generated.length, name);
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

      if (window.NexaurenLoader) {
        NexaurenLoader.setText(
          extra > 0
            ? "A confirmar o uso dos créditos…"
            : "A registar a geração…"
        );
      }

      const charged = await authorizeGeneration(
        count,
        extra > 0 ? selectedSource : null
      );

      resultMeta.textContent = extra > 0
        ? `${generated.length} samples • ${extra} créditos gastos ` +
          `(${sourceLabel(charged.credit_source)}) • ` +
          `${charged.remaining_credits} créditos restantes`
        : `${generated.length} samples • 0 créditos gastos • ` +
          `limite incluído do plano`;
      resultBox.hidden = false;
      progressBox.hidden = true;
      updateCost();
    } catch (error) {
      console.error(error);

      if (error.code === "CREDIT_SOURCE_REQUIRED") {
        alert(
          `Escolha a fonte de créditos. ` +
          `São necessários ${error.data?.required_credits || 0} créditos.`
        );
      } else if (error.code === "INSUFFICIENT_CREDITS") {
        alert(
          `${error.message} Necessários: ` +
          `${error.data?.required_credits || 0}. ` +
          `Disponíveis nessa fonte: ` +
          `${error.data?.available_credits || 0}.`
        );
        await loadLimits();
      } else if (error.code === "BALANCE_CHANGED") {
        alert(error.message);
        await loadLimits();
      } else if (error.code === "MAX_SAMPLES") {
        alert(error.message);
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
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = s.playbackRate;

    const filter = offline.createBiquadFilter();
    filter.type = s.filterType;
    filter.frequency.value = s.filterFreq;
    filter.Q.value = 0.35 + Math.random() * 2.5;

    const gain = offline.createGain();
    gain.gain.value = s.gain;

    const shaper = offline.createWaveShaper();
    shaper.curve = makeDriveCurve(s.drive);
    shaper.oversample = "2x";

    const panner = offline.createStereoPanner
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
      const x = i * 2 / (n - 1) - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }

    return curve;
  }

  function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytes = 44 + length * channels * 2;
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
    view.setUint16(32, channels * 2, true);
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
          Math.min(1, buffer.getChannelData(ch)[i])
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

    return new Blob([array], { type: "audio/wav" });
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
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "Sample";
  }

  function buildReadme(count, name) {
    return `NEXAUREN — SAMPLE PACK GENERATOR\n\n` +
      `Pack: ${name}\n` +
      `Samples gerados: ${count}\n\n` +
      `Obrigado por usar o Nexauren.\n\n` +
      `Este pack foi criado a partir do sample enviado pelo utilizador. ` +
      `O Nexauren aplicou variações de processamento para criar versões ` +
      `diferentes, mantendo o processo no navegador.\n\n` +
      `DICAS\n` +
      `• Ouça cada variação antes de a usar num projeto.\n` +
      `• Combine diferentes versões para criar grooves e camadas.\n` +
      `• Guarde o ZIP original para manter a organização do pack.\n\n` +
      `DIREITOS\n` +
      `O Nexauren não reivindica propriedade sobre o áudio original ` +
      `enviado pelo utilizador nem sobre as variações geradas. O utilizador ` +
      `é responsável por garantir que possui os direitos necessários sobre ` +
      `o material de origem e por respeitar as licenças aplicáveis.\n\n` +
      `VOLTE AO NEXAUREN\n` +
      `Explore mais ferramentas para áudio, imagem, texto, produtividade ` +
      `e criação.\n\n` +
      `Nexauren — ferramentas para criar, trabalhar e produzir melhor.\n`;
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
    return `NEXAUREN — DIREITOS E USO\n\n` +
      `O Nexauren não reivindica a propriedade do sample de origem nem ` +
      `do conteúdo criado pelo utilizador. A utilização do resultado ` +
      `depende dos direitos que o utilizador possui sobre o material ` +
      `de origem.\n\n` +
      `Se o sample original pertence a outra pessoa, uma transformação ` +
      `automática não elimina a licença, copyright ou outras restrições ` +
      `existentes. Verifique sempre a licença antes de distribuir ou ` +
      `vender o resultado.\n\n` +
      `Este ficheiro é informativo e não substitui aconselhamento jurídico.\n`;
  }

  loadLimits();
})();
