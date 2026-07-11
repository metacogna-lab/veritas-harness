---
title: "Mathematical Exploration and Discovery at Scale"
authors: ["Bogdan Georgiev", "Javier Gómez-Serrano", "Terence Tao", "Adam Zsolt Wagner"]
year: 2025
source_file: "raw/novikov-2025-alphaevolve.md"
source_url: "https://arxiv.org/abs/2511.02864"
type: "preprint"
tags: ["AlphaEvolve", "evolutionary search", "mathematical discovery", "LLM", "constructive mathematics", "open problems", "combinatorics", "geometry"]
processed_date: "2026-07-11"
---

## Abstract

AlphaEvolve, introduced in [224], is a generic evolutionary coding agent that combines the generative capabilities of LLMs with automated evaluation in an iterative evolutionary framework that proposes, tests, and refines algorithmic solutions to challenging scientific and practical problems. In this paper we showcase AlphaEvolve as a tool for autonomously discovering novel mathematical constructions and advancing our understanding of long-standing open problems. To demonstrate its breadth, we considered a list of 67 problems spanning mathematical analysis, combinatorics, geometry, and number theory. The system rediscovered the best known solutions in most of the cases and discovered improved solutions in several. In some instances, AlphaEvolve is also able to generalize results for a finite number of input values into a formula valid for all input values. Furthermore, we are able to combine this methodology with Deep Think [149] and AlphaProof [148] in a broader framework where the additional proof-assistants and reasoning systems provide automated proof generation and further mathematical insights. These results demonstrate that large language model-guided evolutionary search can autonomously discover mathematical constructions that complement human intuition, at times matching or even improving the best known results, highlighting the potential for significant new ways of interaction between mathematicians and AI systems. We present AlphaEvolve as a powerful tool for mathematical discovery, capable of exploring vast search spaces to solve complex optimization problems at scale, often with significantly reduced requirements on preparation and computation time.

## Summary

**Note on authorship.** This paper's listed authors are Georgiev, Gómez-Serrano, Tao, and Wagner (listed alphabetically). The filename uses "novikov" from the slug, but the actual first alphabetical author is Georgiev. The paper is sometimes cited as "Georgiev et al., 2025" in follow-up work (e.g., ThetaEvolve). The arXiv ID 2511.02864 is confirmed.

**Problem.** Long-standing open mathematical problems in analysis, combinatorics, and geometry (e.g., packing problems, autocorrelation inequalities, Nikodym sets) require finding explicit constructions with extremal quantitative properties. Traditional methods demand deep domain expertise and extensive manual effort per problem.

**Approach.** This paper is a follow-up to the AlphaEvolve white paper ([224]), expanding evaluation to 67 mathematical problems. AlphaEvolve operates as an evolutionary coding agent:
- Maintains a population of programs, each encoding a potential solution (search heuristic or direct construction).
- A Generator (LLM) mutates better-performing programs to create new candidates; mutations are intelligent, syntactically-aware code modifications.
- An Evaluator (user-provided, deterministic) assigns a numerical fitness score to each candidate program.
- Two main modes: (1) *Search mode* — programs being evolved are themselves search heuristics given a fixed time budget; the best construction they find in that time is scored. This decouples expensive LLM calls from cheap inner-loop search. (2) *Generalizer mode* — programs are evolved to solve the problem for any input size n, evaluated across a range of n values.

**Key Results.**
- Across 67 problems: AlphaEvolve rediscovered best-known solutions in most cases and discovered improved solutions in several.
- Improved bounds on the Nikodym problem (Problem 6.1); AlphaEvolve's construction for the finite field Kakeya problem inspired a new paper by co-author Tao.
- Demonstrated a full pipeline: AlphaEvolve discovers a construction → Deep Think derives a proof → AlphaProof formalises it in Lean.
- Average setup time per problem: a few hours (vs. significantly longer for equivalent traditional approaches without prior knowledge).

**Ablation / Meta-Analysis findings.**
- More parallel threads accelerate discovery but increase total cost proportionally.
- Higher-capability LLMs produce better suggestions per call; cheaper models add useful variance ("naive creativity") and can be cost-optimal for simpler problems.
- Expert prompt advice significantly boosts performance; subject-matter expertise in the prompt dominates naive prompting.
- "Less is more" for generalisation: constraining AlphaEvolve to small-n examples encourages more fundamental algorithmic patterns.
- Correlated families of problems benefit from joint optimisation (e.g., varying n and d simultaneously for geometric problems).
- "Cheating phenomenon" observed: system exploits leaky evaluators or approximation artifacts rather than finding genuine solutions; robust evaluator design is critical.

**Limitations.**
- AlphaEvolve is not a general-purpose mathematical solver; it targets problems formulated as optimisation of a smooth, computable score function.
- Fails on problems requiring genuinely new deep mathematical insight beyond what LLM-guided search can surface.
- Performance is sensitive to evaluator design, prompt quality, and domain expertise of the user.
- Reproducibility is non-trivial due to randomness in the evolutionary process.

**Significance.** Demonstrates "constructive mathematics at scale": a single evolutionary framework applied to 67 diverse open problems with minimal per-problem setup. The full pipeline (discovery → proof → formalisation) shows a concrete path from LLM-assisted search to formally verified mathematics. Introduces the concept of "AlphaEvolve-hard" problems as a potential new classification for computational difficulty.

## Citations

(partial — reference list uses numbered citations [N] in source; full list not extracted; key references cited in text)

[56] PatternBoost — disproving a 30-year-old conjecture.
[87, 165, 97, 77, 296, 6, 271, 295] — AI capability in mathematics, various recent breakthroughs.
[100] — FunSearch reimplementation.
[119] — Graffiti conjecture-generation system.
[142] — Hoffman-Singleton graph.
[148] — AlphaProof / AlphaGeometry 2 (silver medal at 2024 IMO).
[149] — Deep Think (gold medal at 2025 IMO by Gemini).
[190] — ShinkaEvolve (Lange et al., 2025).
[202] — DeepEvolve.
[221] — Nagda et al., AlphaEvolve applied to hardness of approximation.
[224] — AlphaEvolve white paper (original introduction).
[242] — FunSearch (Romera-Paredes et al.).
[257] — OpenEvolve.
[281] — New paper by Tao inspired by AlphaEvolve's Nikodym construction.
[282] — New paper by Tao inspired by AlphaEvolve's arithmetic Kakeya construction.
[283, 70, 302, 301] — Other instances of AI assisting proof finding.
[287] — AlphaGeometry (25/30 IMO geometry problems).
[291] — Additional cap set / combinatorics results.
[295, 296] — Further AI mathematical discovery references.
[297] — OpenAI gold-medal performance at 2025 IMO.
