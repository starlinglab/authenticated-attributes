# Authenticated Attributes

This repo contains the initial implementation of the Authenticated Attributes project from The Starling Lab. It is built on top of the [Hyperbee](https://docs.pears.com/building-blocks/hyperbee) key-value store.

This repo also contains a specific frontend for Authenticated Attributes, designed to work within the asset management system [Uwazi](https://uwazi.io/).

## Repo Structure

```
authenticated-attributes
│
├── hyperbee          // Backend code
│   ├── demo-get.js   // Some demo scripts
│   ├── demo.js
│   ├── test-cbor.js
│   ├── import.js     // ZIP import script
│   ├── src           // Code for using db
│   │   └── ...
│   ├── server.js     // CRUD webserver for db
│   └── example.env   // Example server config
│
├── uwazi                 // Frontend code
│   ├── metadata-manager  // Backend script for managing Uwazi metadata
│   │   └── ...
│   └── entity-page       // Custom UI for Uwazi files to see metadata
│       ├── sw.js         // Service worker for WACZ embedding on Uwazi
│       └── ...           // Svelte files
└── docs
    └── ...               // Project documentation
```

## Development

After cloning the repo, enter `hyperbee` and `uwazi/entity-page`, and run `npm install` in each to install dependencies. Enable pre-commit hooks with `git config core.hooksPath .githooks`. Now you should be ready to make code changes, and formatting and linting will happen automatically before committing.

Using NodeJS v20 LTS is recommended over the latest NodeJS version.

## Documentation

Please see the [docs](./docs/) folder for further documentation on the project. [database.md](./docs/database.md) is a good starting point.

## License

Authenticated Attributes is under the MIT license, see [LICENSE](./LICENSE) for details.
