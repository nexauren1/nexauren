const {PDFDocument,rgb,degrees,StandardFonts}=PDFLib;
const fileInput=document.getElementById('file');
const drop=document.getElementById('drop');
const fileInfo=document.getElementById('fileInfo');
const run=document.getElementById('run');
const status=document.getElementById('status');
const statusTitle=document.getElementById('statusTitle');
const statusText=document.getElementById('statusText');
const error=document.getElementById('error');
const result=document.getElementById('result');
const download=document.getElementById('download');
const reset=document.getElementById('reset');
const text=document.getElementById('text');
const size=document.getElementById('size');
const opacity=document.getElementById('opacity');
const rotation=document.getElementById('rotation');
const x=document.getElementById('x');
const y=document.getElementById('y');
let file=null,outputUrl=null;
function clearMessages(){status.hidden=true;error.hidden=true;result.hidden=true}
function showError(msg){status.hidden=true;result.hidden=true;error.textContent=msg;error.hidden=false}
function readBytes(f){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(new Uint8Array(r.result));r.onerror=()=>reject(new Error('The PDF could not be read.'));r.readAsArrayBuffer(f)})}
function validPdf(bytes){return bytes.length>4&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-'}
function chooseX(page,w){if(x.value==='left')return 24;if(x.value==='right')return Math.max(24,page.getWidth()-w-24);return (page.getWidth()-w)/2}
function chooseY(page,h){if(y.value==='top')return page.getHeight()-h-28;if(y.value==='bottom')return 28;return (page.getHeight()-h)/2}
async function loadFile(f){clearMessages();file=null;run.disabled=true;if(!f)return;if(!/\.pdf$/i.test(f.name)&&f.type!=='application/pdf'){showError('Please choose a PDF file.');return}file=f;fileInfo.textContent=`${f.name} · ${(f.size/1024/1024).toFixed(2)} MB`;fileInfo.hidden=false;run.disabled=false}
fileInput.addEventListener('change',e=>{loadFile(e.target.files?.[0]);fileInput.value=''})
;['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('active')}));['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('active')}));drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files?.[0]));
run.addEventListener('click',async()=>{if(!file){showError('Please upload a PDF first.');return}const label=(text.value||'').trim();if(!label){showError('Enter watermark text first.');return}let bytes;try{bytes=await readBytes(file);if(!validPdf(bytes))throw new Error('This file does not contain a valid PDF header.');status.hidden=false;error.hidden=true;result.hidden=true;statusTitle.textContent='Creating your PDF…';statusText.textContent='Applying the watermark to every page';run.disabled=true;const doc=await PDFDocument.load(bytes.slice());const font=await doc.embedFont(StandardFonts.HelveticaBold);const fontSize=Math.max(8,Math.min(120,Number(size.value)||36));const alpha=Math.max(.05,Math.min(1,Number(opacity.value)||.25));const angle=Number(rotation.value)||0;for(const page of doc.getPages()){const box=font.widthOfTextAtSize(label,fontSize);const h=fontSize*1.15;const px=chooseX(page,box);const py=chooseY(page,h);page.drawText(label,{x:px,y:py,size:fontSize,font,color:rgb(.85,.45,.02),opacity:alpha,rotate:degrees(angle)})}const out=await doc.save({useObjectStreams:true});if(!out?.length)throw new Error('The watermarked PDF could not be created.');if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(new Blob([out],{type:'application/pdf'}));download.href=outputUrl;download.download='nexauren-watermarked.pdf';status.hidden=true;result.hidden=false}catch(e){showError(e?.message||'We could not watermark this PDF.')}finally{run.disabled=false}})
reset.addEventListener('click',()=>{if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;file=null;fileInfo.hidden=true;fileInfo.textContent='';run.disabled=true;text.value='CONFIDENTIAL';clearMessages()});
clearMessages();fileInfo.hidden=true;run.disabled=true;