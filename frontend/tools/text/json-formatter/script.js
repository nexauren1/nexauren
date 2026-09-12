const input = document.getElementById('jsonInput');
const output = document.getElementById('jsonOutput');
const status = document.getElementById('status');
const copyBtn = document.getElementById('copyBtn');

const sample = {
  name: "Nexauren",
  type: "tools-platform",
  active: true,
  tools: ["JSON Formatter", "Text Cleaner"]
};

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function parseInput() {
  if (!input.value.trim()) {
    throw new Error('Digite ou cole um JSON primeiro.');
  }

  return JSON.parse(input.value);
}

function formatJson() {
  try {
    const data = parseInput();
    output.value = JSON.stringify(data, null, 2);
    copyBtn.disabled = false;
    setStatus('JSON válido e formatado com sucesso.', 'success');
  } catch (error) {
    output.value = '';
    copyBtn.disabled = true;
    setStatus(`JSON inválido: ${error.message}`, 'error');
  }
}

function minifyJson() {
  try {
    const data = parseInput();
    output.value = JSON.stringify(data);
    copyBtn.disabled = false;
    setStatus('JSON válido e minificado com sucesso.', 'success');
  } catch (error) {
    output.value = '';
    copyBtn.disabled = true;
    setStatus(`JSON inválido: ${error.message}`, 'error');
  }
}

function clearAll() {
  input.value = '';
  output.value = '';
  copyBtn.disabled = true;
  setStatus('');
  input.focus();
}

async function copyResult() {
  if (!output.value) return;

  try {
    await navigator.clipboard.writeText(output.value);
    setStatus('Resultado copiado para a área de transferência.', 'success');
  } catch {
    output.select();
    document.execCommand('copy');
    setStatus('Resultado copiado.', 'success');
  }
}

document.getElementById('formatBtn')
  .addEventListener('click', formatJson);

document.getElementById('minifyBtn')
  .addEventListener('click', minifyJson);

document.getElementById('clearBtn')
  .addEventListener('click', clearAll);

document.getElementById('sampleBtn')
  .addEventListener('click', () => {
    input.value = JSON.stringify(sample, null, 2);
    formatJson();
  });

copyBtn.addEventListener('click', copyResult);
