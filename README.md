# claude-mods

Personal Claude Code mods (function-hook plugins), checked out at `~/.claude/mods/` as a submodule
of the [dotfiles](https://github.com/MagnusPladsen/dotfiles) repo. Loaded in every session via
`CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`.

| Mod | Purpose |
|-----|---------|
| `usage-warn` | Warns at every 10% of the 5-hour and 7-day usage windows from 50%, with a pace forecast, a status line and a notification plus chime at 90% |
| `filetree-collapsible` | Local fork of data-goblin's filetree pane with a collapse-to-strip button |

Each mod folder is a self-contained plugin. `filetree-collapsible/README.md` is the upstream README;
its marketplace install steps install upstream, not this fork. Use the steps below instead.

## Install

### Easiest: paste this into Claude Code

```text
Install my Claude Code mods from the public GitHub repo MagnusPladsen/claude-mods into ~/.claude/mods and load them in every session.

1. If ~/.claude/mods is already a git repo or a submodule of my dotfiles repo (~/.dotfiles, used as `git --git-dir=$HOME/.dotfiles --work-tree=$HOME`), pull or run `submodule update --init .claude/mods`. Otherwise clone https://github.com/MagnusPladsen/claude-mods.git there. If the folder exists with other content, back it up to ~/.claude/mods.bak-<timestamp> first and ask me before overwriting anything.
2. In ~/.claude/settings.json, set `env.CLAUDE_CODE_PLUGIN_DIRS` to a colon-separated list with one entry per mod folder (each folder containing `.claude-plugin/plugin.json`), e.g. `~/.claude/mods/usage-warn:~/.claude/mods/filetree-collapsible`. Keep any other entries already there, and don't touch other settings. Show me the diff before saving.
3. Never push.
4. When done, list the installed mods and tell me to restart Claude Code so they load.
```

### Manual

```bash
# Fresh machine with the dotfiles repo (settings.json already loads the mods)
dotfiles submodule update --init .claude/mods

# Standalone
git clone https://github.com/MagnusPladsen/claude-mods.git ~/.claude/mods
```

Then add the mods to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/usage-warn:~/.claude/mods/filetree-collapsible"
  }
}
```

Restart Claude Code. Mods hot-reload on save after that. Update with `git -C ~/.claude/mods pull`.
