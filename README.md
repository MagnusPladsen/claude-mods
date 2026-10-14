# claude-mods

Personal Claude Code mods (function-hook plugins), checked out at `~/.claude/mods/` as a submodule
of the [dotfiles](https://github.com/MagnusPladsen/dotfiles) repo. Loaded in every session via
`CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`.

| Mod | Purpose |
|-----|---------|
| `usage-warn` | Warns at every 10% of the 5-hour and 7-day usage windows from 50%, with a pace forecast, a status line and a notification plus chime at 90% |
| `filetree-collapsible` | Local fork of data-goblin's filetree pane with a collapse-to-strip button |
