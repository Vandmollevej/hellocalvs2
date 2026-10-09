# Porting a web page to the native app

Each user-facing web page (`src/app/**/page.tsx`) has exactly one native screen
in `native/shared/src/commonMain/kotlin/dk/packroff/hellocal/screens/<area>/`.
The screen must look and behave like the web page: same texts, same order,
same API calls, same validation and empty/error states.

## Rules

1. **Read the whole web page and every component it imports** (recursively,
   `src/components/**`). Port behaviour, not just layout.
2. **Texts:** `val t = LocalTranslator.current` → `t.t("same.key", "name" to value)`.
   Never hard-code a text that the web takes from `t()`. If the web hard-codes
   Danish, use the same Danish string.
3. **Design:** use only `dk.packroff.hellocal.ui.*` components (HcScreen,
   HcAppBar, HcText, HcButton, HcTextField, HcCard, HcSectionTitle, HcListRow,
   HcBottomSheet, HcLoader, HcError, HcLink, HcRemoteImage, HcIcon, VSpace) and
   tokens `HcColors.*`, `HcDimens.*`, `HcTypeRoles.*` (generated from
   `globals.css` — `.hf-type-body` → `HcTypeRoles.Body`, `text-hf-brand` →
   `HcColors.Brand`, `bg-hf-card` → `HcColors.Card`). No hex values, no
   `Color(0x…)`, and no raw Material widgets where a Hc component exists.
   A missing reusable component goes in `ui/` (not inside a screen) so other
   screens can use it.
4. **Icons:** `<IconFoo size={24} stroke={1.6} />` → `HcIcon("Foo", size = 24.dp, stroke = 1.6f)`.
   Custom SVG icons from `src/components/icons/*` → draw with `Canvas`/`ImageVector`
   in `ui/icons/CustomIcons.kt`.
5. **Data:** call the same `/api/...` routes as the web page via `Api.get/post/put/patch/delete`
   (returns `JsonElement`). Parse with `@Serializable` data classes and
   `ApiJson.decodeFromJsonElement(...)`, or read fields from the `JsonObject`.
   Load in `LaunchedEffect`, mutate via `rememberCoroutineScope().launch { … }`.
   Show `HcLoader()` while loading and the web's error text on failure.
   After anything that creates/changes a registration, call
   `NativeHooks.onRegistrationChanged()` (refreshes widgets).
6. **Navigation:** `val nav = LocalNavigator.current`;
   `router.push(x)` → `nav.push(x)`, `router.replace(x)` → `nav.replace(x)`,
   `router.back()` → `nav.back()`, `<Link href>` → `nav.push(href)` or `HcLink`.
   Path params/query: `args["id"]`, `args.opt("mode")`.
7. **Browser-only features** have native equivalents:
   - camera/photos/barcode/OCR/speech/share/biometrics → `Device.*` in
     `platform/Device.kt` (one interface, implemented by both apps)
   - localStorage → `NativeHooks.secureStorage`
   - `window.open`/mailto/tel → `NativeHooks.openExternalUrl`.
   If one isn't there yet, add the expect/actual in `platform/` with a TODO
   rather than leaving the feature out silently.
8. **Register the screen** in your area's `<Area>Routes.kt`:
   `ScreenRoute("/web/route/[id]") { FooScreen(it) }`. Use the web route exactly
   as written in `native/parity/screens.json`. Full-screen pages without the bottom
   nav get `fullScreen = true`; pages reachable logged-out get `public = true`.
9. Kotlin must compile for **Android and iOS** (common code): no `java.*`,
   no `android.*`, no `String.format` in `commonMain`. Use kotlinx-datetime for dates.
   Numbers: `formatNumber()` in `ui/Format.kt`. Never write `/*` inside a comment (e.g. `api/**`) — Kotlin nests block comments.
10. When done: `node scripts/native/parity.mjs --port <route> <kotlin file(s)>`.
