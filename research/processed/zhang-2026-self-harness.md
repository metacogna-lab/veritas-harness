---
title: "Self-Harness: Harnesses That Improve Themselves"
authors: ["Hangfan Zhang", "Shao Zhang", "Kangcong Li", "Chen Zhang", "Yang Chen", "Yiqun Zhang", "Lei Bai", "Shuyue Hu"]
year: 2026
source_file: "raw/zhang-2026-self-harness.md"
source_url: "https://arxiv.org/abs/2606.09498"
type: "preprint"
tags: ["harness engineering", "self-improvement", "LLM agents", "recursive self-improvement", "Terminal-Bench", "model-specific adaptation"]
processed_date: "2026-07-11"
---

## Abstract

The performance of LLM-based agents is jointly shaped by their base models and the harnesses that mediate their interaction with the environment. Because different models exhibit distinct behaviors, effective harness design is inherently model-specific. Yet agent harnesses are still largely engineered by human experts, a paradigm that scales poorly as modern LLMs become increasingly diverse and rapidly evolving. In this paper, we introduce Self-Harness, a new paradigm in which an LLM-based agent improves its own operating harness, without relying on human engineers or stronger external agents. We operationalize Self-Harness as an iterative loop with three stages: Weakness Mining, which identifies model-specific failure patterns from execution traces; Harness Proposal, which generates diverse yet minimal harness modifications tied to these failures; and Proposal Validation, which accepts candidate edits only after regression testing. We instantiate Self-Harness on Terminal-Bench-2.0 using a minimal initial harness and three base models from diverse families: MiniMax M2.5, Qwen3.5-35B-A3B, and GLM-5. Across all three models, Self-Harness consistently improves performance, with held-out pass rates increasing from 40.5% to 61.9%, 23.8% to 38.1%, and 42.9% to 57.1%, respectively. Qualitative analyses further show that Self-Harness does not simply add generic instructions, but effectively turns model-specific weaknesses into concrete, executable harness changes. These results suggest a path toward LLM-based agents that are not merely shaped by their harnesses, but can also participate in reshaping them.

## Summary

**Problem.** Harness engineering—the system prompt, tools, memory management, verification rules, orchestration logic, and runtime mechanisms surrounding a fixed LLM—is critical for agent performance. The same base model can exhibit substantially different performance under different harnesses. Current harness engineering is done by human experts, which does not scale with the diversity and rapid release pace of modern LLMs. Unlike Meta-Harness (Lee et al. 2026), which uses a *stronger* external agent to optimize a *weaker* target agent's harness, Self-Harness asks whether a fixed model can improve the harness it operates under using only its own behavioral evidence.

**Three paradigms of harness improvement (per the paper):**
1. Human harness engineering: manual expert revision.
2. Meta-Harness: stronger external agent optimizes a weaker target agent's harness.
3. Self-Harness (this work): the agent improves its own harness, using its own execution traces.

**Self-Harness algorithm (three stages per iteration):**

1. **Weakness Mining:** Run the current harness on held-in tasks, producing execution traces with verifiable outcomes. The agent clusters failed traces to identify recurring model-specific failure patterns (not isolated mistakes). Clustering enables reasoning about systematic weaknesses rather than individual errors.

2. **Harness Proposal:** Based on the failure patterns, the fixed model (now in proposer role) generates K diverse, minimal candidate harness modifications, each tied to a specific failure mechanism. Edits are constrained to remain targeted rather than globally restructuring the harness.

3. **Proposal Validation (acceptance rule):** Each candidate is re-evaluated on both held-in (Din) and held-out (Dho) task splits. An edit is promoted only if it improves performance on both splits without causing measurable degradation on either. All accepted edits are merged into the next harness version; if none pass, the harness is unchanged.

**Experimental setup.** Terminal-Bench-2.0, using a minimal DeepAgent-based initial harness, three base models: MiniMax M2.5, Qwen3.5-35B-A3B, GLM-5. Infrastructure: 64-CPU/256GB machine with 2 MB/s outbound bandwidth cap; Harbor execution environment. Concurrency: 32 tasks for MiniMax and GLM-5, 48 for Qwen3.5 (locally deployed on 4×H200 GPUs).

**Results:**

| Model | Held-in initial | Held-in final | Held-out initial | Held-out final |
|---|---|---|---|---|
| MiniMax M2.5 | 43.0% | 50.0% | 40.5% | 61.9% |
| Qwen3.5-35B-A3B | 15.1% | 36.0% | 23.8% | 38.1% |
| GLM-5 | 47.7% | 57.0% | 42.9% | 57.1% |

Largest absolute improvement: +21.4pp (Qwen3.5 held-out). Largest relative improvement: +138% (Qwen3.5 held-in).

**Qualitative analysis of discovered harness changes per model:**

- *MiniMax M2.5:* Encourages creating required output files earlier; handles structured tool outputs more carefully; installs loop breakers to stop unproductive tool-use loops.
- *Qwen3.5-35B-A3B:* Checks dependencies in advance; avoids repeated failed commands; breaks cycles of endless exploration; reminds agent to produce required artifacts after tool errors.
- *GLM-5:* Preserves environment settings (PATH) across shell commands; moves more quickly from exploration to implementation and testing. Key case study: the accepted edit uses bounded staged operations, checks external archive evidence before committing more work, and repairs failed sanity checks before finalizing.

Notably, Self-Harness also discovers broader structural mechanisms: subagent-based decomposition and middleware creation—not just local failure repair.

**Limitations.** Self-Harness studies bounded harness edits under fixed benchmarks, not open-ended self-improvement. Accepted edits may reflect benchmark-specific failure patterns. Depends on the quality of verifier outcomes and trace records. Higher-stakes harness changes would require stronger acceptance gates than pass-rate non-regression alone. The protocol cannot discover improvements that the model cannot propose given its current harness.

**Significance.** Self-Harness introduces a controlled empirical framework for harness self-improvement: each accepted edit must specify the behavior it aims to change, the harness surface it modifies, the evidence motivating it, and the evaluation justifying promotion. By holding the model, evaluator, and benchmark fixed, the protocol isolates improvements due to harness changes alone. The retained edits are small and auditable. The paper argues for a style of agent engineering in which harnesses evolve through recorded, testable, and reversible changes.

## Citations

[1] Lingyue Fu et al. CataRena: Evaluation of LLM agents through iterative tournament competitions. ICML 2026.
[2] GLM-5 Team. GLM-5: from vibe coding to agentic engineering. arXiv:2602.15763, 2026.
[3] Shengran Hu, Cong Lu, and Jeff Clune. Automated design of agentic systems (ADAS). arXiv:2408.08435, 2025.
[4] LangChain. DeepAgents, 2026. https://github.com/langchain-ai/deepagents.
[5] Yoonho Lee, Roshen Nair, Qizheng Zhang, Kangwook Lee, Omar Khattab, and Chelsea Finn. Meta-Harness: End-to-end optimization of model harnesses. arXiv:2603.28052, 2026.
[6] Patrick Lewis et al. Retrieval-augmented generation for knowledge-intensive NLP tasks. NeurIPS 2020.
[7] Yongyuan Liang et al. Anticipatory planning for multimodal AI agents. CVPR 2026.
[8] Jiahang Lin et al. Agentic harness engineering: Observability-driven automatic evolution of coding-agent harnesses. arXiv:2604.25850, 2026.
[9] Jiacheng Liu et al. Dive into Claude Code: The design space of today's and future AI agent systems. arXiv:2604.14228, 2026.
[10] Pengfei Liu et al. Pre-train, prompt, and predict: A systematic survey of prompting methods. arXiv:2107.13586, 2021.
[11] Chris Lu, Cong Lu, Robert Tjarko Lange, Jakob Foerster, Jeff Clune, and David Ha. The AI Scientist: Towards fully automated open-ended scientific discovery. arXiv:2408.06292, 2024.
[12] Lingrui Mei et al. A survey of context engineering for large language models. arXiv:2507.13334, 2025.
[13] Mike A. Merrill et al. Terminal-Bench: Benchmarking agents on hard, realistic tasks in command line interfaces. arXiv:2601.11868, 2026.
[14] MiniMax. MiniMax M2.5: Built for real-world productivity. February 2026.
[15] Alexander Novikov et al. AlphaEvolve: A coding agent for scientific and algorithmic discovery. arXiv:2506.13131, 2025.
[16] OpenAI. Codex, 2026.
[17] Charles Packer et al. MemGPT: Towards LLMs as operating systems. arXiv:2310.08560, 2024.
[18] Yujia Qin et al. ToolLLM: Facilitating LLMs to master 16000+ real-world APIs. arXiv:2307.16789, 2023.
[19] Jiahao Qiu et al. Alita: Generalist agent enabling scalable agentic reasoning. arXiv:2505.20286, 2025.
[20] Qwen Team. Qwen3.5: Towards native multimodal agents. February 2026.
[21] Sander Schulhoff et al. The Prompt Report: A systematic survey of prompt engineering techniques. arXiv:2406.06608, 2025.
[22] Melanie Sclar et al. Quantifying language models' sensitivity to spurious features in prompt design. arXiv:2310.11324, 2024.
[23] Noah Shinn et al. Reflexion: Language agents with verbal reinforcement learning. arXiv:2303.11366, 2023.
[24] Xingyao Wang et al. OpenHands: An open platform for AI software developers as generalist agents. ICLR 2025.
[25] Jason Wei et al. Chain-of-thought prompting elicits reasoning in LLMs. NeurIPS 2022.
[26] Siyuan Xu et al. Controllable and verifiable tool-use data synthesis for agentic RL. arXiv:2604.09813, 2026.
[27] Yutaro Yamada et al. The AI Scientist-v2: Workshop-level automated scientific discovery via agentic tree search. arXiv:2504.08066, 2025.
[28] John Yang et al. SWE-agent: Agent-computer interfaces enable automated software engineering. arXiv:2405.15793, 2024.
[29] Shunyu Yao et al. ReAct: Synergizing reasoning and acting in language models. arXiv:2210.03629, 2023.
[30] Xunjian Yin et al. Gödel Agent: A self-referential agent framework for recursively self-improvement. ACL 2025.
[31] Eric Zelikman, Eliana Lorch, Lester Mackey, and Adam Tauman Kalai. Self-taught optimizer (STOP): Recursively self-improving code generation. arXiv:2310.02304, 2024.
[32] Hangfan Zhang et al. The path of self-evolving large language models. arXiv:2510.02752, 2025.
[33] Jenny Zhang, Shengran Hu, Cong Lu, Robert Lange, and Jeff Clune. Darwin Gödel Machine: Open-ended evolution of self-improving agents. arXiv:2505.22954, 2025.
[34] Qizheng Zhang et al. Agentic Context Engineering: Evolving contexts for self-improving language models. arXiv:2510.04618, 2026.
[35] Shao Zhang et al. Leveraging dual process theory in language agent framework for real-time simultaneous human-AI collaboration. ACL 2025.
[36] Ningyan Zhu et al. SemaClaw: A step towards general-purpose personal AI agents through harness engineering. arXiv:2604.11548, 2026.
[37] Mingchen Zhuge et al. Language agents as optimizable graphs. arXiv:2402.16823, 2024.
