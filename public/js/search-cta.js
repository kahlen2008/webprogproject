// Minimalist Animated Rotating Placeholder Call-to-Action for Search Bar
// Smoothly cycles through popular recipe suggestions directly in the input placeholder.

function initRotatingSearchPlaceholder() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("query");

  if (!form || !input) return;

  const defaultPlaceholder = "Search for a recipe, ingredient or cuisine...";
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
    if (isFocused || input.value.length > 0) return;

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRotatingSearchPlaceholder);
} else {
  initRotatingSearchPlaceholder();
}
