---
title: "Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models"
authors: ["Qizheng Zhang", "Changran Hu", "Shubhangi Upasani", "Boyuan Ma", "Fenglu Hong", "Vamsidhar Kamanuru", "Jay Rainton", "Chen Wu", "Mengmeng Ji", "Hanchen Li", "Urmish Thakker", "James Zou", "Kunle Olukotun"]
year: 2026
source_file: "raw/zhang-2025-ace.md"
source_url: "https://arxiv.org/abs/2510.04618"
type: "paper"
tags: ["context engineering", "prompt optimization", "self-improving LLMs", "agent memory", "context collapse", "brevity bias", "playbook"]
processed_date: "2026-07-11"
---

## Abstract

Large language model (LLM) applications such as agents and domain-specific reasoning increasingly rely on context adaptation: modifying inputs with instructions, strategies, or evidence, rather than weight updates. Prior approaches improve usability but often suffer from brevity bias, which drops domain insights for concise summaries, and from context collapse, where iterative rewriting erodes details over time. We introduce ACE (Agentic Context Engineering), a framework that treats contexts as evolving playbooks that accumulate, refine, and organize strategies through a modular process of generation, reflection, and curation. ACE prevents collapse with structured, incremental updates that preserve detailed knowledge and scale with long-context models. Across agent and domain-specific benchmarks, ACE optimizes contexts both offline (e.g., system prompts) and online (e.g., agent memory), consistently outperforming strong baselines: +10.6% on agents and +8.6% on finance, while significantly reducing adaptation latency and rollout cost. Notably, ACE could adapt effectively without labeled supervision and instead by leveraging natural execution feedback. On the AppWorld leaderboard, ACE matches the top-ranked production-level agent on the overall average and surpasses it on the harder test-challenge split, despite using a smaller open-source model. These results show that comprehensive, evolving contexts enable scalable, efficient, and self-improving LLM systems with low overhead.

## Summary

**Problem.** Context adaptation (modifying LLM inputs rather than weights) is the dominant paradigm for improving deployed LLM applications. Existing methods suffer from two failure modes: (1) *brevity bias* — iterative optimization converges to short, generic prompts that omit domain-specific heuristics and failure patterns; and (2) *context collapse* — monolithic LLM rewrites of large accumulated contexts abruptly compress them to near-empty summaries, destroying accumulated knowledge. A concrete example: at adaptation step 60, a context of 18,282 tokens achieved 66.7% accuracy; after one monolithic rewrite it collapsed to 122 tokens and dropped to 57.1%, below the baseline of 63.7%.

**ACE framework.** ACE treats contexts not as prompts to be distilled but as *evolving playbooks* — structured, itemized collections of reusable strategies, domain concepts, and failure modes. Three specialized roles operate in a pipeline:
- **Generator**: produces reasoning trajectories for new queries, surfacing strategies and pitfalls.
- **Reflector**: critiques trajectories to extract concrete lessons; can run multiple refinement rounds.
- **Curator**: synthesizes lessons into compact *delta* entries, which are merged by lightweight non-LLM logic into the existing context.

**Key design innovations.**
1. *Incremental delta updates*: context is updated as itemized bullets rather than full rewrites, so accumulated knowledge is preserved and errors are localised.
2. *Grow-and-refine*: context expands steadily; redundant or harmful bullets are down-weighted (tracked via helpfulness/harmfulness counters in metadata) rather than deleted wholesale.
3. *Parallel batching*: deltas are independent and can be merged in parallel, enabling fast multi-epoch adaptation.

**Results.**
- AppWorld (agent benchmark): ACE reaches 59.5% vs. 51.9% for the strongest baseline (GEPA), surpassing IBM-CUGA (GPT-4.1) on the harder test-challenge split with an open-source model (DeepSeek-V3.1).
- FiNER (financial named entity recognition): ACE achieves 80.0% vs. 73.5% for the base LLM.
- Average gains: +10.6% on agent tasks, +8.6% on domain-specific benchmarks.
- ACE works without labeled supervision, using execution feedback and environment signals only.

**Cost efficiency.**
- Adaptation stage: ACE uses 80.8% fewer input tokens than GEPA (39.3M vs. 204.1M) and 83.6% fewer output tokens, by replacing GEPA's prompt-validation loop with localized updates.
- Evaluation stage: ACE uses more input tokens per query due to richer contexts, but 91.8% are served from KV cache, resulting in 82.6% reduction in billed input-token cost.

**Robustness.** ACE improves performance across all tested Reflector models (GPT-OSS-120B, DeepSeek-V3.1, GPT-5.1). Even with adversarially injected harmful reflection bullets, the grow-and-refine mechanism's helpfulness counters dampen their influence.

**Limitations.**
- Contexts grow over time; very long contexts add evaluation-time input token cost, partially mitigated by caching.
- Three separate LLM roles add architectural complexity vs. simpler single-model approaches.
- Offline adaptation requires a representative query set; distribution shift between adaptation and deployment queries may reduce gains.
- Evaluated on a limited set of benchmarks; broader generalization untested.

**Significance.** ACE operationalises the insight that LLMs benefit from detailed, comprehensive contexts rather than concise ones — inverting the conventional wisdom behind prompt compression. By treating context as an accumulating playbook rather than a summary, ACE enables scalable self-improvement without weight updates, label supervision, or expensive retraining, making it applicable across agent, domain-specific, and knowledge-intensive LLM applications.

## Citations

(partial — key references from body)

- Trivedi, H. et al. (2024). AppWorld. arXiv.
- Agrawal, S. et al. (2025). GEPA. arXiv.
- Suzgun, M. et al. (2025). Dynamic Cheatsheet. arXiv.
- Xu, J. et al. (2025). A-MEM. arXiv.
- Shinn, N. et al. (2023). Reflexion. NeurIPS.
- Yuksekgonul, M. et al. (2025). TextGrad. arXiv.
- Yao, S. et al. (2023). ReAct. ICLR.
- Lewis, P. et al. (2020). RAG. NeurIPS.
- Wei, J. et al. (2022). Chain-of-Thought. NeurIPS.
- Peng, B. et al. (2024). Long-context LLMs. arXiv.
- Zaharia, M. et al. (2024). Compound AI systems. arXiv.
- Loukas, L. et al. (2022). FiNER. arXiv.
- Marreed, S. et al. (2025). IBM-CUGA. arXiv.
- Gao, J. et al. (2025). Brevity bias in prompt optimization. arXiv.
- Opsahl-Ong, K. et al. (2024). System prompt optimization. arXiv.
- Jiang, J. et al. (2025). Long-context saturation. arXiv.
- Borgeaud, S. et al. (2022). RETRO. ICML.
- Asai, A. et al. (2024). Self-RAG. ICLR.
