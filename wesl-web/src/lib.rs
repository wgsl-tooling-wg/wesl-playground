//! The Command-line interface for the `wgsl-tools` suite.
//!
//! Very much a work in progress.

use std::{collections::HashMap, fmt::Display, path::PathBuf, str::FromStr};

use tsify::Tsify;
use wesl::{
    eval::{Eval, EvalAttrs, EvalError, HostShareable, Instance, RefInstance},
    syntax::{self, AccessMode, AddressSpace, TranslationUnit},
    BasicSourceMap, CompileOptions, Diagnostic, Mangler, Resource, VirtualFileResolver,
    MANGLER_ESCAPE, MANGLER_HASH, MANGLER_NONE,
};

use cfg_if::cfg_if;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

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

#[derive(Debug, Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(tag = "command")]
pub enum Command {
    /// check correctness of the source file
    Check(CommonArgs),
    /// parse the source and convert it back to code from the syntax tree
    Parse(CommonArgs),
    /// output the syntax tree to stdout
    Dump(CommonArgs),
    /// compile a source file and outputs the compiled file to stdout
    Compile(CompileArgs),
    /// evaluate a const expression
    Eval(EvalArgs),
}

#[derive(Debug, Tsify, Serialize, Deserialize)]
pub struct CommonArgs {
    /// wgsl file entry-point
    input: String,
}

#[derive(Debug, Tsify, Serialize, Deserialize)]
pub struct CompileArgs {
    #[serde(flatten)]
    common: CommonArgs,
    /// name mangling strategy
    mangler: ManglerKind,
    /// show nicer error messages by computing a sourcemap
    no_sourcemap: bool,
    /// disable imports
    no_imports: bool,
    /// disable conditional compilation
    no_cond_comp: bool,
    /// disable generics
    no_generics: bool,
    /// disable stripping unused declarations
    no_strip: bool,
    /// exposed shader entry-points
    entry_points: Option<Vec<String>>,
    /// conditional compilation features to enable
    enable_features: Vec<String>,
    /// conditional compilation features to disable
    disable_features: Vec<String>,
}

/// reference: https://gpuweb.github.io/gpuweb/#binding-type
#[derive(Clone, Copy, Debug, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum BindingType {
    Uniform,
    Storage,
    ReadOnlyStorage,
    Filtering,
    NonFiltering,
    Comparison,
    Float,
    UnfilterableFloat,
    Sint,
    Uint,
    Depth,
    WriteOnly,
    ReadWrite,
    ReadOnly,
}

impl FromStr for BindingType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "uniform" => Ok(Self::Uniform),
            "storage" => Ok(Self::Storage),
            "read-only-storage" => Ok(Self::ReadOnlyStorage),
            "filtering" => Ok(Self::Filtering),
            "non-filtering" => Ok(Self::NonFiltering),
            "comparison" => Ok(Self::Comparison),
            "float" => Ok(Self::Float),
            "unfilterable-float" => Ok(Self::UnfilterableFloat),
            "sint" => Ok(Self::Sint),
            "uint" => Ok(Self::Uint),
            "depth" => Ok(Self::Depth),
            "write-only" => Ok(Self::WriteOnly),
            "read-write" => Ok(Self::ReadWrite),
            "read-only" => Ok(Self::ReadOnly),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Tsify, Serialize, Deserialize)]
struct Binding {
    group: u32,
    binding: u32,
    kind: BindingType,
    #[serde(with = "serde_bytes")]
    data: Box<[u8]>,
}

#[derive(Debug, Tsify, Serialize, Deserialize)]
pub struct EvalArgs {
    /// context to evaluate the expression into
    #[serde(flatten)]
    compile: CompileArgs,
    /// run the eval() to at shader-execution-time instead of at pipeline-creation-time
    runtime: bool,
    /// the expression to evaluate
    expr: String,
    /// bindings. Only `Uniform` and `buffer` bindings are supported at the moment.
    /// syntax: colon-separated group,binding,binding_type,wgsl_type,path
    ///  * group and binding are @group and @binding numbers
    ///  * binding_type is the `GPU*BindingType`
    ///  * path is a path to a binary file of the buffer contents.
    /// example: 0:0:storage:array<vec3<u32>,5>:./my_buffer.bin
    bindings: Vec<Binding>,
    overrides: Vec<(String, String)>,
}

#[derive(Clone, Copy, Debug, Tsify, Serialize, Deserialize)]
enum ManglerKind {
    /// escaped path mangler  foo/bar/{item} -> foo_bar_item
    Escape,
    /// hash mangler          foo/bar/{item} -> item_1985638328947
    Hash,
    /// disable mangling (warning: will break if case of name conflicts!)
    None,
}

impl Display for ManglerKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManglerKind::Escape => f.write_str("escape"),
            ManglerKind::Hash => f.write_str("hash"),
            ManglerKind::None => f.write_str("none"),
        }
    }
}

#[derive(Clone, Debug, thiserror::Error)]
enum CliError {
    #[error("binding `@group({0}) @binding({1})` not found")]
    BindingNotFound(u32, u32),
    #[error(
        "binding `@group({0}) @binding({1})` ({2} bytes) incompatible with type `{3}` ({4} bytes)"
    )]
    BindingIncompatible(u32, u32, u32, wesl::eval::Type, u32),
    #[error("{0}")]
    CompileError(#[from] wesl::Error),
}

fn make_mangler(kind: ManglerKind) -> Box<dyn Mangler> {
    match kind {
        ManglerKind::Escape => Box::new(MANGLER_ESCAPE),
        ManglerKind::Hash => Box::new(MANGLER_HASH),
        ManglerKind::None => Box::new(MANGLER_NONE),
    }
}

fn run_compile(args: &CompileArgs) -> Result<(TranslationUnit, Option<BasicSourceMap>), CliError> {
    let name = PathBuf::from("main.wgsl");

    let mut resolver = VirtualFileResolver::new();
    resolver
        .add_file(name.clone(), args.common.input.clone())
        .map_err(wesl::Error::ResolveError)?;
    let entrypoint: Resource = name.into();

    let mangler = make_mangler(args.mangler);

    let mut features = HashMap::new();
    features.extend(args.enable_features.iter().map(|f| (f.clone(), true)));
    features.extend(args.disable_features.iter().map(|f| (f.clone(), false)));

    let compile_options = CompileOptions {
        use_imports: !args.no_imports,
        use_condcomp: !args.no_cond_comp,
        use_generics: !args.no_generics,
        strip: !args.no_strip,
        entry_points: args.entry_points.clone(),
        features,
    };

    if !args.no_sourcemap {
        let (wgsl, sourcemap) =
            wesl::compile_with_sourcemap(&entrypoint, &resolver, &mangler, &compile_options);
        Ok((wgsl?, Some(sourcemap)))
    } else {
        let wgsl = wesl::compile(&entrypoint, &resolver, &mangler, &compile_options)?;
        Ok((wgsl, None))
    }
}

fn parse_binding(
    b: &Binding,
    wgsl: &TranslationUnit,
) -> Result<((u32, u32), RefInstance), CliError> {
    let mut ctx = wesl::eval::Context::new(wgsl);

    let ty_expr = wgsl
        .global_declarations
        .iter()
        .find_map(|d| match d {
            syntax::GlobalDeclaration::Declaration(d) => {
                let (group, binding) = d.eval_group_binding(&mut ctx).ok()?;
                if group == b.group && binding == b.binding {
                    d.ty.clone()
                } else {
                    None
                }
            }
            _ => None,
        })
        .ok_or_else(|| CliError::BindingNotFound(b.group, b.binding))?;

    let ty = ty_expr
        .eval_value(&mut ctx)
        .and_then(|inst| match inst {
            Instance::Type(ty) => Ok(ty),
            _ => Err(EvalError::UnknownType(inst.to_string())),
        })
        .map_err(|e| {
            wesl::Error::Error(
                Diagnostic::from(e)
                    .with_ctx(&ctx)
                    .with_source(ty_expr.to_string()),
            )
        })?;
    let (storage, access) = match b.kind {
        BindingType::Uniform => (AddressSpace::Uniform, AccessMode::Read),
        BindingType::Storage => (
            AddressSpace::Storage(Some(AccessMode::ReadWrite)),
            AccessMode::ReadWrite,
        ),
        BindingType::ReadOnlyStorage => (
            AddressSpace::Storage(Some(AccessMode::Read)),
            AccessMode::Read,
        ),
        BindingType::Filtering => todo!(),
        BindingType::NonFiltering => todo!(),
        BindingType::Comparison => todo!(),
        BindingType::Float => todo!(),
        BindingType::UnfilterableFloat => todo!(),
        BindingType::Sint => todo!(),
        BindingType::Uint => todo!(),
        BindingType::Depth => todo!(),
        BindingType::WriteOnly => todo!(),
        BindingType::ReadWrite => todo!(),
        BindingType::ReadOnly => todo!(),
    };
    let inst = Instance::from_buffer(&b.data, &ty, &mut ctx).ok_or_else(|| {
        CliError::BindingIncompatible(
            b.group,
            b.binding,
            b.data.len() as u32,
            ty.clone(),
            ty.size_of(&mut ctx).unwrap(),
        )
    })?;
    // log::info!("binding: {inst}, {:?}", b.data);
    Ok((
        (b.group, b.binding),
        RefInstance::from_instance(inst, storage, access),
    ))
}

fn parse_override(src: &str, wgsl: &TranslationUnit) -> Result<Instance, CliError> {
    let mut ctx = wesl::eval::Context::new(wgsl);
    let expr = src
        .parse::<syntax::Expression>()
        .map_err(|e| wesl::Error::Error(Diagnostic::from(e).with_source(src.to_string())))?;
    let inst = expr.eval_value(&mut ctx).map_err(|e| {
        wesl::Error::Error(
            Diagnostic::from(e)
                .with_ctx(&ctx)
                .with_source(src.to_string()),
        )
    })?;
    Ok(inst)
}

fn run_eval(args: &EvalArgs) -> Result<(Instance, Vec<Binding>), CliError> {
    let (wgsl, sourcemap) = run_compile(&args.compile)?;

    let bindings = args
        .bindings
        .iter()
        .map(|b| parse_binding(b, &wgsl))
        .collect::<Result<_, _>>()?;

    let overrides = args
        .overrides
        .iter()
        .map(|(name, expr)| -> Result<(String, Instance), CliError> {
            Ok((name.to_string(), parse_override(expr, &wgsl)?))
        })
        .collect::<Result<_, _>>()?;

    let expr = args
        .expr
        .parse::<syntax::Expression>()
        .map_err(|e| wesl::Error::Error(Diagnostic::from(e).with_source(args.expr.to_string())))?;

    let (res, mut ctx) = if args.runtime {
        wesl::eval_runtime(&expr, &wgsl, bindings, overrides)
    } else {
        wesl::eval_const(&expr, &wgsl)
    };

    let res = res.map_err(|e| {
        Diagnostic::from(e)
            .with_source(args.expr.clone())
            .with_ctx(&ctx)
    });
    let inst = if let Some(sourcemap) = sourcemap {
        res.map_err(|e| wesl::Error::Error(e.with_sourcemap(&sourcemap)))
    } else {
        res.map_err(|e| wesl::Error::Error(e))
    }?;

    let bindings = args
        .bindings
        .iter()
        .map(|b| {
            let inst = ctx.binding(b.group, b.binding).unwrap().clone();
            let buf = inst.read().unwrap().to_buffer(&mut ctx).unwrap();
            Binding {
                group: b.group,
                binding: b.binding,
                kind: b.kind,
                data: buf.into(),
            }
        })
        .collect();

    Ok((inst, bindings))
}

#[wasm_bindgen]
pub fn main(cli: Command) -> Result<JsValue, JsValue> {
    init_log();
    // log::debug!("WESL invoked, {cli:?}");

    let serializer =
        serde_wasm_bindgen::Serializer::new().serialize_large_number_types_as_bigints(true);

    match &cli {
        Command::Check(args) | Command::Parse(args) | Command::Dump(args) => {
            let source = &args.input;

            match &cli {
                Command::Check(_) => source
                    .parse::<TranslationUnit>()
                    .map(|_| ("").serialize(&serializer).unwrap())
                    .map_err(|err| (&err.to_string()).serialize(&serializer).unwrap()),
                Command::Parse(_) => source
                    .parse::<TranslationUnit>()
                    .map(|module| (&module.to_string()).serialize(&serializer).unwrap())
                    .map_err(|err| (&err.to_string()).serialize(&serializer).unwrap()),
                Command::Dump(_) => source
                    .parse::<TranslationUnit>()
                    .map(|module| (&module).serialize(&serializer).unwrap())
                    .map_err(|err| (&err.to_string()).serialize(&serializer).unwrap()),
                _ => unreachable!(),
            }
        }
        Command::Compile(args) => run_compile(args)
            .map(|(module, _)| (&module.to_string()).serialize(&serializer).unwrap())
            .map_err(|err| (&err.to_string()).serialize(&serializer).unwrap()),
        Command::Eval(args) => run_eval(args)
            .map(|(inst, bindings)| {
                (&(inst.to_string(), bindings))
                    .serialize(&serializer)
                    .unwrap()
            })
            .map_err(|err| (&err.to_string()).serialize(&serializer).unwrap()),
    }
}
