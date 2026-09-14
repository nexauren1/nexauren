const {PDFDocument}=PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const input=document.getElementById('fileInput');
const drop=document.getElementById('dropZone');
const choose=document.getElementById('chooseBtn');
const workspace=document.getElementById('workspace');
const grid=document.getElementById('pageGrid');
const meta=document.getElementById('fileMeta');
const selectedCount=document.getElementById('selectedCount');
const selectionHint=document.getElementById('selectionHint');
const rangeInput=document.getElementById('pageRange');
const applyRange=document.getElementById('applyRange');
const selectAll=document.getElementById('selectAll');
const clearSelection=document.getElementById('clearSelection');
const status=document.getElementById('status');
const statusTitle=document.getElementById('statusTitle');
const statusText=document.getElementById('statusText');
const errorBox=document.getElementById('errorBox');
const errorText=document.getElementById('errorText');
const result=document.getElementById('result');
const resultText=document.getElementById('resultText');
const extractBtn=document.getElementById('extractBtn');
const downloadBtn=document.getElementById('downloadBtn');
const resetBtn=document.getElementById('resetBtn');
const clearBtn=document.getElementById('clearBtn');

let file=null;
let sourceBytes=null;
let pages=[];
let outputBlob=null;

function clearMessages(){
  status.hidden=true;
  errorBox.hidden=true;
  result.hidden=true;
}

function showError(message){
  status.hidden=true;
  result.hidden=true;
  errorText.textContent=message;
  errorBox.hidden=false;
}

function showProgress(title,text){
  errorBox.hidden=true;
  result.hidden=true;
  statusTitle.textContent=title;
  statusText.textContent=text;
  status.hidden=false;
}

function reset(){
  file=null;
  sourceBytes=null;
  pages=[];
  outputBlob=null;
  input.value='';
  grid.innerHTML='';
  workspace.hidden=true;
  rangeInput.value='';
  meta.textContent='';
  clearMessages();
  extractBtn.disabled=true;
}

function updateSelection(){
  const count=pages.filter(page=>page.selected).length;
  selectedCount.textContent=`${count} page${count===1?'':'s'} selected`;
  selectionHint.textContent=count
    ? 'Ready to extract the selected pages.'
    : 'Choose the pages to extract.';
  extractBtn.disabled=!sourceBytes||count===0;
}

function setSelected(index,value){
  const page=pages[index];
  if(!page)return;
  page.selected=value;
  page.card.classList.toggle('selected',value);
  page.check.textContent=value?'✓':'';
  updateSelection();
}

function parseRanges(value,total){
  const selected=new Set();
  if(!value.trim())throw new Error('Enter at least one page number or range.');

  for(const raw of value.split(',')){
    const part=raw.trim();
    if(!part)continue;

    if(/^\d+$/.test(part)){
      const pageNumber=Number(part);
      if(pageNumber<1||pageNumber>total){
        throw new Error(`Page ${pageNumber} is outside the PDF.`);
      }
      selected.add(pageNumber-1);
      continue;
    }

    const match=part.match(/^(\d+)\s*-\s*(\d+)$/);
    if(!match)throw new Error(`Invalid page range: ${part}`);

    let start=Number(match[1]);
    let end=Number(match[2]);
    if(start>end)[start,end]=[end,start];
    if(start<1||end>total){
      throw new Error(`Range ${part} is outside the PDF.`);
    }

    for(let number=start;number<=end;number++)selected.add(number-1);
  }

  if(!selected.size)throw new Error('No valid pages were selected.');
  return selected;
}

function isPdfFile(fileToCheck){
  return Boolean(
    fileToCheck &&
    (fileToCheck.type==='application/pdf' ||
      fileToCheck.name.toLowerCase().endsWith('.pdf'))
  );
}

async function readFileBytes(fileToRead){
  const buffer=await fileToRead.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  if(bytes.length<5){
    throw new Error('The selected file is too small to be a valid PDF.');
  }

  const header=new TextDecoder().decode(bytes.subarray(0,5));
  if(header!=='%PDF-'){
    throw new Error('This file does not contain a valid PDF header. Please choose a real PDF file.');
  }
  return bytes;
}

async function loadPdf(selectedFile){
  if(!isPdfFile(selectedFile)){
    showError('Please choose a valid PDF file.');
    return;
  }

  reset();
  file=selectedFile;
  showProgress('Reading your PDF…','Loading pages for preview');

  try{
    sourceBytes=await readFileBytes(selectedFile);

    // PDF.js may transfer/detach the bytes it receives.
    // Keep an independent copy for pdf-lib extraction later.
    const previewBytes=sourceBytes.slice();
    const pdf=await pdfjsLib.getDocument({data:previewBytes}).promise;

    if(!pdf.numPages)throw new Error('The PDF contains no pages.');

    meta.textContent=`${pdf.numPages} page${pdf.numPages===1?'':'s'} · ${(selectedFile.size/1024/1024).toFixed(2)} MB`;
    workspace.hidden=false;
    pages=[];
    grid.innerHTML='';

    for(let number=1;number<=pdf.numPages;number++){
      statusText.textContent=`Rendering page ${number} of ${pdf.numPages}`;

      const page=await pdf.getPage(number);
      const base=page.getViewport({scale:1});
      const scale=Math.min(1.2,260/Math.max(base.width,base.height));
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);
      canvas.height=Math.ceil(viewport.height);

      await page.render({
        canvasContext:canvas.getContext('2d'),
        viewport
      }).promise;

      const card=document.createElement('article');
      card.className='page-card';

      const preview=document.createElement('div');
      preview.className='preview';
      preview.appendChild(canvas);

      const check=document.createElement('div');
      check.className='check';
      preview.appendChild(check);

      const info=document.createElement('div');
      info.className='page-info';

      const pageNumber=document.createElement('div');
      pageNumber.className='page-number';
      pageNumber.textContent=`Page ${number}`;
      info.appendChild(pageNumber);

      card.append(preview,info);
      grid.appendChild(card);

      const pageState={
        index:number-1,
        selected:false,
        card,
        check
      };

      pages.push(pageState);
      card.onclick=()=>setSelected(number-1,!pageState.selected);
    }

    updateSelection();
    status.hidden=true;
  }catch(error){
    workspace.hidden=true;
    sourceBytes=null;
    showError(error?.message||'The PDF could not be read. Try another PDF file.');
  }
}

function applyPageRanges(){
  try{
    if(!pages.length)throw new Error('Choose a PDF before applying a page range.');
    const selected=parseRanges(rangeInput.value,pages.length);
    pages.forEach((page,index)=>setSelected(index,selected.has(index)));
  }catch(error){
    showError(error.message);
  }
}

function selectEverything(value){
  pages.forEach((page,index)=>setSelected(index,value));
  rangeInput.value=value&&pages.length?`1-${pages.length}`:'';
}

async function createPdf(){
  const selected=pages.filter(page=>page.selected).map(page=>page.index);

  if(!sourceBytes){
    showError('Choose a PDF before extracting pages.');
    return;
  }
  if(!selected.length){
    showError('Select at least one page before extracting.');
    return;
  }

  extractBtn.disabled=true;
  clearMessages();
  showProgress('Creating extracted PDF…','Copying selected pages');

  try{
    // Always pass a fresh copy to pdf-lib.
    const source=await PDFDocument.load(sourceBytes.slice(),{
      ignoreEncryption:false
    });
    const output=await PDFDocument.create();
    const copiedPages=await output.copyPages(source,selected);
    copiedPages.forEach(page=>output.addPage(page));

    const bytes=await output.save({useObjectStreams:true});
    if(!bytes?.length)throw new Error('The extracted PDF could not be generated.');

    outputBlob=new Blob([bytes],{type:'application/pdf'});
    status.hidden=true;
    resultText.textContent=`${selected.length} page${selected.length===1?'':'s'} extracted · ${(outputBlob.size/1024/1024).toFixed(2)} MB`;
    result.hidden=false;
  }catch(error){
    showError(error?.message||'The pages could not be extracted. The PDF may be damaged, encrypted or protected.');
  }finally{
    updateSelection();
  }
}

function download(){
  if(!outputBlob)return;
  const url=URL.createObjectURL(outputBlob);
  const link=document.createElement('a');
  link.href=url;
  link.download='nexauren-extracted-pages.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

choose.onclick=event=>{
  event.stopPropagation();
  input.click();
};

drop.onclick=event=>{
  if(!event.target.closest('button'))input.click();
};

drop.onkeydown=event=>{
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    input.click();
  }
};

input.onchange=()=>{
  const selectedFile=input.files?.[0];
  if(selectedFile)loadPdf(selectedFile);
  input.value='';
};

drop.ondragover=event=>{
  event.preventDefault();
  drop.classList.add('dragover');
};

drop.ondragleave=()=>drop.classList.remove('dragover');
drop.ondrop=event=>{
  event.preventDefault();
  drop.classList.remove('dragover');
  loadPdf(event.dataTransfer.files?.[0]);
};

applyRange.onclick=applyPageRanges;
rangeInput.onkeydown=event=>{
  if(event.key==='Enter')applyPageRanges();
};
selectAll.onclick=()=>selectEverything(true);
clearSelection.onclick=()=>selectEverything(false);
clearBtn.onclick=reset;
resetBtn.onclick=reset;
downloadBtn.onclick=download;
extractBtn.onclick=createPdf;

clearMessages();
