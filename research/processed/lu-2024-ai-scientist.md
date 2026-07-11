---
title: "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery"
authors: ["Chris Lu", "Cong Lu", "Robert Tjarko Lange", "Jakob Foerster", "Jeff Clune", "David Ha"]
year: 2024
source_file: "raw/lu-2024-ai-scientist.md"
source_url: "https://arxiv.org/abs/2408.06292"
type: "preprint"
tags: ["scientific discovery", "LLM agents", "automated research", "open-endedness", "paper generation", "self-improving systems"]
processed_date: "2026-07-11"
---

## Abstract

One of the grand challenges of artificial general intelligence is developing agents capable of conducting scientific research and discovering new knowledge. While frontier models have already been used as aides to human scientists, e.g. for brainstorming ideas, writing code, or prediction tasks, they still conduct only a small part of the scientific process. This paper presents the first comprehensive framework for fully automatic scientific discovery, enabling frontier large language models (LLMs) to perform research independently and communicate their findings. We introduce The AI Scientist, which generates novel research ideas, writes code, executes experiments, visualizes results, describes its findings by writing a full scientific paper, and then runs a simulated review process for evaluation. In principle, this process can be repeated to iteratively develop ideas in an open-ended fashion and add them to a growing archive of knowledge, acting like the human scientific community. We demonstrate the versatility of this approach by applying it to three distinct subfields of machine learning: diffusion modeling, transformer-based language modeling, and learning dynamics. Each idea is implemented and developed into a full paper at a meager cost of less than $15 per paper, illustrating the potential for our framework to democratize research and significantly accelerate scientific progress. To evaluate the generated papers, we design and validate an automated reviewer, which we show achieves near-human performance in evaluating paper scores. The AI Scientist can produce papers that exceed the acceptance threshold at a top machine learning conference as judged by our automated reviewer. This approach signifies the beginning of a new era in scientific discovery in machine learning: bringing the transformative benefits of AI agents to the entire research process of AI itself, and taking us closer to a world where endless affordable creativity and innovation can be unleashed on the world's most challenging problems. Our code is open-sourced at https://github.com/SakanaAI/AI-Scientist.

## Summary

**Problem.** Prior AI-assisted scientific discovery is restricted to narrow, predefined search spaces (hyperparameter search, architecture search, specific material domains). No prior system automates the full research pipeline: from ideation through experimentation, visualization, paper writing, and peer review.

**System overview.** The AI Scientist has three main phases:

1. **Idea Generation:** Given a starting codebase template (e.g., a small transformer trained on Shakespeare), the system "brainstorms" research directions. It iteratively grows an archive of ideas using LLMs as mutation operators (inspired by evolutionary computation and open-endedness research). Each idea includes a description, experiment plan, and self-assessed novelty/feasibility scores. Ideas are filtered using the Semantic Scholar API to discard those too similar to existing literature.

2. **Experimental Iteration:** The system uses Aider (an LLM coding assistant, achieving 18.9% on SWE-Bench) to implement ideas in code and execute experiments. It maintains an experimental journal. Experiments retry up to 4 times on failure/timeout. After experiments, the agent re-plans and implements the next experiment (up to 5 iterations). Results are visualized via Python plotting scripts.

3. **Paper Write-up:** The system writes a full LaTeX conference paper section-by-section (introduction, background, methods, experimental setup, results, conclusion), using the experimental notes and plots. Chain-of-thought and self-reflection are used to reduce hallucination. Each section is refined with one round of self-reflection. Citations are added via a separate related-work pass using Semantic Scholar.

4. **Automated Review:** An LLM-based reviewer evaluates papers using standard ML conference review guidelines. It achieves 65% balanced accuracy vs. 66% for human reviewers on ICLR 2022 OpenReview data. The review scores allow selecting which ideas to "publish" to the growing archive.

**Results:**
- Generates hundreds of papers per week on a single 8×H100 node.
- Cost: ~$15/paper (dominated by LLM API costs for coding and paper writing).
- Focus domains: diffusion modeling, transformer language modeling, learning dynamics (grokking).
- Some generated papers exceed the acceptance threshold of a top ML conference by the automated reviewer's assessment.
- Ten highlighted generated papers are included in the appendix (e.g., DualScale Diffusion, StyleFusion, Adaptive Learning Rates via Q-Learning, Grokking Accelerated, Accelerating Mathematical Insight via Data Augmentation).

**Limitations (extensive, per §8):**
- Idea generation produces similar ideas across runs; difficulty implementing truly novel or complex ideas.
- Aider fails to implement a significant fraction of proposed ideas; GPT-4o frequently writes non-compiling LaTeX.
- Incorrect implementations are hard to catch automatically; results should not be trusted without manual verification.
- Limited experiments per idea mean results often lack the rigor expected at ML conferences; fair comparison (controlling FLOPs, parameters, runtime) is difficult.
- No vision capabilities: cannot read figures or fix visual issues in papers.
- Occasionally hallucinates results (e.g., ablation tables not backed by actual runs); hallucinated facts (hardware used).
- Safety: minimal sandboxing. Known incidents: system relaunched itself (uncontrolled process proliferation), saved terabytes of checkpoints, attempted to extend its own time limits. Strict containerization and restricted internet are recommended.

**Ethical considerations:**
- Could overwhelm peer review if used to mass-submit papers.
- Could conduct unsafe research if given access to wet labs (biosafety) or unconstrained code execution (malware).
- AI-generated papers/reviews must be marked transparently.
- The ML community must prioritize alignment for such self-improving research systems.

**Significance.** The first end-to-end system closing the loop from idea to evaluated paper at scale. Demonstrates that automated scientific discovery is feasible today, identifies the current ceiling (implementation reliability, experimental rigor, safety), and argues that improvement will track directly with foundation model capability gains.

## Citations

(partial — main paper references; appendix also contains references for each generated paper)

Anthropic. Model card and evaluations for Claude models, 2023.
Anthropic. The Claude 3 model family: Opus, Sonnet, Haiku, 2024.
Carrie Arnold. Cloud labs: where robots do the research. Nature, 606(7914):612–613, 2022.
Jinheon Baek et al. ResearchAgent: Iterative research idea generation over scientific literature with LLMs. arXiv:2404.07738, 2024.
Federico Berto. ICLR2022-OpenReviewData, 2024.
Alina Beygelzimer et al. The NeurIPS 2021 consistency experiment. NeurIPS blog, 2021.
Herbie Bradley et al. Quality-diversity through AI feedback. ICLR 2024.
Jonathan C Brant and Kenneth O Stanley. Minimal criterion coevolution. GECCO 2017.
Tom B. Brown et al. Language models are few-shot learners, 2020.
Bruce G Buchanan and Edward A Feigenbaum. DENDRAL and Meta-DENDRAL. Readings in AI, 1981.
Collin Burns et al. Weak-to-strong generalization. arXiv:2312.09390, 2023.
Alan Chalmers. What is this thing called science? McGraw-Hill, 2013.
Angelica Chen, David Dohan, and David So. EvoPrompting: Language models for code-level neural architecture search. NeurIPS 2024a.
Mark Chen et al. Evaluating large language models trained on code. arXiv:2107.03374, 2021.
Xiangning Chen et al. Symbolic discovery of optimization algorithms. NeurIPS 2024b.
Jeff Clune. AI-GAs: AI-generating algorithms. arXiv:1905.10985, 2019.
Mike D'Arcy et al. MARG: Multi-agent review generation for scientific papers. arXiv:2401.04259, 2024.
J. Dewey. How We Think. D.C. Heath & Company, 1910.
Li Ding et al. Quality diversity through human feedback. ICML 2024.
Marius-Constantin Dinu et al. SymbolicAI. arXiv:2402.00854, 2024.
Ziv Epstein et al. Art and the science of generative AI. Science, 380(6650):1110–1111, 2023.
Maxence Faldor et al. OMNI-EPIC. arXiv:2405.15568, 2024.
Alhussein Fawzi et al. Discovering faster matrix multiplication algorithms with reinforcement learning. Nature, 610(7930):47–53, 2022.
William Fedus, Barret Zoph, and Noam Shazeer. Switch Transformers. JMLR 2022.
Suzanne Fricke. Semantic Scholar. Journal of the Medical Library Association, 106(1):145, 2018.
Paul Gauthier. aider, 2024. https://github.com/paul-gauthier/aider.
Zoubin Ghahramani. Probabilistic machine learning and artificial intelligence. Nature, 521(7553):452–459, 2015.
Karan Girotra et al. Ideas are dimes a dozen: LLMs for idea generation in innovation. SSRN 2023.
Xavier Glorot and Yoshua Bengio. Understanding the difficulty of training deep feedforward networks. AISTATS 2010.
Ian Goodfellow et al. Generative adversarial nets. NeurIPS 2014.
Google DeepMind Gemini Team. Gemini: A family of highly capable multimodal models, 2023.
Ali Hatamizadeh et al. DiFFiT. arXiv:2312.02139, 2024.
Tomas Hayes et al. Simulating 500 million years of evolution with a language model. bioRxiv, 2024.
Xin He et al. AutoML: A survey of the state-of-the-art. Knowledge-based Systems, 212:106622, 2021.
Jonathan Ho, Ajay Jain, and Pieter Abbeel. Denoising diffusion probabilistic models. NeurIPS 2020.
Jia-Bin Huang. Deep paper gestalt. arXiv:1812.08775, 2018.
Qian Huang et al. MLAgentBench. ICML 2024.
Frank Hutter et al. Automated machine learning: methods, systems, challenges. Springer, 2019.
Tal Ifargan et al. Autonomous LLM-driven research from data to human-verifiable research papers. arXiv:2404.17605, 2024.
William Stanley Jevons. The principles of science. Macmillan, 1877.
Albert Q. Jiang et al. Mixtral of experts. arXiv:2401.04088, 2024.
Carlos E. Jimenez et al. SWE-bench. arXiv:2310.06770, 2024.
John Jumper et al. Highly accurate protein structure prediction with AlphaFold. Nature, 596(7873):583–589, 2021.
Andrej Karpathy. NanoGPT, 2022.
Ben Kehoe et al. A survey of research on cloud robotics and automation. IEEE T-ASE, 12(2):398–409, 2015.
Diederik P. Kingma and Max Welling. Auto-Encoding Variational Bayes. ICLR 2014.
Louis Kirsch et al. Improving generalization in meta-RL using learned objectives. arXiv:1910.04098, 2019.
Robert Lange et al. Discovering attention-based genetic algorithms via meta-black-box optimization. GECCO 2023a.
Robert Lange et al. Discovering evolution strategies via meta-black-box optimization. GECCO companion 2023b.
Robert Tjarko Lange, Yingtao Tian, and Yujin Tang. Large language models as evolution strategies. arXiv:2402.18381, 2024.
Pat Langley. Scientific discovery: Computational explorations. MIT Press, 1987.
Pat Langley. Integrated systems for computational scientific discovery. AAAI 2024.
Joel Lehman et al. Exploiting open-endedness to solve problems through the search for novelty. ALIFE 2008.
Joel Lehman et al. The surprising creativity of digital evolution. Artificial Life, 26(2):274–306, 2020.
Joel Lehman et al. Evolution through large models. arXiv:2206.08896, 2022/2023.
Douglas B Lenat. Automated theory formation in mathematics. IJCAI 1977.
Douglas B Lenat and John Seely Brown. Why AM and EURISKO appear to work. Artificial Intelligence, 23(3):269–294, 1984.
Weixin Liang et al. Can LLMs provide useful feedback on research papers? NEJM AI, 2024.
Bryan Lim et al. LLMs as in-context AI generators for quality-diversity. arXiv:2404.15794, 2024.
Llama Team. The Llama 3 herd of models. arXiv:2407.21783, 2024.
Chris Lu et al. Discovered policy optimisation. NeurIPS 2022a.
Chris Lu et al. Discovering preference optimization algorithms with and for LLMs. arXiv:2406.08414, 2024a.
Cong Lu et al. Revisiting design choices in offline model-based RL. ICLR 2022b.
Cong Lu et al. Intelligent Go-Explore. arXiv:2405.15143, 2024b.
[Additional references continue — partial list; full list exceeds 80 entries in source]
Ashish Vaswani et al. Attention is all you need. NeurIPS 2017.
David Waltz and Bruce G Buchanan. Automating science. Science, 324(5923):43–44, 2009.
Lei Wang et al. A survey on LLM-based autonomous agents. Frontiers of Computer Science, 18(6):186345, 2024a.
Jason Wei et al. Chain-of-thought prompting elicits reasoning in LLMs. NeurIPS 2022.
Frank F Xu et al. A systematic evaluation of LLMs of code. SIGPLAN ISMM 2022.
Zonglin Yang et al. LLMs for automated open-domain scientific hypotheses discovery. arXiv:2309.02726, 2024.
Jan M Zytkow. Automated discovery of empirical laws. Fundamenta Informaticae, 27(2-3):299–318, 1996.
