/* tslint:disable */
/* eslint-disable */
export function init_log(level: string): void;
export function run(args: Command): any;
export type ManglerKind = "escape" | "hash" | "none";

export type Command = ({ command: "Compile" } & CompileOptions) | ({ command: "Eval" } & EvalOptions) | ({ command: "Exec" } & ExecOptions) | ({ command: "Dump" } & DumpOptions);

export interface CompileOptions {
    files: { [name: string]: string };
    root: string;
    mangler?: ManglerKind;
    sourcemap: boolean;
    imports: boolean;
    condcomp: boolean;
    generics: boolean;
    strip: boolean;
    lower: boolean;
    validate: boolean;
    naga: boolean;
    lazy: boolean;
    keep?: string[] | undefined;
    keep_root: boolean;
    mangle_root: boolean;
    features: { [name: string]: boolean };
}

export type BindingType = "uniform" | "storage" | "read-only-storage" | "filtering" | "non-filtering" | "comparison" | "float" | "unfilterable-float" | "sint" | "uint" | "depth" | "write-only" | "read-write" | "read-only";

export interface Binding {
    group: number;
    binding: number;
    kind: BindingType;
    data: Uint8Array;
}

export interface EvalOptions extends CompileOptions {
    expression: string;
}

export interface ExecOptions extends CompileOptions {
    entrypoint: string;
    resources?: Binding[];
    overrides?: { [name: string]: string };
}

export interface DumpOptions {
    source: string;
}

export interface Diagnostic {
    file: string;
    span: { start: number; end: number };
    title: string;
}

export interface Error {
    source: string | undefined;
    message: string;
    diagnostics: Diagnostic[];
}


export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init_log: (a: number, b: number) => void;
  readonly run: (a: any) => [number, number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
