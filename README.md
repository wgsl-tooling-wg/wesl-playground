# WESL Playground

A web interface to test WESL (WGSL Extended) shaders in the browser.

Website: [wesl.thissma.fr](https://wesl.thissma.fr)

WESL Implementations: [k2d222/wgsl-tools](https://github.com/k2d222/wgsl-tools) and [ncthbrt/mew](https://github.com/ncthbrt/mew)

Spec Reference: [wesl-spec](https://github.com/wgsl-tooling-wg/wesl-spec)

## Contributing
* Installing: `yarn install`
* Building:
  * release `yarn build`
  * development `yarn dev`
* Updating crate `wesl-web`:
  * release `wasm-pack build wesl-web --release --target web --out-dir ../src/wesl-web`
  * development `wasm-pack build wesl-web --dev --target web --out-dir ../src/wesl-web --features debug`
