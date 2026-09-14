const $=s=>document.querySelector(s);
const input=$("#files"),drop=$("#dropzone"),choose=$("#choose"),list=$("#fileList"),section=$("#listSection"),count=$("#fileCount"),status=$("#status"),result=$("#result"),download=$("#download"),resultText=$("#resultText");
let files=[];

function size(n){if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(1)+" KB";return (n/1048576).toFixed(2)+" MB"}
function escapeHtml(v){return v.replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}
function render(){
  count.textContent=`${files.length} ${files.length===1?"file":"files"}`;
  section.classList.toggle("hidden",!files.length);
  list.innerHTML=files.map((f,i)=>`<div class="file-item" draggable="true" data-i="${i}"><span class="grip">⋮⋮</span><span class="pdf-badge">PDF</span><div class="file-info"><div class="file-name">${escapeHtml(f.name)}</div><div class="file-size">${size(f.size)}</div></div><button class="remove" type="button" data-remove="${i}" aria-label="Remove ${escapeHtml(f.name)}">×</button></div>`).join("");
  list.querySelectorAll("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();files.splice(+b.dataset.remove,1);render()});
  let dragIndex=null;
  list.querySelectorAll(".file-item").forEach(el=>{el.ondragstart=()=>{dragIndex=+el.dataset.i;el.classList.add("dragging")};el.ondragend=()=>el.classList.remove("dragging");el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const to=+el.dataset.i;if(dragIndex===null||dragIndex===to)return;const [moved]=files.splice(dragIndex,1);files.splice(to,0,moved);render()}});
}
function add(selected){
  const incoming=[...selected].filter(f=>f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf"));
  if(!incoming.length){showError("Please choose valid PDF files.");return}
  const existing=new Set(files.map(f=>f.name+"|"+f.size+"|"+f.lastModified));
  incoming.forEach(f=>{const key=f.name+"|"+f.size+"|"+f.lastModified;if(!existing.has(key)){files.push(f);existing.add(key)}});
  status.className="status";status.textContent="";result.classList.add("hidden");render();
}
function showError(message){status.className="status error";status.textContent=message}
choose.onclick=()=>input.click();drop.onclick=e=>{if(e.target!==choose)input.click()};input.onchange=()=>{add(input.files);input.value=""};
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>add(e.dataTransfer.files));
$("#clear").onclick=()=>{files=[];render();status.textContent=""};
$("#again").onclick=()=>{files=[];download.removeAttribute("href");result.classList.add("hidden");status.textContent="";render();window.scrollTo({top:0,behavior:"smooth"})};

$("#merge").onclick=async()=>{
  if(files.length<2){showError("Add at least 2 PDF files to merge.");return}
  const button=$("#merge");button.disabled=true;button.textContent="Merging…";status.className="status";status.textContent="Preparing your PDF…";
  try{
    if(!window.PDFLib)throw new Error("PDF engine unavailable");
    const out=await PDFLib.PDFDocument.create();
    for(let i=0;i<files.length;i++){
      status.textContent=`Merging file ${i+1} of ${files.length}…`;
      const bytes=await files[i].arrayBuffer();
      const src=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:false});
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }
    const bytes=await out.save();
    const blob=new Blob([bytes],{type:"application/pdf"});
    if(download.href)URL.revokeObjectURL(download.href);
    download.href=URL.createObjectURL(blob);
    resultText.textContent=`${files.length} PDFs merged into ${out.getPageCount()} pages.`;
    result.classList.remove("hidden");status.textContent="";result.scrollIntoView({behavior:"smooth",block:"center"});
  }catch(err){
    console.error(err);showError("We couldn't merge these PDFs. Check that they are valid and not password-protected, then try again.");
  }finally{button.disabled=false;button.textContent="Merge PDFs"}
};
render();
