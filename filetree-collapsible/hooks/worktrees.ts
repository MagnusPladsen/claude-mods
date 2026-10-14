export type Worktree = { path: string; branch: string; detached: boolean }

// Reads `git worktree list --porcelain`: one block per worktree, a blank line between them. Bare
// repositories have no files to show, so they are left out.
export function parseWorktrees(out: string): Worktree[] {
  const list: Worktree[] = []
  for (const block of out.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean)
    const path = lines.find(l => l.startsWith('worktree '))?.slice('worktree '.length)
    if (!path || lines.includes('bare')) continue
    const ref = lines.find(l => l.startsWith('branch '))?.slice('branch '.length) ?? ''
    list.push({ path: path.replace(/\\/g, '/'), branch: ref.replace(/^refs\/heads\//, ''), detached: lines.includes('detached') })
  }
  return list
}
