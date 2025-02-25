# WESL Playground

A web interface to test WESL (WGSL Extended) shaders in the browser.

Website: [wesl.thissma.fr](https://wesl.thissma.fr)

Spec Reference: [wesl-spec](https://github.com/wgsl-tooling-wg/wesl-spec)

Supported Implementations:
* 🟢 [wesl-rs](https://github.com/wgsl-tooling-wg/wesl-rs) (supported)
* 🔴 [wesl-js](https://github.com/wgsl-tooling-wg/wesl-js) (planned #1)
* 🔴 [ncthbrt/mew](https://github.com/ncthbrt/mew) (planned #3)
* 🔴 [naga_oil](https://github.com/bevyengine/naga_oil) (planned #2)

## Building
* For [wesl-rs](https://github.com/wgsl-tooling-wg/wesl-rs): (set the path or git url to crate `wesl` first in `wesl-web/Cargo.toml`, it is not yet available on crates.io).
* Instal: `yarn install`
* Update crate `wesl-web`:
  * release `wasm-pack build wesl-web --release --target web --out-dir ../src/wesl-web`
  * development `wasm-pack build wesl-web --dev --target web --out-dir ../src/wesl-web --features debug`
* Build:
  * release `yarn build`
  * development `yarn dev`

## Contributing

Contributions are welcome. Please join the [discord](https://discord.gg/Ng5FWmHuSv) server and introduce yourself first, or contact via [email](mailto:mathis.brossier@gmail.com).

## License

Except where noted (below and/or in individual files), all code in this repository is dual-licensed under either:

* MIT License ([LICENSE-MIT](LICENSE-MIT) or [http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))
* Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))

at your option.

### Your contributions

Unless you explicitly state otherwise,
any contribution intentionally submitted for inclusion in the work by you,
as defined in the Apache-2.0 license,
shall be dual licensed as above,
without any additional terms or conditions.
