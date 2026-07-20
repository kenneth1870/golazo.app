/** URL slug for a club team name — mirrors Rails `String#parameterize`. */
export function clubTeamSlug(name) {
  if (!name) return ""
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function clubTeamPath(code, nameOrSlug) {
  const slug = nameOrSlug?.includes?.("-") && !nameOrSlug.includes(" ")
    ? nameOrSlug
    : clubTeamSlug(nameOrSlug)
  return `/leagues/${code}/teams/${slug}`
}
