/** Sync followed teams/leagues to an existing push subscription. */
export async function syncFavoriteToPush(item, { addTeams, addLeagues, removeTeams, removeLeagues, subscribed, following }) {
  if (!subscribed || !item) return

  if (item.type === "team" && item.name) {
    if (following) await addTeams([item.name])
    else await removeTeams([item.name])
    return
  }

  if (item.type === "competition") {
    const code = item.code || item.id
    if (!code) return
    if (following) await addLeagues([code])
    else await removeLeagues([code])
  }
}

/** @deprecated use syncFavoriteToPush */
export async function syncTeamFollowToPush(teamName, opts) {
  return syncFavoriteToPush(
    { type: "team", name: teamName },
    { ...opts, following: opts.following }
  )
}
