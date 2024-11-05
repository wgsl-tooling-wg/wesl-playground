use std::{collections::HashMap, path::PathBuf};

use cfg_if::cfg_if;
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[derive(Tsify, Serialize, Deserialize, Default)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "lowercase")]
pub enum ManglerKind {
    #[default]
    Escape,
    Hash,
    None,
}

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct WeslOptions {
    pub files: HashMap<String, String>,
    pub root: String,
    #[serde(default)]
    pub mangler: ManglerKind,
    pub imports: bool,
    pub condcomp: bool,
    pub strip: bool,
    #[serde(default)]
    pub entrypoints: Option<Vec<String>>,
    pub features: HashMap<String, bool>,
    pub eval: Option<String>,
    #[serde(default)]
    pub bindings: Option<HashMap<(u32, u32), String>>,
    #[serde(default)]
    pub overrides: Option<HashMap<String, String>>,
}

#[cfg(feature = "ncthbrt")]
#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct NcthOptions {
    pub files: HashMap<String, String>,
    pub root: String,
    pub resolve: bool,
    pub normalize: bool,
    pub specialize: bool,
    pub dealias: bool,
    pub mangle: bool,
    pub flatten: bool,
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
    message: String,
    diagnostics: Vec<Diagnostic>,
}

#[cfg(feature = "wesl")]
fn compile_impl(args: WeslOptions) -> Result<String, wesl::Error> {
    use eval::{Context, Eval, RefInstance};
    use syntax::TranslationUnit;
    use wesl::*;

    let mut resolver = VirtualFileResolver::new();

    for (name, source) in args.files {
        let resource = PathBuf::from(name).into();
        resolver.add_file(resource, source).unwrap();
    }

    let root: Resource = PathBuf::from(args.root).into();

    let mangler: Box<dyn Mangler> = match args.mangler {
        ManglerKind::Escape => Box::new(MANGLER_ESCAPE),
        ManglerKind::Hash => Box::new(MANGLER_HASH),
        ManglerKind::None => Box::new(MANGLER_NONE),
    };
    let mangler = CachedMangler::new(&mangler);

    let compile_options = wesl::CompileOptions {
        use_imports: args.imports,
        use_condcomp: args.condcomp,
        use_generics: false,
        strip: args.strip,
        entry_points: args.entrypoints,
        features: args.features,
    };

    let (wgsl, sourcemap) =
        wesl::compile_with_sourcemap(&root, &resolver, &mangler, &compile_options);
    let wgsl = wgsl?;

    let empty_code = TranslationUnit::default();
    let mut empty_ctx = Context::new(&empty_code);

    let bindings = args
        .bindings
        .unwrap_or_default()
        .into_iter()
        .map(|(key, eval)| {
            let expr = eval
                .parse::<syntax::Expression>()
                .map_err(|e| wesl::Diagnostic::from(e).with_source(eval.clone()))?;
            let inst = expr
                .eval_value(&mut empty_ctx)
                .map_err(|e| wesl::Diagnostic::from(e).with_source(eval.clone()))?;
            let inst = RefInstance::new(
                inst,
                syntax::AddressSpace::Storage(None),
                syntax::AccessMode::ReadWrite,
            );
            Ok((key, inst))
        })
        .collect::<Result<_, Diagnostic<Error>>>()?;
    let overrides = args
        .overrides
        .unwrap_or_default()
        .into_iter()
        .map(|(key, eval)| {
            let expr = eval
                .parse::<syntax::Expression>()
                .map_err(|e| wesl::Diagnostic::from(e).with_source(eval.clone()))?;
            let inst = expr
                .eval_value(&mut empty_ctx)
                .map_err(|e| wesl::Diagnostic::from(e).with_source(eval.clone()))?;
            Ok((key, inst))
        })
        .collect::<Result<_, Diagnostic<Error>>>()?;

    if let Some(eval) = args.eval {
        let inst = (|| {
            let expr = eval
                .parse::<syntax::Expression>()
                .map_err(|e| wesl::Diagnostic::from(e).with_source(eval.clone()))?;

            let (res, ctx) = wesl::eval_runtime(&expr, &wgsl, bindings, overrides);
            res.map_err(|e| {
                wesl::Diagnostic::from(e)
                    .with_source(eval)
                    .with_ctx(&ctx)
                    .with_sourcemap(&sourcemap)
            })
        })()?;
        // sourcemap.set_default_source(eval.clone());
        // let inst = wesl::eval_with_sourcemap(&eval, &wgsl, &sourcemap)?;
        Ok(inst.to_string())
    } else {
        Ok(wgsl.to_string())
    }
}

#[cfg(feature = "ncthbrt")]
fn compile_impl_ncthbrt(args: NcthOptions) -> Result<String, String> {
    use wesl_types::{CompilerPass, CompilerPassError};
    let root_path = PathBuf::from(&args.root);
    let file_system = wesl_bundle::file_system::VirtualFilesystem {
        entry_point: root_path.parent().unwrap().to_path_buf(),
        files: args
            .files
            .iter()
            .map(|(k, v)| (PathBuf::from(k), v.clone()))
            .collect(),
    };
    let bundler = wesl_bundle::Bundler { file_system };

    let mut source_module = match bundler.bundle(&wesl_bundle::BundleContext {
        entry_points: vec![PathBuf::from(&args.root)],
        enclosing_module_name: None,
    }) {
        Ok(ast) => ast,
        Err(err) => return Err(ansi_to_html::convert(&err.to_string()).unwrap()),
    };

    for entry in args.files.keys() {
        if entry == &args.root {
            continue;
        }

        let module = match bundler.bundle(&wesl_bundle::BundleContext {
            entry_points: vec![PathBuf::from(entry)],
            enclosing_module_name: Some(entry.replace(".wgsl", "").replace(".wesl", "")),
        }) {
            Ok(ast) => ast,
            Err(err) => return Err(ansi_to_html::convert(&err.to_string()).unwrap()),
        };

        source_module
            .global_directives
            .extend(module.global_directives);
        source_module
            .global_declarations
            .extend(module.global_declarations);
    }

    let compile = || -> Result<wesl_parse::syntax::TranslationUnit, CompilerPassError> {
        let mut result = if args.resolve {
            let mut resolver = wesl_resolve::Resolver::default();
            let result = resolver.apply(&source_module)?;
            result
        } else {
            source_module
        };
        if args.normalize {
            let mut normalizer = wesl_template_normalize::TemplateNormalizer {
                ..Default::default()
            };
            normalizer.apply_mut(&mut result)?;
        }
        if args.specialize {
            let mut specializer = wesl_specialize::Specializer::default();
            specializer.apply_mut(&mut result)?;
        }
        if args.dealias {
            let mut dealiaser = wesl_dealias::Dealiaser {
                ..Default::default()
            };
            dealiaser.apply_mut(&mut result)?;
        }
        if args.mangle {
            let mut mangler = wesl_mangle::Mangler {
                ..Default::default()
            };
            mangler.apply_mut(&mut result)?;
        }
        if args.flatten {
            let mut flattener = wesl_flatten::Flattener::default();
            flattener.apply_mut(&mut result)?;
        }
        Ok(result)
    };
    compile()
        .map(|result| result.to_string())
        .map_err(|e| format!("{e:?}"))
}

cfg_if! {
    if #[cfg(feature = "debug")] {
        fn init_log() {
            static ONCE: std::sync::Once = std::sync::Once::new();
            ONCE.call_once(|| {
                std::panic::set_hook(Box::new(console_error_panic_hook::hook));
                console_log::init_with_level(log::Level::Trace).expect("error initializing log");
            })
        }
    } else {
        fn init_log() {}
    }
}

#[cfg(feature = "wesl")]
fn wesl_err_to_diagnostic(e: wesl::Error) -> Error {
    Error {
        #[cfg(feature = "ansi-to-html")]
        message: ansi_to_html::convert(&e.to_string()).unwrap(),
        #[cfg(not(feature = "ansi-to-html"))]
        message: e.to_string(),
        diagnostics: match e {
            wesl::Error::Error(d) => {
                if let wesl::Diagnostic {
                    file: Some(file),
                    span: Some(span),
                    ..
                } = d
                {
                    vec![Diagnostic {
                        file: file.path().with_extension("wgsl").display().to_string(),
                        span: span.range(),
                        title: "error here".to_string(),
                    }]
                } else {
                    vec![]
                }
            }
            _ => vec![],
        },
    }
}

fn validate(src: String) -> Result<String, Error> {
    #[cfg(feature = "naga")]
    let src = {
        use naga::back::wgsl::WriterFlags;
        use naga::valid::{Capabilities, ValidationFlags};
        let module = naga::front::wgsl::parse_str(&src).map_err(|e| Error {
            message: e.message().to_string(),
            diagnostics: vec![],
        })?;
        let mut validator =
            naga::valid::Validator::new(ValidationFlags::all(), Capabilities::all());
        let info = validator.validate(&module).map_err(|e| Error {
            message: e.emit_to_string(&src),
            diagnostics: vec![],
        })?;
        let flags = WriterFlags::EXPLICIT_TYPES;
        naga::back::wgsl::write_string(&module, &info, flags).map_err(|e| Error {
            message: e.to_string(),
            diagnostics: vec![],
        })?
    };
    Ok(src)
}

#[wasm_bindgen]
pub fn compile(args: WeslOptions) -> Result<String, JsValue> {
    init_log();

    #[cfg(feature = "wesl")]
    let src = compile_impl(args).map_err(wesl_err_to_diagnostic);

    #[cfg(not(feature = "wesl"))]
    let src = args.files.get(&args.root).cloned().ok_or(Error {
        message: format!("file `{}` not found", args.root),
        diagnostics: vec![],
    });

    src.and_then(validate)
        .map_err(|e| serde_wasm_bindgen::to_value(&e).unwrap())
}

#[cfg(feature = "ncthbrt")]
#[wasm_bindgen]
pub fn compile_ncth(args: NcthOptions) -> Result<String, String> {
    init_log();
    compile_impl_ncthbrt(args).map(|d| d.to_string())
}
