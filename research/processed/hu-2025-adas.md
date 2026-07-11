---
title: "Automated Design of Agentic Systems"
authors: ["Shengran Hu", "Cong Lu", "Jeff Clune"]
year: 2025
source_file: "raw/hu-2025-adas.md"
source_url: "https://arxiv.org/abs/2408.08435"
type: "paper"
tags: ["agentic systems", "automated design", "meta-agent", "code search", "self-improving AI", "AI-GA", "AutoML"]
processed_date: "2026-07-11"
---

## Abstract

Researchers are investing substantial effort in developing powerful general-purpose agents, wherein Foundation Models are used as modules within agentic systems (e.g. Chain-of-Thought, Self-Reflection, Toolformer). However, the history of machine learning teaches us that hand-designed solutions are eventually replaced by learned solutions. We describe a newly forming research area, Automated Design of Agentic Systems (ADAS), which aims to automatically create powerful agentic system designs, including inventing novel building blocks and/or combining them in new ways. We further demonstrate that there is an unexplored yet promising approach within ADAS where agents can be defined in code and new agents can be automatically discovered by a meta agent programming ever better ones in code. Given that most programming languages are Turing Complete, this approach theoretically enables the learning of any possible agentic system: including novel prompts, tool use, workflows, and combinations thereof. We present a simple yet effective algorithm named Meta Agent Search to demonstrate this idea, where a meta agent iteratively programs interesting new agents based on an ever-growing archive of previous discoveries. Through extensive experiments across multiple domains including coding, science, and math, we show that our algorithm can progressively invent agents with novel designs that greatly outperform state-of-the-art hand-designed agents. Importantly, we consistently observe the surprising result that agents invented by Meta Agent Search maintain superior performance even when transferred across domains and models, demonstrating their robustness and generality. Provided we develop it safely, our work illustrates the potential of an exciting new research direction toward automatically designing ever-more powerful agentic systems to benefit humanity.

## Summary

**Problem.** Current agentic systems (CoT, self-reflection, tool-use, multi-agent pipelines) are hand-designed by researchers. This is expensive, domain-specific, and misses a vast combinatorial space of possible agent designs. The paper asks: can agentic system design itself be automated?

**ADAS formulation.** The paper defines Automated Design of Agentic Systems (ADAS) as an optimization problem with three components: (1) a *search space* over possible agent designs; (2) a *search algorithm* that navigates it; and (3) an *evaluation function* measuring agent performance. Prior ADAS work (PromptBreeder, TextGrad) restricts the search space to prompts only, severely limiting the scope of discoverable designs.

**Meta Agent Search algorithm.** The key insight is to represent agentic systems as Python code, making the search space Turing-complete and enabling discovery of any combination of prompts, tool use, workflows, and multi-agent structures. A meta agent (GPT-4o) iteratively:
1. Reviews an ever-growing archive of previously discovered agents (with scores).
2. Programs a new agent as Python code with a `forward(task)` function.
3. Performs two rounds of self-reflection to check novelty and fix implementation errors.
4. Evaluates the new agent on a validation set and adds it to the archive.

**Results.**
- On DROP (reading comprehension): +13.6 F1 vs. best hand-designed baseline.
- On MGSM (math): +14.4% accuracy.
- After cross-domain transfer to GSM8K (math): +25.9% over baselines.
- After cross-domain transfer to GSM-Hard: +13.2%.
- Discovered agents transfer robustly across both similar and dissimilar domains (e.g., math → reading comprehension) and across different underlying models (GPT-3.5 → GPT-4).

**Example discovered agents.** The meta agent invented architectures including: Multi-step Peer Review Agent (multiple expert reviewers critique answers), Verified Multimodal Agent (task decomposition with visual analysis), and Divide and Conquer Agent (recursive sub-problem decomposition). All names and designs were generated autonomously.

**Safety considerations.** The authors sandbox all generated code in containerized environments and perform manual inspections. They note that ADAS accelerates AI capability development, raising AI safety concerns they argue are net-positive to publish for community awareness and research.

**Future directions.** Higher-order ADAS (the meta agent improved by ADAS itself), online continual learning post-deployment, multi-objective optimization (performance, cost, latency, safety), and seeding with existing frameworks (LangChain, RAG tools).

**Limitations.**
- Currently evaluated only on single-step QA tasks; multi-step interactive environments remain future work.
- The meta agent (GPT-4o) is costly; discovered agents evaluated on cheaper GPT-3.5 to reduce cost, introducing an evaluation/design model gap.
- Search algorithm is simple (explore-only, no exploitation); no Quality-Diversity or RL-based search.
- Safety relies on manual inspection plus containerization; automated safety validation is not yet integrated into the ADAS loop.

**Significance.** ADAS frames agent design as a learnable, automatable process — the same historical trajectory that replaced hand-designed vision features with learned CNNs and hand-designed alignment losses with learned ones. Meta Agent Search is the first algorithm to search the full code space for agent design, demonstrating that automated agent design can substantially exceed human expert design while generalizing across domains and models.

## Citations

(partial — selected key references from body and reference section)

- Clune, J. (2019). AI-Generating Algorithms, an Alternate Paradigm for Producing General Artificial Intelligence. arXiv.
- Sutton, R. (2019). The Bitter Lesson.
- Fernando, C. et al. (2024). PromptBreeder. arXiv.
- Yang, C. et al. (2024). Large Language Models as Optimizers. arXiv.
- Zhuge, M. et al. (2024). GPT-Swarm. arXiv.
- Lu, C. et al. (2024a). Learned loss functions. (LLM alignment)
- Lu, C. et al. (2024b). The AI Scientist. arXiv.
- Faldor, M. et al. (2024). OMNI-EPIC. arXiv.
- Elsken, T. et al. (2019). Neural Architecture Search. JMLR.
- Hutter, F. et al. (2019). AutoML: Methods, Systems, Challenges.
- Wei, J. et al. (2022). Chain-of-Thought Prompting. NeurIPS.
- Yao, S. et al. (2023). ReAct. ICLR.
- Madaan, A. et al. (2024). Self-Refine. NeurIPS.
- Shinn, N. et al. (2023). Reflexion. NeurIPS.
- Lewis, P. et al. (2020). RAG. NeurIPS.
- Rafailov, R. et al. (2024). DPO. NeurIPS.
- Zelikman, E. et al. (2022). STaR. NeurIPS.
- Dua, D. et al. (2019). DROP. NAACL.
- Cobbe, K. et al. (2021). GSM8K. arXiv.
- Shi, F. et al. (2023). MGSM. arXiv.
- Chollet, F. (2019). ARC Challenge.
- Schmidhuber, J. (1987, 2003). Meta-learning / self-referential systems.
- Mouret, J.-B. & Clune, J. (2015). Quality-Diversity.
- Stanley, K. & Lehman, J. (2015). Open-endedness.
- Zaharia, M. et al. (2024). Compound AI systems.
- OpenAI (2022, 2024). GPT-3.5, GPT-4o.
- Anthropic (2024a, 2024b). Claude 3, Claude 3.5 Sonnet.
