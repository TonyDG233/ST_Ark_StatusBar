declare module '*?raw' {
  const content: string;
  export default content;
}
declare module '*?url' {
  const content: string;
  export default content;
}
<<<<<<< HEAD
=======
declare module '*.css' {
  const content: unknown;
  export default content;
}
>>>>>>> b0b1703a805d03d3a4d97270fa3ebbc17a91f8b8
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.md' {
  const content: string;
  export default content;
}
<<<<<<< HEAD
declare module '*.css' {
  const content: unknown;
  export default content;
}
declare module '*.scss' {
  const content: unknown;
=======
declare module '*.yaml' {
  const content: any;
>>>>>>> b0b1703a805d03d3a4d97270fa3ebbc17a91f8b8
  export default content;
}
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
>>>>>>> b0b1703a805d03d3a4d97270fa3ebbc17a91f8b8
}
