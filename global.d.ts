declare module '*?raw' {
  const content: string;
  export default content;
}
declare module '*?url' {
  const content: string;
  export default content;
}
<<<<<<< HEAD
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
=======
>>>>>>> 7bdcf6686f559c588cd3e4b41cdfc5e6dd270e6f
declare module '*.css' {
  const content: unknown;
  export default content;
}
<<<<<<< HEAD
=======
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
declare module '*.yaml' {
  const content: any;
  export default content;
}
>>>>>>> 7bdcf6686f559c588cd3e4b41cdfc5e6dd270e6f
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}

declare const YAML: typeof import('yaml');

declare const z: typeof import('zod');
declare namespace z {
  export type infer<T> = import('zod').infer<T>;
  export type input<T> = import('zod').input<T>;
  export type output<T> = import('zod').output<T>;
}

declare module 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js' {
<<<<<<< HEAD
  export function registerMvuSchema(schema: z.ZodObject | (() => z.ZodObject)): void;
=======
  export function registerMvuSchema(
    schema: z.ZodType<Record<string, any>> | (() => z.ZodType<Record<string, any>>),
  ): void;
>>>>>>> 7bdcf6686f559c588cd3e4b41cdfc5e6dd270e6f
}
