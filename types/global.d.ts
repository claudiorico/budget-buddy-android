// CSS side-effect imports — processed by metro + NativeWind
declare module '*.css' {}

// uuid v9 ships without bundled types in the browser ESM entry
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string | ArrayLike<number>, namespace: string | ArrayLike<number>, buf?: ArrayLike<number>, offset?: number): string | ArrayLike<number>;
  export function v5(name: string | ArrayLike<number>, namespace: string | ArrayLike<number>, buf?: ArrayLike<number>, offset?: number): string | ArrayLike<number>;
}
