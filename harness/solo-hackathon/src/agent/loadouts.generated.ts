// GENERATED from HarnessSpec "solo-hackathon" (veritas-v0.2 H-4). Edit the spec, not this file.
// Consumed by src/agent/loadouts.ts → fromGeneratedLoadout → LoadoutRegistry.

export const generatedLoadouts = [
  {
    name: "solo-hackathon",
    adapter: "path",
    toolNames: ["read_file"],
    specialists: [
      { role: "facilitator", focus: "Guide a single-person hackathon: frame the problem, constraints, and success criteria (Step 1), then keep the run on rails." },
      { role: "scout", focus: "Survey existing code, docs, and constraints inside scope before the build sprint." },
      { role: "builder", focus: "Translate the framed problem into the smallest shippable vertical slice." }
    ],
  }
] as const;

export const scopeDefaults = {"hosts":[],"paths":["."]} as const;
