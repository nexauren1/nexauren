const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const sizeEl = document.getElementById("size");
const button = document.getElementById("generate");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultsGrid = document.getElementById("resultsGrid");
const uploadBox = document.getElementById("uploadBox");
const imageInput = document.getElementById("imageInput");
const previewWrap = document.getElementById("previewWrap");
const preview = document.getElementById("preview");
const removeImage = document.getElementById("removeImage");
const referenceBox = document.getElementById("referenceBox");
const referenceInput = document.getElementById("referenceInput");
const referencePreview = document.getElementById("referencePreview");
const variationBox = document.getElementById("variationBox");
const variationCountEl = document.getElementById("variationCount");
const featureButtons = [...document.querySelectorAll(".feature")];
const modeButtons = [...document.querySelectorAll(".mode")];

let mode = "generate";
let selectedImage = null;
let referenceFiles = [];
let selectedFeature = "";
let access = { plan: "free", features: {} };

const requiredPlans = {
  "image-editing": "pro",
  variations: "pro",
  "multi-reference": "premium",
  "creative-control": "premium"
};

function planRank(plan) {
  return { free: 0, pro: 1, premium: 2 }[plan] ?? 0;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function featureUnlocked(key) {
  return !!access.features[key];
}

function updateFeatureUI() {
  featureButtons.forEach((el) => {
    const key = el.dataset.feature;
    const unlocked = featureUnlocked(key);
    el.classList.toggle("locked", !unlocked);
    el.classList.toggle("unlocked", unlocked);
    el.classList.toggle("selected", key === selectedFeature);
  });
}

async function loadAccess() {
  try {
    const response = await fetch("/api/ai/image/access", {
      credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      access = {
        plan: data.plan || "free",
        features: Object.fromEntries(
          (data.features || []).map((item) => [item.key, !!item.unlocked])
        )
      };
      updateFeatureUI();
    }
  } catch (_) {}
}

function selectMode(nextMode) {
  if (nextMode === "edit" && !featureUnlocked("image-editing")) {
    setStatus("AI Image Editing is a Pro feature. Upgrade to unlock it.");
    window.location.href = "/plans/";
    return;
  }

  mode = nextMode;
  if (mode === "edit") selectedFeature = "image-editing";
  else if (selectedFeature === "image-editing") selectedFeature = "";

  modeButtons.forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === mode);
  });
  uploadBox.classList.toggle("hidden", mode !== "edit");
  updateAdvancedUI();
  button.textContent = mode === "edit" ? "Edit Image" : "Generate Image";
  setStatus("");
}

function updateAdvancedUI() {
  referenceBox.classList.toggle(
    "hidden",
    selectedFeature !== "multi-reference"
  );
  variationBox.classList.toggle(
    "hidden",
    selectedFeature !== "variations"
  );
  updateFeatureUI();
}

modeButtons.forEach((el) => {
  el.addEventListener("click", () => selectMode(el.dataset.mode));
});

featureButtons.forEach((el) => {
  el.addEventListener("click", () => {
    const key = el.dataset.feature;
    if (!featureUnlocked(key)) {
      const required = requiredPlans[key] || "pro";
      setStatus(
        `${el.querySelector("b").textContent} requires ${required.toUpperCase()}.`
      );
      window.location.href = "/plans/";
      return;
    }

    selectedFeature = selectedFeature === key ? "" : key;

    if (key === "image-editing") {
      selectMode("edit");
      return;
    }

    if (mode === "edit") {
      mode = "generate";
      modeButtons.forEach((item) => {
        item.classList.toggle("active", item.dataset.mode === mode);
      });
      uploadBox.classList.add("hidden");
    }

    updateAdvancedUI();
    setStatus(
      selectedFeature
        ? `${el.querySelector("b").textContent} selected.`
        : "Advanced feature cleared."
    );
  });
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please choose a PNG, JPG or WebP image.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setStatus("The image must be smaller than 10 MB.");
    imageInput.value = "";
    return;
  }
  selectedImage = file;
  preview.src = URL.createObjectURL(file);
  previewWrap.classList.remove("hidden");
  setStatus("Image ready to edit.");
});

removeImage.addEventListener("click", () => {
  selectedImage = null;
  imageInput.value = "";
  preview.removeAttribute("src");
  previewWrap.classList.add("hidden");
});

referenceInput.addEventListener("change", () => {
  const files = [...(referenceInput.files || [])];
  if (files.length < 2 || files.length > 4) {
    setStatus("Choose between 2 and 4 reference images.");
    referenceInput.value = "";
    referenceFiles = [];
    renderReferencePreview();
    return;
  }

  const invalid = files.find(
    (file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024
  );
  if (invalid) {
    setStatus("Each reference must be an image smaller than 10 MB.");
    referenceInput.value = "";
    referenceFiles = [];
    renderReferencePreview();
    return;
  }

  referenceFiles = files;
  renderReferencePreview();
  setStatus(`${files.length} reference images ready.`);
});

function renderReferencePreview() {
  referencePreview.innerHTML = "";
  referenceFiles.forEach((file) => {
    const img = document.createElement("img");
    img.alt = "Reference preview";
    img.src = URL.createObjectURL(file);
    referencePreview.appendChild(img);
  });
}

function prepareInputImage(file) {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bitmap) => {
      const scale = Math.min(
        1,
        512 / Math.max(bitmap.width, bitmap.height)
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    }).catch(reject);
  });
}

async function prepareReferenceImages(files) {
  const output = [];
  for (const file of files) {
    output.push(await prepareInputImage(file));
  }
  return output;
}

function addResult(image, index, total) {
  const src = image.startsWith("data:")
    ? image
    : `data:image/jpeg;base64,${image}`;

  const card = document.createElement("article");
  card.className = "result-item";

  const img = document.createElement("img");
  img.src = src;
  img.alt = total > 1
    ? `AI variation ${index + 1}`
    : "AI generated result";

  const footer = document.createElement("div");
  footer.className = "result-item-footer";

  const label = document.createElement("span");
  label.textContent = total > 1
    ? `Variation ${index + 1}`
    : "Generated image";

  const link = document.createElement("a");
  link.href = src;
  link.download = total > 1
    ? `nexauren-ai-variation-${index + 1}.jpg`
    : "nexauren-ai-image.jpg";
  link.textContent = "Download";

  footer.append(label, link);
  card.append(img, footer);
  resultsGrid.appendChild(card);
}

async function generateImage() {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    setStatus("Please describe the image you want to create or edit.");
    promptEl.focus();
    return;
  }

  if (mode === "edit") {
    if (!featureUnlocked("image-editing")) {
      window.location.href = "/plans/";
      return;
    }
    if (!selectedImage) {
      setStatus("Upload an image first.");
      return;
    }
  }

  if (selectedFeature === "multi-reference") {
    if (!featureUnlocked("multi-reference")) {
      window.location.href = "/plans/";
      return;
    }
    if (referenceFiles.length < 2 || referenceFiles.length > 4) {
      setStatus("Choose between 2 and 4 reference images first.");
      return;
    }
  }

  button.disabled = true;
  resultsGrid.innerHTML = "";
  resultEl.classList.add("hidden");

  try {
    let inputImage = null;
    let referenceImages = [];

    if (mode === "edit") {
      inputImage = await prepareInputImage(selectedImage);
    }

    if (selectedFeature === "multi-reference") {
      referenceImages = await prepareReferenceImages(referenceFiles);
    }

    const variationCount = selectedFeature === "variations"
      ? Number(variationCountEl.value)
      : 1;
    const total = variationCount > 1 ? variationCount : 1;

    setStatus(
      total > 1
        ? `Generating ${total} variations…`
        : selectedFeature === "multi-reference"
          ? "Generating with your reference images…"
          : mode === "edit"
            ? "Editing your image…"
            : "Generating your image…"
    );

    const response = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        size: sizeEl.value,
        mode,
        feature: selectedFeature,
        input_image: inputImage,
        reference_images: referenceImages,
        variation_count: variationCount
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !Array.isArray(data.images)) {
      if (data.code === "UPGRADE_REQUIRED") {
        window.location.href = "/plans/";
        return;
      }
      throw new Error(data.error || "Image generation failed.");
    }

    data.images.forEach((image, index) => {
      addResult(image, index, data.images.length);
    });

    resultEl.classList.remove("hidden");
    setStatus(
      data.images.length > 1
        ? `${data.images.length} variations generated successfully.`
        : selectedFeature === "multi-reference"
          ? "Multi-reference image generated successfully."
          : mode === "edit"
            ? "Image edited successfully."
            : "Image generated successfully."
    );
  } catch (error) {
    setStatus(error.message || "Something went wrong.");
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", generateImage);
loadAccess();
