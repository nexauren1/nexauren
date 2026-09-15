const $=id=>document.getElementById(id);
let posts=[];
let categories=[];
let authors=[];
let editingId=null;

const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const dateText=value=>value?new Date(String(value).match(/^\d+$/)?Number(value):value).toLocaleString():"—";

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
  const [cats,auts]=await Promise.all([
    api("/api/blog/admin/categories"),
    api("/api/blog/admin/authors")
  ]);
  categories=cats.categories||[];
  authors=auts.authors||[];
  $("category").innerHTML='<option value="">No category</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("author").innerHTML='<option value="">No author</option>'+authors.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");
}

async function loadPosts(){
  $("loading").hidden=false;
  $("postsTable").hidden=true;
  try{
    const data=await api("/api/blog/admin/posts");
    posts=data.posts||[];
    renderPosts();
  }catch(error){
    $("loading").textContent=error.message;
    $("loading").hidden=false;
  }
}

function renderPosts(){
  const query=$("search").value.trim().toLowerCase();
  const filter=$("statusFilter").value;
  const rows=posts.filter(p=>{
    const hay=`${p.title||""} ${p.slug||""} ${p.category_name||""} ${p.type||""}`.toLowerCase();
    return (!query||hay.includes(query))&&(!filter||p.status===filter);
  });
  $("totalPosts").textContent=posts.length;
  $("publishedPosts").textContent=posts.filter(p=>p.status==="published").length;
  $("draftPosts").textContent=posts.filter(p=>p.status==="draft").length;
  $("scheduledPosts").textContent=posts.filter(p=>p.status==="scheduled").length;
  $("navPosts").textContent=posts.length;
  $("loading").hidden=true;
  $("postsTable").hidden=false;
  $("postsBody").innerHTML=rows.length?rows.map(p=>`<tr>
    <td><div class="post-title">${esc(p.title)}</div><div class="post-meta">/${esc(p.slug)} · ${Number(p.reading_time||0)} min read</div></td>
    <td>${esc(p.category_name||"—")}</td>
    <td>${esc(String(p.type||"article").replaceAll("_"," "))}</td>
    <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
    <td>${esc(dateText(p.updated_at))}</td>
    <td><div class="row-actions"><button data-edit="${p.id}">Edit</button><button data-delete="${p.id}">Delete</button></div></td>
  </tr>`).join(""): '<tr><td colspan="6" class="empty">No posts found.</td></tr>';
}

function showView(view){
  const editor=view==="new"||view==="edit";
  $("postsView").hidden=editor;
  $("editorView").hidden=!editor;
  $("pageTitle").textContent=editor?(view==="edit"?"Edit post":"New post"):"Posts";
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  window.scrollTo({top:0,behavior:"smooth"});
}

function resetForm(){
  editingId=null;
  $("postForm").reset();
  $("status").value="draft";
  $("type").value="article";
  $("imagePreview").textContent="No image";
}

function fillForm(post){
  editingId=post.id;
  $("title").value=post.title||"";
  $("slug").value=post.slug||"";
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
  $("coverImage").value=post.cover_image||"";
  $("coverAlt").value=post.cover_image_alt||"";
  if(post.published_at){
    const d=new Date(post.published_at);
    if(!Number.isNaN(d.getTime()))$("publishedAt").value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  updatePreview();
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
    title:$("title").value.trim(),
    slug:$("slug").value.trim(),
    excerpt:$("excerpt").value.trim(),
    content:$("content").value,
    cover_image:$("coverImage").value.trim(),
    cover_image_alt:$("coverAlt").value.trim(),
    category_id:$("category").value||null,
    author_id:$("author").value||null,
    status:$("status").value,
    type:$("type").value,
    seo_title:$("seoTitle").value.trim(),
    seo_description:$("seoDescription").value.trim(),
    seo_keywords:$("seoKeywords").value.trim(),
    canonical_url:$("canonicalUrl").value.trim(),
    published_at:publishedAt?new Date(publishedAt).toISOString():null
  };
}

$("postForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("save");
  button.disabled=true;
  button.textContent="Saving…";
  try{
    const body=payload();
    if(!body.title||!body.content)throw new Error("Title and content are required.");
    const data=await api(editingId?`/api/blog/admin/posts/${editingId}`:"/api/blog/admin/posts",{
      method:editingId?"PUT":"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(body)
    });
    notice(editingId?"Post updated successfully.":"Post created successfully.");
    await loadPosts();
    resetForm();
    showView("posts");
    if(data.slug)notice(`Saved: /blog/${data.slug}/`);
  }catch(error){notice(error.message,true);}
  finally{button.disabled=false;button.textContent="Save post";}
});

$("title").addEventListener("input",()=>{
  if(editingId||$("slug").dataset.touched)return;
  $("slug").value=$("title").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180);
});
$("slug").addEventListener("input",()=>$("slug").dataset.touched="1");
$("coverImage").addEventListener("input",updatePreview);
function updatePreview(){
  const url=$("coverImage").value.trim();
  const box=$("imagePreview");
  if(!url){box.textContent="No image";return;}
  box.innerHTML="";
  const img=new Image();
  img.alt="Cover preview";
  img.onload=()=>{box.innerHTML="";box.appendChild(img);};
  img.onerror=()=>{box.textContent="Image could not be previewed";};
  img.src=url;
}

document.addEventListener("click",event=>{
  const edit=event.target.closest("[data-edit]");
  const del=event.target.closest("[data-delete]");
  if(edit)editPost(edit.dataset.edit);
  if(del)deletePost(del.dataset.delete);
});

$("newPost").onclick=()=>{resetForm();showView("new");};
$("cancel").onclick=()=>{resetForm();showView("posts");};
document.querySelectorAll(".nav-item").forEach(button=>button.onclick=()=>{
  if(button.dataset.view==="new"){resetForm();showView("new");}
  else{showView("posts");loadPosts();}
});
$("search").oninput=renderPosts;
$("statusFilter").onchange=renderPosts;

(async()=>{
  try{
    await loadBase();
    await loadPosts();
  }catch(error){
    notice(error.message,true);
    $("loading").textContent=error.message;
  }
})();
