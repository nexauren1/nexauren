const input=document.getElementById('fileInput');
const choose=document.getElementById('chooseBtn');
const drop=document.getElementById('dropZone');
const workspace=document.getElementById('workspace');
const preview=document.getElementById('preview');
const palette=document.getElementById('palette');
const status=document.getElementById('status');
const fileInfo=document.getElementById('fileInfo');
const newBtn=document.getElementById('newBtn');
const regenerate=document.getElementById('regenerateBtn');
const copyAll=document.getElementById('copyAllBtn');
let sourceFile=null;
let colors=[];

function setStatus(text,type=''){status.textContent=text;status.className='status '+type}
function valid(file){return file&&['image/jpeg','image/png','image/webp'].includes(file.type)}
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0,l=(max+min)/2;const d=max-min;if(d){s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=((g-b)/d+(g<b?6:0));break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4}h/=6}return [Math.round(h*360),Math.round(s*100),Math.round(l*100)]}
function hex(r,g,b){return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()}
function distance(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2)}
function makePalette(){
  const img=new Image();img.onload=()=>{
    const canvas=document.createElement('canvas');const max=180;const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;const candidates=[];
    for(let i=0;i<data.length;i+=16){const a=data[i+3];if(a<150)continue;const r=data[i],g=data[i+1],b=data[i+2];const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<12&&mx>235)continue;candidates.push([r,g,b])}
    candidates.sort((a,b)=>(b[0]+b[1]+b[2])-(a[0]+a[1]+a[2]));colors=[];
    for(const c of candidates){if(colors.every(x=>distance(c,x)>42))colors.push(c);if(colors.length===6)break}
    while(colors.length<6){const c=candidates[Math.floor(Math.random()*Math.max(1,candidates.length))]||[120,120,120];colors.push(c)}
    renderPalette();setStatus('Palette generated successfully.','success');
  };img.onerror=()=>setStatus('We could not read this image. Try another file.','error');img.src=URL.createObjectURL(sourceFile)
}
function renderPalette(){palette.innerHTML='';colors.forEach((c,i)=>{const h=hex(...c),hsl=rgbToHsl(...c);const b=document.createElement('button');b.className='swatch';b.type='button';b.title='Copy '+h;b.innerHTML=`<div class="swatch-color" style="background:${h}"></div><div class="swatch-info"><div class="hex">${h}</div><div class="values">RGB ${c.join(', ')}<br>HSL ${hsl.join(', ')}</div></div>`;b.onclick=()=>navigator.clipboard?.writeText(h).then(()=>setStatus(`${h} copied to clipboard.`,'success'));palette.appendChild(b)})}
function loadFile(file){if(!valid(file)){setStatus('Please choose a JPG, PNG or WebP image.','error');return}sourceFile=file;preview.src=URL.createObjectURL(file);fileInfo.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB · ${file.type.split('/')[1].toUpperCase()}`;drop.hidden=true;workspace.hidden=false;setStatus('Generating palette…');makePalette()}
choose.onclick=()=>input.click();input.onchange=()=>loadFile(input.files[0]);
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
regenerate.onclick=()=>{if(sourceFile){setStatus('Regenerating palette…');makePalette()}};
copyAll.onclick=()=>{if(!colors.length)return;const text=colors.map(c=>{const h=hex(...c);const s=rgbToHsl(...c);return `${h} | RGB ${c.join(', ')} | HSL ${s.join(', ')}`}).join('\n');navigator.clipboard?.writeText(text).then(()=>setStatus('Full palette copied to clipboard.','success'))};
newBtn.onclick=()=>{sourceFile=null;colors=[];input.value='';preview.removeAttribute('src');palette.innerHTML='';workspace.hidden=true;drop.hidden=false;setStatus('')};
