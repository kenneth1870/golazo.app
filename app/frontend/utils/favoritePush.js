/** Sync a newly followed team to an existing push subscription. */
export async function syncTeamFollowToPush(teamName, { addTeams, subscribed, following }) {
  if (!following || !teamName || !subscribed || !addTeams) return
  await addTeams([teamName])
}
