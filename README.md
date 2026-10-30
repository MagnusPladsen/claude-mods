# claude-mods

Personal Claude Code mods (function-hook plugins), checked out at `~/.claude/mods/` as a submodule
of the [dotfiles](https://github.com/MagnusPladsen/dotfiles) repo.

No mods are kept here at the moment. `usage-warn` and `filetree-collapsible` were removed; they are in
the git history.

## Adding a mod

Put each mod in its own folder containing `.claude-plugin/plugin.json`, then load it by adding the
folder to `env.CLAUDE_CODE_PLUGIN_DIRS` (colon-separated) in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/<mod-folder>"
  }
}
```

Restart Claude Code. Mods hot-reload on save after that. Update with `git -C ~/.claude/mods pull`.
