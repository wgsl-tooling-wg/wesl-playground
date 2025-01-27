use std::collections::HashMap;

use cfg_if::cfg_if;
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::*;
use wesl::{CompileResult, VirtualResolver, Wesl};

#[derive(Tsify, Clone, Copy, Debug, Default, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "lowercase")]
pub enum ManglerKind {
    #[default]
    Escape,
    Hash,
    None,
}

impl From<ManglerKind> for wesl::ManglerKind {
    fn from(value: ManglerKind) -> Self {
        match value {
            ManglerKind::Escape => wesl::ManglerKind::Escape,
            ManglerKind::Hash => wesl::ManglerKind::Hash,
            ManglerKind::None => wesl::ManglerKind::None,
        }
    }
}

#[derive(Tsify, Debug, Serialize, Deserialize)]
#[serde(tag = "command")]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum Command {
    Compile(CompileOptions),
    Eval(EvalOptions),
}

#[derive(Tsify, Debug, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct CompileOptions {
    #[tsify(type = "{ [name: string]: string }")]
    pub files: HashMap<String, String>,
    pub root: String,
    #[serde(default)]
    pub mangler: ManglerKind,
    pub sourcemap: bool,
    pub imports: bool,
    pub condcomp: bool,
    pub generics: bool,
    pub strip: bool,
    pub lower: bool,
    pub validate: bool,
    pub naga: bool,
    #[serde(default)]
    pub entrypoints: Option<Vec<String>>,
    #[tsify(type = "{ [name: string]: boolean }")]
    pub features: HashMap<String, bool>,
}

#[derive(Tsify, Debug, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct EvalOptions {
    #[serde(flatten)]
    pub compile: CompileOptions,
    pub runtime: bool,
    pub expr: String,
    #[serde(default)]
    pub bindings: HashMap<(u32, u32), String>,
    #[serde(default)]
    #[tsify(type = "{ [name: string]: string }")]
    pub overrides: HashMap<String, String>,
}

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Diagnostic {
    file: String,
    span: std::ops::Range<usize>,
    title: String,
}

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Error {
    source: Option<String>,
    message: String,
    diagnostics: Vec<Diagnostic>,
}

fn run_compile(args: CompileOptions) -> Result<CompileResult, wesl::Error> {
    let mut resolver = VirtualResolver::new();

    for (path, source) in &args.files {
        resolver.add_module(path, source.clone());
    }

    let comp = Wesl::new_barebones()
        .set_options(wesl::CompileOptions {
            use_imports: args.imports,
            use_condcomp: args.condcomp,
            use_generics: args.generics,
            use_stripping: args.strip,
            use_lower: args.lower,
            use_validate: args.validate,
            entry_points: args.entrypoints,
            features: args.features,
        })
        .use_sourcemap(args.sourcemap)
        .set_custom_resolver(resolver)
        .set_mangler(args.mangler.into())
        .compile(args.root)?;
    Ok(comp)
}

cfg_if! {
    if #[cfg(feature = "debug")] {
        fn init_log() {
            static ONCE: std::sync::Once = std::sync::Once::new();
            ONCE.call_once(|| {
                std::panic::set_hook(Box::new(console_error_panic_hook::hook));
                console_log::init_with_level(log::Level::Debug).expect("error initializing log");
            })
        }
    } else {
        fn init_log() {}
    }
}

fn wesl_err_to_diagnostic(e: wesl::Error, source: Option<String>) -> Error {
    Error {
        source,
        #[cfg(feature = "ansi-to-html")]
        message: ansi_to_html::convert(&e.to_string()).unwrap(),
        #[cfg(not(feature = "ansi-to-html"))]
        message: e.to_string(),
        diagnostics: {
            let d = wesl::Diagnostic::from(e);
            if let (Some(span), Some(res)) = (&d.span, &d.resource) {
                vec![Diagnostic {
                    file: res.path().with_extension("wgsl").display().to_string(),
                    span: span.range(),
                    title: d.error_message(),
                }]
            } else {
                vec![]
            }
        },
    }
}

#[cfg(feature = "naga")]
fn run_naga(src: &str) -> Result<(), Error> {
    use naga::back::wgsl::WriterFlags;
    use naga::valid::{Capabilities, ValidationFlags};
    let module = naga::front::wgsl::parse_str(src).map_err(|e| Error {
        source: Some(src.to_string()),
        message: e.message().to_string(),
        diagnostics: vec![],
    })?;
    let mut validator = naga::valid::Validator::new(ValidationFlags::all(), Capabilities::all());
    let info = validator.validate(&module).map_err(|e| Error {
        source: Some(src.to_string()),
        message: e.emit_to_string(src),
        diagnostics: e
            .spans()
            .map(|(span, msg)| Diagnostic {
                file: "output".to_string(),
                span: span.to_range().unwrap_or_default(),
                title: msg.to_string(),
            })
            .collect(),
    })?;
    let flags = WriterFlags::EXPLICIT_TYPES;
    naga::back::wgsl::write_string(&module, &info, flags).map_err(|e| Error {
        source: Some(src.to_string()),
        message: e.to_string(),
        diagnostics: vec![],
    })?;
    Ok(())
}

#[wasm_bindgen]
pub fn run(
    #[wasm_bindgen(unchecked_param_type = "Command")] args: JsValue,
) -> Result<String, JsValue> {
    init_log();

    let args = serde_wasm_bindgen::from_value(args).unwrap();
    log::debug!("compile {args:?}");

    let serializer = serde_wasm_bindgen::Serializer::new();
    // .serialize_bytes_as_arrays(false)
    // .serialize_large_number_types_as_bigints(true);

    match args {
        Command::Compile(args) => {
            let naga = args.naga;
            let comp = run_compile(args)
                .map_err(|e| wesl_err_to_diagnostic(e, None))
                .map_err(|e| e.serialize(&serializer).unwrap())?;

            let source = comp.syntax.to_string();
            if naga {
                #[cfg(feature = "naga")]
                run_naga(&source).map_err(|e| e.serialize(&serializer).unwrap())?;
            }
            Ok(source)
        }
        Command::Eval(args) => {
            let comp = run_compile(args.compile)
                .map_err(|e| wesl_err_to_diagnostic(e, None))
                .map_err(|e| e.serialize(&serializer).unwrap())?;
            let inst = comp
                .eval(&args.expr)
                .map_err(|e| wesl_err_to_diagnostic(e, Some(comp.syntax.to_string())))
                .map_err(|e| e.serialize(&serializer).unwrap())?;
            Ok(inst.to_string())
        } // Command::Exec(args) => {
          //     let inst = run_exec(args)
          //         .map_err(wesl_err_to_diagnostic)
          //         .map_err(|e| e.serialize(&serializer).unwrap())?;
          //     Ok(inst.to_string())
          // }
    }
}
