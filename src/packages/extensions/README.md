#### Note

⚠️ ⚠️ ⚠️ You are viewing the docs for the **next** release, in case you want to check the docs for the stable release, you can view it [here](https://www.npmjs.com/package/@excalidraw/extensions).

### Extensions

Excalidraw extensions to be used in Excalidraw.

### Installation

You can use npm

```
npm install react react-dom @excalidraw/extensions
```

or via yarn

```
yarn add react react-dom @excalidraw/extensions
```

After installation you will see a folder `excalidraw-extensions-assets` and `excalidraw-extensions-assets-dev` in `dist` directory which contains the assets needed for this app in prod and dev mode respectively.

Move the folder `excalidraw-extensions-assets` and `excalidraw-extensions-assets-dev` to the path where your assets are served.

By default it will try to load the files from `https://unpkg.com/@excalidraw/extensions/dist/`

If you want to load assets from a different path you can set a variable `window.EXCALIDRAW_EXTENSIONS_ASSET_PATH` depending on environment (for example if you have different URL's for dev and prod) to the url from where you want to load the assets.

#### Note

**If you don't want to wait for the next stable release and try out the unreleased changes you can use `@excalidraw/extensions@next`.**

### Need help?

Check out the existing [Q&A](https://github.com/excalidraw/excalidraw/discussions?discussions_q=label%3Apackage%3Aextensions). If you have any queries or need help, ask us [here](https://github.com/excalidraw/excalidraw/discussions?discussions_q=label%3Apackage%3Aextensions).

### Development

#### Install the dependencies

```bash
yarn
```
