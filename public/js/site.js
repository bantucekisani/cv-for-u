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

  document.querySelectorAll(".topbar-right a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href !== "#" && href === currentPage) {
      link.classList.add("is-current");
    }
  });

  const menuBtn = document.getElementById("menuBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const topbar = menuBtn?.closest(".topbar");
  const isMobileViewport = () => window.innerWidth <= 768;

  if (!menuBtn || !mobileMenu) {
    return;
  }

  let mobileOverlay = null;

  const ensureMobileOverlay = () => {
    if (mobileOverlay) {
      return mobileOverlay;
    }

    mobileOverlay = document.createElement("div");
    mobileOverlay.className = "mobile-nav-overlay";
    mobileOverlay.setAttribute("aria-hidden", "true");
    mobileOverlay.innerHTML = `<div class="mobile-nav-sheet">${mobileMenu.innerHTML}</div>`;
    document.body.appendChild(mobileOverlay);

    mobileOverlay.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => syncMenuState(false));
    });

    mobileOverlay.addEventListener("click", (event) => {
      if (event.target === mobileOverlay) {
        syncMenuState(false);
      }
    });

    return mobileOverlay;
  };

  const positionMobileOverlay = () => {
    if (!mobileOverlay || !isMobileViewport()) {
      return;
    }

    const topbarBottom = topbar
      ? Math.round(topbar.getBoundingClientRect().bottom + 10)
      : 96;

    mobileOverlay.style.top = `${topbarBottom}px`;
  };

  const syncMenuState = (isOpen) => {
    const shouldOpen = isOpen && isMobileViewport();
    const overlay = ensureMobileOverlay();

    mobileMenu.classList.toggle("show", shouldOpen);
    document.body.classList.toggle("menu-open", shouldOpen);
    menuBtn.textContent = shouldOpen ? "Close" : "Menu";
    menuBtn.setAttribute("aria-expanded", String(shouldOpen));
    mobileMenu.setAttribute("aria-hidden", String(!shouldOpen));
    overlay.classList.toggle("show", shouldOpen);
    overlay.setAttribute("aria-hidden", String(!shouldOpen));

    if (shouldOpen) {
      positionMobileOverlay();
    }
  };

  syncMenuState(mobileMenu.classList.contains("show"));

  menuBtn.addEventListener("click", () => {
    syncMenuState(!mobileMenu.classList.contains("show"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      syncMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    positionMobileOverlay();

    if (window.innerWidth > 768 && mobileMenu.classList.contains("show")) {
      syncMenuState(false);
    }
  });
});
