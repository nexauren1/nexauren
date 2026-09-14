const input=document.getElementById('imageInput');
const uploadArea=document.getElementById('uploadArea');
const workspace=document.getElementById('workspace');
const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const formatInput=document.getElementById('formatInput');
const qualityInput=document.getElementById('qualityInput');
const qualityValue=document.getElementById('qualityValue');
const qualityField=document.getElementById('qualityField');
const downloadButton=document.getElementById('downloadButton');
const newButton=document.getElementById('newButton');
const status=document.getElementById('status');
const fileInfo=document.getElementById('fileInfo');
let image=null,sourceName='image',rotation=0,flipX=1,flipY=1;
function loader(show){if(window.NexaurenLoader){if(show&&typeof window.NexaurenLoader.show==='function')window.NexaurenLoader.show();if(!show&&typeof window.NexaurenLoader.hide==='function')window.NexaurenLoader.hide();}}
function render(){if(!image)return;const turn=Math.abs(rotation)%180!==0;canvas.width=turn?image.naturalHeight:image.naturalWidth;canvas.height=turn?image.naturalWidth:image.naturalHeight;ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.scale(flipX,flipY);ctx.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);ctx.restore();}
function loadFile(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){status.textContent='Please choose a JPG, PNG or WebP image.';return;}loader(true);status.textContent='Loading image…';const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{image=img;sourceName=file.name.replace(/\.[^.]+$/,'')||'image';rotation=0;flipX=1;flipY=1;render();fileInfo.textContent=`${file.name} · ${img.naturalWidth} × ${img.naturalHeight}px`;uploadArea.classList.add('hidden');workspace.classList.remove('hidden');status.textContent='Ready. Choose a transform.';URL.revokeObjectURL(url);loader(false);};img.onerror=()=>{status.textContent='We could not read this image. Try another file.';URL.revokeObjectURL(url);loader(false);};img.src=url;}
input.addEventListener('change',e=>loadFile(e.target.files[0]));
['dragenter','dragover'].forEach(type=>uploadArea.addEventListener(type,e=>{e.preventDefault();uploadArea.classList.add('dragging');}));
['dragleave','drop'].forEach(type=>uploadArea.addEventListener(type,e=>{e.preventDefault();uploadArea.classList.remove('dragging');}));
uploadArea.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{if(!image)return;const action=button.dataset.action;if(action==='left')rotation=(rotation-90+360)%360;if(action==='right')rotation=(rotation+90)%360;if(action==='180')rotation=(rotation+180)%360;if(action==='horizontal')flipX*=-1;if(action==='vertical')flipY*=-1;if(action==='reset'){rotation=0;flipX=1;flipY=1;}render();status.textContent='Preview updated.';}));
qualityInput.addEventListener('input',()=>qualityValue.textContent=`${qualityInput.value}%`);
formatInput.addEventListener('change',()=>qualityField.classList.toggle('hidden',formatInput.value==='image/png'));
function downloadResult(){if(!image)return;loader(true);status.textContent='Creating your image…';const type=formatInput.value,quality=Number(qualityInput.value)/100,outCanvas=document.createElement('canvas');outCanvas.width=canvas.width;outCanvas.height=canvas.height;const out=outCanvas.getContext('2d');if(type==='image/jpeg'){out.fillStyle='#fff';out.fillRect(0,0,outCanvas.width,outCanvas.height);}out.drawImage(canvas,0,0);outCanvas.toBlob(blob=>{loader(false);if(!blob){status.textContent='We could not create the image. Please try again.';return;}const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg',url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${sourceName}-transformed.${ext}`;a.click();URL.revokeObjectURL(url);status.textContent='Image ready. Your download should start now.';},type,type==='image/png'?undefined:quality);}
downloadButton.addEventListener('click',downloadResult);
newButton.addEventListener('click',()=>{image=null;input.value='';workspace.classList.add('hidden');uploadArea.classList.remove('hidden');status.textContent='';fileInfo.textContent='';});
