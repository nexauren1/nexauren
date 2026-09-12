const fileInput = document.querySelector('#audioFile');
const fileInfo = document.querySelector('#fileInfo');
const convertButton = document.querySelector('#convertButton');
const message = document.querySelector('#message');

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  fileInfo.hidden = false;
  fileInfo.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  convertButton.disabled = false;
  message.textContent = '';
});

convertButton.addEventListener('click', () => {
  message.textContent = 'Converter preparado. A conversão de formatos será ativada na próxima etapa.';
});
