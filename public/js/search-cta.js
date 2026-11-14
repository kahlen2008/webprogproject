// Minimalist Animated Rotating Placeholder Call-to-Action for Search Bar
// Smoothly cycles through popular recipe suggestions directly in the input placeholder.

function initRotatingSearchPlaceholder() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("query");

  if (!form || !input) return;

  const defaultPlaceholder = "Search for a recipe, ingredient or cuisine...";
  input.dataset.origPlaceholder = defaultPlaceholder;
  const suggestions = [
    'Search "Pasta"...',
    'Search "Chicken Curry"...',
    'Search "Stuffed Cabbage"...',
    'Search "English Breakfast"...',
    'Search "Teriyaki Salmon"...',
    'Search "Chocolate Soufflé"...',
    'Search "Fettucine Alfredo"...',
    'Search "Steak"...',
  ];

  // Respect user's motion preferences
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    input.placeholder = defaultPlaceholder;
    form.addEventListener("submit", handleFormSubmit);
    return;
  }

  let suggestionIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let isFocused = false;
  let timerId = null;

  function getCurrentKeyword() {
    const current = suggestions[suggestionIndex] || "";
    const match = current.match(/"([^"]+)"/);
    return match ? match[1] : "";
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const typedQuery = input.value.trim();

    if (typedQuery) {
      window.location.href = `recipes.html?search=${encodeURIComponent(typedQuery)}`;
      return;
    }

    // If submitted empty while a suggestion is displayed, search that suggestion
    const fallbackKeyword = getCurrentKeyword();
    if (fallbackKeyword) {
      window.location.href = `recipes.html?search=${encodeURIComponent(fallbackKeyword)}`;
    } else {
      window.location.href = "recipes.html";
    }
  }

  form.addEventListener("submit", handleFormSubmit);

  function tick() {
    const activeLang = localStorage.getItem("recipeplan_lang") || "en";
    if (isFocused || input.value.length > 0 || activeLang !== "en") return;

    const currentText = suggestions[suggestionIndex];

    if (!isDeleting) {
      // Typing forward
      charIndex++;
      input.placeholder = currentText.substring(0, charIndex);

      if (charIndex >= currentText.length) {
        // Finished typing full suggestion, pause before deleting
        isDeleting = true;
        timerId = setTimeout(tick, 2200);
        return;
      }
      timerId = setTimeout(tick, 65);
    } else {
      // Deleting back to empty
      charIndex--;
      input.placeholder = currentText.substring(0, charIndex) || " ";

      if (charIndex <= 0) {
        // Move to next suggestion
        isDeleting = false;
        suggestionIndex = (suggestionIndex + 1) % suggestions.length;
        timerId = setTimeout(tick, 400);
        return;
      }
      timerId = setTimeout(tick, 35);
    }
  }

  // Handle focus: pause animation immediately and show clean default placeholder
  input.addEventListener("focus", () => {
    isFocused = true;
    if (timerId) clearTimeout(timerId);
    input.placeholder = defaultPlaceholder;
  });

  // Handle blur: resume rotating if user didn't leave any text in the input
  input.addEventListener("blur", () => {
    isFocused = false;
    if (!input.value.trim()) {
      charIndex = 0;
      isDeleting = false;
      timerId = setTimeout(tick, 800);
    }
  });

  // Start after a gentle initial delay
  timerId = setTimeout(tick, 1000);
}

function initHeroFanCarousel() {
  const stage = document.getElementById("hero-fan-stage");
  if (!stage) return;

  const cards = Array.from(stage.querySelectorAll(".hero-fan-card"));
  const dots = Array.from(document.querySelectorAll(".hero-fan-dot"));
  if (cards.length !== 3) return;

  let activeIdx = 0;
  let intervalId = null;
  let isPaused = false;

  const applyPositions = (centerIdx) => {
    activeIdx = ((centerIdx % 3) + 3) % 3;
    const rightIdx = (activeIdx + 1) % 3;
    const leftIdx = (activeIdx + 2) % 3;

    cards[activeIdx].setAttribute("data-fan-pos", "center");
    cards[rightIdx].setAttribute("data-fan-pos", "right");
    cards[leftIdx].setAttribute("data-fan-pos", "left");

    dots.forEach((dot, idx) => {
      dot.setAttribute("aria-current", idx === activeIdx ? "true" : "false");
    });
  };

  const startAutoRotate = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      if (!isPaused) {
        applyPositions(activeIdx + 1);
      }
    }, 3000);
  };

  stage.addEventListener("mouseenter", () => {
    isPaused = true;
  });
  stage.addEventListener("mouseleave", () => {
    isPaused = false;
  });

  // Clicking a side card brings it to the front center instead of navigating immediately
  cards.forEach((card, idx) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".favourite-btn")) return;
      if (card.getAttribute("data-fan-pos") !== "center") {
        e.preventDefault();
        applyPositions(idx);
        startAutoRotate();
      }
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.getAttribute("data-fan-dot") || 0);
      applyPositions(idx);
      startAutoRotate();
    });
  });

  startAutoRotate();

  // Wire up live ratings and favourite heart buttons on the hero cards
  Promise.all([
    import("./utils.js"),
    import("./auth.js"),
    import("./ratings.js"),
  ])
    .then(([{ showToast, showAuthPromptModal, playHeartEffect, syncAllCardHearts }, { getCurrentUser }, { attachCardRating }]) => {
      syncAllCardHearts();
      cards.forEach((card) => {
        const recipeId = card.getAttribute("data-recipe-id");
        if (recipeId) attachCardRating(card, recipeId);

        const favBtn = card.querySelector(".favourite-btn");
        if (!favBtn) return;

        favBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const id = favBtn.getAttribute("data-id");
          const name = favBtn.getAttribute("data-name") || "Recipe";
          const image = favBtn.getAttribute("data-image") || "";
          const category = favBtn.getAttribute("data-category") || "Main";
          const area = favBtn.getAttribute("data-area") || "";

          const user = getCurrentUser();
          if (!user) {
            showAuthPromptModal({
              title: "Log in to save favourites",
              description: "Your saved recipes will be waiting for you on any device.",
              redirectUrl: `recipe.html?id=${encodeURIComponent(id)}`,
              icon: "heart",
            });
            return;
          }

          let storedFavs = [];
          try {
            storedFavs = JSON.parse(localStorage.getItem("recipeplan_favourites") || "[]");
          } catch (err) {}

          const exists = storedFavs.some((f) => String(f.id) === String(id));
          const icon = favBtn.querySelector(".heart-icon");

          if (exists) {
            storedFavs = storedFavs.filter((f) => String(f.id) !== String(id));
            icon?.setAttribute("fill", "none");
            icon?.classList.remove("text-[#ca5c2e]");
            favBtn.classList.remove("text-[#ca5c2e]");
            playHeartEffect(favBtn, false);
            showToast(`Removed "${name}" from favourites`);
            if (user.uid) {
              Promise.all([
                import("./firebase-config.js"),
                import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
              ])
                .then(([{ db }, { doc, deleteDoc }]) =>
                  deleteDoc(doc(db, "users", user.uid, "favourites", String(id)))
                )
                .catch(console.warn);
            }
          } else {
            const favItem = {
              id: String(id),
              name,
              image,
              category,
              area,
              savedAt: new Date().toISOString(),
            };
            storedFavs.unshift(favItem);
            icon?.setAttribute("fill", "#ca5c2e");
            icon?.classList.add("text-[#ca5c2e]");
            favBtn.classList.add("text-[#ca5c2e]");
            playHeartEffect(favBtn, true);
            showToast(`Saved "${name}" to favourites!`);
            if (user.uid) {
              Promise.all([
                import("./firebase-config.js"),
                import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
              ])
                .then(([{ db }, { doc, setDoc, serverTimestamp }]) =>
                  setDoc(doc(db, "users", user.uid, "favourites", String(id)), {
                    ...favItem,
                    savedAt: serverTimestamp(),
                  })
                )
                .catch(console.warn);
            }
          }

          localStorage.setItem("recipeplan_favourites", JSON.stringify(storedFavs));
          window.dispatchEvent(new CustomEvent("favourites-changed"));
        });
      });
    })
    .catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initRotatingSearchPlaceholder();
    initHeroFanCarousel();
  });
} else {
  initRotatingSearchPlaceholder();
  initHeroFanCarousel();
}
