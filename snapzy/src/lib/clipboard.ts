export async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // The Clipboard API needs HTTPS or localhost; opening the dev server from a
  // phone over the LAN (http://192.168…) lands here.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Copy failed");
}

// Supabase signed URLs accept `download=<name>`, which makes Storage send
// Content-Disposition: attachment — no CORS fetch or blob needed.
export function downloadUrl(signedUrl: string, filename: string) {
  const sep = signedUrl.includes("?") ? "&" : "?";
  return `${signedUrl}${sep}download=${encodeURIComponent(filename)}`;
}
