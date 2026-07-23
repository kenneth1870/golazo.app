import { describe, it, expect, beforeEach } from "vitest"
import { claimPrompt, releasePrompt, isPromptBlocked } from "./promptCoordinator"

describe("promptCoordinator", () => {
  beforeEach(() => {
    releasePrompt("install")
    releasePrompt("ios-install")
    releasePrompt("onboarding")
  })

  it("allows first prompt to claim", () => {
    expect(claimPrompt("install")).toBe(true)
    expect(isPromptBlocked("install")).toBe(false)
    expect(isPromptBlocked("ios-install")).toBe(true)
  })

  it("blocks competing prompts until release", () => {
    claimPrompt("install")
    expect(claimPrompt("ios-install")).toBe(false)
    releasePrompt("install")
    expect(claimPrompt("ios-install")).toBe(true)
  })

  it("ignores release from non-active prompt", () => {
    claimPrompt("install")
    releasePrompt("ios-install")
    expect(isPromptBlocked("ios-install")).toBe(true)
  })
})
