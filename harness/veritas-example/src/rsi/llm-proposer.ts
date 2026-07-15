/**
 * LLM-backed RSI proposer — injects ILLMBackbone; still dry-run / human-release
 * gated. Never applies edits to disk (invariant #5).
 */
import { parseLastObject } from "../parse/json.ts";
import type { ILLMBackbone } from "../llm/types.ts";
import type { HarnessEditProposal, ProposalContext } from "./types.ts";
import type { Proposer } from "./proposal.ts";

interface ProposerJson {
  targetPath?: string;
  description?: string;
  diff?: string;
  rationale?: string;
}

/** Build a Proposer that asks the model for a bounded JSON edit proposal. */
export function createLlmProposer(llm: ILLMBackbone): Proposer {
  return async (ctx: ProposalContext): Promise<HarnessEditProposal> => {
    const surfaces = ctx.editableSurfaces.map((s) => `- ${s.path}: ${s.rationale}`).join("\n");
    const advisory = ctx.priorLessonContext ? `\nPrior lessons (advisory only):\n${ctx.priorLessonContext}\n` : "";
    const prompt =
      `${ctx.honestTaskDescription}\n\nEditable surfaces:\n${surfaces}\n${advisory}\n` +
      `Respond with a single JSON object only:\n` +
      `{"targetPath":"<one of the editable paths>","description":"...","diff":"unified diff or stub","rationale":"..."}\n`;

    const result = await llm.complete({
      system:
        "You propose bounded harness repairs. Be honest about the objective. " +
        "Only propose edits to declared editable surfaces. Output JSON only.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const parsed = parseLastObject(result.text) as ProposerJson | undefined;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("llm proposer: could not parse JSON proposal from model output");
    }
    const targetPath = typeof parsed.targetPath === "string" ? parsed.targetPath : ctx.editableSurfaces[0]!.path;
    return {
      id: `llm-${ctx.pattern.id}-${Date.now()}`,
      patternId: ctx.pattern.id,
      targetPath,
      description: typeof parsed.description === "string" ? parsed.description : `Address ${ctx.pattern.signature}`,
      diff: typeof parsed.diff === "string" ? parsed.diff : "(empty diff — human must author the real patch)",
      rationale:
        typeof parsed.rationale === "string"
          ? parsed.rationale
          : "LLM-proposed candidate; human review required before apply",
    };
  };
}
