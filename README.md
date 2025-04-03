# Authenticated Attributes

This repo contains the initial implementation of the Authenticated Attributes project from The Starling Lab. It is built on top of the [Hyperbee](https://docs.pears.com/building-blocks/hyperbee) key-value store.

It functions both as a library for accessing the database, as well as a server with an HTTP API for the database.
Installing the library as an npm module is not available yet.

## Install

```bash
$ git clone https://github.com/starlinglab/authenticated-attributes
$ cd authenticated-attributes

# Generate private key for signing attributes
$ openssl genpkey -algorithm ED25519 > signing_key.pem

# Create and edit config
# Make sure to set a JWT secret!
$ cp example.env .env
$ nano .env
```

### Docker

For the HTTP server, a Docker container and Docker Compose file are available.

1. Download [docker-compose.yml](./docker-compose.yml) to your server
2. Generate a signing key as described above or in the compose file
3. Edit the JWT secret in the compose file
4. Run `docker compose up -d`

## Development

After cloning the repo, run `npm install` to install dependencies. Enable pre-commit hooks with `git config core.hooksPath .githooks`. Now you should be ready to make code changes, and formatting and linting will happen automatically before committing.

Using NodeJS v20 LTS is recommended over the latest NodeJS version.

## Documentation

Please see the [docs](./docs/) folder for further documentation on the project. [database.md](./docs/database.md) is a good starting point.

## License

Authenticated Attributes is under the MIT license, see [LICENSE](./LICENSE) for details.
