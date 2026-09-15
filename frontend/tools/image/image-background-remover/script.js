document.addEventListener('DOMContentLoaded', () => {
const input=document.getElementById('fileInput');
const choose=document.getElementById('chooseBtn');
const drop=document.getElementById('dropZone');
const workspace=document.getElementById('workspace');
const originalCanvas=document.getElementById('originalCanvas');
const resultCanvas=document.getElementById('resultCanvas');
const octx=originalCanvas.getContext('2d',{willReadFrequently:true});
const rctx=resultCanvas.getContext('2d',{willReadFrequently:true});
const tol=document.getElementById('tolerance');
const edge=document.getElementById('edge');
const tolVal=document.getElementById('toleranceValue');
const edgeVal=document.getElementById('edgeValue');
const bg=document.getElementById('background');
const sample=document.getElementById('sample');
const remove=document.getElementById('remove');
const download=document.getElementById('download');
const reset=document.getElementById('reset');
const status=document.getElementById('status');
let original=null;
let ready=false;

function setStatus(text){status.textContent=text;}

function openPicker(){input.click();}
choose.addEventListener('click',openPicker);
drop.addEventListener('click',(e)=>{if(e.target!==choose)openPicker();});

function loadFile(file){
if(!file)return;
const allowed=['image/jpeg','image/png','image/webp'];
if(!allowed.includes(file.type)){setStatus('Please choose a JPG, PNG or WebP image.');return;}
setStatus('Loading image…');
const url=URL.createObjectURL(file);
const img=new Image();
img.onload=()=>{
try{
const w=img.naturalWidth;
const h=img.naturalHeight;
if(!w||!h)throw new Error('Invalid dimensions');
originalCanvas.width=resultCanvas.width=w;
originalCanvas.height=resultCanvas.height=h;
octx.clearRect(0,0,w,h);
octx.drawImage(img,0,0,w,h);
rctx.clearRect(0,0,w,h);
rctx.drawImage(img,0,0,w,h);
original=octx.getImageData(0,0,w,h);
workspace.classList.remove('hidden');
workspace.style.display='block';
ready=false;
download.disabled=true;
setStatus('Image loaded. The original and result preview are ready.');
}catch(error){original=null;setStatus('Could not load this image. Try another file.');}
URL.revokeObjectURL(url);
};
img.onerror=()=>{setStatus('Could not read this image. Try another file.');URL.revokeObjectURL(url);};
img.src=url;
}

input.addEventListener('change',()=>loadFile(input.files&&input.files[0]));
['dragenter','dragover'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();e.stopPropagation();drop.classList.add('drag');}));
['dragleave','drop'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();e.stopPropagation();drop.classList.remove('drag');}));
drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files&&e.dataTransfer.files[0]));

tol.addEventListener('input',()=>tolVal.textContent=tol.value);
edge.addEventListener('input',()=>edgeVal.textContent=edge.value);

function hexRgb(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}

sample.addEventListener('click',()=>{
if(!original){setStatus('Upload an image first.');return;}
const w=originalCanvas.width,h=originalCanvas.height,d=original.data;
const points=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
let r=0,g=0,b=0;
points.forEach(([x,y])=>{const i=(y*w+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2];});
r=Math.round(r/4);g=Math.round(g/4);b=Math.round(b/4);
bg.value='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
setStatus('Background color sampled from the corners.');
});

function processImage(){
if(!original){setStatus('Upload an image first.');return;}
if(window.NexaurenLoader?.show)window.NexaurenLoader.show();
setStatus('Removing background…');
requestAnimationFrame(()=>{
try{
const w=originalCanvas.width,h=originalCanvas.height,src=original.data;
const out=new Uint8ClampedArray(src);
const [br,bgValue,bb]=hexRgb(bg.value);
const tolerance=Number(tol.value)*2.55;
const softness=Math.max(1,Number(edge.value)*2.55);
const seen=new Uint8Array(w*h);
const queue=new Int32Array(w*h);
const mask=new Uint8Array(w*h);
let head=0,tail=0;
const distance=i=>Math.hypot(src[i]-br,src[i+1]-bgValue,src[i+2]-bb);
function add(x,y){const p=y*w+x;if(seen[p])return;seen[p]=1;if(distance(p*4)<=tolerance)queue[tail++]=p;}
for(let x=0;x<w;x++){add(x,0);if(h>1)add(x,h-1);}
for(let y=1;y<h-1;y++){add(0,y);if(w>1)add(w-1,y);}
while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);mask[p]=1;if(x>0)add(x-1,y);if(x<w-1)add(x+1,y);if(y>0)add(x,y-1);if(y<h-1)add(x,y+1);}
for(let p=0;p<w*h;p++){
const i=p*4;
if(mask[p])out[i+3]=0;
else if(softness>1){const d=distance(i);if(d<tolerance+softness)out[i+3]=Math.max(0,Math.min(255,Math.round(255*(d-tolerance)/softness)));}
}
rctx.clearRect(0,0,w,h);
rctx.putImageData(new ImageData(out,w,h),0,0);
ready=true;
download.disabled=false;
setStatus('Result preview ready. Check the transparent image before downloading.');
}catch(error){ready=false;download.disabled=true;setStatus('Could not process the image. Please try again.');}
if(window.NexaurenLoader?.hide)window.NexaurenLoader.hide();
});
}
remove.addEventListener('click',processImage);

download.addEventListener('click',()=>{
if(!ready)return;
resultCanvas.toBlob(blob=>{
if(!blob){setStatus('Could not create the PNG.');return;}
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download='nexauren-background-removed.png';
document.body.appendChild(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(url),1000);
},'image/png');
});

reset.addEventListener('click',()=>{
input.value='';workspace.classList.add('hidden');workspace.style.display='';original=null;ready=false;download.disabled=true;setStatus('Upload an image to begin.');
});
});
