// -----------------------------------------------------------------------------
// GENERATED FILE — do not edit directly.
// Source of truth: packages/core/src/docs/
// Run  pnpm docs:sync  from the repo root to regenerate.
// -----------------------------------------------------------------------------

// Public entry point for the docs corpus. Surface renderers import from here.

export type { Audience, Surface, Section, TaskId, Capability, DocPage, DocBlock, FactsBlock, SidebarNode } from './types';
export { SECTION_LABELS, SECTION_ORDER } from './types';

export type { RendererAdapter, FactsData, PageExtras } from './adapter';
export { renderPage, renderBlock, pageBadges } from './adapter';

export { filterBySurface, filterByCapability, filterForSurface, filterByAudience, buildSidebar, anchorFor } from './filter';
export { getPages, getPage } from './corpus';
export { docTranslatableEntries, localizePages, availableDocLocales } from './i18n';

export * from './data/tools';
export * from './data/providers';
export * from './data/modes';
export * from './data/personas';
export * from './data/permissions';
export * from './data/shortcuts';
export * from './data/capabilities';
export * from './data/tasks';
