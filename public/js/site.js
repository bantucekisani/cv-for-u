document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const pageTitles = {
    "create-cv.html": "CV for U - Create CV",
    "dashboard.html": "Dashboard - CV for U",
    "help.html": "Help and Support - CV for U",
    "improve-cv.html": "CV for U - Improve My CV",
    "index.html": "CV for U - Online CV Maker and Job Finder",
    "pricing.html": "Pricing - CV for U",
    "privacy.html": "Privacy Policy - CV for U",
    "terms.html": "Terms of Service - CV for U"
  };

  if (pageTitles[currentPage]) {
    document.title = pageTitles[currentPage];
  }

  document.querySelectorAll(".app-name").forEach((node) => {
    if (!node.textContent.trim()) {
      node.textContent = "CV for U";
    }
  });

  document.querySelectorAll(".landing-footer p").forEach((node) => {
    node.textContent = "Copyright 2026 CV for U - Made in South Africa";
  });

  document.querySelectorAll(".topbar-right a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href !== "#" && href === currentPage) {
      link.classList.add("is-current");
    }
  });

  const menuBtn = document.getElementById("menuBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!menuBtn || !mobileMenu) {
    return;
  }

  const syncMenuState = (isOpen) => {
    mobileMenu.classList.toggle("show", isOpen);
    menuBtn.textContent = isOpen ? "Close" : "Menu";
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  };

  syncMenuState(mobileMenu.classList.contains("show"));

  menuBtn.addEventListener("click", () => {
    syncMenuState(!mobileMenu.classList.contains("show"));
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => syncMenuState(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      syncMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && mobileMenu.classList.contains("show")) {
      syncMenuState(false);
    }
  });
});
