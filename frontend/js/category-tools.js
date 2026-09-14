(() => {
  const root = document.querySelector('[data-category]');
  const grid = document.querySelector('#tool-grid');
  const search = document.querySelector('#tool-search');
  const empty = document.querySelector('#empty-state');
  const status = document.querySelector('#load-status');

  if (!root || !grid) return;

  const category = root.dataset.category;
  const config = {
    ai: {name:'AI',eyebrow:'NEXAUREN · AI',icon:'✦',description:'Practical AI tools for creating, transforming and working faster.'},
    audio: {name:'Audio',eyebrow:'NEXAUREN · AUDIO',icon:'♫',description:'Tools for working with sound, music and audio files.'},
    image: {name:'Image',eyebrow:'NEXAUREN · IMAGE',icon:'◈',description:'Create, transform and optimize images directly in your browser.'},
    pdf: {name:'PDF',eyebrow:'NEXAUREN · PDF',icon:'▤',description:'A growing workspace for creating, editing, converting and organizing PDFs.'},
    marketplace: {name:'Marketplace',eyebrow:'NEXAUREN · MARKETPLACE',icon:'◇',description:'Tools for product listings, selling assets and marketplace workflows.'},
    productivity: {name:'Productivity',eyebrow:'NEXAUREN · PRODUCTIVITY',icon:'↗',description:'Simple tools designed to help you organize work and move faster.'},
    text: {name:'Text',eyebrow:'NEXAUREN · TEXT',icon:'T',description:'Tools for formatting, transforming and working with text and data.'},
    utilities: {name:'Utilities',eyebrow:'NEXAUREN · UTILITIES',icon:'◷',description:'Useful everyday utilities for calculations, dates and practical tasks.'},
    business: {name:'Business',eyebrow:'NEXAUREN · BUSINESS',icon:'▦',description:'Practical tools for business workflows and everyday operations.'}
  };

  const info = config[category] || {
    name: category,
    eyebrow: `NEXAUREN · ${category}`,
    icon: '•',
    description: 'Practical tools for this category.'
  };

  document.title = `${info.name} Tools — Nexauren`;
  document.querySelector('[data-eyebrow]')?.replaceChildren(info.eyebrow);
  document.querySelector('[data-title]')?.replaceChildren(info.name);
  document.querySelector('[data-description]')?.replaceChildren(info.description);
  document.querySelector('[data-category-icon]')?.replaceChildren(info.icon);

  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

  let tools = [];

  function render(list) {
    grid.innerHTML = list.map(tool => `
      <a class="tool-card" href="${esc(tool.toolPath || '#')}">
        <div class="tool-icon">${esc(tool.icon || info.icon)}</div>
        <div class="tool-body">
          <div class="tool-meta">
            <span>${esc(info.name)}</span>
            ${tool.status === 'published' ? '<b>Available</b>' : ''}
          </div>
          <h2>${esc(tool.name)}</h2>
          <p>${esc(tool.description || 'Open this tool to get started.')}</p>
        </div>
        <span class="tool-arrow" aria-hidden="true">→</span>
      </a>
    `).join('');

    empty.hidden = list.length !== 0;
    if (status) {
      status.textContent = `${list.length} tool${list.length === 1 ? '' : 's'} available`;
    }
  }

  function filter() {
    const query = (search?.value || '').trim().toLowerCase();
    if (!query) return render(tools);
    render(tools.filter(tool =>
      `${tool.name} ${tool.description} ${tool.slug}`
        .toLowerCase().includes(query)
    ));
  }

  async function load() {
    try {
      if (status) status.textContent = 'Loading tools…';
      const response = await fetch('/data/tools.json', {cache:'no-store'});
      if (!response.ok) throw new Error('registry');
      const data = await response.json();
      tools = Array.isArray(data.tools)
        ? data.tools.filter(tool =>
            tool.category === category && tool.status !== 'archived'
          )
        : [];
      render(tools);
    } catch (error) {
      tools = [];
      if (status) status.textContent = 'Could not load the tool registry.';
      render([]);
    }
  }

  search?.addEventListener('input', filter);
  load();
})();