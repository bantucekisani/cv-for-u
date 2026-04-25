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

  if (!menuBtn || !mobileMenu) {
    return;
  }

  const applyMobileMenuLayout = (isOpen) => {
    if (window.innerWidth > 768) {
      mobileMenu.removeAttribute("style");
      mobileMenu.querySelectorAll("a").forEach((link) => link.removeAttribute("style"));
      return;
    }

    if (!isOpen) {
      mobileMenu.style.display = "none";
      return;
    }

    const topbarBottom = topbar
      ? Math.round(topbar.getBoundingClientRect().bottom + 12)
      : 96;

    Object.assign(mobileMenu.style, {
      display: "flex",
      position: "fixed",
      top: `${topbarBottom}px`,
      left: "12px",
      right: "12px",
      width: "auto",
      margin: "0",
      padding: "14px",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "10px",
      background: "rgba(255, 255, 255, 0.98)",
      border: "1px solid rgba(219, 234, 254, 0.95)",
      borderRadius: "24px",
      boxShadow: "0 24px 48px rgba(15, 23, 42, 0.16), 0 0 0 100vmax rgba(15, 23, 42, 0.26)",
      maxHeight: `calc(100vh - ${topbarBottom + 20}px)`,
      overflowY: "auto",
      overflowX: "hidden",
      visibility: "visible",
      opacity: "1",
      zIndex: "1201"
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      Object.assign(link.style, {
        display: "flex",
        width: "100%",
        minHeight: "54px",
        padding: "0 18px",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        borderRadius: "18px"
      });
    });
  };

  const syncMenuState = (isOpen) => {
    mobileMenu.classList.toggle("show", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    menuBtn.textContent = isOpen ? "Close" : "Menu";
    menuBtn.setAttribute("aria-expanded", String(isOpen));
    mobileMenu.setAttribute("aria-hidden", String(!isOpen));
    applyMobileMenuLayout(isOpen);
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

  document.addEventListener("click", (event) => {
    if (!mobileMenu.classList.contains("show") || window.innerWidth > 768) {
      return;
    }

    if (topbar && !topbar.contains(event.target)) {
      syncMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && mobileMenu.classList.contains("show")) {
      syncMenuState(false);
    }
  });
});
