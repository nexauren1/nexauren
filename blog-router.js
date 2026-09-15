const BLOG_TYPES = [
  "article",
  "guide",
  "news",
  "breaking_news",
  "review",
  "comparison",
  "opinion",
  "announcement"
];

const BLOG_STATUSES = ["draft", "published", "scheduled"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function readingTime(content) {
  const text = String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.split(" ").length / 200));
}

async function currentUser(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(/nexauren_session=([^;]+)/);
  if (!match) return null;

  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role FROM sessions s " +
    "JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

async function requireAdmin(req, env) {
  const user = await currentUser(req, env);
  if (!user) return { response: json({ error: "Please sign in." }, 401) };
  if (String(user.role).toLowerCase() !== "admin") {
    return { response: json({ error: "Admin access required." }, 403) };
  }
  return { user };
}

const PUBLISHED_FILTER =
  "(p.published_at IS NULL OR " +
  "datetime(replace(replace(p.published_at,'T',' '),'Z',''))<=CURRENT_TIMESTAMP)";

async function publicPosts(req, env) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const category = url.searchParams.get("category");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 12)));

  if (slug) {
    const post = await env.BLOG_DB.prepare(
      "SELECT p.*, c.name AS category_name, c.slug AS category_slug, " +
      "a.name AS author_name, a.slug AS author_slug " +
      "FROM posts p " +
      "LEFT JOIN categories c ON c.id=p.category_id " +
      "LEFT JOIN authors a ON a.id=p.author_id " +
      "WHERE p.slug=? AND p.status='published' AND " +
      PUBLISHED_FILTER + " LIMIT 1"
    ).bind(slug).first();

    if (!post) return json({ error: "Post not found." }, 404);
    return json({ ok: true, post });
  }

  let query =
    "SELECT p.id,p.title,p.slug,p.excerpt,p.cover_image,p.cover_image_alt, " +
    "p.category_id,p.author_id,p.type,p.reading_time,p.views,p.published_at, " +
    "c.name AS category_name,c.slug AS category_slug,a.name AS author_name " +
    "FROM posts p " +
    "LEFT JOIN categories c ON c.id=p.category_id " +
    "LEFT JOIN authors a ON a.id=p.author_id " +
    "WHERE p.status='published' AND " +
    PUBLISHED_FILTER + " ";

  const bindings = [];
  if (category) {
    query += "AND c.slug=? ";
    bindings.push(category);
  }

  query += "ORDER BY COALESCE(p.published_at,p.created_at) DESC LIMIT ?";
  bindings.push(limit);

  const result = await env.BLOG_DB.prepare(query).bind(...bindings).all();
  return json({ ok: true, posts: result.results || [] });
}

async function publicPostImage(req, env, slug) {
  const post = await env.BLOG_DB.prepare(
    "SELECT cover_image FROM posts WHERE slug=? AND status='published' AND " +
    PUBLISHED_FILTER + " LIMIT 1"
  ).bind(slug).first();

  const source = String(post?.cover_image || "").trim();
  if (!source) return new Response("Image not found.", { status: 404 });

  let imageUrl;
  try {
    imageUrl = new URL(source);
  } catch (_) {
    return new Response("Invalid image URL.", { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return new Response("Unsupported image URL.", { status: 400 });
  }

  try {
    const response = await fetch(imageUrl.toString(), {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" }
    });

    if (!response.ok) {
      return new Response("Image unavailable.", { status: 404 });
    }

    const type = response.headers.get("Content-Type") || "";
    if (!type.toLowerCase().startsWith("image/")) {
      return new Response("Resource is not an image.", { status: 415 });
    }

    const headers = new Headers(response.headers);
    headers.set("Content-Type", type.split(";")[0]);
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(response.body, {
      status: 200,
      headers
    });
  } catch (_) {
    return new Response("Could not load image.", { status: 502 });
  }
}

async function adminCategories(req, env) {
  const result = await env.BLOG_DB.prepare(
    "SELECT * FROM categories ORDER BY name ASC"
  ).all();
  return json({ ok: true, categories: result.results || [] });
}

async function adminAuthors(req, env) {
  const result = await env.BLOG_DB.prepare(
    "SELECT * FROM authors ORDER BY name ASC"
  ).all();
  return json({ ok: true, authors: result.results || [] });
}

async function adminPosts(req, env) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const post = await env.BLOG_DB.prepare(
      "SELECT p.*,c.name AS category_name,a.name AS author_name " +
      "FROM posts p " +
      "LEFT JOIN categories c ON c.id=p.category_id " +
      "LEFT JOIN authors a ON a.id=p.author_id " +
      "WHERE p.id=? LIMIT 1"
    ).bind(id).first();

    if (!post) return json({ error: "Post not found." }, 404);
    return json({ ok: true, post });
  }

  const result = await env.BLOG_DB.prepare(
    "SELECT p.id,p.title,p.slug,p.excerpt,p.type,p.status,p.cover_image, " +
    "p.reading_time,p.views,p.published_at,p.created_at,p.updated_at, " +
    "c.name AS category_name,a.name AS author_name " +
    "FROM posts p " +
    "LEFT JOIN categories c ON c.id=p.category_id " +
    "LEFT JOIN authors a ON a.id=p.author_id " +
    "ORDER BY p.updated_at DESC"
  ).all();

  return json({ ok: true, posts: result.results || [] });
}

async function createPost(req, env) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON." }, 400);

  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) {
    return json({ error: "Title and content are required." }, 400);
  }

  const type = BLOG_TYPES.includes(body.type) ? body.type : "article";
  const status = BLOG_STATUSES.includes(body.status) ? body.status : "draft";
  const slug = slugify(body.slug || title);
  if (!slug) return json({ error: "A valid slug is required." }, 400);

  const exists = await env.BLOG_DB.prepare(
    "SELECT id FROM posts WHERE slug=? LIMIT 1"
  ).bind(slug).first();
  if (exists) return json({ error: "That slug is already in use." }, 409);

  const result = await env.BLOG_DB.prepare(
    "INSERT INTO posts(" +
    "title,slug,excerpt,content,cover_image,cover_image_alt," +
    "category_id,author_id,status,type,seo_title,seo_description," +
    "seo_keywords,canonical_url,reading_time,published_at,updated_at" +
    ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)"
  ).bind(
    title,
    slug,
    String(body.excerpt || "").trim() || null,
    content,
    String(body.cover_image || "").trim() || null,
    String(body.cover_image_alt || "").trim() || null,
    body.category_id ? Number(body.category_id) : null,
    body.author_id ? Number(body.author_id) : null,
    status,
    type,
    String(body.seo_title || "").trim() || null,
    String(body.seo_description || "").trim() || null,
    String(body.seo_keywords || "").trim() || null,
    String(body.canonical_url || "").trim() || null,
    readingTime(content),
    status === "published" ? (body.published_at || new Date().toISOString()) : null
  ).run();

  return json({ ok: true, id: result.meta?.last_row_id || null, slug }, 201);
}

async function updatePost(req, env, id) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON." }, 400);

  const current = await env.BLOG_DB.prepare(
    "SELECT * FROM posts WHERE id=? LIMIT 1"
  ).bind(id).first();
  if (!current) return json({ error: "Post not found." }, 404);

  const title = String(body.title ?? current.title).trim();
  const content = String(body.content ?? current.content).trim();
  const type = BLOG_TYPES.includes(body.type) ? body.type : current.type || "article";
  const status = BLOG_STATUSES.includes(body.status) ? body.status : current.status;
  const slug = slugify(body.slug || title);

  const duplicate = await env.BLOG_DB.prepare(
    "SELECT id FROM posts WHERE slug=? AND id<>? LIMIT 1"
  ).bind(slug, id).first();
  if (duplicate) return json({ error: "That slug is already in use." }, 409);

  const publishedAt = status === "published"
    ? (body.published_at || current.published_at || new Date().toISOString())
    : null;

  await env.BLOG_DB.prepare(
    "UPDATE posts SET title=?,slug=?,excerpt=?,content=?,cover_image=?," +
    "cover_image_alt=?,category_id=?,author_id=?,status=?,type=?," +
    "seo_title=?,seo_description=?,seo_keywords=?,canonical_url=?," +
    "reading_time=?,published_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(
    title,
    slug,
    String(body.excerpt ?? current.excerpt ?? "").trim() || null,
    content,
    String(body.cover_image ?? current.cover_image ?? "").trim() || null,
    String(body.cover_image_alt ?? current.cover_image_alt ?? "").trim() || null,
    body.category_id === undefined ? current.category_id : (body.category_id ? Number(body.category_id) : null),
    body.author_id === undefined ? current.author_id : (body.author_id ? Number(body.author_id) : null),
    status,
    type,
    String(body.seo_title ?? current.seo_title ?? "").trim() || null,
    String(body.seo_description ?? current.seo_description ?? "").trim() || null,
    String(body.seo_keywords ?? current.seo_keywords ?? "").trim() || null,
    String(body.canonical_url ?? current.canonical_url ?? "").trim() || null,
    readingTime(content),
    publishedAt,
    id
  ).run();

  return json({ ok: true, id: Number(id), slug });
}

async function deletePost(req, env, id) {
  const result = await env.BLOG_DB.prepare(
    "DELETE FROM posts WHERE id=?"
  ).bind(id).run();

  if (!result.meta?.changes) return json({ error: "Post not found." }, 404);
  return json({ ok: true });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    const method = req.method;

    if (!env.BLOG_DB) {
      return json({ error: "Blog database is not configured." }, 500);
    }

    const imageMatch = path.match(/^\/api\/blog\/image\/([^/]+)\/?$/);
    if (imageMatch && method === "GET") {
      return publicPostImage(req, env, decodeURIComponent(imageMatch[1]));
    }

    if (path === "/api/blog/posts" && method === "GET") {
      return publicPosts(req, env);
    }

    if (path === "/api/blog/admin/categories" && method === "GET") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return adminCategories(req, env);
    }

    if (path === "/api/blog/admin/authors" && method === "GET") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return adminAuthors(req, env);
    }

    if (path === "/api/blog/admin/posts" && method === "GET") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return adminPosts(req, env);
    }

    if (path === "/api/blog/admin/posts" && method === "POST") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return createPost(req, env);
    }

    const match = path.match(/^\/api\/blog\/admin\/posts\/(\d+)$/);
    if (match && method === "PUT") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return updatePost(req, env, match[1]);
    }

    if (match && method === "DELETE") {
      const auth = await requireAdmin(req, env);
      if (auth.response) return auth.response;
      return deletePost(req, env, match[1]);
    }

    return null;
  }
};
