import wesl from "./wesl-web/wesl_web";
// import ansiHTML from "ansi-html"

// const $run = document.querySelector("#btn-run")
// const $input = document.querySelector("#input")
// const $output = document.querySelector("#output")
// let selected = "main.wgsl"

// const options: Command = {
//   command: "Compile",
//   files: new Map([
//     ["main.wgsl", "import util/my_fn;\nfn main() -> u32 {\n    return my_fn();\n}\n"],
//     ["util.wgsl", "fn my_fn() -> u32 { return 42; }"],
//   ]),
//   root: "main.wgsl",
//   mangler: "Escape",
//   sourcemap: true,
//   imports: true,
//   cond_comp: true,
//   generics: false,
//   strip: true,
//   lower: true,
//   validate: true,
//   entry_points: [],
//   enable_features: [],
//   disable_features: [],
// }

// function run_wesl() {
//   console.log("compiling with options", options)
//   const res = wesl.main(options)
//   $output.innerHTML = ansiHTML(res)
// }

// // function select(sel: string) {
// //   options.files[selected] = $input.textContent
// //   selected = sel
// //   $input.textContent = options.files[selected]
// // }

function init() {
  // console.log(wesl)
  // $run.addEventListener('click', run_wesl)
  // $input.textContent = options.files[selected]
}

wesl().then(init)
