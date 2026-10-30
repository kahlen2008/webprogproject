// Global multi-language support (130+ languages including Korean and Nepali)
// Powered by a headless Google Translate engine + GTX query/placeholder translation.

const LANG_STORAGE_KEY = "recipeplan_lang";

// Comprehensive list of 130+ languages supported by Google Translate
// Popular & regional languages are listed first for quick access, followed by all languages A–Z.
export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "it", name: "Italian", native: "Italiano" },
  // Full alphabetical list
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "ay", name: "Aymara", native: "Aymar aru" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "bm", name: "Bambara", native: "Bamanankan" },
  { code: "eu", name: "Basque", native: "Euskara" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "bho", name: "Bhojpuri", native: "भोजपुरी" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "ceb", name: "Cebuano", native: "Cebuano" },
  { code: "ny", name: "Chichewa", native: "Chichewa" },
  { code: "co", name: "Corsican", native: "Corsu" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "dv", name: "Dhivehi", native: "ދިވެހި" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "eo", name: "Esperanto", native: "Esperanto" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "ee", name: "Ewe", native: "Eʋegbe" },
  { code: "tl", name: "Filipino (Tagalog)", native: "Filipino" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "fy", name: "Frisian", native: "Frysk" },
  { code: "gl", name: "Galician", native: "Galego" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "gn", name: "Guarani", native: "Avañe'ẽ" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl ayisyen" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { code: "iw", name: "Hebrew", native: "עברית" },
  { code: "hmn", name: "Hmong", native: "Hmoob" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "ig", name: "Igbo", native: "Igbo" },
  { code: "ilo", name: "Ilocano", native: "Ilokano" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "jw", name: "Javanese", native: "Basa Jawa" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "kk", name: "Kazakh", native: "Қазақ тілі" },
  { code: "km", name: "Khmer", native: "ខ្មែរ" },
  { code: "rw", name: "Kinyarwanda", native: "Kinyarwanda" },
  { code: "gom", name: "Konkani", native: "कोंकणी" },
  { code: "kri", name: "Krio", native: "Krio" },
  { code: "ku", name: "Kurdish (Kurmanji)", native: "Kurdî" },
  { code: "ckb", name: "Kurdish (Sorani)", native: "کوردی" },
  { code: "ky", name: "Kyrgyz", native: "Кыргызча" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "la", name: "Latin", native: "Latina" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "ln", name: "Lingala", native: "Lingála" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "lg", name: "Luganda", native: "Luganda" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "mg", name: "Malagasy", native: "Malagasy" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "mi", name: "Maori", native: "Te Reo Māori" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "mni-Mtei", name: "Meiteilon (Manipuri)", native: "মৈতৈলোন্" },
  { code: "lus", name: "Mizo", native: "Mizo ṭawng" },
  { code: "mn", name: "Mongolian", native: "Монгол" },
  { code: "my", name: "Myanmar (Burmese)", native: "မြန်မာ" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "or", name: "Odia (Oriya)", native: "ଓଡ଼ିଆ" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo" },
  { code: "ps", name: "Pashto", native: "پښتو" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "qu", name: "Quechua", native: "Runasimi" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "sm", name: "Samoan", native: "Gagana fa'a Sāmoa" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "gd", name: "Scots Gaelic", native: "Gàidhlig" },
  { code: "nso", name: "Sepedi", native: "Sepedi" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "st", name: "Sesotho", native: "Sesotho" },
  { code: "sn", name: "Shona", native: "ChiShona" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "so", name: "Somali", native: "Soomaali" },
  { code: "su", name: "Sundanese", native: "Basa Sunda" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "tg", name: "Tajik", native: "Тоҷикӣ" },
  { code: "tt", name: "Tatar", native: "Татар" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ" },
  { code: "ts", name: "Tsonga", native: "Xitsonga" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "tk", name: "Turkmen", native: "Türkmen" },
  { code: "ak", name: "Twi", native: "Twi" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە" },
  { code: "uz", name: "Uzbek", native: "Oʻzbek" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "xh", name: "Xhosa", native: "isiXhosa" },
  { code: "yi", name: "Yiddish", native: "ייִדיש" },
  { code: "yo", name: "Yoruba", native: "Yorùbá" },
  { code: "zu", name: "Zulu", native: "isiZulu" },
];

// Read active language code from localStorage or googtrans cookie
export function getCurrentLanguage() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved) return saved;
  } catch (e) {}

  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return "en";
}

export function getLanguageInfo(code) {
  return (
    LANGUAGES.find((l) => l.code.toLowerCase() === String(code || "en").toLowerCase()) ||
    LANGUAGES[0]
  );
}

function setGoogTransCookie(langCode) {
  const host = window.location.hostname;
  if (!langCode || langCode === "en") {
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    if (host) {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${host};`;
    }
  } else {
    const val = `/en/${langCode}`;
    document.cookie = `googtrans=${val}; path=/; SameSite=Lax`;
    if (host && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      document.cookie = `googtrans=${val}; path=/; domain=${host}; SameSite=Lax`;
      document.cookie = `googtrans=${val}; path=/; domain=.${host}; SameSite=Lax`;
    }
  }
}

// Switch active language across the entire application
export function setLanguage(langCode) {
  const normalized = langCode || "en";
  const previous = getCurrentLanguage();

  try {
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
  } catch (e) {}

  setGoogTransCookie(normalized);
  document.documentElement.setAttribute("lang", normalized);

  // Update any visible language switcher labels immediately
  updateSwitcherLabels(normalized);

  if (normalized === "en") {
    if (previous !== "en") {
      restorePlaceholders();
      // Reload cleanly to clear Google Translate DOM mutations
      window.location.reload();
    }
    return;
  }

  // Trigger Google Translate hidden select if already mounted
  const combo = document.querySelector(".goog-te-combo");
  if (combo) {
    combo.value = normalized;
    combo.dispatchEvent(new Event("change"));
    translatePlaceholders(normalized);
  } else {
    // Ensure script is loaded; if already loading, reload to apply cookie
    initGoogleTranslate();
    setTimeout(() => {
      const retryCombo = document.querySelector(".goog-te-combo");
      if (retryCombo) {
        retryCombo.value = normalized;
        retryCombo.dispatchEvent(new Event("change"));
        translatePlaceholders(normalized);
      } else {
        window.location.reload();
      }
    }, 600);
  }
}

// Translate input/textarea placeholders (which Google's DOM observer skips)
const placeholderCache = {};

async function fetchTranslation(text, targetLang, sourceLang = "en") {
  if (!text || !text.trim() || targetLang === sourceLang) return text;
  const cacheKey = `i18n:${sourceLang}:${targetLang}:${text}`;
  if (placeholderCache[cacheKey]) return placeholderCache[cacheKey];
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      placeholderCache[cacheKey] = cached;
      return cached;
    }
  } catch (e) {}

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const translated =
      Array.isArray(data?.[0])
        ? data[0].map((segment) => segment?.[0] || "").join("")
        : text;
    if (translated) {
      placeholderCache[cacheKey] = translated;
      try {
        sessionStorage.setItem(cacheKey, translated);
      } catch (e) {}
      return translated;
    }
  } catch (e) {}
  return text;
}

export async function translatePlaceholders(targetLang = getCurrentLanguage()) {
  if (!targetLang || targetLang === "en") {
    restorePlaceholders();
    return;
  }
  const inputs = document.querySelectorAll("input[placeholder], textarea[placeholder]");
  await Promise.all(
    Array.from(inputs).map(async (el) => {
      if (el.closest(".notranslate, [translate='no']")) return;
      if (!el.dataset.origPlaceholder) {
        el.dataset.origPlaceholder = el.getAttribute("placeholder") || "";
      }
      const orig = el.dataset.origPlaceholder;
      if (!orig) return;
      const translated = await fetchTranslation(orig, targetLang, "en");
      if (translated) el.setAttribute("placeholder", translated);
    })
  );
}

function restorePlaceholders() {
  document.querySelectorAll("[data-orig-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", el.dataset.origPlaceholder);
  });
}

// Translate non-English user search queries to English so TheMealDB can find recipes
export async function translateQueryToEnglish(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return "";
  const lang = getCurrentLanguage();
  const hasNonAscii = /[^\u0000-\u007f]/.test(trimmed);
  if (lang === "en" && !hasNonAscii) return trimmed;
  return fetchTranslation(trimmed, "en", "auto");
}

// Mount hidden Google Translate element and load script
export function initGoogleTranslate() {
  const currentLang = getCurrentLanguage();
  if (currentLang && currentLang !== "en") {
    setGoogTransCookie(currentLang);
    document.documentElement.setAttribute("lang", currentLang);
  }

  if (!document.getElementById("google_translate_element")) {
    const holder = document.createElement("div");
    holder.id = "google_translate_element";
    holder.className = "hidden";
    holder.setAttribute("aria-hidden", "true");
    document.body.appendChild(holder);
  }

  window.googleTranslateElementInit = function () {
    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          autoDisplay: false,
        },
        "google_translate_element"
      );

      const saved = getCurrentLanguage();
      if (saved && saved !== "en") {
        setTimeout(() => {
          const combo = document.querySelector(".goog-te-combo");
          if (combo && combo.value !== saved) {
            combo.value = saved;
            combo.dispatchEvent(new Event("change"));
          }
          translatePlaceholders(saved);
        }, 400);
      }
    }
  };

  if (!document.getElementById("google-translate-script")) {
    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.head.appendChild(script);
  }
}

// Create HTML markup for the language switcher dropdown
export function createLanguageSwitcherHtml(idPrefix = "nav") {
  const current = getLanguageInfo(getCurrentLanguage());
  return `
    <div class="relative notranslate" translate="no" data-lang-switcher="${idPrefix}">
      <button
        type="button"
        id="${idPrefix}-lang-btn"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#ede4da] bg-white/90 hover:bg-stone-50 hover:border-[#ca5c2e]/40 text-xs font-semibold text-stone-700 transition focus:outline-none shadow-2xs"
        aria-label="Select Language"
        aria-expanded="false"
      >
        <svg class="w-4 h-4 text-[#ca5c2e] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="lang-current-label max-w-[85px] truncate">${current.native}</span>
        <svg class="w-3.5 h-3.5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div
        id="${idPrefix}-lang-dropdown"
        class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#ede4da] z-50 overflow-hidden"
      >
        <div class="p-2.5 border-b border-stone-100 bg-[#faf7f2]">
          <div class="relative">
            <svg class="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              id="${idPrefix}-lang-search"
              placeholder="Search 130+ languages (e.g. Nepali)..."
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#ca5c2e]"
            >
          </div>
        </div>
        <div id="${idPrefix}-lang-list" class="max-h-64 overflow-y-auto divide-y divide-stone-50 p-1">
          ${renderLanguageOptionsHtml("", current.code)}
        </div>
      </div>
    </div>
  `;
}

function renderLanguageOptionsHtml(filterText, activeCode) {
  const q = String(filterText || "").trim().toLowerCase();
  const filtered = q
    ? LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.native.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q)
      )
    : LANGUAGES;

  if (filtered.length === 0) {
    return `<div class="py-6 text-center text-xs text-stone-400">No languages match "${filterText}"</div>`;
  }

  return filtered
    .map((l) => {
      const isSelected = l.code.toLowerCase() === String(activeCode || "en").toLowerCase();
      return `
        <button
          type="button"
          data-lang-code="${l.code}"
          class="lang-option-btn w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition ${
            isSelected
              ? "bg-[#fbf2ec] text-[#ca5c2e] font-bold"
              : "text-stone-700 hover:bg-stone-50 font-medium"
          }"
        >
          <span class="truncate">${l.native} <span class="text-stone-400 font-normal">(${l.name})</span></span>
          ${
            isSelected
              ? `<svg class="w-3.5 h-3.5 text-[#ca5c2e] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
              : ""
          }
        </button>
      `;
    })
    .join("");
}

function updateSwitcherLabels(langCode) {
  const info = getLanguageInfo(langCode);
  document.querySelectorAll(".lang-current-label").forEach((el) => {
    el.textContent = info.native;
  });
}

// Bind interactive events to a language switcher instance
export function bindLanguageSwitcher(idPrefix = "nav") {
  const btn = document.getElementById(`${idPrefix}-lang-btn`);
  const dropdown = document.getElementById(`${idPrefix}-lang-dropdown`);
  const searchInput = document.getElementById(`${idPrefix}-lang-search`);
  const listEl = document.getElementById(`${idPrefix}-lang-list`);

  if (!btn || !dropdown || !listEl) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains("hidden");
    document.querySelectorAll("[id$='-lang-dropdown']").forEach((d) => d.classList.add("hidden"));
    if (isHidden) {
      dropdown.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
      if (searchInput) {
        searchInput.value = "";
        listEl.innerHTML = renderLanguageOptionsHtml("", getCurrentLanguage());
        setTimeout(() => searchInput.focus(), 50);
      }
    } else {
      btn.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
    const optBtn = e.target.closest(".lang-option-btn");
    if (optBtn) {
      const code = optBtn.dataset.langCode;
      dropdown.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
      setLanguage(code);
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      listEl.innerHTML = renderLanguageOptionsHtml(searchInput.value, getCurrentLanguage());
    });
  }

  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  });
}

// Mount a floating switcher on standalone pages without #navbar (login, signup, onboarding)
export function ensureStandaloneLanguageSwitcher() {
  if (document.getElementById("navbar") || document.getElementById("standalone-lang-host")) return;
  const host = document.createElement("div");
  host.id = "standalone-lang-host";
  host.className = "fixed top-4 right-4 z-50";
  host.innerHTML = createLanguageSwitcherHtml("standalone");
  document.body.appendChild(host);
  bindLanguageSwitcher("standalone");
}

// Auto-initialize on module load
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initGoogleTranslate();
      ensureStandaloneLanguageSwitcher();
    });
  } else {
    initGoogleTranslate();
    ensureStandaloneLanguageSwitcher();
  }
}

