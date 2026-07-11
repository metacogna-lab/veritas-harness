---
title: "SELF-REFINE: Iterative Refinement with Self-Feedback"
authors: ["Aman Madaan", "Niket Tandon", "Prakhar Gupta", "Skyler Hallinan", "Luyu Gao", "Sarah Wiegreffe", "Uri Alon", "Nouha Dziri", "Shrimai Prabhumoye", "Yiming Yang", "Shashank Gupta", "Bodhisattwa Prasad Majumder", "Katherine Hermann", "Sean Welleck", "Amir Yazdanbakhsh", "Peter Clark"]
year: 2023
source_file: "raw/madaan-2023-self-refine.md"
source_url: "https://arxiv.org/abs/2303.17651"
type: "preprint"
tags: ["self-improvement", "iterative-refinement", "LLM", "feedback", "test-time-compute", "code-optimization", "dialog-generation"]
processed_date: "2026-07-11"
---

## Abstract

Like humans, large language models (LLMs) do not always generate the best output on their first try. Motivated by how humans refine their written text, we introduce SELF-REFINE, an approach for improving initial outputs from LLMs through iterative feedback and refinement. The main idea is to generate an initial output using an LLM; then, the same LLM provides feedback for its output and uses it to refine itself, iteratively. SELF-REFINE does not require any supervised training data, additional training, or reinforcement learning, and instead uses a single LLM as the generator, refiner and the feedback provider. We evaluate SELF-REFINE across 7 diverse tasks, ranging from dialog response generation to mathematical reasoning, using state-of-the-art (GPT-3.5 and GPT-4) LLMs. Across all evaluated tasks, outputs generated with SELF-REFINE are preferred by humans and automatic metrics over those generated with the same LLM using conventional one-step generation, improving by ~20% absolute on average in task performance. Our work demonstrates that even state-of-the-art LLMs like GPT-4 can be further improved at test-time using our simple, standalone approach.

## Summary

**Problem Statement**

LLMs often produce suboptimal first-pass outputs, especially on multi-faceted tasks (dialog quality, code readability, constrained generation). Existing refinement methods rely on supervised training or external reward models, which are costly and domain-specific. There is a need for a training-free refinement method applicable across diverse tasks.

**Approach**

SELF-REFINE uses a single LLM (M) in three roles:
1. **Generator**: produces initial output y₀ from input x via prompt p_gen.
2. **Feedback provider**: given (x, y_t), M produces actionable, specific feedback fb_t via prompt p_fb. Feedback should identify concrete phrases and suggest concrete improvements.
3. **Refiner**: given (x, y₀, fb₀, …, y_t, fb_t), M produces y_{t+1} via prompt p_refine, retaining full history.

The loop iterates until a stopping condition (e.g., M signals "no further refinement needed" or a max iteration count is reached, typically 4 iterations). No parameter updates occur; guidance comes solely from few-shot prompts.

**Tasks Evaluated (7)**

Dialogue Response Generation, Code Optimization, Code Readability Improvement, Math Reasoning, Sentiment Reversal, Acronym Generation, Constrained Generation (up to 30 keyword constraints).

**Key Results**

- SELF-REFINE consistently outperforms same-model single-pass generation across all 7 tasks and all 3 base LLMs (GPT-3.5, ChatGPT, GPT-4).
- Average improvement ~20% absolute. Largest gains in preference-based tasks: Dialogue Response Generation (GPT-4: +49.2%), Sentiment Reversal (GPT-4: +32.4%), Constrained Generation (GPT-4: +30.0%).
- Smallest gains in Math Reasoning (~0.2%), because LLMs struggle to identify subtle arithmetic errors and tend to judge their chain-of-thought as correct (ChatGPT feedback "everything looks good" in 94% of math cases).
- Feedback quality matters: specific, actionable feedback outperforms generic feedback, which outperforms no feedback.
- Improvement accumulates over iterations but shows diminishing returns (most gain in first 1–2 iterations).
- A 1-vs-k ablation confirms SELF-REFINE's gains are not simply from generating more samples — refined outputs beat all k initial samples from the same model.
- Weaker models (Vicuna-13B) fail to reliably generate structured feedback, and even oracle feedback fails to trigger consistent refinement.

**Limitations**

- Requires a base model with strong few-shot instruction-following ability; weaker models cannot reliably execute the feedback and refinement prompts.
- Evaluated only on English tasks; cross-lingual performance is unknown.
- Relies on closed, proprietary models (GPT-3.5, GPT-4, Codex), limiting reproducibility.
- Does not guard against adversarial use of the refinement loop to generate harmful text.
- Feedback accuracy is the primary failure mode: 94% of unsuccessful refinements trace to erroneous feedback (wrong location or wrong fix), not the refiner.

**Significance**

SELF-REFINE establishes a simple, training-free, single-model loop for iterative self-improvement at test time. It shows that even GPT-4 has headroom for improvement through iterative self-feedback, and that this headroom is accessible without any gradient updates. The approach is directly analogous to how humans draft and revise, and provides a foundation for more sophisticated agentic self-correction loops.

## Citations

(partial — references section begins at line 590 of source; key citations from in-text references listed)

Amabile, T. M. 1983. A Theoretical Framework. The Social Psychology of Creativity. Springer.

Bai, Y., Jones, A., Ndousse, K., et al. 2022a. Training a helpful and harmless assistant with RLHF. arXiv:2204.05862.

Brown, T. B., Mann, B., Ryder, N., et al. 2020. Language models are few-shot learners. NeurIPS. arXiv:2005.14165.

Chen, M., Tworek, J., Jun, H., et al. 2021. Evaluating large language models trained on code (Codex). arXiv:2107.03374.

Chiang, W.-L., Li, Z., Lin, Z., et al. 2023. Vicuna: An open-source chatbot impressing GPT-4 with 90% ChatGPT quality.

Cobbe, K., Kosaraju, V., Bavarian, M., et al. 2021. Training verifiers to solve math word problems. arXiv:2110.14168.

Fu, J., Ng, S.-K., Jiang, Z., and Liu, P. 2023. GPTScore: Evaluate as you desire. arXiv:2302.04166.

Le, H., Wang, Y., Gotmare, A. D., Savarese, S., and Hoi, S. C. H. 2022b. CodeRL. NeurIPS.

Liu, Y., Iter, D., Xu, Y., Wang, S., Xu, R., and Zhu, C. 2022. G-Eval: NLG evaluation. arXiv:2303.16634.

Madaan, A., Shypula, A., Alon, U., et al. 2023. Learning performance-improving code edits. arXiv:2302.07867.

Mehri, S. and Eskenazi, M. 2020. DialoGLUE. arXiv:2009.10855.

OpenAI. 2023. GPT-4 Technical Report. arXiv:2303.08774.

Ouyang, L., Wu, J., Jiang, X., et al. 2022. Training language models to follow instructions with human feedback. NeurIPS. arXiv:2203.02155.

Peng, B., Li, C., He, P., Galley, M., and Gao, J. 2023. CHECK YOUR FACTS AND TRY AGAIN. arXiv:2302.12813.

Puri, R., Spring, R., Marathe, M., et al. 2021. Codenet. arXiv:2105.12655.

Reid, M. and Neubig, G. 2022. Learning to model editing processes. arXiv:2205.12374.

Saunders, W., Yeh, C., Wu, J., Bills, S., Ouyang, L., Ward, J., and Leike, J. 2022a. Self-critiquing models for assisting human evaluators. arXiv:2206.05802.

Scheurer, J., Campos, J. A., Chan, J. S., Chen, A., Cho, K., and Perez, E. 2022. Training language models with language feedback. arXiv:2204.14146.

Schick, T., Dwivedi-Yu, J., Jiang, Z., Petroni, F., Lewis, P., Izacard, G., You, W., Nallapati, R., Riedel, S., and Kiela, D. 2022b. PEER. arXiv:2208.11981.

Shinn, N., et al. 2023. Reflexion. arXiv:2303.11366.

Stiennon, N., Ouyang, L., Wu, J., Ziegler, D. M., Lowe, R., Voss, C., Radford, A., Amodei, D., and Christiano, P. 2020. Learning to summarize from human feedback. NeurIPS.

Tandon, N., Lal, Y., and Clark, P. 2022. Interscript: A dataset for interactive learning of scripts through error feedback. arXiv:2112.07867.

Welleck, S., Lu, X., West, P., Brahman, F., Shen, T., Khashabi, D., and Choi, Y. 2022. Generating sequences by learning to self-correct. arXiv:2211.00053.

Yang, K., Tian, J., Peng, N., and Choi, Y. 2022. Re3: Generating longer stories with recursive reprompting and revision. arXiv:2210.06774.

Yasunaga, M. and Liang, P. 2020. Graph-based, self-supervised program repair from diagnostic feedback. ICML.

Zhang, Y., et al. 2015. Character-level convolutional networks for text classification. NeurIPS.
