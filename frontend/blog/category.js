const API="/api/blog";
const root=document.querySelector("[data-category]");
const postsEl=document.querySelector("#categoryPosts");
const emptyEl=document.querySelector("#empty");
const countEl=document.querySelector("#count");
const searchEl=document.querySelector("#search");
const slug=root?.dataset.category||"";
let posts=[];

function esc(value){
  return String(value??"").replace(/[&<>\"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    "\"":"&quot;","'":"&#39;"
  }[c]));
}

function render(){
  const q=searchEl.value.trim().toLowerCase();
  const list=posts.filter(p=>{
    const text=`${p.title||""} ${p.excerpt||""}`.toLowerCase();
    return !q||text.includes(q);
  });

  countEl.textContent=`${list.length} ${list.length===1?"article":"articles"}`;
  postsEl.innerHTML=list.map(p=>`<article class="post-card">
    <a href="/blog/${encodeURIComponent(p.slug)}/">
      <div class="cover">
        ${p.cover_image?`<img src="${esc(p.cover_image)}" alt="${esc(p.cover_image_alt||p.title)}" loading="lazy">`:"<span>N</span>"}
      </div>
      <div class="post-body">
        <div class="meta">${esc(p.type||"article")} ${p.reading_time?` · ${p.reading_time} min read`:""}</div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.excerpt||"")}</p>
        <span class="read">Read article <b>→</b></span>
      </div>
    </a>
  </article>`).join("");

  emptyEl.hidden=list.length>0;
}

async function load(){
  try{
    const res=await fetch(`${API}/posts?category=${encodeURIComponent(slug)}&limit=50`,{
      headers:{Accept:"application/json"},cache:"no-store"
    });
    if(!res.ok)throw new Error("Category unavailable");
    const data=await res.json();
    posts=Array.isArray(data.posts)?data.posts:[];
  }catch(error){
    console.error("Nexauren category:",error);
    posts=[];
  }
  render();
}

searchEl?.addEventListener("input",render);
load();
