// Builds public/css/tailwind.css, the pre-built Tailwind used by index.html, recipes.html
// and recipe.html (the other pages use the Tailwind CDN). Regenerate it after adding
// Tailwind classes that those pages, or JS that renders on them, didn't use before:
//
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o public/css/tailwind.css --minify
//
// The theme matches the inline tailwind.config block on the CDN pages. The input file also
// bundles css/base.css, components.css and recipes.css, since those pages load only this file.
module.exports = {
  content: ["./public/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ca5c2e",
          dark: "#b34d23",
          light: "#fdf8f4",
          surface: "#faf6f0",
          cream: "#faf7f2",
          pill: "#f5ebe4",
          pillText: "#a04e28",
          border: "#ede4da",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Outfit", "Inter", "sans-serif"],
      },
      // Extra small sizes used across the site (the previous build had these too).
      boxShadow: {
        "2xs": "0 1px 1px 0 rgba(0, 0, 0, 0.04)",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
};
