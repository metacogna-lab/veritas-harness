---
title: "ThetaEvolve: Test-time Learning on Open Problems"
authors: ["Yiping Wang", "Shao-Rong Su", "Zhiyuan Zeng", "Eva Xu", "Liliang Ren", "Xinyu Yang", "Zeyi Huang", "Xuehai He", "Luyao Ma", "Baolin Peng", "Hao Cheng", "Pengcheng He", "Weizhu Chen", "Shuohang Wang", "Simon Shaolei Du", "Yelong Shen"]
year: 2025
source_file: "raw/wang-2025-thetaevolve.md"
source_url: "https://arxiv.org/abs/2511.23473"
type: "preprint"
tags: ["AlphaEvolve", "evolutionary search", "reinforcement learning", "test-time learning", "open problems", "mathematical optimisation", "open-source", "small LLMs"]
processed_date: "2026-07-11"
---

## Abstract

Recent advances in large language models (LLMs) have enabled breakthroughs in mathematical discovery, exemplified by AlphaEvolve, a closed-source system that evolves programs to improve bounds on open problems. However, it relies on ensembles of frontier LLMs to achieve new bounds and is a pure inference system that cannot internalize the evolving strategies. We introduce ThetaEvolve, an open-source framework that simplifies and extends AlphaEvolve to efficiently scale both in-context learning and Reinforcement Learning (RL) at test time, allowing models to continually learn from their experiences in improving open optimization problems. ThetaEvolve features a single LLM, a large program database for enhanced exploration, batch sampling for higher throughput, lazy penalties to discourage stagnant outputs, and optional reward shaping for stable training signals, etc. ThetaEvolve is the first evolving framework that enable a small open-source model, like DeepSeek-R1-0528-Qwen3-8B, to achieve new best-known bounds on open problems (circle packing and first auto-correlation inequality) mentioned in AlphaEvolve. Besides, across two models and four open tasks, we find that ThetaEvolve with RL at test time consistently outperforms inference-only baselines, and the model indeed learns evolving capabilities, as the RL-trained checkpoints demonstrate faster progress and better final performance on both trained target task and other unseen tasks. We release our code publicly.

## Summary

**Problem.** AlphaEvolve achieves strong results on open mathematical optimisation problems but is closed-source, relies on ensembles of expensive frontier LLMs (Gemini-2.0-Flash/Pro, Claude-Sonnet-4, o4-mini, GPT-4.1), and cannot update the underlying model from experience — it is a pure inference system. Open-source alternatives (OpenEvolve, ShinkaEvolve) remain complex with many underexplored hyperparameters. The question is: can a small open-source model be made competitive via test-time RL, and can it genuinely internalise improved evolutionary strategies?

**Approach.** ThetaEvolve simplifies the AlphaEvolve/OpenEvolve pipeline in several ways and adds RL:

- **Single LLM**: Replaces AlphaEvolve's LLM ensemble with a single model (evaluated on ProRL-1.5B-v2 and DeepSeek-R1-0528-Qwen3-8B).
- **Large program database**: Population size = 10,000 (vs. OpenEvolve's 70); larger database consistently improves final performance.
- **Batch sampling**: At each step, B parent programs are sampled and n responses are generated per prompt, yielding B×n child programs; enables efficient batched inference with vLLM/SGLang.
- **Lazy penalty**: Structured penalties for: no diff blocks found (−0.4), no valid changes (−0.3), no solution (−0.2), invalid solution (−0.1); penalises repeating programs already in the database to prevent stagnation.
- **Optional reward shaping**: Normalises objective scores to a stable training range, particularly important for tasks with narrow score intervals (e.g., autocorrelation inequalities); uses reward-shaping function F with configurable bounds and exponent α.
- **RL algorithm**: GRPO with asymmetric clipping (clip\_low=0.2, clip\_high=0.28), learning rate 10⁻⁶, weight decay 0.1, batch size B=32, n=16 responses per prompt, max 16K token responses.

**Key Results.**
- DeepSeek-R1-0528-Qwen3-8B (8B parameters) achieves new best-known bounds on CirclePacking (2.63598308 vs AlphaEvolve's 2.63586276) and FirstAutoCorrIneq (1.503133 vs AlphaEvolve's 1.503164) — first open-source small model to exceed AlphaEvolve results on these tasks.
- ThetaEvolve's circle-packing program finds the best solution in ~3 seconds; ShinkaEvolve (6-model frontier ensemble) takes ~75 seconds.
- RL consistently outperforms pure inference across all 4 tasks and both models.
- RL-trained checkpoints demonstrate faster progress and better final scores when used for pure inference on the same task — confirming the model internalises evolutionary strategies, not just task-specific patterns.
- Improvements transfer to unseen tasks (generalisation of evolutionary capability across problems).
- RL benefits cannot be replicated with format reward alone or by performing RL in a static (non-evolving) environment — confirming that the dynamic evolutionary environment is essential.

**Tasks Evaluated.**
1. CirclePacking-T: pack N=26 circles in unit square, maximise sum of radii.
2. FirstAutoCorrIneq: improve constant bound for first autocorrelation inequality (minimisation).
3. SecondAutoCorrIneq: improve constant bound for second autocorrelation inequality.
4. ThirdAutoCorrIneq: improve constant bound for third autocorrelation inequality (minimisation).
5. HadamardMatrix: maximise determinant of N=29 Hadamard matrix.

**Limitations.**
- Results limited to mathematical optimisation problems with clean, deterministic evaluators.
- RL training requires significant compute; full ablations on larger models not provided.
- Comparison with AlphaEvolve uses slightly different evaluator tolerances (OpenEvolve-style ε=10⁻⁶ tolerance vs. strict AlphaEvolve); authors note this and prove their results remain superior even after shrinking radii by 10⁻⁶.
- ThirdAutoCorrIneq evaluator in AlphaEvolve contains typos; ThetaEvolve uses corrected verifier, making direct comparison on that task indirect.

**Significance.** First framework to show that RL at test time enables a small open-source model (8B params) to surpass frontier-ensemble baselines (AlphaEvolve with Gemini/Claude/GPT-4.1) on open mathematical optimisation problems. Demonstrates that evolutionary capability can be internalised as a learnable skill, not just scaffolded via inference-time prompting. Fully open-source implementation released.

## Citations

(partial — key references cited in text; full list in source)

DeepSeek-AI. DeepSeek-R1-0528-Qwen3-8B. 2025.
Friedman, E. Circle packing (reference problem). 2012.
Gao et al. RL for reasoning language models. 2024.
Georgiev, Gómez-Serrano, Tao, Wagner. Mathematical Exploration and Discovery at Scale (AlphaEvolve-v2). arXiv:2511.02864, 2025.
Google DeepMind. [reference for Deep Think / Gemini IMO gold]. 2025.
Hu et al. ProRL-1.5B-v2. 2025.
Hubert et al. AlphaProof. 2025.
Kwon et al. vLLM. 2023.
Lambert et al. RL for language models. 2024.
Lange et al. ShinkaEvolve. 2025.
Liu et al. Truncated importance sampling. 2025a, 2025b.
Novikov et al. AlphaEvolve [white paper, original introduction]. 2025.
OpenAI. [reference for RL / inference scaling]. 2024.
Romera-Paredes et al. FunSearch. 2024.
Shao et al. GRPO. 2024.
Sharma. OpenEvolve. 2025.
Team et al. [RL for reasoning]. 2025.
Wagner, A. Z. [mathematical result]. 2021.
Wang and Tao. [ThirdAutoCorrIneq typo correction]. 2025.
Yao et al. Truncated importance sampling. 2025.
Yu et al. Asymmetric clipping / dynamic sampling. 2025.
Zeng et al. Adaptive verifiable environment for RL. 2025.
Zheng et al. SGLang. 2024.
Zhu et al. slime RL framework. 2025.
