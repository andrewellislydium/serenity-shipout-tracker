Ship-out readiness tracker for Serenity Power (client facing, maintained by Lydium). Node/TypeScript/Express server with a vanilla ES module front end.

- SPEC.md is the build spec; read it before making changes. reference/tracker-reference.html is the authority for look, behaviour and copy. Ask before deviating from the spec.
- Brand: Lydium colours only (SPEC section 9). No em dashes in UI copy. Logo at 108 px wide or more, never recoloured or stretched.
- Escape all user text with esc() in public/js/core.js. Never put unescaped input into innerHTML.
- The API only talks to storage through the Store interface in src/store/types.ts. Keep it that way so the Azure adapter can drop in.
- All writes are editor only, enforced on the server with requireRole('editor').
- Local dev: `npm run dev` on port 5190. Live data is in data/tracker.json (git ignored); delete it to reseed from data/tracker-state.json.
- STORE=table is the Azure Table Storage adapter (managed identity in Azure, Azurite locally via AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true).
- Runtime target is Node 24 LTS (SPEC says 20, which is end of life). Keep code compatible with 20.12+.
- Status: milestones 1 to 7 done; table adapter done; Azure App Service setup in progress via the portal.
