(() => {
  const root = document.querySelector('[data-category]');
  if (!root) return;

  const category = root.dataset.category;
  const grid = document.querySelector('#tools-grid');
  const count = document.querySelector('#tool-count');
  const search = document.querySelector('#tool-search');
  const empty = document.querySelector('#empty-state');
  let tools = [];

  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const render = () => {
    const query = normalize(search?.value);
    const visible = tools.filter((tool) => {
      if (!query) return true;
      return [tool.name, tool.description, tool.slug, tool.id]
        .some((value) => normalize(value).includes(query));
    });

    count.textContent = query
      ? `${visible.length} of ${tools.length} tools`
      : `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'} available`;

    grid.innerHTML = visible.map((tool) => `
      <a class="tool" href="${escapeHTML(tool.toolPath)}">
        <div class="icon">${escapeHTML(tool.icon || '◈')}</div>
        <div class="tool-copy">
          <h2>${escapeHTML(tool.name)}</h2>
          <p>${escapeHTML(tool.description || '')}</p>
        </div>
        <span class="open">Open →</span>
      </a>
    `).join('');

    if (!visible.length) {
      empty.hidden = false;
      empty.innerHTML = query
        ? `No tools match <strong>“${escapeHTML(search.value.trim())}”</strong>. Try another search.`
        : 'No published tools in this category yet.';
    } else {
      empty.hidden = true;
    }
  };

  search?.addEventListener('input', render);
  document.querySelector('[data-clear-search]')?.addEventListener('click', () => {
    search.value = '';
    search.focus();
    render();
  });

  fetch('/data/tools.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('registry');
      return response.json();
    })
    .then((data) => {
      const all = Array.isArray(data) ? data : (data.tools || []);
      tools = all.filter((tool) =>
        tool.category === category && tool.status === 'published' && tool.toolPath
      );
      render();
    })
    .catch(() => {
      count.textContent = '';
      grid.innerHTML = '';
      empty.hidden = false;
      empty.textContent = 'We could not load the tools right now. Please try again.';
    });
})();
