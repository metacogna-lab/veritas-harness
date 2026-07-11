---
title: "Meta Context Engineering via Agentic Skill Evolution"
authors: ["Haoran Ye", "Xuning He", "Vincent Arak", "Haonan Dong", "Guojie Song"]
year: 2026
source_file: "raw/ye-2026-mce.md"
source_url: "https://arxiv.org/abs/2601.21557"
type: "preprint"
tags: ["context engineering", "meta-learning", "skill evolution", "LLM agents", "self-improvement", "evolutionary computation"]
processed_date: "2026-07-11"
---

## Abstract

The operational efficacy of large language models relies heavily on their inference-time context. This has established Context Engineering (CE) as a formal discipline for optimizing these inputs. Current CE methods rely on manually crafted harnesses, such as rigid generation-reflection workflows and predefined context schemas. They impose structural biases and restrict context optimization to a narrow, intuition-bound design space. To address this, we introduce Meta Context Engineering (MCE), a bi-level framework that supersedes static CE heuristics by co-evolving CE skills and context artifacts. In MCE iterations, a meta-level agent refines engineering skills via agentic crossover, a deliberative search over the history of skills, their executions, and evaluations. A base-level agent executes these skills, learns from training rollouts, and optimizes context as flexible files and code. We evaluate MCE across five disparate domains under offline and online settings. MCE demonstrates consistent performance gains, achieving 5.6–53.8% relative improvement over state-of-the-art agentic CE methods (mean of 16.9%), while maintaining superior context adaptability, transferability, and efficiency in both context usage and training.

## Summary

**Problem.** Current Context Engineering (CE) methods are constrained by manually crafted agentic harnesses that impose structural biases: case-based trajectories lack generalization; itemized lists are structurally flat; graph-based hierarchies add latency without consistent gains. Prompt-rewriting methods favor brevity (GEPA); additive-curation methods favor verbosity (ACE). No single harness is universally optimal, and the resulting design space is narrow—bounded by human intuition.

**Approach.** MCE frames CE as a bi-level optimization problem:
- **Meta-level (skill evolution):** A meta-agent evolves CE skills—organized folders of instructions, scripts, and resources (following Anthropic's Agent Skills abstraction). Evolution is driven by *agentic crossover*: the agent reasons over the history of skills, their execution trajectories, and performance metrics to synthesize superior skills.
- **Base-level (context optimization):** A base-agent executes the current skill, processes training rollouts, and constructs context as files and code (not predefined schemas). Coding toolkits and filesystem access give the base-agent a Turing-complete, schema-free design space.

**Key results (evaluated on FiNER, USPTO-50k, Symptom2Disease, LawBench, Aegis2.0):**
- Offline: 89.1% average relative improvement over DeepSeek-V3.1 baseline; 18.4% over prior SOTA (ACE).
- Online: 74.1% average relative improvement; 33.0% over prior SOTA.
- Context adaptability: MCE flexibly adjusts context length from 1.5K to 86K tokens per task; prior methods are biased toward brevity or verbosity.
- Context efficiency: At equal token budgets, MCE outperforms ACE (73% vs. 65% on FiNER at ~1.5K tokens).
- Transferability: MCE contexts degrade 4–7% less than ACE contexts when transferred from strong to weak models.
- Training efficiency: 13.6× faster training on FiNER (1.9h vs. 25.8h); 4.8× fewer rollouts to reach 95% training accuracy.
- MCE-enhanced general LLMs outperform domain-specific fine-tuned models on LawBench (0.70 vs. 0.56 F1) and Aegis2.0 safety classification.

**Ablation.** Bi-level design is necessary: removing skill evolution drops offline FiNER from 75% to 73%; using a fixed (non-evolved) skill further drops to 71%.

**Limitations.** MCE is most advantageous for knowledge-acquisition and pattern-matching tasks. It may not help on reasoning-intensive tasks where manually crafted iterative-trial harnesses already excel. Batch-level optimization may struggle with very long, complex trajectories requiring fine-grained credit assignment.

**Significance.** MCE treats CE as a learnable agentic capability rather than a fixed workflow. It supersedes prior CE methods (ACE, GEPA, DC, MIPROv2, ICL) by searching over the full space of agentic harnesses rather than a single heuristic point. The agentic skill evolution paradigm is proposed as a novel evolutionary abstraction level (above solution/function/program level) for meta-level agent optimization.

## Citations

(partial — first page of references extracted; full reference list spans approximately 50+ entries in the source)

[1] Lakshya A Agrawal et al. GEPA: Reflective prompt evolution can outperform reinforcement learning. arXiv:2507.19457, 2025.
[2] Qingyao Ai et al. MemoryBench: A benchmark for memory and continual learning in LLM systems. arXiv:2510.17281, 2025.
[3] Anthropic. Equipping agents for the real world with agent skills. Anthropic Engineering Blog, October 2025.
[4] Anthropic. Claude Agent SDK overview, 2025a.
[5] Anthropic. anthropics/skills: Public repository for Agent Skills, 2025b.
[6] Anthropic. Claude code docs, 2026.
[7] Michael Bolin. Unrolling the codex agent loop, January 2026. OpenAI.
[8] Yuzheng Cai et al. Training-free group relative policy optimization. arXiv:2510.08191, 2025a.
[9] Zhicheng Cai et al. FLEX: Continuous agent evolution via forward learning from experience. arXiv:2511.06449, 2025b.
[10] Shipeng Cen and Ying Tan. Beyond algorithm evolution: An LLM-driven framework for the co-evolution of swarm intelligence optimization algorithms and prompts. arXiv:2512.09209, 2025.
[11] Daixuan Cheng et al. LLM-in-sandbox elicits general agentic intelligence. arXiv:2601.16206, 2026.
[12] Prateek Chhikara et al. Mem0: Building production-ready AI agents with scalable long-term memory. arXiv:2504.19413, 2025.
[13] Jinyuan Fang et al. A comprehensive survey of self-evolving AI agents. arXiv:2508.07407, 2025.
[14] Zhiwei Fei et al. LawBench: Benchmarking legal knowledge of large language models. EMNLP 2024.
[15] Huan-ang Gao et al. A survey of self-evolving agents: On path to artificial super intelligence. arXiv:2507.21046, 2025.
[16] Shaona Ghosh et al. AEGIS2.0: A diverse AI safety dataset. arXiv:2501.09004, 2025.
[17] Gretel AI. Symptom to diagnosis dataset. Hugging Face, 2023.
[18] Qingyan Guo et al. Connecting large language models with evolutionary algorithms yields powerful prompt optimizers. ICLR 2024.
[19] Shuhan Guo et al. Nested-refinement metamorphosis. ACL 2025.
[20] André Hottung et al. VRPAgent: LLM-driven discovery of heuristic operators for vehicle routing problems. arXiv:2510.07073, 2025.
[21] Mengkang Hu et al. [reference text not fully captured in source extraction]
