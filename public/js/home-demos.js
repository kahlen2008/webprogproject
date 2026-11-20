// Home page: the small looping demos in the three "How RecipePlan works" cards, and the
// cards sliding in when they scroll into view. Owner: Person 2.
// The demos are decorative (aria-hidden); the cards' text says the same thing.
// They only run while on screen, and stay still for people who prefer reduced motion.

const section = document.getElementById("feature-pillars");

if (section) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cards = [...section.querySelectorAll(".rp-pillar")];
  const timers = new Set();

  const wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.add(id);
    });

  // ---------- Week grid: 7 days x 3 meals, filled in a scattered order ----------
  const grid = section.querySelector("[data-demo-grid]");
  if (grid) {
    // A fixed scattered order looks more like someone planning than a left-to-right sweep.
    const order = [0, 8, 15, 3, 10, 17, 6, 1, 12, 19, 4, 9, 16, 2, 13, 20, 7, 11, 18, 5, 14];
    grid.innerHTML = Array.from({ length: 21 }, (_, i) => {
      const meal = Math.floor(i / 7); // 0 breakfast, 1 lunch, 2 dinner
      return `<span class="rp-demo-cell meal-${meal}" style="--o:${order.indexOf(i)}"></span>`;
    }).join("");
  }

  // ---------- Search: types a query, then shows a matching recipe ----------
  const SEARCHES = [
    { query: "chicken", name: "Teriyaki Chicken Casserole", tag: "Chicken", meta: "Japanese", img: "images/cat-chicken.webp" },
    { query: "pasta", name: "Fettucine Alfredo", tag: "Pasta", meta: "Italian", img: "images/pasta-hero.webp" },
    { query: "dessert", name: "Chocolate Gateau", tag: "Dessert", meta: "French", img: "images/cat-dessert.webp" },
  ];
  const typed = section.querySelector("[data-demo-typed]");
  const result = section.querySelector("[data-demo-result]");
  const resultImg = section.querySelector("[data-demo-img]");
  const resultName = section.querySelector("[data-demo-name]");
  const resultTag = section.querySelector("[data-demo-tag]");
  const resultMeta = section.querySelector("[data-demo-count]");

  let searchRunning = false;
  let searchIndex = 0;

  async function runSearchDemo() {
    if (!typed || !result || searchRunning) return;
    searchRunning = true;
    try {
      while (searchRunning) {
        const item = SEARCHES[searchIndex % SEARCHES.length];
        // Clear the old query, then type the new one letter by letter.
        result.classList.remove("is-shown");
        while (typed.textContent.length && searchRunning) {
          typed.textContent = typed.textContent.slice(0, -1);
          await wait(35);
        }
        if (!searchRunning) break;
        // Swap the result while it's hidden.
        resultImg.src = item.img;
        resultName.textContent = item.name;
        resultTag.textContent = item.tag;
        resultMeta.textContent = item.meta;
        await wait(250);
        for (const ch of item.query) {
          if (!searchRunning) break;
          typed.textContent += ch;
          await wait(85);
        }
        if (!searchRunning) break;
        await wait(300);
        result.classList.add("is-shown");
        await wait(2400);
        searchIndex++;
      }
    } finally {
      searchRunning = false;
    }
  }

  // ---------- Allergy: "Avoid peanuts" switches on and off, flagging Pad Thai ----------
  const allergy = section.querySelector("[data-demo-allergy]");
  let allergyRunning = false;

  async function runAllergyDemo() {
    if (!allergy || allergyRunning) return;
    allergyRunning = true;
    try {
      while (allergyRunning) {
        await wait(900);
        if (!allergyRunning) break;
        allergy.classList.add("is-on");
        await wait(2800);
        if (!allergyRunning) break;
        allergy.classList.remove("is-on");
      }
    } finally {
      allergyRunning = false;
    }
  }

  function startDemos() {
    section.classList.remove("is-paused");
    runSearchDemo();
    runAllergyDemo();
  }

  function stopDemos() {
    section.classList.add("is-paused");
    searchRunning = false;
    allergyRunning = false;
    timers.forEach(clearTimeout);
    timers.clear();
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    // Still versions: a finished search, a planned week and a flagged dish.
    result?.classList.add("is-shown");
    allergy?.classList.add("is-on");
    section.classList.add("is-static");
  } else {
    // Cards slide in one after another the first time they come into view.
    section.classList.add("is-animated");
    cards.forEach((card, i) => card.style.setProperty("--d", `${i * 90}ms`));
    const entrance = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            entrance.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    cards.forEach((card) => entrance.observe(card));

    // Run the demos only while the section is on screen (saves battery and CPU).
    section.classList.add("is-paused");
    new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? startDemos() : stopDemos()),
      { threshold: 0.1 }
    ).observe(section);

    // Also pause when the tab is in the background.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopDemos();
      else {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) startDemos();
      }
    });
  }
}
