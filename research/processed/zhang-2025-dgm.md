---
title: "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents"
authors: ["Jenny Zhang", "Shengran Hu", "Cong Lu", "Robert Lange", "Jeff Clune"]
year: 2025
source_file: "raw/zhang-2025-dgm.md"
source_url: "https://arxiv.org/abs/2505.22954"
type: "paper"
tags: ["self-improvement", "open-endedness", "coding agents", "RSI", "evolutionary algorithms", "meta-learning", "agentic AI"]
processed_date: "2026-07-11"
---

## Abstract

Most of today's AI systems are constrained by human-designed, fixed architectures and cannot autonomously and continuously improve themselves. The scientific method, on the other hand, is a cumulative and open-ended system, where each innovation builds upon previous artifacts, enabling future discoveries. There is growing hope that the current manual process of advancing AI could itself be automated. If done safely, such automation would accelerate AI development and allow us to reap its benefits much sooner. This prospect raises the question of how AI systems can endlessly improve themselves while getting better at solving relevant problems. Meta-learning can automate the discovery of novel algorithms, but is limited by first-order improvements and the human design of a suitable search space. The Gödel machine (Schmidhuber, 2007) proposed a theoretical alternative: a self-improving AI that repeatedly modifies itself in a provably beneficial manner. Unfortunately, proving that most changes are net beneficial is impossible in practice. We introduce the Darwin Gödel Machine (DGM), a novel self-improving system that iteratively modifies its own code (thereby also improving its ability to modify its own codebase) and empirically validates each change using coding benchmarks. Inspired by Darwinian evolution and open-endedness research, the DGM grows an archive of generated coding agents. It samples agents from this archive, which self-modify to create new, interesting versions of themselves. This open-ended exploration forms a growing tree of diverse, high-quality agents and allows the parallel exploration of many different paths through the search space. Empirically, the DGM automatically improves its coding capabilities (e.g., better code editing tools, long-context window management, peer-review mechanisms), increasing performance on SWE-bench from 20.0% to 50.0%, and on Polyglot from 14.2% to 30.7%. Furthermore, the DGM significantly outperforms baselines without self-improvement or open-ended exploration. All experiments were done with safety precautions (e.g., sandboxing, human oversight). Overall, the DGM represents a significant step toward self-improving AI, capable of gathering its own stepping stones along a path that unfolds into endless innovation. All code is open-sourced at https://github.com/jennyzzt/dgm.

## Summary

**Problem.** Existing AI systems rely on human-designed, fixed architectures. Each advancement in AI still requires heavy human intervention. The theoretical Gödel Machine (Schmidhuber, 2007) proposed provably beneficial self-modification, but in practice proving that a code change is net beneficial is intractable. Existing meta-learning approaches like ADAS use a fixed meta-agent and do not close the self-referential loop.

**Approach.** The Darwin Gödel Machine (DGM) relaxes the proof requirement by replacing formal verification with empirical benchmark validation. The system maintains an archive of coding agents (initialised with one base agent). In each iteration: (1) a parent agent is selected from the archive with probability proportional to performance and inversely proportional to number of existing children; (2) the selected agent reads its own evaluation logs, proposes a feature to implement, then modifies its own Python codebase to produce a child agent; (3) the child is evaluated on a coding benchmark (SWE-bench or Polyglot); (4) agents that retain basic codebase-editing ability are added to the archive; all others are discarded. The archive serves as an open-ended population of stepping stones — branching from suboptimal agents is explicitly permitted, enabling escape from local optima.

**Key Results.**
- On SWE-bench Verified, DGM improves from 20.0% to 50.0% over 80 iterations, comparable to the checked open-source state-of-the-art.
- On Polyglot (full benchmark), DGM improves from 14.2% to 30.7%, surpassing the Aider baseline (a year of human expert development).
- DGM outperforms both ablation baselines: DGM without self-improvement (fixed meta-agent; gains taper early) and DGM without open-ended exploration (no archive; catastrophic forgetting of useful intermediate agents).
- Discovered improvements transfer across foundation models (Claude 3.5 Sonnet → Claude 3.7 Sonnet, o3-mini), across benchmarks (SWE-bench ↔ Polyglot zero-shot), and across programming languages (Python → C++/Rust).
- Specific discovered innovations: finer-grained file viewing by line, string-replacement editing, multiple-attempt workflows with FM-based ranking, history-aware patch generation.

**Safety Discussion.** All agent execution and self-modification ran inside isolated sandboxed environments with strict time limits. The self-modification scope is restricted to the agent's own Python codebase. A full auditable archive lineage is maintained. No harmful or malicious behavior was observed. The authors note self-improvement could in principle be directed toward safety and interpretability if those were included in evaluation criteria.

**Limitations.**
- DGM still falls short of closed-source SoTA SWE-bench solutions.
- A single DGM run on SWE-bench takes ~2 weeks with significant API costs.
- The open-ended exploration process (archive maintenance, parent selection) is fixed and not itself modifiable by DGM — left as future work.
- Self-improvement is limited to agent design (prompts, tools, workflows); retraining the underlying foundation model is not yet addressed.
- Performance gains are benchmark-dependent; benchmarks may not capture all desired agent properties (robustness, interpretability, safety).

**Significance.** DGM is the first system powered by frozen foundation models that closes the self-referential self-improvement loop with open-ended exploration, demonstrating that downstream coding task performance directly measures and improves self-modification ability. It operationalises the long-theorised Gödel Machine concept without requiring formal proofs.

## Citations

(partial — first ~30 references; full list in source PDF, arXiv:2505.22954)

Fuma Aki et al. Llm-poet: Evolving complex environments using large language models. GECCO Companion, 2024.
Rajeev Alur et al. Search-based program synthesis. CACM, 61(12):84–93, 2018.
S-I Amari. Learning patterns and pattern sequences by self-organizing nets. IEEE Trans. Computers, 1972.
Marcin Andrychowicz et al. Hindsight experience replay. NeurIPS 30, 2017.
Anthropic. Claude 3.5 Sonnet, June 2024a.
Anthropic. Claude can now use tools, May 2024b.
Anthropic. Claude 3.7 Sonnet and Claude Code, February 2025.
Usman Anwar et al. Foundational challenges in assuring alignment and safety of large language models. arXiv:2404.09932, 2024.
Dzmitry Bahdanau et al. Neural machine translation by jointly learning to align and translate. ICLR, 2015.
Yuntao Bai et al. Constitutional AI: Harmlessness from AI feedback. arXiv:2212.08073, 2022.
Yoshua Bengio et al. Managing extreme AI risks amid rapid progress. Science, 384(6698):842–845, 2024.
N Bostrom. Existential Risks. Journal of Evolution and Technology, 9, 2002.
Nick Bostrom. Ethical issues in advanced artificial intelligence. Machine Ethics and Robot Ethics, pp. 69–75, 2020.
Herbie Bradley et al. Quality-diversity through AI feedback. ICLR 2024.
Tom Brown et al. Language models are few-shot learners. NeurIPS 33:1877–1901, 2020.
Jake Bruce et al. Genie: Generative interactive environments. ICML 2024.
Ruisheng Cao et al. Spider2-v: How far are multimodal agents from automating data science workflows? NeurIPS 37, 2024.
Banghao Chen et al. Unleashing the potential of prompt engineering in large language models. arXiv:2310.14735, 2023.
Ching-An Cheng et al. Trace is the next autodiff. NeurIPS 37, 2024.
Jeff Clune. AI-GAs: AI-generating algorithms. arXiv:1905.10985, 2019.
Cédric Colas et al. Curious: intrinsically motivated modular multi-goal RL. ICML, 2019.
Cédric Colas et al. Language and culture internalization for human-like autotelic AI. Nature Machine Intelligence, 2022a.
Cédric Colas et al. Autotelic agents with intrinsically motivated goal-conditioned RL: a short survey. JAIR, 2022b.
Cédric Colas et al. Augmenting autotelic agents with large language models. CoLLAs, 2023.
Charles Darwin. Origin of the species. Routledge, 2023.
Richard Dawkins. The evolution of evolvability. In Artificial life. Routledge, 2019.
Michael Dennis et al. Emergent complexity and zero-shot transfer via unsupervised environment design. NeurIPS 33, 2020.
Aaron Dharna et al. Quality-Diversity Self-Play: Open-Ended Strategy Innovation via Foundation Models. NeurIPS 2024 Workshop.
Li Ding et al. Quality diversity through human feedback. ICML 2024.
