const ALLOWED_TEMPLATES = new Set([
  "templateA",
  "templateB",
  "templateC",
  "templateD",
  "templateE",
  "templateF",
  "templateG",
  "templateH"
]);

const ALLOWED_COLORS = new Set([
  "blue",
  "grey",
  "black",
  "teal",
  "gold"
]);

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatText(value) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function sanitiseTemplate(value) {
  return ALLOWED_TEMPLATES.has(value) ? value : "templateA";
}

function sanitiseColor(value) {
  return ALLOWED_COLORS.has(value) ? value : "blue";
}

function joinMeta(parts = []) {
  return parts
    .filter(Boolean)
    .map(part => esc(part))
    .join(" <span class=\"cv-meta-separator\">&middot;</span> ");
}

function renderPhoto(photo) {
  if (!photo) {
    return "";
  }

  return `
    <div class="cv-photo-wrapper">
      <img src="${esc(photo)}" alt="Profile photo">
    </div>
  `;
}

function renderContactSection(cv) {
  const items = [cv.email, cv.phone, cv.location].filter(Boolean);

  if (!items.length) {
    return "";
  }

  return `
    <div class="cv-sidebar-section">
      <h3>Contact</h3>
      ${items.map(item => `<p>${esc(item)}</p>`).join("")}
    </div>
  `;
}

function renderSkillsSection(skills = []) {
  const cleanedSkills = Array.isArray(skills)
    ? skills.map(skill => String(skill || "").trim()).filter(Boolean)
    : [];

  if (!cleanedSkills.length) {
    return "";
  }

  return `
    <div class="cv-sidebar-section">
      <h3>Core Skills</h3>
      <ul class="cv-sidebar-list">
        ${cleanedSkills.map(skill => `<li>${esc(skill)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSummarySection(summary) {
  const text = String(summary || "").trim();

  if (!text) {
    return "";
  }

  return `
    <section class="cv-block cv-section">
      <h2>Profile</h2>
      <p>${formatText(text)}</p>
    </section>
  `;
}

function renderExperienceSection(experience = []) {
  const items = Array.isArray(experience)
    ? experience.filter(item => item && (item.title || item.company || item.dates || (item.bullets || []).length))
    : [];

  if (!items.length) {
    return "";
  }

  return `
    <section class="cv-block cv-section">
      <h2>Experience</h2>
      ${items.map(item => {
        const title = item.title || item.company || "Experience";
        const meta = joinMeta([
          item.title ? item.company : "",
          item.location,
          item.dates
        ]);
        const bullets = Array.isArray(item.bullets)
          ? item.bullets.map(bullet => String(bullet || "").trim()).filter(Boolean)
          : [];

        return `
          <article class="cv-item cv-experience-item">
            <h3>${esc(title)}</h3>
            ${meta ? `<p class="cv-meta">${meta}</p>` : ""}
            ${bullets.length ? `
              <ul>
                ${bullets.map(bullet => `<li>${esc(bullet)}</li>`).join("")}
              </ul>
            ` : ""}
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function renderEducationSection(education = []) {
  const items = Array.isArray(education)
    ? education.filter(item => item && (item.qualification || item.institution || item.location || item.year))
    : [];

  if (!items.length) {
    return "";
  }

  return `
    <section class="cv-block cv-section">
      <h2>Education</h2>
      ${items.map(item => {
        const title = item.qualification || item.institution || "Education";
        const meta = joinMeta([
          item.qualification ? item.institution : "",
          item.location,
          item.year
        ]);

        return `
          <article class="cv-item cv-education-item">
            <h3>${esc(title)}</h3>
            ${meta ? `<p class="cv-meta">${meta}</p>` : ""}
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function renderReferencesSection(references = [], referencesOnRequest = false) {
  const items = Array.isArray(references)
    ? references.filter(item => item && (item.name || item.role || item.phone))
    : [];

  if (!items.length && !referencesOnRequest) {
    return "";
  }

  return `
    <section class="cv-block cv-section">
      <h2>References</h2>
      ${referencesOnRequest ? `
        <p class="cv-empty">References available on request</p>
      ` : items.map(item => {
        const meta = joinMeta([item.role, item.phone]);

        return `
          <article class="cv-item cv-reference">
            <h3>${esc(item.name || "Reference")}</h3>
            ${meta ? `<p class="cv-meta">${meta}</p>` : ""}
          </article>
        `;
      }).join("")}
    </section>
  `;
}

module.exports = function renderCvHTML(cv) {
  const template = sanitiseTemplate(cv.template);
  const color = sanitiseColor(cv.color);

  return `
<div class="cv-preview ${template} color-${color}">
  <aside class="cv-sidebar">
    ${renderPhoto(cv.photo)}
    ${renderContactSection(cv)}
    ${renderSkillsSection(cv.skills)}
  </aside>

  <section class="cv-main">
    <header class="cv-header">
      <h1>${esc(cv.name || "")}</h1>
      ${cv.title ? `<p class="cv-title">${esc(cv.title)}</p>` : ""}
    </header>

    ${renderSummarySection(cv.summary)}
    ${renderExperienceSection(cv.experience)}
    ${renderEducationSection(cv.education)}
    ${renderReferencesSection(cv.references, cv.referencesOnRequest === true)}
  </section>
</div>
`;
};
