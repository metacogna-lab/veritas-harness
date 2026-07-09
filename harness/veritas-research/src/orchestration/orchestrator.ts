/**
 * Multi-model decomposition orchestrator — invariant #7: HONEST decomposition.
 *
 * This is a WORKLOAD-decomposition pattern and nothing else: it splits a large
 * objective into independent subtasks, runs them on worker agents (optionally
 * cheaper models) with bounded concurrency and a per-worker token budget, and
 * synthesizes the results over rounds with accumulated knowledge.
 *
 * The hard boundary (enforced in code AND by test, not just review): every
 * worker prompt carries the FULL, TRUTHFUL parent objective and a complete
 * description of its subtask. The orchestrator must never construct a worker
 * prompt that omits or obscures the parent objective's intent to route around a
 * worker model's own safety behavior. `buildWorkerPrompt` makes the parent
 * objective structurally unavoidable; `validateSubtasks` rejects empty/obscured
 * subtask descriptions.
 */
import type { LLMBackbone } from "../llm/index.ts";
import { parseLastArray, parseLastObject } from "../parse/json.ts";

export interface Subtask {
  id: string;
  /** A complete, truthful description of the subtask. Never empty. */
  description: string;
}

export interface WorkerResult {
  id: string;
  description: string;
  output: string;
  prompt: string;
}

export interface OrchestratorOptions {
  /** Decomposer + synthesizer model. */
  llm: LLMBackbone;
  /** Worker model (optionally cheaper). Defaults to `llm`. */
  workerLLM?: LLMBackbone;
  maxConcurrency?: number;
  maxRounds?: number;
  /** Approx character budget for the packed context handed to each worker. */
  tokenBudgetChars?: number;
}

export interface OrchestratorResult {
  answer: string;
  rounds: number;
  workerResults: WorkerResult[];
}

/**
 * Reject any decomposition that hides a subtask's real shape. An empty or
 * whitespace-only description is treated as obscuring intent and fails loudly.
 */
export function validateSubtasks(subtasks: Subtask[]): void {
  for (const s of subtasks) {
    if (!s.description || s.description.trim().length === 0) {
      throw new Error(`DISHONEST DECOMPOSITION: subtask "${s.id}" has an empty description`);
    }
  }
}

/** Truncate accumulated context to a character budget (cheap token proxy). */
export function packContext(text: string, budgetChars: number): string {
  if (text.length <= budgetChars) return text;
  return `${text.slice(0, budgetChars)}\n...[context packed to ${budgetChars} chars]`;
}

/**
 * Build a worker prompt. The parent objective is ALWAYS embedded, labeled as
 * the real goal the subtask serves — this is the honest-decomposition guarantee.
 */
export function buildWorkerPrompt(
  parentObjective: string,
  subtask: Subtask,
  accumulatedKnowledge: string,
  budgetChars: number,
): string {
  const packed = packContext(accumulatedKnowledge, budgetChars);
  return (
    `PARENT OBJECTIVE (the full, real goal this subtask serves):\n${parentObjective}\n\n` +
    `YOUR SUBTASK:\n${subtask.description}\n\n` +
    `KNOWN SO FAR:\n${packed || "(nothing yet)"}`
  );
}

/** Run `worker` over `items` with at most `limit` in flight at once. */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
  return results;
}

export class Orchestrator {
  private readonly llm: LLMBackbone;
  private readonly workerLLM: LLMBackbone;
  private readonly maxConcurrency: number;
  private readonly maxRounds: number;
  private readonly budgetChars: number;

  constructor(opts: OrchestratorOptions) {
    this.llm = opts.llm;
    this.workerLLM = opts.workerLLM ?? opts.llm;
    this.maxConcurrency = opts.maxConcurrency ?? 4;
    this.maxRounds = opts.maxRounds ?? 1;
    this.budgetChars = opts.tokenBudgetChars ?? 4000;
  }

  /** Ask the master model to decompose the objective into subtasks. */
  async decompose(objective: string): Promise<Subtask[]> {
    const completion = await this.llm.complete({
      system:
        "Decompose the objective into independent subtasks. Reply with a JSON array of " +
        'objects: [{"description":"<complete, truthful description of the subtask>"}]. ' +
        "Each description must fully and honestly state what the subtask is for.",
      messages: [{ role: "user", content: `OBJECTIVE:\n${objective}` }],
      temperature: 0,
    });
    const arr = parseLastArray(completion.text) ?? [];
    const subtasks: Subtask[] = arr.map((raw, i) => ({
      id: `st-${i}`,
      description: typeof (raw as { description?: unknown })?.description === "string" ? (raw as { description: string }).description : "",
    }));
    validateSubtasks(subtasks);
    return subtasks;
  }

  private async runWorker(objective: string, subtask: Subtask, knowledge: string): Promise<WorkerResult> {
    const prompt = buildWorkerPrompt(objective, subtask, knowledge, this.budgetChars);
    const completion = await this.workerLLM.complete({
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });
    return { id: subtask.id, description: subtask.description, output: completion.text, prompt };
  }

  async run(objective: string, providedSubtasks?: Subtask[]): Promise<OrchestratorResult> {
    const subtasks = providedSubtasks ?? (await this.decompose(objective));
    if (providedSubtasks) validateSubtasks(providedSubtasks);

    let knowledge = "";
    let answer = "";
    let round = 0;
    let allWorkerResults: WorkerResult[] = [];

    while (round < this.maxRounds) {
      round++;
      const workerResults = await runPool(subtasks, this.maxConcurrency, (st) =>
        this.runWorker(objective, st, knowledge),
      );
      allWorkerResults = workerResults;

      const synthesis = await this.synthesize(objective, workerResults, knowledge);
      answer = synthesis.answer;
      knowledge = synthesis.knowledge;
      if (synthesis.done) break;
    }

    return { answer, rounds: round, workerResults: allWorkerResults };
  }

  private async synthesize(
    objective: string,
    workerResults: WorkerResult[],
    priorKnowledge: string,
  ): Promise<{ done: boolean; answer: string; knowledge: string }> {
    const body = workerResults.map((w) => `## ${w.id}: ${w.description}\n${w.output}`).join("\n\n");
    const completion = await this.llm.complete({
      system:
        "Synthesize the worker results into a single answer for the objective. Reply with a " +
        'JSON object: {"done":true|false,"answer":"<current best answer>","knowledge":"<accumulated notes for the next round>"}.',
      messages: [
        {
          role: "user",
          content: `OBJECTIVE:\n${objective}\n\nPRIOR KNOWLEDGE:\n${packContext(priorKnowledge, this.budgetChars)}\n\nWORKER RESULTS:\n${body}`,
        },
      ],
      temperature: 0,
    });
    const obj = parseLastObject(completion.text) ?? {};
    return {
      done: obj.done === true,
      answer: typeof obj.answer === "string" ? obj.answer : "",
      knowledge: typeof obj.knowledge === "string" ? obj.knowledge : priorKnowledge,
    };
  }
}
