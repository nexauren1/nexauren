const {PDFDocument}=PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const input=document.getElementById('fileInput'),drop=document.getElementById('dropZone'),choose=document.getElementById('chooseBtn');
const workspace=document.getElementById('workspace'),grid=document.getElementById('pageGrid'),meta=document.getElementById('fileMeta');
const selectedCount=document.getElementById('selectedCount'),selectionHint=document.getElementById('selectionHint');
const rangeInput=document.getElementById('pageRange'),applyRange=document.getElementById('applyRange'),selectAll=document.getElementById('selectAll'),clearSelection=document.getElementById('clearSelection');
const status=document.getElementById('status'),statusTitle=document.getElementById('statusTitle'),statusText=document.getElementById('statusText');
const errorBox=document.getElementById('errorBox'),errorText=document.getElementById('errorText'),result=document.getElementById('result'),resultText=document.getElementById('resultText');
const extractBtn=document.getElementById('extractBtn'),downloadBtn=document.getElementById('downloadBtn'),resetBtn=document.getElementById('resetBtn'),clearBtn=document.getElementById('clearBtn');
let file=null,sourceBytes=null,pages=[],outputBlob=null;
function clearState(){status.hidden=true;errorBox.hidden=true;result.hidden=true}
function showError(msg){status.hidden=true;result.hidden=true;errorText.textContent=msg;errorBox.hidden=false}
function progress(title,text){errorBox.hidden=true;result.hidden=true;statusTitle.textContent=title;statusText.textContent=text;status.hidden=false}
function reset(){file=null;sourceBytes=null;pages=[];outputBlob=null;input.value='';grid.innerHTML='';workspace.hidden=true;rangeInput.value='';clearState()}
function updateSelection(){const count=pages.filter(p=>p.selected).length;selectedCount.textContent=`${count} page${count===1?'':'s'} selected`;selectionHint.textContent=count?'Ready to extract the selected pages.':'Choose the pages to extract.';extractBtn.disabled=count===0}
function setSelected(index,value){const p=pages[index];if(!p)return;p.selected=value;p.card.classList.toggle('selected',value);p.check.textContent=value?'✓':'';updateSelection()}
function parseRanges(value,total){
 const selected=new Set();
 if(!value.trim())throw new Error('Enter at least one page number or range.');
 for(const raw of value.split(',')){
  const part=raw.trim();if(!part)continue;
  if(/^\d+$/.test(part)){const n=Number(part);if(n<1||n>total)throw new Error(`Page ${n} is outside the PDF.`);selected.add(n-1);continue}
  const match=part.match(/^(\d+)\s*-\s*(\d+)$/);if(!match)throw new Error(`Invalid page range: ${part}`);
  let a=Number(match[1]),b=Number(match[2]);if(a>b)[a,b]=[b,a];if(a<1||b>total)throw new Error(`Range ${part} is outside the PDF.`);for(let n=a;n<=b;n++)selected.add(n-1);
 }
 return selected
}
async function loadPdf(f){
 if(!f||f.type!=='application/pdf'){showError('Please choose a valid PDF file.');return}
 reset();file=f;progress('Reading your PDF…','Loading pages for preview');
 try{
  sourceBytes=new Uint8Array(await f.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data:sourceBytes}).promise;
  if(!pdf.numPages)throw new Error('The PDF contains no pages.');
  meta.textContent=`${pdf.numPages} page${pdf.numPages===1?'':'s'} · ${(f.size/1024/1024).toFixed(2)} MB`;
  workspace.hidden=false;pages=[];grid.innerHTML='';
  for(let i=1;i<=pdf.numPages;i++){
   statusText.textContent=`Rendering page ${i} of ${pdf.numPages}`;
   const page=await pdf.getPage(i),base=page.getViewport({scale:1}),scale=Math.min(1.2,260/Math.max(base.width,base.height)),vp=page.getViewport({scale});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
   const card=document.createElement('article');card.className='page-card';
   const preview=document.createElement('div');preview.className='preview';preview.appendChild(canvas);
   const check=document.createElement('div');check.className='check';preview.appendChild(check);
   const info=document.createElement('div');info.className='page-info';
   const number=document.createElement('div');number.className='page-number';number.textContent=`Page ${i}`;
   info.appendChild(number);card.append(preview,info);grid.appendChild(card);
   const p={index:i-1,selected:false,card,check};pages.push(p);
   card.onclick=()=>setSelected(i-1,!p.selected);
  }
  updateSelection();status.hidden=true;
 }catch(e){workspace.hidden=true;showError(e?.message||'The PDF could not be read. Try another PDF file.')}
}
function applyPageRanges(){
 try{const set=parseRanges(rangeInput.value,pages.length);pages.forEach((p,i)=>setSelected(i,set.has(i)))}catch(e){showError(e.message)}
}
function selectEverything(value){pages.forEach((p,i)=>setSelected(i,value));if(value)rangeInput.value=pages.length?`1-${pages.length}`:'';else rangeInput.value=''}
async function createPdf(){
 const selected=pages.filter(p=>p.selected).map(p=>p.index);
 if(!sourceBytes||!selected.length){showError('Select at least one page before extracting.');return}
 extractBtn.disabled=true;clearState();progress('Creating extracted PDF…','Copying selected pages');
 try{
  const source=await PDFDocument.load(sourceBytes,{ignoreEncryption:false});
  const out=await PDFDocument.create();
  const copied=await out.copyPages(source,selected);
  copied.forEach(page=>out.addPage(page));
  const bytes=await out.save({useObjectStreams:true});
  if(!bytes.length)throw new Error('The extracted PDF could not be generated.');
  outputBlob=new Blob([bytes],{type:'application/pdf'});status.hidden=true;
  resultText.textContent=`${selected.length} page${selected.length===1?'':'s'} extracted · ${(outputBlob.size/1024/1024).toFixed(2)} MB`;
  result.hidden=false;
 }catch(e){showError(e?.message||'The pages could not be extracted. The PDF may be damaged, encrypted or protected.')}finally{updateSelection()}
}
function download(){if(!outputBlob)return;const url=URL.createObjectURL(outputBlob),a=document.createElement('a');a.href=url;a.download='nexauren-extracted-pages.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
choose.onclick=e=>{e.stopPropagation();input.click()};drop.onclick=e=>{if(!e.target.closest('button'))input.click()};drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};input.onchange=()=>{const f=input.files?.[0];if(f)loadPdf(f);input.value=''};drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover')};drop.ondragleave=()=>drop.classList.remove('dragover');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');loadPdf(e.dataTransfer.files?.[0])};
applyRange.onclick=applyPageRanges;rangeInput.onkeydown=e=>{if(e.key==='Enter')applyPageRanges()};selectAll.onclick=()=>selectEverything(true);clearSelection.onclick=()=>selectEverything(false);clearBtn.onclick=reset;resetBtn.onclick=reset;downloadBtn.onclick=download;extractBtn.onclick=createPdf;clearState();