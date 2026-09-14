const {PDFDocument,degrees}=PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const input=document.getElementById('fileInput'),drop=document.getElementById('dropZone'),choose=document.getElementById('chooseBtn');
const workspace=document.getElementById('workspace'),grid=document.getElementById('pageGrid'),meta=document.getElementById('fileMeta');
const status=document.getElementById('status'),statusTitle=document.getElementById('statusTitle'),statusText=document.getElementById('statusText');
const errorBox=document.getElementById('errorBox'),errorText=document.getElementById('errorText'),result=document.getElementById('result'),resultText=document.getElementById('resultText');
const rotateBtn=document.getElementById('rotateBtn'),downloadBtn=document.getElementById('downloadBtn'),resetBtn=document.getElementById('resetBtn'),clearBtn=document.getElementById('clearBtn');
let file=null,sourceBytes=null,pages=[],outputBlob=null;
function clearState(){status.hidden=true;errorBox.hidden=true;result.hidden=true}
function showError(msg){status.hidden=true;result.hidden=true;errorText.textContent=msg;errorBox.hidden=false}
function progress(title,text){errorBox.hidden=true;result.hidden=true;statusTitle.textContent=title;statusText.textContent=text;status.hidden=false}
function reset(){file=null;sourceBytes=null;pages=[];outputBlob=null;input.value='';grid.innerHTML='';workspace.hidden=true;clearState();window.scrollTo({top:0,behavior:'smooth'})}
function drawRotation(canvas,source,angle){
 const w=source.width,h=source.height,swap=angle===90||angle===270;
 canvas.width=swap?h:w;canvas.height=swap?w:h;
 const ctx=canvas.getContext('2d');ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(source,-w/2,-h/2);ctx.restore();
}
function updateCard(page,angle){page.rotation=angle;drawRotation(page.canvas,page.source,angle);page.angleLabel.textContent=`${angle}°`}
async function loadPdf(f){
 if(!f||f.type!=='application/pdf'){showError('Please choose a valid PDF file.');return}
 reset();file=f;progress('Reading your PDF…','Loading pages for preview');
 try{
  sourceBytes=new Uint8Array(await f.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data:sourceBytes}).promise;
  meta.textContent=`${pdf.numPages} page${pdf.numPages===1?'':'s'} · ${(f.size/1024/1024).toFixed(2)} MB`;
  workspace.hidden=false;
  pages=[];grid.innerHTML='';
  for(let i=1;i<=pdf.numPages;i++){
   statusText.textContent=`Rendering page ${i} of ${pdf.numPages}`;
   const page=await pdf.getPage(i),base=page.getViewport({scale:1}),scale=Math.min(1.2,260/Math.max(base.width,base.height)),vp=page.getViewport({scale});
   const source=document.createElement('canvas');source.width=Math.ceil(vp.width);source.height=Math.ceil(vp.height);
   await page.render({canvasContext:source.getContext('2d'),viewport:vp}).promise;
   const canvas=document.createElement('canvas');
   const card=document.createElement('article');card.className='page-card';
   const preview=document.createElement('div');preview.className='preview';preview.appendChild(canvas);
   const info=document.createElement('div');info.className='page-info';
   const number=document.createElement('div');number.className='page-number';number.textContent=`Page ${i}`;
   const actions=document.createElement('div');actions.className='page-actions';
   const angleLabel=document.createElement('span');angleLabel.className='angle-label';angleLabel.textContent='0°';
   [['90','↻ 90°'],['180','↻ 180°'],['270','↻ 270°'],['0','Reset']].forEach(([value,label])=>{
    const b=document.createElement('button');b.type='button';b.textContent=label;if(value==='0')b.className='reset';
    b.onclick=()=>updateCard(p,Number(value));actions.appendChild(b);
   });
   info.append(number,angleLabel,actions);card.append(preview,info);grid.appendChild(card);
   const p={index:i-1,rotation:0,source,canvas,angleLabel};pages.push(p);drawRotation(canvas,source,0);
  }
  status.hidden=true;
 }catch(e){workspace.hidden=true;showError(e?.message||'The PDF could not be read. Try another PDF file.')}
}
function rebuildPdf(){
 const out=PDFDocument.create();return out.then(async doc=>{
  for(const p of pages){
   const img=await doc.embedPng(p.canvas.toDataURL('image/png'));
   const page=doc.addPage([p.canvas.width,p.canvas.height]);
   page.drawImage(img,{x:0,y:0,width:p.canvas.width,height:p.canvas.height});
  }
  return doc.save({useObjectStreams:true});
 });
}
async function createPdf(){
 if(!file||!pages.length){showError('Choose a PDF before creating the rotated document.');return}
 rotateBtn.disabled=true;clearState();progress('Creating rotated PDF…','Applying page rotations');
 try{
  let outBytes;
  try{
   const pdf=await PDFDocument.load(sourceBytes,{ignoreEncryption:false}),pdfPages=pdf.getPages();
   if(pdfPages.length!==pages.length)throw new Error('The PDF page count changed while processing.');
   pdfPages.forEach((page,i)=>page.setRotation(degrees(pages[i].rotation||0)));
   outBytes=await pdf.save({useObjectStreams:true});
  }catch(nativeError){
   statusText.textContent='Rebuilding the document for compatibility';
   outBytes=await rebuildPdf();
  }
  if(!outBytes||!outBytes.length)throw new Error('The rotated PDF could not be generated.');
  outputBlob=new Blob([outBytes],{type:'application/pdf'});status.hidden=true;
  resultText.textContent=`${pages.length} page${pages.length===1?'':'s'} rotated · ${(outputBlob.size/1024/1024).toFixed(2)} MB`;
  result.hidden=false;
 }catch(e){showError(e?.message||'The PDF could not be rotated. Try another PDF file.')}finally{rotateBtn.disabled=false}
}
function download(){if(!outputBlob)return;const url=URL.createObjectURL(outputBlob),a=document.createElement('a');a.href=url;a.download='nexauren-rotated.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
choose.onclick=e=>{e.stopPropagation();input.click()};drop.onclick=e=>{if(!e.target.closest('button'))input.click()};drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};input.onchange=()=>{const f=input.files?.[0];if(f)loadPdf(f);input.value=''};drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover')};drop.ondragleave=()=>drop.classList.remove('dragover');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');loadPdf(e.dataTransfer.files?.[0])};
document.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>{const value=Number(b.dataset.all);pages.forEach(p=>updateCard(p,value))});
clearBtn.onclick=reset;resetBtn.onclick=reset;downloadBtn.onclick=download;rotateBtn.onclick=createPdf;clearState();