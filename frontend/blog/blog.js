const API="/api/blog";
const postsEl=document.querySelector("#posts");
const emptyEl=document.querySelector("#empty");
const searchEl=document.querySelector("#search");
const categoryEl=document.querySelector("#category");
let posts=[];
const CATEGORIES=[
  {name:"Technology",slug:"technology"},
  {name:"News",slug:"news"},
  {name:"Culture",slug:"culture"},
  {name:"Business",slug:"business"},
  {name:"Guides",slug:"guides"}
];
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function render(){
  const q=searchEl.value.trim().toLowerCase();
  const cat=categoryEl.value;
  const list=posts.filter(p=>{
    const text=`${p.title||""} ${p.excerpt||""} ${p.category_name||""}`.toLowerCase();
    return (!q||text.includes(q))&&(!cat||p.category_slug===cat);
  });
  postsEl.innerHTML=list.map(p=>`<article class="card">
    <a href="/blog/${encodeURIComponent(p.slug)}/" aria-label="${esc(p.title)}">
      <div class="cover">${p.cover_image?`<img src="${esc(p.cover_image)}" alt="${esc(p.cover_image_alt||p.title)}" loading="lazy">`:""}</div>
      <div class="body"><div class="meta"><span class="tag">${esc(p.category_name||"Nexauren")}</span><span>·</span><span>${esc(p.type||"article")}</span>${p.reading_time?`<span>· ${p.reading_time} min</span>`:""}</div>
      <h2>${esc(p.title)}</h2><p class="excerpt">${esc(p.excerpt||"")}</p><span class="read">Read article →</span></div>
    </a></article>`).join("");
  emptyEl.hidden=list.length!==0;
}
async function load(){
  categoryEl.innerHTML='<option value="">All categories</option>'+CATEGORIES.map(c=>`<option value="${c.slug}">${c.name}</option>`).join("");
  try{
    const res=await fetch(`${API}/posts?limit=50`);
    if(!res.ok)throw new Error("Blog unavailable");
    const data=await res.json();
    posts=Array.isArray(data.posts)?data.posts:[];
  }catch(error){
    posts=[];
  }
  render();
}
searchEl.addEventListener("input",render);
categoryEl.addEventListener("change",render);
load();
