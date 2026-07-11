---
title: "Meta-Harness: End-to-End Optimization of Model Harnesses"
authors: ["Yoonho Lee", "Roshen Nair", "Qizheng Zhang", "Kangwook Lee", "Omar Khattab", "Chelsea Finn"]
year: 2026
source_file: "raw/lee-2026-meta-harness.md"
source_url: "https://arxiv.org/abs/2603.28052"
type: "preprint"
tags: ["harness engineering", "meta-optimization", "LLM agents", "coding agents", "context engineering", "filesystem-based search"]
processed_date: "2026-07-11"
---

## Abstract

The performance of large language model (LLM) systems depends not only on model weights, but also on their harness: the code that determines what information to store, retrieve, and present to the model. Yet harnesses are still designed largely by hand, and existing text optimizers are poorly matched to this setting because they compress feedback too aggressively: they are memoryless, condition only on scalar scores, or restrict feedback to short templates or summaries. We introduce Meta-Harness, an outer-loop system that searches over harness code for LLM applications. It uses an agentic proposer that accesses the source code, scores, and execution traces of all prior candidates through a filesystem. On online text classification, Meta-Harness improves over a state-of-the-art context management system by 7.7 points while using 4× fewer context tokens. On retrieval-augmented math reasoning, a single discovered harness improves accuracy on 200 IMO-level problems by 4.7 points on average across five held-out models. On agentic coding, discovered harnesses surpass the best hand-engineered baselines on TerminalBench-2. Together, these results show that richer access to prior experience can enable automated harness engineering.

## Summary

**Problem.** Harness engineering—crafting the code that wraps an LLM (prompts, retrieval, memory, tool logic)—can produce a 6× performance gap on the same benchmark. This engineering remains largely manual. Existing text optimizers (OPRO, TextGrad, AlphaEvolve, GEPA, Feedback Descent, TTT-Discover) are poorly suited to harness engineering because they compress feedback aggressively: available context per step ranges from 100 to 30,000 tokens in prior work, far below what harness evaluation requires. A single design choice (what to store in memory) can affect behavior many reasoning steps later—compressed feedback removes the information needed to trace downstream failures.

**Approach.** Meta-Harness is an outer-loop system with a single coding-agent proposer. Its key design: **full history via filesystem access**.

- Each evaluated harness contributes a directory containing its source code, evaluation scores, and execution traces (prompts, tool calls, model outputs, state updates).
- The proposer queries the filesystem through standard terminal tools (grep, cat) rather than ingesting history as a single prompt.
- In the most demanding setting, a single evaluation can produce up to 10,000,000 tokens of diagnostic information (vs. 30,000 in prior SOTA).
- The proposer reads a median of 82 files per iteration (range 69–99), roughly evenly split between prior harness source code (41%) and execution traces (40%).
- No fixed parent-selection rule: the proposer is free to inspect any prior harness and its execution trace.
- The system became practical only following "major improvements in coding-agent capabilities around early 2026" (per the paper's own footnote).

**Objective.** Find a harness H* = argmax E[r(τ, x)] over task distribution X, where a harness is a stateful program that wraps an LLM M, constructing prompts and updating state after each interaction. A Pareto frontier is maintained when multiple objectives apply (accuracy and context cost).

**Results:**
- *Online text classification:* +7.7 points over ACE (SOTA context management) while using 4× fewer context tokens. Reaches TTT-Discover's final accuracy in only 4 evaluations (vs. 60).
- *Retrieval-augmented math reasoning (IMO-level):* +4.7 points average accuracy on 200 problems across 5 held-out models.
- *TerminalBench-2 (agentic coding):* Discovered harness ranks #1 among all Claude Haiku 4.5 agents, surpassing Terminus-KIRA (35.5%) and all other reported harnesses, achieving 40% pass rate.

**Discovered harness behavior (TerminalBench-2 qualitative analysis):**
- The proposer demonstrates causal reasoning over prior failures: identifies that prompt+completion-flow edits caused all 6 early regressions; pivots to a purely additive "environment bootstrap" (pre-loop snapshot of working directory, installed languages, package managers, available memory) that adds ~80 lines with no risk of regressing passing tasks.
- The bootstrap eliminates 2–4 exploratory turns on tasks with non-obvious environments (bioinformatics, rendering, chess, cryptography tools), which is where tight turn budgets matter most.

**Practical guidelines from the paper:**
1. Write a high-quality skill/prompt for the proposer that specifies what's forbidden and what to optimize, while leaving diagnosis free.
2. Use a baseline harness that is hard for the search set to saturate.
3. Log everything in machine-readable formats navigable by grep/cat.
4. Optionally add a small CLI to the experience store.
5. Validate harness syntax cheaply before expensive benchmark runs.
6. Automate evaluation outside the proposer.

**Limitations.** Meta-Harness requires a stronger external proposer to optimize a target agent's harness—it is not self-harness improvement (see Self-Harness, Zhang et al. 2026). The workflow only became practical in early 2026 with major coding-agent capability improvements. The proposer generates ~10 MTok/iteration context, orders of magnitude more than prior text optimization methods.

## Citations

[1] Lakshya A Agrawal et al. GEPA: Reflective prompt evolution can outperform reinforcement learning. 2025.
[2] Alaa et al. unknown — reference not captured.
[3] ... (references [3]–[10] partially captured)
[7] Iñigo Casanueva et al. Efficient intent detection with dual sentence encoders. arXiv:2003.04807, 2020.
[8] Mert Cemri et al. AdAEvolve: Adaptive LLM driven zeroth-order optimization. arXiv:2602.20133, 2026.
[9] Harrison Chase. LangChain, October 2022.
[10] Arman Cohan et al. Structural scaffolds for citation intent classification. 2019.
[11] Iñigo Casanueva et al. Efficient intent detection with dual sentence encoders, 2020.
[12] Mert Cemri et al. AdAEvolve. arXiv:2602.20133, 2026.
[13] Harrison Chase. LangChain, 2022.
[14] Arman Cohan et al. Structural scaffolds for citation intent classification. arXiv:1904.01608, 2019.
[15] Dorottya Demszky et al. GoEmotions: A dataset of fine-grained emotions. arXiv:2005.00547, 2020.
[16] Zhiwei Fei et al. LawBench. EMNLP 2024.
[17] Chelsea Finn, Pieter Abbeel, and Sergey Levine. MAML. ICML 2017.
[18] ForgeCode. Benchmarks don't matter, 2025.
[19] Gretel AI. Symptom to diagnosis dataset, 2023.
[20] Shengran Hu, Cong Lu, and Jeff Clune. Automated design of agentic systems. ICLR 2025.
[21] Anthropic Justin Young. Effective harnesses for long-running agents. Anthropic Engineering Blog, November 2025.
[22] Phillip Keung et al. The multilingual Amazon reviews corpus. arXiv:2010.02573, 2020.
[23] Omar Khattab et al. DSPy: Compiling declarative language model calls into self-improving pipelines. arXiv:2310.03714, 2023.
[24] Tushar Khot et al. SciTail: A textual entailment dataset from science question answering. AAAI 2018.
[25] KRAFTON AI and Ludo Robotics. Terminus-KIRA: Boosting frontier model performance on TerminalBench. 2026.
[26] Yoonho Lee, Joseph Boen, and Chelsea Finn. Feedback Descent. arXiv:2511.07919, 2025.
[27] Joel Lehman et al. Evolution through large models. arXiv:2206.08896, 2022.
[28] Patrick Lewis et al. Retrieval-augmented generation for knowledge-intensive NLP tasks. NeurIPS 2020.
[29] Lefteris Loukas et al. FiNER: Financial numeric entity recognition for XBRL tagging. ACL 2022.
[30] Thang Luong et al. Towards robust mathematical reasoning. EMNLP 2025.
[31] Aman Madaan et al. Self-Refine: Iterative refinement with self-feedback. NeurIPS 2023.
[32] Pekka Malo et al. Good debt or bad debt: Detecting semantic orientations in economic texts. arXiv:1307.5336, 2013.
[33] Mike A Merrill et al. Terminal-Bench: Benchmarking agents on hard, realistic tasks in command line interfaces. arXiv:2601.11868, 2026.
[34] Jack Nichols. How we scored #1 on terminal-bench (52%), Jun 2025. Warp blog.
[35] Alexander Novikov et al. AlphaEvolve: A coding agent for scientific and algorithmic discovery. arXiv:2506.13131, 2025.
[36] OpenAI. Harness engineering: leveraging Codex in an agent-first world. OpenAI Blog, February 2026.
[37] Charles Packer et al. MemGPT: Towards LLMs as operating systems. 2023.
[38] Reid Pryzant et al. Automatic prompt optimization with "gradient descent" and beam search. arXiv:2305.03495, 2023.
[39] Bernardino Romera-Paredes et al. Mathematical discoveries from program search with large language models. Nature 2024.
[40] Jürgen Schmidhuber. A neural network that embeds its own meta-levels. IEEE ICNN 1993.
[41] Nadine Schneider et al. What's what: guide to reaction role assignment. J. Chem. Inf. Model. 2016.
[42] Srijan Shakya et al. Adaptive retrieval helps reasoning in LLMs. arXiv:2602.07213, 2026.
[43] Asankhaya Sharma. OpenEvolve: an open-source evolutionary coding agent. GitHub 2025.
[44] Jake Snell et al. Prototypical networks for few-shot learning. NeurIPS 2017.
[45] Rich Sutton. The bitter lesson, 2019.
[46] Sebastian Thrun and Lorien Pratt. Learning to learn: Introduction and overview. Springer 1998.
[47] Muxin Tian et al. SWE-Bench Mobile. arXiv 2026.
[48] Harsh Trivedi et al. Interleaving retrieval with chain-of-thought reasoning. arXiv:2212.10509, 2023.
[49] Chenghao Xiao et al. RAR-B: Reasoning as retrieval benchmark. arXiv:2404.06347, 2024.
[50] Yiming Xiong et al. Learning to continually learn via meta-learning agentic memory designs. OpenReview 2026.
[51] Chengrun Yang et al. Large language models as optimizers (OPRO). ICLR 2023.
[52] Haoran Ye et al. Meta context engineering via agentic skill evolution. arXiv:2601.21557, 2026.
[53] Mert Yuksekgonul et al. TextGrad: Automatic "differentiation" via text. arXiv:2406.07496, 2024.
[54] Mert Yuksekgonul et al. Learning to discover at test time (TTT-Discover). arXiv:2601.16175, 2026.
[55] Mert Yuksekgonul et al. Learning to discover at test time. arXiv:2601.16175, 2026. [duplicate]
[56] Alex L. Zhang, Tim Kraska, and Omar Khattab. Recursive language models. arXiv:2512.24601, 2026.
[57] Guibin Zhang et al. MemEvolve: Meta-evolution of agent memory systems. arXiv:2512.18746, 2025.
[58] Jiayi Zhang et al. AFlow: Automating agentic workflow generation. arXiv:2410.10762, 2025.
[59] Qizheng Zhang et al. Agentic Context Engineering: Evolving contexts for self-improving language models. arXiv:2510.04618, 2025.
[60] Xiang Zhang, Junbo Zhao, and Yann LeCun. Character-level convolutional networks for text classification. arXiv:1509.01626, 2016.
