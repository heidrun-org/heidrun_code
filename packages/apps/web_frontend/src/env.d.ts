/// <reference types="vite/client" />

/** The date and time of the build, as `<year><month><day>-<hours><minutes><seconds>`. Set by `vite.config.ts`. */
declare const __BUILD_TIME__: string;

/** The texts of every language by language, then by key "<namespace>.<key>". Built by `vite.config.ts` from `src/i18n/locales`. */
declare module "virtual:locale-messages" {
  const messages: Record<string, Record<string, string>>;
  export default messages;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, any>;
  export default component;
}
