import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Modddel",
  description:
    "This is simple framework designed to support implementation of the DDD principles and provide structured approach for building robust and maintainable applications. Below is an introduction to the key concepts and components of our DDD Model Framework.",
  head: [
    [
      "link",
      { rel: "icon", href: `${process.env.BASE_URL ?? "/"}favicon.ico` },
    ],
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [{ text: "Home", link: "/" }],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Key concepts", link: "/key-concepts" },
          { text: "Aggregate root", link: "/aggregate-root" },
          { text: "Repository", link: "/repository" },
          { text: "Test utils", link: "/test-utils" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/nulltype-dev/modddel" },
    ],
  },
  base: process.env.BASE_URL,
});
