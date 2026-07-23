import { describe, it, expect, vi } from "vitest"
import { matchTeamName } from "./matchTeamName"

vi.mock("../i18n/teamNames", () => ({
  translateTeam: (name) => (name === "México" ? "Mexico" : name),
}))

describe("matchTeamName", () => {
  it("matches exact names case-insensitively", () => {
    expect(matchTeamName("Brazil", "brazil", "en")).toBe(true)
  })

  it("matches translated team names", () => {
    expect(matchTeamName("México", "Mexico", "en")).toBe(true)
  })

  it("returns false when either name is missing", () => {
    expect(matchTeamName(null, "Brazil", "en")).toBe(false)
    expect(matchTeamName("Brazil", "", "en")).toBe(false)
  })

  it("returns false for unrelated teams", () => {
    expect(matchTeamName("Spain", "Brazil", "en")).toBe(false)
  })
})
