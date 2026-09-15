const $=id=>document.getElementById(id);
let posts=[];
let categories=[];
let authors=[];
let editingId=null;
let autosaveTimer=null;
const LOCAL_KEY="nexauren_blog_editor_draft";

const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const dateText=value=>value?new Date(String(value).match(/^\d+$/)?Number(value):value).toLocaleString():"—";
const typeText=value=>String(value||"article").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());

function notice(message,error=false){
  const box=$("notice");
  box.textContent=message;
  box.className=error?"notice error":"notice";
  box.hidden=false;
  clearTimeout(notice.timer);
  notice.timer=setTimeout(()=>box.hidden=true,4500);
}

async function api(url,options={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){location.replace("/login/");throw new Error("Please sign in.");}
  if(response.status===403)throw new Error(data.error||"Admin access required.");
  if(!response.ok)throw new Error(data.error||data.detail||"Request failed.");
  return data;
}

async function loadBase(){
  const [cats,auts]=await Promise.all([api("/api/blog/admin/categories"),api("/api/blog/admin/authors")]);
  categories=cats.categories||[];
  authors=auts.authors||[];
  $("category").innerHTML='<option value="">No category</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("author").innerHTML='<option value="">No author</option>'+authors.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
  $("categoryFilter").innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

async function loadPosts(){
  $("loading").hidden=false;
  $("postsTable").hidden=true;
  try{
    const data=await api("/api/blog/admin/posts");
    posts=data.posts||[];
    clearSelection();
    renderPosts();
  }catch(error){
    $("loading").textContent=error.message;
    $("loading").hidden=false;
  }
}

function renderPosts(){
  const query=$("search").value.trim().toLowerCase();
  const status=$("statusFilter").value;
  const category=$("categoryFilter").value;
  const type=$("typeFilter").value;
  const sort=$("sortFilter").value;
  let rows=posts.filter(p=>{
    const hay=`${p.title||""} ${p.slug||""} ${p.category_name||""} ${p.type||""} ${p.status||""}`.toLowerCase();
    return (!query||hay.includes(query))&&(!status||p.status===status)&&(!category||String(p.category_id)===String(category))&&(!type||p.type===type);
  });
  rows.sort((a,b)=>{
    if(sort==="title")return String(a.title||"").localeCompare(String(b.title||""));
    const av=new Date(sort==="published"?(a.published_at||a.updated_at):(a.updated_at||a.created_at||0)).getTime();
    const bv=new Date(sort==="published"?(b.published_at||b.updated_at):(b.updated_at||b.created_at||0)).getTime();
    return bv-av;
  });
  $("totalPosts").textContent=posts.length;
  $("publishedPosts").textContent=posts.filter(p=>p.status==="published").length;
  $("draftPosts").textContent=posts.filter(p=>p.status==="draft").length;
  $("scheduledPosts").textContent=posts.filter(p=>p.status==="scheduled").length;
  $("navPosts").textContent=posts.length;
  $("resultCount").textContent=`${rows.length} result${rows.length===1?"":"s"}`;
  $("loading").hidden=true;
  $("postsTable").hidden=false;
  $("postsBody").innerHTML=rows.length?rows.map(p=>`<tr>
    <td class="check-col"><input class="row-check" type="checkbox" data-select="${p.id}" aria-label="Select ${esc(p.title)}"></td>
    <td><div class="post-title">${esc(p.title)}</div><div class="post-meta">/${esc(p.slug)} · ${Number(p.reading_time||0)} min read</div></td>
    <td>${esc(p.category_name||"—")}</td>
    <td>${esc(typeText(p.type))}</td>
    <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
    <td>${esc(dateText(p.updated_at))}</td>
    <td><div class="row-actions"><button data-edit="${p.id}">Edit</button>${p.status==="published"?`<button data-view="${esc(p.slug)}">View</button>`:""}<button data-delete="${p.id}">Delete</button></div></td>
  </tr>`).join(""): '<tr><td colspan="7" class="empty">No posts match these filters.</td></tr>';
  syncSelectionUI();
}

function showView(view){
  const editor=view==="new"||view==="edit";
  $("postsView").hidden=editor;
  $("editorView").hidden=!editor;
  $("pageTitle").textContent=editor?(view==="edit"?"Edit post":"New post"):"Content library";
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  window.scrollTo({top:0,behavior:"smooth"});
}

function resetForm(){
  editingId=null;
  $("postForm").reset();
  $("status").value="draft";
  $("type").value="article";
  $("slug").dataset.touched="";
  $("imagePreview").textContent="No image";
  $("saveState").textContent="Not saved";
  updateMetrics();
  updatePreview();
  updateSeo();
}

function fillForm(post){
  editingId=post.id;
  $("title").value=post.title||"";
  $("slug").value=post.slug||"";
  $("slug").dataset.touched="1";
  $("excerpt").value=post.excerpt||"";
  $("content").value=post.content||"";
  $("seoTitle").value=post.seo_title||"";
  $("seoDescription").value=post.seo_description||"";
  $("seoKeywords").value=post.seo_keywords||"";
  $("canonicalUrl").value=post.canonical_url||"";
  $("status").value=post.status||"draft";
  $("type").value=post.type||"article";
  $("category").value=post.category_id||"";
  $("author").value=post.author_id||"";
  $("tags").value=Array.isArray(post.tags)?post.tags.join(", "):post.tags||"";
  $("coverImage").value=post.cover_image||"";
  $("coverAlt").value=post.cover_image_alt||"";
  if(post.published_at){
    const d=new Date(post.published_at);
    if(!Number.isNaN(d.getTime()))$("publishedAt").value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  $("saveState").textContent="Loaded from server";
  updatePreview();
  updateMetrics();
  updateSeo();
}

async function editPost(id){
  try{
    const data=await api(`/api/blog/admin/posts?id=${encodeURIComponent(id)}`);
    fillForm(data.post);
    showView("edit");
  }catch(error){notice(error.message,true);}
}

async function deletePost(id){
  const post=posts.find(x=>String(x.id)===String(id));
  if(!post)return;
  if(!confirm(`Delete “${post.title}”? This cannot be undone.`))return;
  try{
    await api(`/api/blog/admin/posts/${encodeURIComponent(id)}`,{method:"DELETE"});
    notice("Post deleted.");
    await loadPosts();
  }catch(error){notice(error.message,true);}
}

function payload(){
  const publishedAt=$("publishedAt").value;
  return {
    title:$("title").value.trim(),slug:$("slug").value.trim(),excerpt:$("excerpt").value.trim(),content:$("content").value,
    cover_image:$("coverImage").value.trim(),cover_image_alt:$("coverAlt").value.trim(),category_id:$("category").value||null,
    author_id:$("author").value||null,status:$("status").value,type:$("type").value,seo_title:$("seoTitle").value.trim(),
    seo_description:$("seoDescription").value.trim(),seo_keywords:$("seoKeywords").value.trim(),canonical_url:$("canonicalUrl").value.trim(),
    published_at:publishedAt?new Date(publishedAt).toISOString():null,tags:$("tags").value.split(",").map(x=>x.trim()).filter(Boolean)
  };
}

async function savePost(event){
  if(event)event.preventDefault();
  const buttons=[$("save"),$("saveSide")].filter(Boolean);
  buttons.forEach(b=>{b.disabled=true;b.textContent="Saving…";});
  try{
    const body=payload();
    if(!body.title||!body.content.trim())throw new Error("Title and content are required.");
    const data=await api(editingId?`/api/blog/admin/posts/${editingId}`:"/api/blog/admin/posts",{method:editingId?"PUT":"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body)});
    clearLocalDraft();
    notice(editingId?"Post updated successfully.":"Post created successfully.");
    await loadPosts();
    resetForm();
    showView("posts");
    if(data.slug)notice(`Saved: /blog/${data.slug}/`);
  }catch(error){notice(error.message,true);}
  finally{buttons.forEach(b=>{b.disabled=false;b.textContent="Save post";});}
}

function updatePreview(){
  const url=$("coverImage").value.trim();
  const box=$("imagePreview");
  if(!url){box.textContent="No image";return;}
  box.innerHTML="";
  const img=new Image();img.alt="Cover preview";
  img.onload=()=>{box.innerHTML="";box.appendChild(img);};
  img.onerror=()=>{box.textContent="Image could not be previewed";};
  img.src=url;
}

function updateMetrics(){
  const raw=$("content").value.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  const words=raw?raw.split(" ").length:0;
  const minutes=Math.max(0,Math.ceil(words/200));
  $("wordCount").textContent=`${words} word${words===1?"":"s"}`;
  $("readingTime").textContent=`${minutes} min read`;
  $("excerptCount").textContent=`${$("excerpt").value.length} / 500`;
  $("seoTitleCount").textContent=`${$("seoTitle").value.length} / 220`;
  $("seoDescriptionCount").textContent=`${$("seoDescription").value.length} / 320`;
}

function updateSeo(){
  let score=0;
  const checks=[[$("title").value.trim().length>=30,20],[$("excerpt").value.trim().length>=80,15],[$("content").value.trim().length>=600,20],[$("seoTitle").value.trim().length>=30,15],[$("seoDescription").value.trim().length>=100,15],[$("coverImage").value.trim().length>0,10],[$("coverAlt").value.trim().length>0,5]];
  checks.forEach(x=>{if(x[0])score+=x[1];});
  $("seoScore").textContent=`SEO readiness: ${score}%`;
  $("seoBar").style.width=`${score}%`;
}

function editorChanged(){
  $("saveState").textContent="Unsaved changes";
  updateMetrics();updateSeo();
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(saveLocalDraft,700);
}

function saveLocalDraft(){
  if(!$("editorView")||$("editorView").hidden)return;
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify({savedAt:Date.now(),editingId,payload:payload()}));$("saveState").textContent="Saved locally";}catch(_){ }
}
function clearLocalDraft(){try{localStorage.removeItem(LOCAL_KEY);}catch(_){} }
function restoreLocalDraft(){
  try{
    const data=JSON.parse(localStorage.getItem(LOCAL_KEY)||"null");
    if(!data?.payload)return false;
    const p=data.payload;editingId=data.editingId||null;
    $("title").value=p.title||"";$("slug").value=p.slug||"";$("excerpt").value=p.excerpt||"";$("content").value=p.content||"";
    $("coverImage").value=p.cover_image||"";$("coverAlt").value=p.cover_image_alt||"";$("category").value=p.category_id||"";$("author").value=p.author_id||"";
    $("status").value=p.status||"draft";$("type").value=p.type||"article";$("seoTitle").value=p.seo_title||"";$("seoDescription").value=p.seo_description||"";
    $("seoKeywords").value=p.seo_keywords||"";$("canonicalUrl").value=p.canonical_url||"";$("publishedAt").value=p.published_at?new Date(p.published_at).toISOString().slice(0,16):"";$("tags").value=(p.tags||[]).join(", ");
    $("slug").dataset.touched="1";$("saveState").textContent="Restored local draft";updatePreview();updateMetrics();updateSeo();return true;
  }catch(_){return false;}
}

const selected=new Set();
function syncSelectionUI(){
  document.querySelectorAll("[data-select]").forEach(x=>x.checked=selected.has(String(x.dataset.select)));
  const count=selected.size;$("selectedCount").textContent=count;$("bulkBar").hidden=!count;
  const visible=[...document.querySelectorAll(".row-check")];
  $("selectAll").checked=visible.length>0&&visible.every(x=>x.checked);
}
function clearSelection(){selected.clear();if($("selectAll"))$("selectAll").checked=false;if($("bulkBar"))$("bulkBar").hidden=true;}
async function bulkStatus(status){
  const ids=[...selected];if(!ids.length)return;
  if(!confirm(`Update ${ids.length} selected post${ids.length===1?"":"s"}?`))return;
  try{
    for(const id of ids){const post=posts.find(x=>String(x.id)===id);if(!post)continue;const body={...post,status};delete body.id;delete body.created_at;delete body.updated_at;await api(`/api/blog/admin/posts/${encodeURIComponent(id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
    notice(`Updated ${ids.length} post${ids.length===1?"":"s"}.`);await loadPosts();
  }catch(error){notice(error.message,true);}
}
async function bulkDelete(){
  const ids=[...selected];if(!ids.length)return;
  if(!confirm(`Delete ${ids.length} selected post${ids.length===1?"":"s"}? This cannot be undone.`))return;
  try{for(const id of ids)await api(`/api/blog/admin/posts/${encodeURIComponent(id)}`,{method:"DELETE"});notice(`Deleted ${ids.length} post${ids.length===1?"":"s"}.`);await loadPosts();}catch(error){notice(error.message,true);}
}

function previewPost(){
  const p=payload();
  const safeContent=String(p.content||"").replace(/<script[\s\S]*?<\/script>/gi,"");
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title||"Preview")}</title><style>body{font-family:system-ui,sans-serif;max-width:820px;margin:50px auto;padding:0 20px;color:#18243d;line-height:1.75}h1{font-size:42px;line-height:1.12}img{max-width:100%;border-radius:14px}article{font-size:18px}small{color:#71809a}</style></head><body><small>NEXAUREN · PREVIEW</small><h1>${esc(p.title||"Untitled")}</h1><p>${esc(p.excerpt||"")}</p>${p.cover_image?`<img src="${esc(p.cover_image)}" alt="${esc(p.cover_image_alt)}">`:""}<article>${safeContent.replace(/\n/g,"<br>")}</article></body></html>`;
  const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),30000);
}

$("postForm").addEventListener("submit",savePost);
$("title").addEventListener("input",()=>{if(!editingId&&!$("slug").dataset.touched)$("slug").value=$("title").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180);editorChanged();});
$("slug").addEventListener("input",()=>{ $("slug").dataset.touched="1";editorChanged();});
["excerpt","content","seoTitle","seoDescription","seoKeywords","canonicalUrl","tags","coverImage","coverAlt","publishedAt","status","type","category","author"].forEach(id=>$(id)?.addEventListener("input",()=>{if(id==="coverImage")updatePreview();editorChanged();}));
["status","type","category","author"].forEach(id=>$(id)?.addEventListener("change",editorChanged));

$("newPost").onclick=()=>{resetForm();showView("new");};
$("cancel").onclick=()=>{resetForm();showView("posts");};
$("preview").onclick=previewPost;
$("restoreDraft").onclick=()=>{if(restoreLocalDraft())notice("Local draft restored.");else notice("No local draft is available.",true);};
$("discardLocal").onclick=()=>{clearLocalDraft();$("saveState").textContent="Local draft discarded";notice("Local draft discarded.");};
$("clearFilters").onclick=()=>{$("search").value="";$("statusFilter").value="";$("categoryFilter").value="";$("typeFilter").value="";$("sortFilter").value="updated";renderPosts();};
$("selectAll").onchange=event=>{document.querySelectorAll(".row-check").forEach(x=>{x.checked=event.target.checked;if(event.target.checked)selected.add(String(x.dataset.select));else selected.delete(String(x.dataset.select));});syncSelectionUI();};
$("bulkDraft").onclick=()=>bulkStatus("draft");$("bulkDelete").onclick=bulkDelete;$("clearSelection").onclick=()=>{clearSelection();syncSelectionUI();};

["search","statusFilter","categoryFilter","typeFilter","sortFilter"].forEach(id=>$(id).addEventListener(id==="search"?"input":"change",renderPosts));

document.addEventListener("change",event=>{const row=event.target.closest("[data-select]");if(row){if(row.checked)selected.add(String(row.dataset.select));else selected.delete(String(row.dataset.select));syncSelectionUI();}});
document.addEventListener("click",event=>{
  const edit=event.target.closest("[data-edit]");const del=event.target.closest("[data-delete]");const view=event.target.closest("[data-view]");
  if(edit)editPost(edit.dataset.edit);
  if(del)deletePost(del.dataset.delete);
  if(view)window.open(`/blog/${encodeURIComponent(view.dataset.view)}/`,"_blank","noopener");
});

document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"&&$("editorView")&&!$("editorView").hidden){event.preventDefault();$("postForm").requestSubmit();}if(event.key==="Escape"&&!$("editorView").hidden){resetForm();showView("posts");}});

(async()=>{try{await loadBase();await loadPosts();}catch(error){notice(error.message,true);$("loading").textContent=error.message;}})();
