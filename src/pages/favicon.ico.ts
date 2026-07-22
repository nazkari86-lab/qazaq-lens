const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#173f42"/><circle cx="32" cy="32" r="22" fill="none" stroke="#f3efe4" stroke-width="3"/><circle cx="32" cy="32" r="9" fill="none" stroke="#d9b768" stroke-width="3"/><path d="M32 7v12M32 45v12M7 32h12M45 32h12" stroke="#f3efe4" stroke-width="3" stroke-linecap="round"/></svg>`;
export function GET() {
  return new Response(icon, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
}
