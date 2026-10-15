# usage-warn

A Claude Code mod that warns as your subscription usage windows fill up.

## Features

- One circle per usage window in use, at the right end of the band above the prompt: green below the start percent, the theme's warning color from it, the error color from the notification percent. Nothing is drawn at 0%. Hover the row for `5h 63% · resets in 1h12m · 100% by 13:40`; click a circle to pin the details open, click again to hide them
- A toast at every step of the 5-hour window from the start percent: 50, 60, 70, 80, 90% by default
- The same for the 7-day window, on its own track, and for any model-scoped weekly window the engine reports (`seven_day_opus` draws as `7d opus`)
- A pace forecast: `on pace for 100% at 13:40` when the current pace runs out before the reset. It uses the last hour of readings, and falls back to the average since the window opened
- A status line under the prompt once past the start: `5h 63% · resets in 1h12m · 100% by 13:40`, refreshed every minute
- A native notification and a chime from 90%
- Each step warns once per window across all sessions (kept in the mod's `$.store`), and a jump from 45% to 73% warns once, at 70%

## Settings

Set in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`.

| Setting | Default | Options |
|---|---|---|
| Start warning at | `50` | `30` `40` `50` `60` `70` `80` |
| Warn every | `10` | `5` `10` `20` |
| Native notification from | `90` | `off` `70` `80` `90` `95` |
| Toast seconds | `8` | `4` `8` `15` `30` |
| Status line | `on` | `on` `off` |
| Usage circles | `on` | `on` `off` |
| Pace forecast | `on` | `on` `off` |
| 7-day window | `on` | `on` `off` |
| Sound | `with notification` | `with notification` `every step` `off` |

## Development

```sh
claude plugin validate ~/.claude/mods/usage-warn
claude plugin test ~/.claude/mods/usage-warn
```
