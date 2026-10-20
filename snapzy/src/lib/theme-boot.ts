// Plain module (not "use client") so the root layout can inline the script.
export const THEME_KEY = "snapzy-theme";
export const LANG_KEY = "snapzy-lang";

// Runs before first paint (inlined in <head>) so dark mode never flashes white.
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var l=localStorage.getItem("${LANG_KEY}");if(l)document.documentElement.lang=l==="tl"?"tl":"en";}catch(e){}})();`;
