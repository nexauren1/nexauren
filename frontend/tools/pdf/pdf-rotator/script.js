const { PDFDocument, degrees } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const input=document.getElementById('fileInput'),drop=document.getElementById('dropZone'),choose=document.getElementById('chooseBtn');
const workspace=document.getElementById('workspace'),grid=document.getElementById('pageGrid'),meta=document.getElementById('fileMeta');
const status=document.getElementById('status'),statusTitle=document.getElementById('statusTitle'),statusText=document.getElementById('statusText');
const errorBox=document.getElementById('errorBox'),errorText=document.getElementById('errorText'),result=document.getElementById('result'),resultText=document.getElementById('resultText');
const rotateBtn=document.getElementById('rotateBtn'),downloadBtn=document.getElementById('downloadBtn'),resetBtn=document.getElementById('resetBtn'),clearBtn=document.getElementById('clearBtn');
let file=null, rotations=[], outputBlob=null;
function clearState(){errorBox.hidden=true;status.hidden=true;result.hidden=true}
function showError(msg){status.hidden=true;errorText.textContent=msg;errorBox.hidden=false}
function progress(title,text){statusTitle.textContent=title;statusText.textContent=text;status.hidden=false}
function reset(){file=null;rotations=[];outputBlob=null;input.value='';grid.innerHTML='';workspace.hidden=true;clearState();window.scrollTo({top:0,behavior:'smooth'})}
async function loadPdf(f){
 if(!f||f.type!=='application/pdf'){showError('Please choose a valid PDF file.');return}
 clearState();file=f;progress('Reading your PDF…','Loading pages for preview');
 try{
  const bytes=new Uint8Array(await f.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
  rotations=Array(pdf.numPages).fill(0);meta.textContent=`${pdf.numPages} page${pdf.numPages===1?'':'s'} · ${(f.size/1024/1024).toFixed(2)} MB`;
  grid.innerHTML='';workspace.hidden=false;
  for(let i=1;i<=pdf.numPages;i++){
   statusText.textContent=`Rendering page ${i} of ${pdf.numPages}`;
   const page=await pdf.getPage(i), viewport=page.getViewport({scale:1});
   const scale=Math.min(1.2,260/Math.max(viewport.width,viewport.height));
   const vp=page.getViewport({scale});const card=document.createElement('article');card.className='page-card';
   const preview=document.createElement('div');preview.className='preview';const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);preview.appendChild(canvas);
   const info=document.createElement('div');info.className='page-info';
   const number=document.createElement('div');number.className='page-number';number.textContent=`Page ${i}`;
   const actions=document.createElement('div');actions.className='page-actions';
   [['90','↻ 90°'],['180','↻ 180°'],['270','↻ 270°'],['0','Reset']].forEach(([value,label])=>{const b=document.createElement('button');b.textContent=label;b.type='button';if(value==='0')b.className='reset';b.onclick=()=>{rotations[i-1]=Number(value);renderCardRotation(canvas,viewport,rotations[i-1]);};actions.appendChild(b)});
   info.append(number,actions);card.append(preview,info);grid.appendChild(card);
   await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  }
  status.hidden=true;
 }catch(e){showError(e?.message||'The PDF could not be read. Try another file.')}
}
function renderCardRotation(canvas,baseViewport,angle){
 const w=baseViewport.width,h=baseViewport.height,swap=angle===90||angle===270;canvas.width=Math.ceil(swap?h:w);canvas.height=Math.ceil(swap?w:h);
 const ctx=canvas.getContext('2d');ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.scale(canvas.width/(swap?h:w),canvas.height/(swap?w:h));
 const source=canvas._source; if(source)ctx.drawImage(source,-w/2,-h/2,w,h);ctx.restore();
}
async function createPdf(){
 if(!file)return;clearState();rotateBtn.disabled=true;progress('Creating rotated PDF…','Applying page rotations');
 try{
  const bytes=new Uint8Array(await file.arrayBuffer()),pdf=await PDFDocument.load(bytes),pages=pdf.getPages();
  pages.forEach((page,i)=>page.setRotation(degrees(rotations[i]||0)));
  const out=await pdf.save({useObjectStreams:true});outputBlob=new Blob([out],{type:'application/pdf'});status.hidden=true;
  resultText.textContent=`${pages.length} page${pages.length===1?'':'s'} rotated · ${(outputBlob.size/1024/1024).toFixed(2)} MB`;result.hidden=false;
 }catch(e){showError(e?.message||'The PDF could not be rotated. It may be damaged or protected.')}finally{rotateBtn.disabled=false}
}
function download(){if(!outputBlob)return;const url=URL.createObjectURL(outputBlob),a=document.createElement('a');a.href=url;a.download='nexauren-rotated.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
choose.onclick=e=>{e.stopPropagation();input.click()};drop.onclick=()=>input.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')input.click()};input.onchange=()=>loadPdf(input.files[0]);drop.ondragover=e=>e.preventDefault();drop.ondrop=e=>{e.preventDefault();loadPdf(e.dataTransfer.files[0])};
clearBtn.onclick=reset;resetBtn.onclick=reset;downloadBtn.onclick=download;rotateBtn.onclick=createPdf;
document.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{const value=Number(b.dataset.all);rotations=rotations.map(()=>value);grid.querySelectorAll('.page-card').forEach((card,i)=>{const canvas=card.querySelector('canvas');const source=canvas._source;if(source){renderCardRotation(canvas,source.viewport,value)}})});
