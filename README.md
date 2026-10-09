# anthers-obsidian

The publishing server for [Anthers' public wiki](https://anthers.wiki) — a self-hosted,
Obsidian-faithful reader that serves a live, synced copy of the [Anthers-Wiki](https://github.com/anthers-inc/anthers) vault: the documentation, the roadmap and the public task board, rendered the way Obsidian renders them.

Anthers is a nonprofit platform for creative work — games, video, music, writing, comics, software — where a reader's monthly support reaches the creator with nothing taken by the platform. Running its own planning in the open is a deliberate commitment: the same pages that explain Anthers to you are the ones its own people work from, and this server is how they reach the web.

## What it does

- Serves the vault over a location-based publish boundary, **failing closed** — an unpublished path answers the same 404 a missing file gets, and never confirms it exists. The boundary (which folders publish, and the one allowlisted `.base` file) is Anthers' shape by default and env-overridable for any other operator.
- Renders Obsidian-flavored markdown faithfully: wikilinks with shortest-path resolution and aliases, callouts, note and image embeds, footnotes, math, frontmatter properties.
- Renders **Obsidian Bases** (`.base` files) and **Canvas** (`.canvas` files), including Bases formula evaluation — the surfaces most static publishers cannot show.
- Full-text search (MiniSearch), a link graph with backlinks, and a file tree, all built from the same parsed vault.

The intended deployment reads a **synced copy** of the vault — files land by sync and the server watches and re-indexes; the vault on the authoring machines remains the only source. The server never writes to the vault.

## Running it

Requires [Bun](https://bun.sh).

```shell
bun install
bun run build           # build the frontend into ./build
VAULT_PATH=/path/to/vault bun run src/server/index.ts
```

Development:

```shell
bun run dev:server      # API with watch
bun run dev:client      # frontend dev server
bun run typecheck
```

### Configuration

| Variable | Default | What it is |
| --- | --- | --- |
| `VAULT_PATH` | `./vault` | The vault directory to serve (read-only; writes are never made) |
| `PORT` | `3000` | Listen port |
| `HIDE_FOLDERS` | `.obsidian,.git,.trash,.stversions,.stfolder,.claude,.venv` | Dot-machinery never shown, independent of the publish boundary |
| `PUBLISH_EXCLUDE` | `Internal Wiki,90-99 Agents,00-09 Metafiles` | Vault-relative directory prefixes that never publish |
| `PUBLISH_INCLUDE` | `00-09 Metafiles/01 Tasks` | Prefixes that publish despite an excluded ancestor (strictly-longer wins) |
| `PUBLISH_BASE_FILES` | `Anthers Tasks.base` | The only `.base` files served — a base enumerates, so none publishes unlisted |

The boundary defaults are Anthers' publish decision — everything outside those roots publishes. Another operator publishing from this server states their own boundary in the environment rather than inheriting ours.

## Deploying the stack

The deployment unit is a **droplet running compose** — deliberately not a platform-specific app shape, because this server is a standalone thing: whoever runs it (Anthers on a DigitalOcean droplet, or you on any box with Docker) runs the same three containers.

```text
  ┌────────────┐   sync    ┌─────────────────┐   read-only   ┌──────────────┐
  │ your vault  │ ────────→ │ syncthing       │ ────────────→ │ the server   │
│ (authoring)  │  22000    │ (pull-only copy) │   /vault:ro  │ + Caddy :443 │
  └────────────┘           └─────────────────┘               └──────────────┘
```

The server reads its vault copy **through a read-only bind mount** and has no write path into it by design; the sync engine is the only service with an inbound data path; and the sync engine's GUI is bound to the host's loopback only, so pairing happens over an SSH tunnel (`make tunnel`), never a public port.

Standing one up on a fresh machine:

```sh
git clone https://github.com/anthers-inc/anthers-obsidian
cd anthers-obsidian
sudo ./scripts/setup.sh wiki.example.org   # lays out /srv/anthers-obsidian, fills obsidian.env
```

The script stops there and asks for three things by hand — DNS for the hostname, the sync ignore list (`vault-sync-ignore.example`) placed in the vault folder, and pairing your authoring machine through `make tunnel` with the shared folder set **Send Only** on the authoring side. Then `make up`, and `scripts/verify-deploy.sh` afterward: it checks health, TLS, the page render, and — deliberately — that an excluded path answers the same 404 a missing file gets, through the public door, because a boundary that answers 403 is a boundary that leaks existence.

The pinned image for a pull-based deploy is `ghcr.io/anthers-inc/anthers-obsidian` (published on tag); `make pull` updates the stack to the pinned versions without rebuilding.

## License

Apache-2.0 — see [LICENSE](LICENSE).