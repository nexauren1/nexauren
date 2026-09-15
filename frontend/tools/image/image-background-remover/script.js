const input=document.getElementById('fileInput');
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
let original=null,ready=false;
function setStatus(t){status.textContent=t}
function loadFile(file){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setStatus('Please choose a JPG, PNG or WebP image.');return}
 setStatus('Loading image…');
 const url=URL.createObjectURL(file),im=new Image();
 im.onload=()=>{try{
  originalCanvas.width=resultCanvas.width=im.naturalWidth;
  originalCanvas.height=resultCanvas.height=im.naturalHeight;
  octx.clearRect(0,0,originalCanvas.width,originalCanvas.height);
  octx.drawImage(im,0,0);
  rctx.clearRect(0,0,resultCanvas.width,resultCanvas.height);
  rctx.drawImage(im,0,0);
  original=octx.getImageData(0,0,originalCanvas.width,originalCanvas.height);
  workspace.classList.remove('hidden');ready=false;download.disabled=true;
  setStatus('Image ready. Sample the background or choose its color.');
 }catch(e){setStatus('Could not load this image. Try another file.')}finally{URL.revokeObjectURL(url)}};
 im.onerror=()=>{setStatus('Could not read this image. Try another file.');URL.revokeObjectURL(url)};im.src=url;
}
input.addEventListener('change',e=>loadFile(e.target.files?.[0]));
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files?.[0]));
tol.addEventListener('input',()=>tolVal.textContent=tol.value);
edge.addEventListener('input',()=>edgeVal.textContent=edge.value);
function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
sample.addEventListener('click',()=>{
 if(!original){setStatus('Upload an image first.');return}
 const w=originalCanvas.width,h=originalCanvas.height,d=original.data,pts=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];let r=0,g=0,b=0;
 pts.forEach(([x,y])=>{const i=(y*w+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2]});
 bg.value='#'+[r/4,g/4,b/4].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
 setStatus('Background color sampled. Click Remove background to preview the result.');
});
function processImage(){
 if(!original){setStatus('Upload an image first.');return}
 window.NexaurenLoader?.show?.();setStatus('Removing background…');
 requestAnimationFrame(()=>{try{
  const w=originalCanvas.width,h=originalCanvas.height,src=original.data,out=new Uint8ClampedArray(src),[br,bgValue,bb]=hexRgb(bg.value);
  const tolerance=Number(tol.value)*2.55,soft=Math.max(1,Number(edge.value)*2.55),seen=new Uint8Array(w*h),queue=new Int32Array(w*h),mask=new Uint8Array(w*h);let head=0,tail=0;
  function distance(i){return Math.hypot(src[i]-br,src[i+1]-bgValue,src[i+2]-bb)}
  function add(x,y){const p=y*w+x;if(seen[p])return;seen[p]=1;if(distance(p*4)<=tolerance)queue[tail++]=p}
  for(let x=0;x<w;x++){add(x,0);if(h>1)add(x,h-1)}
  for(let y=1;y<h-1;y++){add(0,y);if(w>1)add(w-1,y)}
  while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;mask[p]=1;if(x>0)add(x-1,y);if(x<w-1)add(x+1,y);if(y>0)add(x,y-1);if(y<h-1)add(x,y+1)}
  for(let p=0;p<w*h;p++){const i=p*4;if(mask[p])out[i+3]=0;else if(soft>1){const dist=distance(i);if(dist<tolerance+soft)out[i+3]=Math.round(255*(dist-tolerance)/soft)}}
  rctx.putImageData(new ImageData(out,w,h),0,0);ready=true;download.disabled=false;setStatus('Preview ready. Check the result on the right before downloading.');
 }catch(e){ready=false;download.disabled=true;setStatus('Could not process the image. Please try again.')}finally{window.NexaurenLoader?.hide?.()}});
}
remove.addEventListener('click',processImage);
download.addEventListener('click',()=>{if(!ready)return;resultCanvas.toBlob(blob=>{if(!blob){setStatus('Could not create the PNG.');return}const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='nexauren-background-removed.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)},'image/png')});
reset.addEventListener('click',()=>{input.value='';workspace.classList.add('hidden');original=null;ready=false;download.disabled=true;setStatus('')});