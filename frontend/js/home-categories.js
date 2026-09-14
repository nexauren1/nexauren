(() => {
  const categories = [
    ['audio','🎵','Audio','Tools for converting and working with audio.'],
    ['image','🖼️','Image','Resize, compress and enhance images.'],
    ['pdf','📄','PDF','Create, convert, organize and work with PDFs.'],
    ['text','✍️','Text','Format, validate and transform text and data.'],
    ['productivity','⚡','Productivity','Practical tools for everyday work.'],
    ['business','💼','Business','Tools for business workflows and tasks.'],
    ['marketplace','🛍️','Marketplace','Create better product listings and assets.'],
    ['utilities','🧰','Utilities','Useful tools for everyday digital tasks.'],
    ['developer','</>','Developer','Tools for coding, data and development.'],
    ['calculators','🔢','Calculators','Fast calculators for common needs.'],
    ['qr-generators','▦','QR & Generators','Generate useful codes and assets.'],
    ['seo','⌕','SEO','Tools for search visibility and optimization.'],
    ['media','▶','Media','Tools for common media workflows.'],
    ['converters','⇄','Converters','Convert values and file formats.'],
    ['security','✓','Security','Privacy and security utilities.'],
    ['files','▣','Files','Work with files directly in your browser.'],
    ['color','◉','Color','Pick, inspect and convert colors.'],
    ['date-time','◷','Date & Time','Dates, time zones and time utilities.'],
    ['finance','$','Finance','Practical finance calculators and utilities.'],
    ['education','🎓','Education','Study and learning utilities.'],
    ['ai','✦','AI','AI-powered tools from Nexauren.']
  ];

  const root = document.querySelector('[data-nexauren-home-categories]');
  if (!root) return;

  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const card = (cat, tools) => {
    const [slug, icon, name, description] = cat;
    const available = tools.length > 0;
    const href = `/category/${slug}/`;
    const toolItems = tools.slice(0, 4).map(tool => `
      <a class="home-tool" href="${tool.toolPath || href}">
        <span>${tool.icon || '•'}</span>
        <strong>${tool.name}</strong>
      </a>
    `).join('');

    return `
      <article class="home-category ${available ? 'is-active' : 'is-coming'}">
        <a class="home-category-main" ${available ? `href="${href}"` : 'aria-disabled="true"'}>
          <div class="home-category-icon">${icon}</div>
          <div>
            <h3>${name}</h3>
            <p>${description}</p>
          </div>
          <span class="home-category-count">${available ? `${tools.length} tool${tools.length === 1 ? '' : 's'}` : 'Coming soon'}</span>
        </a>
        ${available ? `<div class="home-category-tools">${toolItems}</div><a class="home-category-all" href="${href}">View all ${name} tools →</a>` : ''}
      </article>
    `;
  };

  fetch('/data/tools.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('tools.json unavailable');
      return response.json();
    })
    .then(data => {
      const tools = Array.isArray(data) ? data : data.tools;
      const published = Array.isArray(tools)
        ? tools.filter(tool => tool && tool.status === 'published')
        : [];

      root.innerHTML = categories.map(category => {
        const matches = published.filter(tool => normalize(tool.category) === normalize(category[0]));
        return card(category, matches);
      }).join('');

      const total = published.length;
      const count = document.querySelector('[data-home-tool-count]');
      if (count) count.textContent = `${total} tools available`;
    })
    .catch(() => {
      root.innerHTML = categories.map(category => card(category, [])).join('');
    });
})();
