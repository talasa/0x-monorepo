## @0xproject/react-docs

A full-page React component for rendering beautiful documentation for Solidity and Typescript code generated with [TypeDoc](http://typedoc.org/) or [Doxity](https://github.com/0xproject/doxity). See a [live example](http://react-docs-example.s3-website-us-east-1.amazonaws.com/).

<div style="text-align: center;">
<img src="https://s3.eu-west-2.amazonaws.com/0x-wiki-images/screenshot.png" style="padding-bottom: 20px; padding-top: 20px;" width="80%" />
<div>react-docs generating 0x's smart contract docs</div>
</div>

#### Features

*   Mobile optimized
*   Reads Javadoc-style comments in your code to generate class/method/argument/return/type comments.
*   Syntax highlighting support for TypeScript & Solidity
*   Type declaration linking
*   Type declaration popovers to avoid clicking through to the definition
*   Section/method/type anchors for easily pointing others to a specific part of your docs.
*   Version picker
*   Customizable sidebar header
*   Supports custom markdown sections so you can easily add an intro or installation instructions.

## Installation

```bash
yarn add @0xproject/react-docs
```

## Usage

View the [live example](http://react-docs-example.s3-website-us-east-1.amazonaws.com/) that renders the [@0xproject/web3-wrapper](https://github.com/0xProject/0x-monorepo/tree/development/packages/web3-wrapper) Typescript package. It's source code is in the [react-docs-example](https://github.com/0xProject/0x-monorepo/tree/development/packages/react-docs-example) 0x monorepo subpackage.

This package exposes both a single `Documentation` react component that will render a docs page, as well as all of it's sub-components in case someone wants to build their own layout.

Currently this package still has some external dependencies outside of the `Documentation` component, so please start your project off by copying the [react-docs-example](https://github.com/0xProject/0x-monorepo/tree/development/packages/react-docs-example) directory and modifying it there. If you need changes in the [react-docs](https://github.com/0xProject/0x-monorepo/tree/development/packages/react-docs) package, fork the 0x monorepo, make the required changes and submit a PR. Until we merge it, you can have your project depend on your own custom fork.

If your project is in [TypeScript](https://www.typescriptlang.org/), add the following to your `tsconfig.json`:

```json
"compilerOptions": {
    "typeRoots": ["node_modules/@0xproject/typescript-typings/types", "node_modules/@types"],
}
```

## Future improvements

Feel free to contribute to these improvements!

*   Allow user to pass in styling for all major elements similar to [Material-UI](http://www.material-ui.com/).
*   Allow user to define an alternative font and have it change everywhere.
*   Add source links to Solidity docs (currently unsupported by Doxity).

## Contributing

We welcome improvements and fixes from the wider community! To report bugs within this package, please create an issue in this repository.

Please read our [contribution guidelines](../../CONTRIBUTING.md) before getting started.

### Install dependencies

If you don't have yarn workspaces enabled (Yarn < v1.0) - enable them:

```bash
yarn config set workspaces-experimental true
```

Then install dependencies

```bash
yarn install
```

### Build

If this is your **first** time building this package, you must first build **all** packages within the monorepo. This is because packages that depend on other packages located inside this monorepo are symlinked when run from **within** the monorepo. This allows you to make changes across multiple packages without first publishing dependent packages to NPM. To build all packages, run the following from the monorepo root directory:

```bash
yarn lerna:rebuild
```

Or continuously rebuild on change:

```bash
yarn dev
```

You can also build this specific package by running the following from within its directory:

```bash
yarn build
```

or continuously rebuild on change:

```bash
yarn build:watch
```

### Clean

```bash
yarn clean
```

### Lint

```bash
yarn lint
```
