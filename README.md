# DrawTabDataExplorer

A read-only browser for the [DrawTabData](https://github.com/TheSevenPens/DrawTabData)
dataset — drawing tablets, pens, families, brands, drivers, and related
metadata.

Live site: <https://thesevenpens.github.io/DrawTabDataExplorer/>

## Documentation

- [User manual](docs/USERMANUAL.md) — what's in the app and how to use it.
- [Architecture](docs/ARCHITECTURE.md) — project layout and components.
- [CLAUDE.md](CLAUDE.md) — developer notes (setup, adding a brand, the
  submodule workflow).

## Setup

```bash
git clone --recurse-submodules https://github.com/TheSevenPens/DrawTabDataExplorer.git
cd DrawTabDataExplorer
npm install
npm run dev
```

`npm install` runs the postinstall hook that creates the static-data
symlinks; if that step is skipped or the data submodule isn't checked
out yet, run `git submodule update --init --recursive` followed by
`npm run setup-static`.
