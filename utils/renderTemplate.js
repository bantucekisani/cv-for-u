module.exports = function renderCvHTML(cv) {
  // ===============================
  // DEBUG (keep for now)
  // ===============================
  console.log("📌 CV TEMPLATE:", cv.template);
  console.log("📌 CV COLOR:", cv.color);
  console.log("📌 REFERENCES RAW DATA:", cv.references);

  // ===============================
  // SAFETY HELPERS
  // ===============================
  const esc = str =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const safeSummary =
    cv.summary && !/(\d+\s+years?)/i.test(cv.summary)
      ? esc(cv.summary)
      : cv.summary
        ? "Qualified professional with experience in the listed skills and roles."
        : "";

  const skills =
    Array.isArray(cv.skills)
      ? cv.skills
          .map(s => s && s.trim())
          .filter(Boolean)
      : [];

  const hasReferences =
    Array.isArray(cv.references) && cv.references.length;

  const showReferencesSection =
    hasReferences || cv.referencesOnRequest === true;

  // ===============================
  // TEMPLATE
  // ===============================
  return `
<div class="cv-preview ${cv.template || "templateA"} color-${cv.color || "blue"}">

  <!-- ================= SIDEBAR ================= -->
  <aside class="cv-sidebar">

    ${cv.photo ? `
      <div class="cv-photo-wrapper">
        <img src="${esc(cv.photo)}" alt="Profile photo" />
      </div>
    ` : ""}

    ${(cv.email || cv.phone || cv.location) ? `
      <div class="cv-sidebar-section">
        <h3>Contact</h3>
        ${cv.email ? `<p>${esc(cv.email)}</p>` : ""}
        ${cv.phone ? `<p>${esc(cv.phone)}</p>` : ""}
        ${cv.location ? `<p>${esc(cv.location)}</p>` : ""}
      </div>
    ` : ""}

    ${skills.length ? `
      <div class="cv-sidebar-section">
        <h3>Skills</h3>
        <ul>
          ${skills.map(skill => `<li>${esc(skill)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}

  </aside>

  <!-- ================= MAIN ================= -->
  <section class="cv-main">

    <header class="cv-header">
      <h1>${esc(cv.name)}</h1>
      ${cv.title ? `<div class="cv-title">${esc(cv.title)}</div>` : ""}
    </header>

    ${safeSummary ? `
      <section class="cv-block cv-section">
        <h2>Profile</h2>
        <p>${safeSummary}</p>
      </section>
    ` : ""}

    ${Array.isArray(cv.experience) && cv.experience.length ? `
      <section class="cv-block cv-section">
        <h2>Experience</h2>
        ${cv.experience.map(exp => `
          <article class="cv-item">
            <h3>
              ${esc(exp.title)}
              ${exp.company ? ` – ${esc(exp.company)}` : ""}
            </h3>
            ${Array.isArray(exp.bullets) && exp.bullets.length ? `
              <ul>
                ${exp.bullets
                  .map(b => `<li>${esc(b)}</li>`)
                  .join("")}
              </ul>
            ` : ""}
          </article>
        `).join("")}
      </section>
    ` : ""}

    ${Array.isArray(cv.education) && cv.education.length ? `
      <section class="cv-block cv-section">
        <h2>Education</h2>
        ${cv.education.map(edu => `
          <article class="cv-item">
            <h3>
              ${esc(edu.qualification)}
              ${edu.institution ? ` – ${esc(edu.institution)}` : ""}
            </h3>
            ${(edu.location || edu.year) ? `
              <p class="cv-meta">
                ${edu.location ? esc(edu.location) : ""}
                ${edu.location && edu.year ? " • " : ""}
                ${edu.year ? esc(edu.year) : ""}
              </p>
            ` : ""}
          </article>
        `).join("")}
      </section>
    ` : ""}

    <!-- ================= REFERENCES ================= -->
    ${showReferencesSection ? `
      <section class="cv-block cv-section">
        <h2>References</h2>

        ${
          hasReferences
            ? cv.references.map(ref => {
                const role =
                  ref.role ||
                  ref.position ||
                  ref.title ||
                  ref.relationship ||
                  "";

                console.log("🔹 Reference:", {
                  name: ref.name,
                  role,
                  phone: ref.phone
                });

                return `
                  <article class="cv-item cv-reference">
                    <strong>${esc(ref.name)}</strong>
                    ${role ? `<div class="cv-meta">${esc(role)}</div>` : ""}
                    ${ref.phone ? `<div>${esc(ref.phone)}</div>` : ""}
                  </article>
                `;
              }).join("")
            : `<p class="cv-empty">Available on request</p>`
        }

      </section>
    ` : ""}

  </section>
</div>
`;
};
