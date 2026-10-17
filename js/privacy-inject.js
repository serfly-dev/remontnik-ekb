(function () {
  const policyRoot = document.getElementById('privacyPolicyContent');
  if (!policyRoot) return;

  function appendLinkedText(parent, value) {
    let text = String(value || '');
    const clause = text.match(/^(\d+(?:\.\d+)+\.)(\s+)([\s\S]*)$/);
    if (clause) {
      const number = document.createElement('strong');
      number.textContent = clause[1];
      parent.appendChild(number);
      parent.appendChild(document.createTextNode(clause[2]));
      text = clause[3];
    }
    const linkPattern = /https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    let cursor = 0;
    let match;

    while ((match = linkPattern.exec(text))) {
      let linkText = match[0];
      let trailing = '';
      while (/[.,!?;:)\]]$/.test(linkText)) {
        trailing = linkText.slice(-1) + trailing;
        linkText = linkText.slice(0, -1);
      }
      if (!linkText) continue;

      parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      const link = document.createElement('a');
      link.textContent = linkText;
      if (/^https?:\/\//i.test(linkText)) {
        let safeHref = '';
        try {
          const url = new URL(linkText, window.location.origin);
          if (['http:', 'https:'].includes(url.protocol)) safeHref = url.href;
        } catch (_) {
          // Keep malformed links as plain text instead of interrupting the policy render.
        }
        if (!safeHref) {
          parent.appendChild(document.createTextNode(linkText));
        } else {
          link.href = safeHref;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          parent.appendChild(link);
        }
      } else {
        link.href = 'mailto:' + linkText;
        parent.appendChild(link);
      }
      if (trailing) parent.appendChild(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }

    parent.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function renderBody(section, value) {
    String(value || '').trim().split(/\n\s*\n/).filter(Boolean).forEach((block) => {
      const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length && lines.every(line => /^-\s+/.test(line))) {
        const list = document.createElement('ul');
        list.className = 'policy-list';
        lines.forEach((line) => {
          const item = document.createElement('li');
          appendLinkedText(item, line.replace(/^-\s+/, ''));
          list.appendChild(item);
        });
        section.appendChild(list);
        return;
      }

      const paragraph = document.createElement('p');
      appendLinkedText(paragraph, lines.join(' '));
      section.appendChild(paragraph);
    });
  }

  function renderPolicy(content) {
    const title = String(content.title || '').trim();
    const sections = Array.isArray(content.sections) ? content.sections : [];
    if (!title || !sections.length) return;

    const fragment = document.createDocumentFragment();
    const heading = document.createElement('h1');
    heading.textContent = title;
    fragment.appendChild(heading);

    sections.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const sectionTitle = String(item.title || '').trim();
      if (!sectionTitle) return;

      const section = document.createElement('section');
      const headingId = 'privacy-section-' + (index + 1);
      section.className = 'policy-section';
      section.setAttribute('aria-labelledby', headingId);

      const subheading = document.createElement('h2');
      subheading.id = headingId;
      subheading.textContent = sectionTitle;
      section.appendChild(subheading);
      renderBody(section, item.body);
      fragment.appendChild(section);
    });

    policyRoot.replaceChildren(fragment);
    document.title = title + ' — Никита Начаткин — ремонт квартир';
  }

  fetch('/api/sections?key=privacy', { headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null)
    .then((result) => {
      if (!result || !result.success || !Array.isArray(result.data)) return;
      const policy = result.data.find(section => section.key === 'privacy');
      if (policy && policy.content) renderPolicy(policy.content);
    })
    .catch((error) => console.warn('Не удалось загрузить политику из CMS:', error));
})();
