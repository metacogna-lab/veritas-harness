                                                              ThetaEvolve: Test-time Learning on Open Problems


                                             Yiping Wang 1 2 Shao-Rong Su 1 Zhiyuan Zeng 1 Eva Xu 1 Liliang Ren 2 Xinyu Yang 3 2 Zeyi Huang 4 2
                                             Xuehai He 2 Luyao Ma 5 Baolin Peng 2 Hao Cheng 2 Pengcheng He 2 Weizhu Chen 2 Shuohang Wang 2
                                                                            Simon Shaolei Du† 1 Yelong Shen† 2


                                                                 Abstract                                    1. Introduction

arXiv:2511.23473v1 \[cs.LG\] 28 Nov 2025 Recent advances in large
language models Model CP(↑) FACI(↓) (LLMs) have enabled breakthroughs in
mathe- Human - 2.634 1.5098 matical discovery, exemplified by
AlphaEvolve, AlphaEvolve Gemini-2.0-Flash/Pro 2.63586276 1.503164 a
closed-source system that evolves programs to ShinkaEvolve
Claude-sonnet-4/o4-mini/… 2.63598283 - improve bounds on open problems.
However, it ThetaEvolve Distill-Qwen3-8B 2.63598308 1.503133 relies on
ensembles of frontier LLMs to achieve new bounds and is a pure inference
system that Table 1: Improving bounds achieved with ThetaEvolve models
cannot internalize the evolving strategies. based on
DeepSeek-R1-0528-Qwen3-8B (DeepSeek-AI, We introduce ThetaEvolve, an
open-source frame- 2025). We consider two open tasks, circle packing
(CP) work that simplifies and extends AlphaEvolve to and the first
autocorrelation inequality (FACI), and report efficiently scale both
in-context learning and Re- the best values mentioned in AlphaEvolve-v2
(Georgiev inforcement Learning (RL) at test time, allow- et al., 2025)
and its variant ShinkaEvolve (Lange et al., ing models to continually
learn from their experi- 2025). Notably, the circle-packing program
discovered by ences in improving open optimization problems. ThetaEvolve
takes only 3 seconds to consistently find the ThetaEvolve features a
single LLM, a large pro- same best solution, which is significantly
faster than the gram database for enhanced exploration, batch program
found by ShinkaEvolve (around 75 seconds). See sampling for higher
throughput, lazy penalties to Appendix E.2 for details. We also obtain
results close to discourage stagnant outputs, and optional reward
AlphaEvolve on several other tasks (Sec. 4.2). shaping for stable
training signals, etc. ThetaE- volve is the first evolving framework
that en- The recent development of the reasoning capabilities of able a
small open-source model, like DeepSeek- large language models (LLMs) has
enabled them to con- R1-0528-Qwen3-8B, to achieve new best-known tribute
to new scientific findings, like mathematical dis- bounds on open
problems (circle packing and covery (Romera-Paredes et al., 2024;
Charton et al., 2024; first auto-correlation inequality) mentioned in
Al- Wagner, 2021; Fawzi et al., 2022). A notable recent example
phaEvolve. Besides, across two models and four is AlphaEvolve (Novikov
et al., 2025; Georgiev et al., 2025), open tasks, we find that
ThetaEvolve with RL which uses pre-designed evaluators together with
frontier at test-time consistently outperforms inference- LLMs to
iteratively modify and improve candidate programs only baselines, and
the model indeed learns evolv- toward optimizing task-specific
objectives. Through this ing capabilities, as the RL-trained checkpoints
evolutionary process, AlphaEvolve has discovered solutions demonstrate
faster progress and better final per- that match or improve the
best-known results for several formance on both trained target task and
other open mathematical optimization problems. AlphaEvolve is unseen
tasks. We release our code publicly.1 well-suited for problems that aim
to construct specific math- ematical objects to improve their certain
quantitative prop- This work was done during Yiping’s internship at Mi-
erties, such as arranging a fixed number of circles within a 1 crosoft.
University of Washington 2 Microsoft 3 Carnegie unit square to maximize
the sum of radii (Friedman, 2012) Mellon University 4 University of
Wisconsin-Madison 5 (referred to as CirclePacking in our work).
University of California, San Diego. Correspondence to: Yiping Wang
<ypwang61@cs.washington.edu>, Si- In detail, AlphaEvolve maintains a
program database that mon Shaolei Du <ssdu@cs.washington.edu>, Yelong
Shen stores high-scoring or diversity-promoting programs (e.g.,
<yeshe@microsoft.com>. those using different strategies) discovered
throughout the Preprint. evolutionary trajectory. At each iteration,
AlphaEvolve sam- 1 https://github.com/ypwang61/ThetaEvolve ples several
prior programs from this database to construct

                                                                                                         1

ThetaEvolve: Test-time Learning on Open Problems

          Response                             Prompt            (async) sequential    AlphaEvolve Dynamic Environment
                                                                      sampling
         <think>...</think>                 Meta Information
        <<<<<<<SEARCH
                                  LLM        Prior Programs                                          Child        Verifier
             # Original Code
                                Ensemble         + results          Prompt            Program      Program
        =======
                                             Parent Program         Builder           Database        +
                                                                                                    result
                                                                                                                    Parser
             # New Code                          + result                                                          Evaluator
        >>>>>>>REPLACE
                                               Instruction




                                     RL training
        Response (1, 1)                                               Batch               RL Static Environment
                                                                    sampling
                ...
                                                Prompt 1
        Response (1, n)                                                                                           Verifier
                               Single LLM          ...              Prompt              Static
                ...
                                                Prompt B            Builder            Dataset                      Parser

        Response (B, n)                                                                                            Evaluator




                                    (Optional) RL training
            Response                                                  Batch           ThetaEvolve Dynamic Environment
          (1, 1)~(B, n)                                            sampling
                                             Prompt 1~B
        <think>...</think>

        <<<<<<<SEARCH
                                            Meta Information
                                                                                      (Large)
                                                                                                       Child
                                                                                                                  Verifier
                               Single LLM                          Prompt                          Programs
            # Original Code                 Parent Program                            Program           +
                                                + result           Builder                            results       Parser
        =======                                                                       Database    (1, 1)~(B, n)
             # New Code                       Instruction                                                          Evaluator
        >>>>>>>REPLACE

Figure 1: ThetaEvolve draws insights from both the AlphaEvolve pipeline
and conventional RL pipelines. (Top) AlphaEvolve/OpenEvolve Dynamic
Environment (inference only). (Middle) RL Static Environment. (Bottom)
ThetaEvolve Dynamic Environment (with or without RL training).
ThetaEvolve simplifies AlphaEvolve by using a single LLM and
(optionally) including only the parent program in the prompt. It adopts
a large program database and uses batch sampling at each step to better
scale test-time compute. It also incorporates lazy penalties and reward
shaping for (optional) RL training.

a prompt, which is then fed to an ensemble of LLMs to in existing
empirical implementations, these pipelines are al- generate improved
child programs. These child programs most always paired with frontier,
large-scale, closed-source are subsequently evaluated and added back
into the program LLM ensembles. This implies a mindset that smaller
open- database (see Fig. 1, top). As we scale the test-time compute,
source models, which are more suitable for open research AlphaEvolve can
continually learn from its own frontier at- and local deployment, cannot
help push the best-known tempts on open problems, while avoiding
unbounded growth results on these challenging tasks. More importantly,
Al- in context length. phaEvolve is purely an inference-time pipeline
and does not update the underlying model at all. Its performance relies
Nevertheless, AlphaEvolve and its follow-up work also entirely on the
design of the inference procedure, meaning exhibit clear limitations.
First, AlphaEvolve remains a that effective exploration strategies or
“search-on-the-edge” closed-source system, which makes systematic study
of pro- behaviors cannot be learned by the model itself. gram evolution
on open problems relatively under-explored. Although recent efforts have
produced open-source vari- On the other hand, reinforcement learning
(RL) has demon- ants such as OpenEvolve (Sharma, 2025) and ShinkaE-
strated strong potential for improving reasoning language volve (Lange
et al., 2025), these pipelines are still complex, models (Gao et al.,
2024; Lambert et al., 2024; OpenAI, with many hyperparameters that are
not fully ablated, leav- 2024; DeepSeek-AI, 2025; Team et al., 2025;
Google Deep- ing it unclear which components are truly essential.
Second, Mind, 2025). AlphaProof (Hubert et al., 2025) further shows

                                                                  2

ThetaEvolve: Test-time Learning on Open Problems

that when the target task is equipped with a self-contained, 2.
Preliminary: AlphaEvolve Pipeline rule-based verifier such as LEAN,
scaling test-time RL can boost performance beyond standard
inference-time scaling. In this section, we briefly introduce the
framework of Al- Notably, program-evolution pipeline such as AlphaEvolve
phaEvolve (Novikov et al., 2025; Georgiev et al., 2025) share the same
structure: once a candidate program is pro- and its open-source
implementation, OpenEvolve (Sharma, duced, the fixed evaluator can
deterministically check valid- 2025) (Fig. 1 Top). More details are in
Appendix C. ity and compute an objective value for further optimization.
Building on this observation, we integrate the evolution on Manual
Preparation. First, for the target task we aim to open optimization
problems with an RL training pipeline, optimize, we have to manually
design an unhackable eval- leading to our framework ThetaEvolve. We
summarize our uator that maps solutions to scalar scores. These systems
contributions below: also require an initial program which provides an
exam- ple that specifies the basic evaluation format. Moreover, (1) We
propose a new open-source pipeline, for scaling test- We need
meta-information that describes the problem and time compute using
either pure inference or reinforcement outlines possible directions for
improving existing bounds. learning (RL) on challenging open problems.
To achieve AlphaEvolve-v2 demonstrates that the advice provided more
efficient and effective inference, we introduce sev- in the prompt can
significantly influence the final perfor- eral modifications, such as
simplifying the LLM ensem- mance (Georgiev et al., 2025). The prompts
used in the ble to a single LLM, sampling a batch of parent programs
paper are detailed in Appendix B.3. and responses at each step to
improve inference throughput (Sec. 4.4.2), and significantly scaling the
size of the program Program Database. During the evolutionary procedure,
database to obtain better final performance (Sec. 4.4.1), etc.
AlphaEvolve continually generates new programs with their To further
enable effective test-time RL on open problems, evaluation results
attached. They are added into an evolu- we incorporate a lazy penalty to
discourage repeatedly out- tionary program database, whose purpose is to
resample putting previously strong programs without attempting im-
previously explored high-quality candidates for future gen- provement,
and add optional reward shaping to keep training erations. AlphaEvolve
mentions a relatively complex evo- rewards within a reasonable range
(Sec. 3, 4.4). lutionary algorithm to manage the programs store in the
(2) Surprisingly, we show that when scaling test-time com- database (See
Appendix C.4 for detailed illustration). In our pute with ThetaEvolve, a
single open-source 8B model, paper, we focus on ablate the parameters
related to database DeepSeek-R1-0528-Qwen3-8B (DeepSeek-AI, 2025), can
size, like population size, which denotes the maxi- improve the
best-known bounds of two open problems con- mum number of programs that
can be stored in the database. sidered in AlphaEvolve: circle packing
and the first auto- When new programs are added into the program
database, correlation inequality (Tab. 1), whereas the previous results
database would rank the program based on metrics like ob- in AlphaEvolve
were achieved using ensembles of strong jective score or diversity, and
delete some programs if the LLMs such as Gemini-2.0-Flash/Pro. Notably,
the circle- database is full. packing program discovered by ThetaEvolve
takes only 3 seconds to find the current best solution, which is sub-
Prompt Builder and LLM Ensemble. The prompt for stantially faster than
the program found by ShinkaEvolve LLM would be built with these
components: the meta- (around 75 seconds), which uses an ensemble of six
ad- information describing the task and relevant insights, one vanced
closed-source models including Claude-Sonnet-4 or some prior programs
the current parent program to be and o4-mini (Sec. 4.2) improved, the
evaluation scores of these programs, and final (3) We further find that
using RL with ThetaEvolve con- instructions including the
code-replacement rules, etc. Here sistently outperforms inference-only
runs across two open- the programs are sampled from program database.
Given source models and four challenging problems We verify the prompt,
LLM ensemble would generate a response with that the model indeed
internalizes nontrivial capabilities for reasoning CoT and one or more
SEARCH/REPLACE diff improving evolution performance: when using a
checkpoint blocks that modify the parent program. trained with RL under
ThetaEvolve for pure inference on the same task, it achieves better
scores and significantly Verifier. The LLM response is then processed by
the faster progress compared with the original model. This im- parser to
extract diff blocks, which are applied to the parent provement even
transfers to other problems, indicating that program to obtain a child
program. This child program RL with ThetaEvolve can generalize
evolutionary capability is subsequently evaluated using the
task-specific evalua- across tasks. We also shows that such improvements
cannot tor. AlphaEvolve uses an asynchronous pipeline to enable be
obtained by using only a format reward or by performing parallel
evaluation, as the evaluator often becomes the com- RL in a static
environment (Sec. 4.3). putational bottleneck due to its potentially
large timeout (e.g., AlphaEvolve-v2 sets a 1000-second timeout for the

                                                                  3

ThetaEvolve: Test-time Learning on Open Problems

FirstAutoCorrIneq problem). Finally, the child pro- producing child code
with compilation errors, we perform a gram and its evaluation result are
added to the database, series of early checks to avoid unnecessary
evaluation and where they are reranked and organized as described
earlier. assign penalty scores (\< 0) to such cases. In detail, given a
parent program pp, an LLM response r, a child program 3. ThetaEvolve Key
Features cp = cp(pp, r) produced by the parser, and an evaluator
function E, we apply the following checks: In this section, we introduce
the key features of ThetaEvolve.  We mention the most important
features, and leave other    −0.4, if no diff blocks are found in r,
details in Appendix B. −0.3, elif no valid changes (cp ≡ pp),   
s(pp, r) = −0.2, elif no solution, 3.1. Direct Adjustment  −0.1, elif
invalid solution,     First, we make several straightforward
simplifications or  E(cp), otherwise. modifications relative to
AlphaEvolve/OpenEvolve. (1) Here, “no solution” includes different kinds
of cases that Single LLM. Unlike previous works that emphasize LLM
prevent the program from getting any solution, like compila- ensembles,
we only use a single LLM in ThetaEvolve. tion errors, execution errors,
and timeouts. “Invalid solution” means the program successfully produces
an solution, but it Large Program Database. We use a much larger program
fails the evaluator’s validity checks (e.g., overlapping circles
database (population size = 10000) in ThetaEvolve in CirclePacking).
compared with OpenEvolve (population size = 70; Notably, we penalize all
non-valid changes (cp ≡ pp). This AlphaEvolve does not specify the exact
size). As shown in is crucial for RL training: since improving solutions
to Sec. 4.4.1, scaling the database size improves final perfor- open
mathematical problems is difficult, most modifications mance as the
test-time compute increases. do not yield better scores, especially when
performance is already near best-known results. To prevent the model
(Optional) Iterative Refinement. We sample only the par- from producing
lazy outputs,i.e., repeating the current best ent program, without
including additional prior programs program, we additionally penalize
any child program that is as in AlphaEvolve, resulting in a simplified
iterative refine- equivalent (up to comment removal) to any program
already ment procedure. This setup is optional and is used primarily
present in the program database. to improve efficiency by reducing
prompt length. 3.4. (Optional) RL Reward Shaping 3.2. Batch Sampling and
Generation Our ThetaEvolve system provides an adaptive verifiable In
AlphaEvolve, each iteration builds only a single prompt environment
(Zeng et al., 2025) for RL training. A natural and obtains one LLM
response. Although it uses an asyn- choice for the reward is the
original objective score, which chronous pipeline, it is still not
efficient enough when scal- works for tasks like CirclePacking. However,
some ing test-time compute, as it cannot fully leverage optimized tasks
may have more narrow ranges of objective values batched inference
engines such as vLLM (Kwon et al., 2023) (e.g., 0.90 ∼ 0.96 for
SecondAutoCorrIneq) which or SGLang (Zheng et al., 2024). Therefore, we
generate can not effectively differentiate rewards for different solu-
multiple responses from a batch of different parent pro- tion.
Therefore, we normalize the reward for some tasks to grams to improve
the inference efficiency. As shown in the provide a more stable and
effective training signal. Specifi- bottom of Fig. 1, at each step,
ThetaEvolve independently cally, for a given objective score s (possibly
obtained from samples B parent programs from the database, producing B
an early check), we define the reward function R as: prompts. Then, n
responses are generated for each prompt, yielding a total of B × n child
programs. These responses ( s, if s \< 0 or reward shaping is disabled,
and their metrics can also be used for RL training. When R(s) =
inserting these programs into the database, we add them k · F(s),
otherwise. sequentially and re-organize the database after each inser-
(2) tion, which incurs negligible overhead compared with other Here, F :
\[0, ∞) → \[0, 1\] is the reward-shaping function system operations. and
k ∈ R+ is the scaling factor of reward, which is set to be 3 in our
paper. For each task, we manually specify the 3.3. Early Check and Lazy
Penalty upper and lower bounds of the objective value as U and L,
together with a factor α ≥ 1. We then define F as: Since the LLM may
generate responses with various is- α sues, such as missing
SEARCH/REPLACE diff blocks or F(s) = {clip(H(s), 0, 1)} , (3)

                                                                 4

ThetaEvolve: Test-time Learning on Open Problems

where a larger α rewards higher scores more aggressively (1) The
evaluation setups in OpenEvolve and AlphaEvolve as the score approaches
the best-known value, and H(s) is differ slightly for circle packing
problems. OpenEvolve a simple linear mapping that transforms \[L, U \]
to \[0, 1\]: permits a tolerance of 1 × 10−6 when checking whether (
circles overlap or lie outside the unit square (Appendix A.1). (s −
L)/(U − L), if maximizing, This minor difference leads to slightly
different optimiza- H(s) = (4) (U − s)/(U − L), otherwise. tion
problems. In our work, we follow OpenEvolve’s eval- uation setup
(CirclePacking-T, Tolerance), and re- fer to the strict AlphaEvolve
version as a separate task, Details of the reward-shaping parameters for
each task are CirclePacking. We still achieve new SOTA results on
provided in Appendix B.2, and we present ablation studies CirclePacking
by slightly shrinking the radii of the and recommended setup for reward
shaping in Sec. 4.4.3. solutions obtained for CirclePacking-T. (2) The
evaluation function for ThirdAutoCorrIneq 4. Experiments provided by
AlphaEvolve contains several typos (Wang & In our experiments, we
present new best-known bounds Tao, 2025) (see Appendix A.4 for details),
which also leads obtained by scaling with ThetaEvolve (Sec. 4.2),
analyze to a different optimization problem. We correct these issues RL
training under ThetaEvolve (Sec. 4.3), and ablate key in our verifier,
but as a consequence, our bounds are not components of the framework
(Sec. 4.4). We first introduce directly comparable to those reported in
AlphaEvolve. the experimental setup below. RL Training. We use GRPO
(Shao et al., 2024) as our RL 4.1. Setup algorithm, augmented with
asymmetric clipping (Yu et al., Model. We consider two open-source small
mod- 2025) using clip low = 0.2 and clip high = 0.28. els: ProRL-1.5B-v2
(Hu et al., 2025) and The learning rate is set to 10−6 and the weight
decay to 0.1. DeepSeek-R1-0528-Qwen3-8B (DeepSeek-AI, We additionally
apply truncated importance sampling (Yao 2025) (which we refer to as
Distill-Qwen3-8B for et al., 2025; Liu et al., 2025b;a) to improve
training stability. brevity). They contain far fewer parameters than
closed- Importantly, we do not incorporate dynamic sampling (Yu source
SOTA models, but have competitive capabilities et al., 2025) to maintain
a fair comparison between the among models of similar scale. number of
samples used during RL training and inference. Nevertheless, dynamic
sampling may further improve train- Pipeline. we build our
program-evolution dynamic envi- ing stability and overall performance.
We do not include ronment based on OpenEvolve (Sharma, 2025), an open-
KL-divergence or entropy regularization. source implementation of
AlphaEvolve. We utilizes slime framework (Zhu et al., 2025) for RL
training. We set the Multi-Seed. For the main experiments, we use three
ran- batch size to B = 32 and the number of responses per dom seeds (42,
1234, 3407) to reduce variance. We note prompt to n = 16 for both RL and
pure inference in ThetaE- that scaling compute by running with more
random seeds volve. The maximum response length is 16,384 tokens, and
may further improve final performance. the rollout temperature is 1.0.
We allow at most 16 verifier programs to run simultaneously. 4.2. Main
Result: Scaling with ThetaEvolve

Tasks. We evaluate five open mathematical problems. Firstly, we present
the main experiments with ThetaEvolve Four of them originate from
AlphaEvolve (Novikov et al., on two models and four open optimization
problems, includ- 2025): (1) CirclePacking-T: pack N = 26 circles into
ing both pure-inference and RL training runs. The results are a unit
square while maximizing the sum of radii; (2/3/4) shown in Tab. 2.
Impressively, for Distill-Qwen3-8B, FirstAutoCorrIneq /
SecondAutoCorrIneq / ThetaEvolve achieves better results on
CirclePacking ThirdAutoCorrIneq: improve the constant bounds than
AlphaEvolve in both the RL and no-RL settings. In Ap- for the first,
second, and third autocorrelation inequal- pendix E.3, we further show
that our solution has a slightly ities by constructing specialized
functions; and (5) different configuration from the AlphaEvolve
solution: ours HadamardMatrix: maximize the determinant of a is
asymmetric, whereas AlphaEvolve’s is symmetric. We Hadamard matrix with
N = 29. Among these tasks, also note that our solution is visually close
to the one found FirstAutoCorrIneq and ThirdAutoCorrIneq by
ShinkaEvolve2 ; however, ShinkaEvolve uses an ensem- are minimization
problems, while the others are maximiza- ble of six frontier LLMs such
as Claude-Sonnet-4, o4-mini, tion ones. Task descriptions, meta
information, and task- 2 https://github.com/SakanaAI/ specific
parameters are detailed in Appendix A, B.3, and
ShinkaEvolve/blob/main/examples/circle\_ B.2, respectively. Importantly,
we note that packing/viz_circles.ipynb

                                                                 5

ThetaEvolve: Test-time Learning on Open Problems

Table 2: Main results. For each task, we compare w/ RL and w/o RL under
different training steps for ProRL-1.5B-v2 and Distill-Qwen3-8B. “↑”
denotes maximization tasks and “↓” denotes minimization tasks. We report
the mean and best scores across three seeds. More details are in Tab. 9,
and related parameters are list in Tab. 8. Notably, the best result
achieved by AlphaEvolve on CirclePacking is 2.63586276. Although our
evaluator includes a 10−6 tolerance in the validity checks as in
OpenEvolve, it is easy to prove that, even after uniformly shrinking the
radii of all circles by 10−6 , the solutions from our runs on
Distill-Qwen3-8B remain better than that of AlphaEvolve.

                                               ProRL-1.5B-v2 (Hu et al., 2025) Distill-Qwen3-8B (DeepSeek-AI, 2025)

Task Method Step Mean Best Step Mean Best Initial 0 – 0.9598 0 – 0.9598
CirclePacking-T (↑) w/ RL 200 2.3498 2.5225 65 2.6359840 2.6359857 w/o
RL (early) 200 2.0265 2.1343 65 2.6354195 2.6359831 w/o RL (late) 600
2.0991 2.2491 100 2.6359541 2.6359834 Initial 0 – 3.1586 0 – 3.1586
ThirdAutoCorrIneq (↓) w/ RL 200 1.6412 1.6053 65 1.5210 1.4930 w/o RL
(early) 200 1.6831 1.6155 65 1.5498 1.5084 w/o RL (late) 600 1.6766
1.6123 100 1.5491 1.5084 Initial 0 – 0.1433 0 – 0.1433 HadamardMatrix
(↑) w/ RL 100 0.4808 0.5635 65 0.5696 0.5764 w/o RL (early) 100 0.3264
0.4961 65 0.5500 0.5733 w/o RL (late) 300 0.4920 0.5375 100 0.5515
0.5733 Initial – 0 – 0.9055 SecondAutoCorrIneq (↑) w/ RL – 65 0.9444
0.9469 w/o RL (early) – 65 0.9411 0.9433 w/o RL (late) – 100 0.9418
0.9434

and GPT-4.1, and their program requires around 75 seconds 4.3. Analysis
of RL training to find the solution, while ours takes only about 3
seconds. Furthermore, we analyze the affect of applying RL training See
Appendix E.2 for the details of our program. with ThetaEvolve. Across
all tasks, we also observe that ThetaEvolve with RL consistently
outperforms pure inference, even with fewer 4.3.1. D OES THE M ODEL R
EALLY L EARN TO E VOLVE ? training steps (each corresponding to 512 new
programs). Both settings significantly improve upon the initial pro- To
verify whether the RL process in ThetaEvolve helps grams. At first
glance, the improvements may appear the model learn useful evolutionary
strategies, we vi- small, but it is important to emphasize that as a
bound sualize the training curve of ProRL-1.5B-v2 on approaches the
best-known value, further gains become CirclePacking-T (abbreviated as
“CP” in this section). much more difficult, and even small improvements
are The results are shown in Fig. 3, left. In addition to the w/ RL
non-trivial. Moreover, solutions with similar scores can and w/o RL
baselines, we include a third setting: we load still differ meaningfully
in structure. To illustrate this, the step-150 checkpoint from the best
w/ RL run (whose we visualize several solutions in Fig. 2. Although some
best score is 2.5225), and then perform pure inference on runs achieve
close numerical scores, their constructed func- top of this checkpoint
(denoted as “Load CP@150”). tions show clear qualitative differences.
For example, on We observe that: (1) Consistent with the results in Tab.
2, ThirdAutoCorrIneq, ProRL-1.5B-v2 achieves a w/ RL runs improve
programs more quickly (in terms of score around 1.6 while
Distill-Qwen3-8B achieves training steps or number of generated
responses/programs) around 1.5, seemingly a modest difference compared
the dif- than pure inference and also achieve better final perfor-
ference with initial program’s 3.1586, yet Fig. 2 reveals that mance.
(2) Inference using the RL-trained checkpoint the function constructed
by Distill-Qwen3-8B is sub- (“Load CP@150”) climbs even faster than the
w/ RL runs stantially more complex than that of ProRL-1.5B-v2. and
achieves a better best score than inference with the original model,
though still slightly worse than the full RL run. This indicates that RL
meaningfully updates the model parameters in ways that benefit program
evolution.

                                                                 6

ThetaEvolve: Test-time Learning on Open Problems

                                   Circle Packing: Init, score=0.9597642170                                                                                Circle Packing: 1.5B-w_RL@200, score=2.5224972097
                    1.0                                                                            1.0Circle Packing: 1.5B-wo_RL@600, score=2.2491476857 1.0
                                                                                                                                                                                                        4             9            14           19           24

                    0.8                                                                            0.8                                                                               0.8
                                                                                                                                                                                                        3             8            13           18           23

                    0.6                                                                            0.6                                                                               0.6
                                                                                                                                                                                                        2             7            12           17           22

                    0.4                                                                            0.4                                                                               0.4
                                                                                                                                                                                                        1             6            11           16           21

                    0.2                                                                            0.2                                                                               0.2 25
                                                                                                                                                                                                        0             5            10           15           20

                    0.0                                                                                                                                                              0.0
                      0.0             0.2          0.4          0.6         0.8           1.0 0.00.0                   0.2       0.4           0.6           0.8          1.0          0.0                     0.2         0.4          0.6           0.8          1.0

                                                                                                                  (a) CirclePacking-T
                            Autoconvolution (Normalized): ProRL-1.5B-v2                                    Autoconvolution (Normalized): DeepSeek-R1-0528-Qwen3-8B                                          Autoconvolution (Normalized): DeepSeek-R1-0528-Qwen3-8B
       1.6                                                                                          1.5                                                                                           1.0
       1.4
                                                                                                    1.0                                                                                           0.8
       1.2
       1.0                                                                                                                                                                                        0.6
                                                                                                    0.5                                                                                                                                        w/o RL @ Step 100, score=0.9434

f(x) 0.8 f(x) f(x) w/ RL @ Step 65, score=0.9469 0.6 0.4 0.0 0.4 0.2 0.2
w/o RL @ Step 600, score=1.6123 w/o RL @ Step 100, score=1.5084 0.5 0.0
w/ RL @ Step 200, score=1.6053 w/ RL @ Step 65, score=1.4930 0.0 0.3 0.2
0.1 0.0 0.1 0.2 0.3 0.3 0.2 0.1 0.0 0.1 0.2 0.3 0.3 0.2 0.1 0.0 0.1 0.2
0.3 x x x

                             Step function (Normalized): ProRL-1.5B-v2                                          Step function (Normalized): DeepSeek-R1-0528-Qwen3-8B                                         Step function (Normalized): DeepSeek-R1-0528-Qwen3-8B
                                        w/o RL @ Step 600, score=1.6123                                                                                                                                                                        w/o RL @ Step 100, score=0.9434
       0.40                             w/ RL @ Step 200, score=1.6053                              0.3                                                                                           0.4                                          w/ RL @ Step 65, score=0.9469
       0.35                                                                                         0.2
       0.30                                                                                                                                                                                       0.3
                                                                                                    0.1
       0.25

f(x) f(x) 0.0 f(x) 0.2 0.20 0.15 0.1 0.1 0.10 0.2 w/o RL @ Step 100,
score=1.5084 0.05 0.3 w/ RL @ Step 65, score=1.4930 0.0 0.3 0.2 0.1 0.0
0.1 0.2 0.3 0.3 0.2 0.1 0.0 0.1 0.2 0.3 0.3 0.2 0.1 0.0 0.1 0.2 0.3 x x
x

                   (b) ThirdAutoCorrIneq                                                                    (c) ThirdAutoCorrIneq                                                                           (d) SecondAutoCorrIneq

Figure 2: Visualization of the solutions. Although the scores of the w/
RL and w/o RL solutions are close, the solutions themselves (and the
corresponding programs) may differ noticeably. We normalize the
functions (see Appendix A) for clearer visualization. Besides, the
constructed function obtained from Distill-Qwen3-8B is still much more
complex than the one from ProRL-1.5B-v2 (b and c), even though both are
evolved with the same initial program and prompt.

Moreover, we evaluate this CirclePacking-trained check- as in
ThetaEvolve. We compare our results with a baseline point on unseen
tasks, as shown in Fig. 3, middle and right. that applies RL in a static
environment, i.e., always starting We find that, compared to the base
model, this checkpoint from the initial program, which is also used in
AlphaE- significantly improves average performance, often match- volve’s
ablation. The results, shown in Fig. 4, indicate a ing or even
surpassing the w/ RL runs on those tasks, and substantial performance
gap: RL with a static environment slightly improves the best performance
as well. This sug- performs much worse than RL with ThetaEvolve, and
even gests that RL with the ThetaEvolve dynamic environment worse than
the pure inference baseline with ThetaEvolve. In may enable the model to
acquire an evolution capability Appendix D, we roughly analyze why this
occurs: for chal- that transfers across tasks, providing a positive
signal that lenging open problems, directly sampling the final advanced
this single-task RL training paradigm could potentially be program is
extremely unlikely. Thus, the task must be de- extended into a more
general post-training recipe. composed into a trajectory of incremental
improvements, enabling the model to learn and operate at the frontier of
its 4.3.2. C OMPARISON WITH C ONVENTIONAL RL current capabilities. T
RAINING We further highlight the importance of applying RL with a
dynamic environment that stores and updates experience,

                                                                                                                                       7

ThetaEvolve: Test-time Learning on Open Problems

                                ProRL-v2-1.5B - Mean over seeds                                         ProRL-v2-1.5B - Mean over seeds                                   1.70        ProRL-v2-1.5B - Mean over seeds
                     2.50
                                                                                             0.5                                                                          1.68


                                                                                                                                                      ThirdAutoCorrIneq
                     2.25

     CirclePacking                                                          HadamardMatrix
                     2.00                                                                    0.4                                                                          1.66
                     1.75                                                                    0.3                                                                          1.64
                                         w/o RL (2.0991)                                                         w/o RL (0.4920)                                                        w/o RL (1.6766)
                     1.50                w/o RL, Load_CP@150 (2.3852)                                            w/o RL, Load_CP@150 (0.5231)                             1.62          w/o RL, Load_CP@150 (1.6424)
                                         w/ RL (2.3498)                                      0.2                 w/ RL (0.4808)                                                         w/ RL (1.6412)
                     1.25                                                                                                                                                 1.60
                            0    100 200 300 400 500 600                                           0      50   100 150 200 250 300                                               0      100 200 300 400 500 600
                                             Step                                                                     Step                                                                          Step
                                  ProRL-v2-1.5B - Best Seed                                                ProRL-v2-1.5B - Best Seed                                    1.70             ProRL-v2-1.5B - Best Seed
                    2.50                                                                                                                                                                       w/o RL (1.6123)
                                                                                            0.5                                                                         1.68                   w/o RL, Load_CP@150 (1.6118)



                                                                                                                                                    ThirdAutoCorrIneq
                    2.25


                                                                           HadamardMatrix
                                                                                                                                                                                               w/ RL (1.6053)


    CirclePacking
                    2.00                                                                    0.4                                                                         1.66
                    1.75                                                                    0.3                                                                         1.64
                                         w/o RL (2.2491)                                                         w/o RL (0.5375)
                    1.50                 w/o RL, Load_CP@150 (2.4061)                                            w/o RL, Load_CP@150 (0.5409)                           1.62
                                         w/ RL (2.5225)                                     0.2                  w/ RL (0.5635)
                    1.25                                                                                                                                                1.60
                            0    100 200 300 400 500 600                                           0     50    100 150 200 250 300                                               0     100 200 300 400 500 600
                                         Step                                                                      Step                                                                        Step

Figure 3: RL-trained models outperform the base model in pure inference,
both on the trained target task and on unseen tasks. Here, “Load CP@150”
loads the step-150 checkpoint from the best w/ RL run (best score
2.5225) of ProRL-1.5B-v2 on CirclePacking-T. Shaded regions indicate
standard deviation across different seeds. ProRL-v2-1.5B - Mean over
seeds 2.7 Distill-Qwen3-8B - Mean over seeds Distill-Qwen3-8B - Mean
over seeds 2.5 2.0

                                                                                                                                                      ThirdAutoCorrIneq
                                                                                                                                                                                                     w/ RL, static env (1.6173)


     CirclePacking                                                          CirclePacking
                                                                                                                                                                          1.8                        w/ RL (1.5210)
                     2.0
                                                                                             2.6
                     1.5                      w/ RL, static env (1.5985)                                            w/ RL, static env (2.6123434)                         1.6
                                              w/ RL (2.3498)                                                        w/ RL (2.6359840)
                     1.0                                                                     2.5                                                                          1.4
                            0       50        100       150          200                           0           20          40          60                                        0           20           40         60
                                             Step                                                                     Step                                                                          Step
                                   ProRL-v2-1.5B - Best Seed                                 2.7          Distill-Qwen3-8B - Best Seed                                                  Distill-Qwen3-8B - Best Seed
                     2.5                                                                                                                                                  2.0


                                                                                                                                                      ThirdAutoCorrIneq
                                                                                                                                                                                                     w/ RL, static env (1.6010)


     CirclePacking                                                          CirclePacking
                                                                                                                                                                          1.8                        w/ RL (1.4930)
                     2.0
                                                                                             2.6
                     1.5                      w/ RL, static env (1.6890)                                            w/ RL, static env (2.6171644)                         1.6
                                              w/ RL (2.5225)                                                        w/ RL (2.6359857)
                     1.0                                                                     2.5                                                                          1.4
                            0       50       100         150         200                           0           20               40         60                                    0           20            40            60
                                             Step                                                                        Step                                                                       Step

Figure 4: RL with ThetaEvolve dynamic environment outperform RL with
static environment. Here static environment means always starting with
initial program, similar to the ablation baseline used in AlphaEvolve
(Novikov et al., 2025).

               ThirdAutoCorrIneq (↓)                             Mean                          Best                       check failures, not format errors). We evaluate this base-
               w/o RL                                            1.6766                      1.6123                       line on ThirdAutoCorrIneq using ProRL-1.5B-v2,
               w/ RL                                             1.6412                      1.6053                       and the results are shown in Tab. 3. The results show that RL
               w/ RL, format reward                              1.6783                      1.6744                       with format reward is ineffective for challenging open prob-
                                                                                                                          lems and performs even worse than pure inference. This
                       Table 3: Format reward baseline fails.                                                             confirms that RL with a ground-truth evaluator learns non-
                                                                                                                          trivial capabilities that meaningfully improve the evolution
                                                                                                                          on open problems.

4.3.3. F ORMAT R EWARD Finally, to rule out the possibility that the
model is not 4.4. Additional Analysis truly learning to evolve but only
learning the evolution for- mat, such as consistently outputting
SEARCH/REPLACE In this section, we present ablation studies on key
compo- diff blocks or avoiding exact repetition of the parent pro- nents
of ThetaEvolve (database size, batch sampling, and re- gram, we further
compare with a format reward baseline, ward shaping), showing the
effectiveness of our designs. In motivated by prior works (Wang et al.,
2025; Shao et al., Appendix E.4, we also show that the database
management 2025b). This baseline assigns a reward of 1.0 whenever
strategies in AlphaEvolve/OpenEvolve remain important. the program score
in Eq. 1 is not −0.4 or −0.3 (note that the other two error scores
correspond to runtime or validity-

                                                                                                                     8

ThetaEvolve: Test-time Learning on Open Problems

                       CirclePacking - Mean over 3 seeds                            CirclePacking - Best over 3 seeds
             2.2                                                          2.2                                                            0.5 HadamardMatrix - Mean over 3 seeds                   0.5 HadamardMatrix - Best over 3 seeds
             2.0                                                          2.0                                                            0.4                                                      0.4

Best Score Best Score Best Score Best Score 1.8 1.8 0.3 0.3 1.6 Small
(70) 1.6 Small (70) 0.2 Small (70) 0.2 Small (70) 1.4 Medium (1000) 1.4
Medium (1000) 0.1 Medium (1000) 0.1 Medium (1000) Large (10000) Large
(10000) Large (10000) Large (10000) 1.2 1.2 0.0 0.0 0 51k 102k 154k 205k
256k 307k 0 51k 102k 154k 205k 256k 307k 0 26k 51k 77k 102k 128k 154k 0
26k 51k 77k 102k 128k 154k Number of Generated Programs Number of
Generated Programs Number of Generated Programs Number of Generated
Programs

Figure 5: Scaling database size improves the performance of program
evolution, especially when increasing test-time compute. Here we
consider ProRL-1.5B-v2, plot the mean and highest values of the best
objective score across evolution runs with 3 seeds. (Left) Evaluate
CirclePacking-T, using the default OpenEvolve pipeline (Fig. 1, top)
except that we vary the database size as described in Sec. 4.4.1.
(Right) Similar OpenEvolve setup for HadamardMatrix.

                                                           Small                    Medium          Large                                          Pipeline                       #Programs Mean                               Best
                       population size                      70                        1000          10000                                          AlphaEvolve                                               2.6358628
                         archive size                       25                         100          1000
                                                                                                                                                   (Initial program)                                           0.9598
                          num islands                        5                          10            10
                                                                                                                                                   OpenEvolve                            512                       1.0955     1.2634

Table 4: Configurations for ablation study of database size. OpenEvolve
307.2k 2.1313 2.1773 The Small setup is similar to that used in
OpenEvolve. ThetaEvolve w/o RL 307.2k 2.0991 2.2491 ThetaEvolve w/ RL
307.2k 2.3498 2.5225

                                                                                                                                  Table 5: Ablation study across different pipelines. Model:

4.4.1. S CALING DATABASE FOR C OLLABORATING WITH ProRL-1.5B-v2, task:
CirclePacking-T. S CALING T EST-T IME C OMPUTE Firstly, we show that
scaling the size of the program quential sampling, and compare it with
ThetaEvolve. We database is important when increasing test-time compute.
show that ThetaEvolve without RL can perform as well as Notably,
OpenEvolve include three key parameters related OpenEvolve, even though
its program database is updated to database size: (1) population size:
the maximum in a less online manner due to batch-based program gener-
number of programs that can be stored in the database; ation, while
achieving significantly faster inference. Here, (2) archive size: the
size of the elite archive, from we serve ProRL-1.5B-v2 using vanilla
SGLang (Zheng which programs are sampled with higher probability for ex-
et al., 2024) with the same inference parameters (e.g., TP, ploitation;
(3) num islands: the number of independent- dtype) used in ThetaEvolve.
The results are shown in Tab. 5. subgroups in evolution, in general the
larger the more diver- sity. (Check Appendix C.4 for detailed
illustration). We set We observe that when generating only a small
number of the database-size configurations as listed in Tab. 4, and the
new programs (e.g., ∼ 500), similar to OpenEvolve’s default results of
ablating database size are presented in Fig. 5. setup, ProRL-1.5B-v2
exhibits very limited improve- ment over the initial program. However,
when scaling the We see that when test-time compute is relatively small
(e.g., test-time compute of OpenEvolve to match ThetaEvolve fewer than
40 inference steps or fewer than 20K generated w/o RL (307.2k new
programs), the OpenEvolve pipeline programs), a smaller database can
progress faster because also achieves a similarly large improvement,
though it still high-scoring programs are sampled more frequently (Note
underperforms RL-trained runs. This highlights that scaling that the
Large database requires approximately 10K pro- test-time compute is
essential for evolving tasks, regardless grams (or roughly 20 inference
steps) before it becomes of the inference pipeline. fully populated and
begins discarding low-scoring pro- grams). However, when further scaling
test-time compute, In addition, inference with ThetaEvolve is much
faster than it always have very limited additional improvement, while
with OpenEvolve, as shown in Tab. 6. We attribute this to increasing the
database size improves the diversity of candi- batch sampling, which
provides much higher throughput for date programs, which in turn
strengthens the effectiveness the inference engine compared to
asynchronous sequential of the evolutionary search. requests.

4.4.2. BATCH S AMPLING 4.4.3. RL R EWARD S HAPING In this section, we
scale the test-time compute in the orig- Furthermore, we discuss the
influence of RL reward-shaping inal OpenEvolve pipeline, which uses
asynchronous se- parameters. We consider ThirdAutoCorrIneq and re-

                                                                                                                        9

ThetaEvolve: Test-time Learning on Open Problems

                      Pipeline           Time (h)                     steps, Distill-Qwen3-8B discovers a step function
                                                                      whose auto-convolution is very similar to that found by
               OpenEvolve                  63.6                       AlphaEvolve-v2 (Georgiev et al., 2025) (Fig. 6 Middle).
           ThetaEvolve (w/o RL)             5.4                       Although our objective score (1.5068) is still worse than
                                                                      the SOTA value (1.5032), it already surpasses the previous

Table 6: Speed comparison for different pipelines. Here human SOTA
result (1.5097) (Matolcsi & Vinuesa, 2010). we run ProRL-1.5B-v2 on
CirclePacking-T for A similar pattern appears in SecondAutoCorrIneq: al-
400 inference steps (204.8K new programs). Experiments though our score
(0.9469) is worse than the most recent are conducted on 4 A6000.
AlphaEvolve-v2 result (0.9610), it is still better than the pre- vious
human best result (0.9414) (Jaech & Joseph, 2025a). U L α Mean Best
Notably, the timeout of our program is only 350 seconds, whereas the
programs used for the human best bound or ProRL-1.5B-v2 AlphaEvolve-v2
often require much longer runtimes, like w/o RL - - - 1.6766 1.6123
several hours. w/ RL 3.2 1.4557 3.0 1.6535 1.6231 w/ RL 2.5 1.5 1.0
1.6412 1.6053 (2) Beyond (1), we further use the AlphaEvolve-v2 SOTA
solution as an additional initialization. In this setting,
Distill-Qwen3-8B Distill-Qwen3-8B can still make slight improvements w/o
RL - - - 1.5491 1.5084 over the SOTA solution. Although the generated
programs w/ RL 3.2 1.4557 3.0 1.5210 1.4930 primarily apply small
perturbations to the step function, im- proving local optimization
efficiency but not exploring more Table 7: Ablation of RL reward-shaping
parameters on aggressive modifications as AlphaEvolve-v2, we mention
ThirdAutoCorrIneq (↓). that this initialization may already be a local
minimum that hard to further improve from.

port results in Tab. 7. Interestingly, we observe that the pa- 5.
Related Work rameter settings that work well for Distill-Qwen3-8B
perform suboptimally for ProRL-1.5B-v2. A possi- Previous work has
incorporated LLMs into the evaluation ble explanation is that
Distill-Qwen3-8B can quickly loop for prompt optimization, where the
model iteratively reach scores close to the truncated lower bound L, for
ex- updates contextual information in the prompt based on ample,
achieving around 1.53 ∼ 1.57 by step 20, whereas feedback to improve
downstream performance (Yang et al., ProRL-1.5B-v2 only reaches 1.8 ∼
2.0 at step 20 and 2023; Khattab et al., 2023; Fernando et al., 2023;
Guo et al., never surpasses 1.60. Therefore, α = 3.0 is too aggres-
2023; Madaan et al., 2023; Agrawal et al., 2025). A related sive for
ProRL-1.5B-v2, and a narrower \[U, L\] range line of work on agentic
LLMs maintains trajectory informa- together with a smaller α = 1 yields
better performance. tion or feedback in explicit context managers (Shinn
et al., 2023; Zhang et al., 2025; Zhang et al.), and then surfaces In
general, when tackling a new problem, we recommend this experience in
subsequent prompts. By contrast, recent first running ThetaEvolve
without RL as a strong baseline. pipelines such as FunSearch
(Romera-Paredes et al., 2024) Then, determine U , L, and α for RL
training based on the and AlphaEvolve (Novikov et al., 2025; Georgiev et
al., observed score distribution during the inference process. If 2025)
focus on more specific goals for in-context evolv- researchers do not
have sufficient quota to tune these pa- ing, e.g., program optimization
for continuous objectives rameters, keeping α = 1 and narrowing \[L, U
\] to a smaller on challenging open problems. However, these prompt-
range is a consistently safe and robust strategy. optimization and
evolutionary program-search systems are still predominantly
inference-time pipelines, so the under- 4.4.4. M ORE C OMPARISON WITH A
LPHA E VOLVE lying LLM does not internalize the discovered capabilities.
Finally, note that the second version of the AlphaEvolve On the other
hand, AlphaProof (Hubert et al., 2025) couples report (Georgiev et al.,
2025) provides an optional initial a pre-trained LLM with an
AlphaZero-style (Silver et al., program and prompt for
FirstAutoCorrIneq, it allows 2018) reinforcement learning loop in the
Lean proof assis- us to directly compare our setup with AlphaEvolve. We
tant (de Moura et al., 2015), which serves as a self-contained consider
two setups and the results are visualized in Fig. 6. automated verifier.
Beyond its large-scale offline RL train- ing, AlphaProof further employs
Test-Time RL (TTRL): at (1) We use the provided initial program (with
score inference time, it generates a curriculum of formal variants
1.5214) and prompt from AlphaEvolve-v2 (Fig. 6, Left), around a hard
target problem and continues RL training on and keep the initial program
start from random solu- these variants within the Lean environment,
enabling strong tion as AlphaEvolve. We observe that after around 50

                                                                 10

ThetaEvolve: Test-time Learning on Open Problems

                   Autoconvolution (Normalized): ProvidedInit vs HumanBest                                 Autoconvolution (Normalized): DeepSeek-R1-0528-Qwen3-8B                         Autoconvolution (Normalized): DeepSeek-R1-0528-Qwen3-8B
       1.4                                                                                         1.4                                                                             1.4
       1.2                                                                                         1.2                                                                             1.2
       1.0                                                                                         1.0                                                                             1.0
       0.8                                         ProvidedInit, score=1.5213612781                0.8                   w/o RL @ Step 49, score=1.5068026727                      0.8                   w/o RL @ Step 46, score=1.5031324360

f(x) HumanBest, score=1.5097201507 f(x) AlphaEvolve-v2,
score=1.5031635547 f(x) AlphaEvolve-v2, score=1.5031635547 0.6 0.6 0.6
0.4 0.4 0.4 0.2 0.2 0.2 0.0 0.0 0.0 0.3 0.2 0.1 0.0 0.1 0.2 0.3 0.3 0.2
0.1 0.0 0.1 0.2 0.3 0.3 0.2 0.1 0.0 0.1 0.2 0.3 x x x

Figure 6: Comparison with AlphaEvolve under the same initial program and
prompt. We consider FirstAutoCorrIneq. (Left) The solutions and scores
of the previous human SOTA (Matolcsi & Vinuesa, 2010) and the initial
program provided in AlphaEvolve-v2. (Middle) Running ThetaEvolve without
RL, we find that although our score is worse than the new best-known
function found in AlphaEvolve-v2, our evolved program produces an
autoconvolu- tion curve that is highly similar, and our solution still
outperforms the previous human SOTA. (Right) When we additionally
initialize with the AlphaEvolve-v2 SOTA solution, ThetaEvolve can make
slight further improvements to the bound.

problem-specific adaptation that substantially boosts its for- Sciences
AI 2050 Fellowship. mal proving performance. Motivated by these
directions, ThetaEvolve treats an AlphaEvolve-style program evolu-
References tion pipeline as an adaptive verifiable environment (Zeng et
al., 2025; Shao et al., 2025a), and applies RL to optimize Agrawal, L.
A., Tan, S., Soylu, D., Ziems, N., Khare, R., programs for
continuous-reward objectives. Opsahl-Ong, K., Singhvi, A., Shandilya,
H., Ryan, M. J., Jiang, M., et al. Gepa: Reflective prompt evolution can
outperform reinforcement learning. arXiv preprint 6. Discussion on
Future Work arXiv:2507.19457, 2025. In general, AlphaEvolve and
ThetaEvolve are broad Anthropic. Claude 4.5, 2025. URL https://claude.
pipelines suitable for optimization problem with a continu- ai/. Large
language model. ous reward, making them applicable to a wide range of
real- world tasks beyond open mathematical problems. More- Boyer, C. and
Li, Z. K. An improved example for an auto- over, the task-transfer
phenomenon observed in Sec. 4.3.1 convolution inequality. arXiv preprint
arXiv:2506.16750, suggests that we may be able to train on multiple
targets 2025. simultaneously, for example, using different instances of
the same task with varying parameters (e.g., different num- Charton, F.,
Ellenberg, J. S., Wagner, A. Z., and Williamson, bers of circles in
CirclePacking) or even combining G. Patternboost: Constructions in
mathematics with a entirely different tasks. This could potentially
extend to little help from ai. arXiv preprint arXiv:2411.00566,
post-training workflows as well. Finally, we emphasize that 2024.
enabling a model to continually learn may require replacing Cilleruelo,
J., Ruzsa, I., and Vinuesa, C. Generalized sidon a static environment
with a dynamic one that co-evolves sets. Advances in Mathematics,
225(5):2786–2807, 2010. with the model, which may also provides insights
for effec- tive exploration strategy in RL training. Our work offers
Cloninger, A. and Steinerberger, S. On suprema of autocon- an early
attempt at applying RL to a dynamic, verifiable volutions with an
application to sidon sets. Proceedings of environment controlled by a
context manager (such as a the American Mathematical Society,
145(8):3191–3200, program database), and we believe there is substantial
room 2017. for further improvement and optimization. de Moura, L., Kong,
S., Doorn, F., and Raumer, J. The lean theorem prover (system
description). volume 9195, Acknowledgements pp. 378–388, 08 2015. ISBN
978-3-319-21400-9. doi: 10.1007/978-3-319-21401-6 26. We thank Liyuan
Liu, Lifan Yuan, Pang Wei Koh, Jerry Li, Gregory Lau, Rulin Shao and
Jingming Gao for very helpful DeepSeek-AI. Deepseek-r1: Incentivizing
reasoning ca- discussions. YW, ZZ, and XY are supported by Amazon AI
pability in llms via reinforcement learning, 2025. URL
Ph.D. Fellowships. SSD acknowledges the support of NSF
https://arxiv.org/abs/2501.12948. CCF-2212261, NSF IIS-2143493, NSF
CCF-2019844, NSF IIS-2229881, the Sloan Research Fellowship, and Schmidt
Fawzi, A., Balog, M., Huang, A., Hubert, T., Romera- Paredes, B.,
Barekatain, M., Novikov, A., R. Ruiz,

                                                                                                                                   11

ThetaEvolve: Test-time Learning on Open Problems

F. J., Schrittwieser, J., Swirszcz, G., et al. Discovering Khattab, O.,
Singhvi, A., Maheshwari, P., Zhang, Z., San- faster matrix
multiplication algorithms with reinforce- thanam, K., Vardhamanan, S.,
Haq, S., Sharma, A., Joshi, ment learning. Nature, 2022. T. T., Moazam,
H., et al. Dspy: Compiling declarative language model calls into
self-improving pipelines. arXiv Fernando, C., Banarse, D., Michalewski,
H., Osindero, preprint arXiv:2310.03714, 2023. S., and Rocktäschel, T.
Promptbreeder: Self-referential self-improvement via prompt evolution.
arXiv preprint Kwon, W., Li, Z., Zhuang, S., Sheng, Y., Zheng, L., Yu,
arXiv:2309.16797, 2023. C. H., Gonzalez, J. E., Zhang, H., and Stoica,
I. Efficient memory management for large language model serving
Friedman, E. Circles in squares. https: with pagedattention. In
Proceedings of the ACM SIGOPS //erich-friedman.github.io/packing/ 29th
Symposium on Operating Systems Principles, 2023. cirRsqu/, 2012.
Lambert, N., Morrison, J., Pyatkin, V., Huang, S., Ivison, Gao, J., Xu,
S., Ye, W., Liu, W., He, C., Fu, W., Mei, H., Brahman, F., Miranda, L.
J. V., Liu, A., Dziri, N., Lyu, Z., Wang, G., and Wu, Y. On designing
effective rl S., Gu, Y., Malik, S., Graf, V., Hwang, J. D., Yang, J.,
reward at training time for llm reasoning. arXiv preprint Bras, R. L.,
Tafjord, O., Wilhelm, C., Soldaini, L., Smith, arXiv:2410.15115, 2024.
N. A., Wang, Y., Dasigi, P., and Hajishirzi, H. Tülu 3: Georgiev, B.,
Gómez-Serrano, J., Tao, T., and Wagner, A. Z. Pushing frontiers in open
language model post-training. Mathematical exploration and discovery at
scale. arXiv arXiv preprint arXiv:2411.15124, 2024. preprint
arXiv:2511.02864, 2025. Lange, R. T., Imajuku, Y., and Cetin, E.
Shinkaevolve: Google DeepMind. Gemini 2.5: Pushing the frontier Towards
open-ended and sample-efficient program evolu- with advanced reasoning,
multimodality, long context, tion. arXiv preprint arXiv:2509.19349,
2025. and next generation agentic capabilities. arXiv preprint Liu, J.,
Li, Y., Fu, Y., Wang, J., Liu, Q., and Shen, arXiv:2507.06261, 2025. Y.
When speed kills stability: Demystifying rl Guo, Q., Wang, R., Guo, J.,
Li, B., Song, K., Tan, X., Liu, collapse from the inference-training
mismatch, G., Bian, J., and Yang, Y. Connecting large language mod-
2025a. URL https://yingru.notion.site/ els with evolutionary algorithms
yields powerful prompt When-Speed-Kills-Stability-Demystifying-RL-Collap
optimizers. arXiv preprint arXiv:2309.08532, 2023. Liu, L., Yao, F.,
Zhang, D., Dong, C., Shang, J., and Gao, J. Hu, J., Liu, M., Diao, S.,
Lu, X., Dong, X., Molchanov, Flashrl: 8bit rollouts, full power rl,
August 2025b. URL P., Choi, Y., Kautz, J., and Dong, Y. Prorl
https://fengyao.notion.site/flash-rl. v2: Prolonged training validates
rl scaling laws. Madaan, A., Tandon, N., Gupta, P., Hallinan, S., Gao,
https://hijkzzz.notion.site/prorl-v2, 2025. L., Wiegreffe, S., Alon, U.,
Dziri, N., Prabhumoye, S., Hubert, T., Mehta, R., Sartran, L., Horváth,
M. Z., Žužić, Yang, Y., et al. Self-refine: Iterative refinement with
self- G., Wieser, E., Huang, A., Schrittwieser, J., Schroecker,
feedback. Advances in Neural Information Processing Y., Masoom, H.,
Bertolli, O., Zahavy, T., Mandhane, Systems, 36:46534–46594, 2023. A.,
Yung, J., Beloshapka, I., Ibarz, B., Veeriah, V., Yu, L., Nash, O.,
Lezeau, P., Mercuri, S., Sönne, C., Matolcsi, M. and Vinuesa, C.
Improved bounds on the Mehta, B., Davies, A., Zheng, D., Pedregosa, F.,
Li, supremum of autoconvolutions. Journal of mathematical Y., von Glehn,
I., Rowland, M., Albanie, S., Velingker, analysis and applications,
372(2):439–447, 2010. A., Schmitt, S., Lockhart, E., Hughes, E.,
Michalewski, Mouret, J.-B. and Clune, J. Illuminating search spaces by
H., Sonnerat, N., Hassabis, D., Kohli, P., and Sil- mapping elites.
arXiv preprint arXiv:1504.04909, 2015. ver, D. Olympiad-level formal
mathematical reason- ing with reinforcement learning. Nature, 2025. doi:
Novikov, A., Vũ, N., Eisenberger, M., Dupont, E., Huang,
10.1038/s41586-025-09833-y. URL https://doi. P.-S., Wagner, A. Z.,
Shirobokov, S., Kozlovskii, B., Ruiz, org/10.1038/s41586-025-09833-y. F.
J., Mehrabian, A., et al. Alphaevolve: A coding agent for scientific and
algorithmic discovery. arXiv preprint Jaech, A. and Joseph, A. Further
improvements to the lower arXiv:2506.13131, 2025. bound for an
autoconvolution inequality. arXiv preprint arXiv:2508.02803, 2025a.
OpenAI. Openai o1 system card. arXiv preprint arXiv:2412.16720, 2024.
Jaech, A. and Joseph, A. Further improvements to the lower bound for an
autoconvolution inequality. arXiv preprint OpenAI. Chatgpt 5.1 (gpt-5),
2025. URL https://chat. arXiv:2508.02803, 2025b. openai.com/. Large
language model.

                                                               12

ThetaEvolve: Test-time Learning on Open Problems

Orrick, W. P., Solomon, B., Dowdeswell, R. C., and
https://github.com/google-deepmind/ Smith, W. D. New lower bounds for
the maxi- alphaevolve_repository_of_problems/ mal determinant problem.
arXiv: Combinatorics, issues/1, 2025. Opened Nov 11, 2025. 2003. URL
https://api.semanticscholar. Wang, Y., Yang, Q., Zeng, Z., Ren, L., Liu,
L., Peng, B., org/CorpusID:117273399. Cheng, H., He, X., Wang, K., Gao,
J., et al. Reinforce- Romera-Paredes, B., Barekatain, M., Novikov, A.,
Balog, ment learning for reasoning in large language models with M.,
Kumar, M. P., Dupont, E., Ruiz, F. J., Ellenberg, J. S., one training
example. arXiv preprint arXiv:2504.20571, Wang, P., Fawzi, O., et
al. Mathematical discoveries from 2025. program search with large
language models. Nature, 625 Wei, J., Wang, X., Schuurmans, D., Bosma,
M., Xia, F., Chi, (7995):468–475, 2024. E., Le, Q. V., Zhou, D., et
al. Chain-of-thought prompting Shao, R., Asai, A., Shen, S. Z., Ivison,
H., Kishore, V., elicits reasoning in large language models. Advances in
Zhuo, J., Zhao, X., Park, M., Finlayson, S., Sontag, D., neural
information processing systems, 35:24824–24837, Murray, T., Min, S.,
Dasigi, P., Soldaini, L., Brahman, F., 2022. Yih, W.-t., Wu, T.,
Zettlemoyer, L., Kim, Y., Hajishirzi, Yang, C., Wang, X., Lu, Y., Liu,
H., Le, Q. V., Zhou, D., H., and Koh, P. W. Dr tulu: Reinforcement
learning with and Chen, X. Large language models as optimizers. In
evolving rubrics for deep research, 2025a. Preprint. The Twelfth
International Conference on Learning Repre- sentations, 2023. Shao, R.,
Li, S. S., Xin, R., Geng, S., Wang, Y., Oh, S., Du, S. S., Lambert, N.,
Min, S., Krishna, R., et al. Spu- Yao, F., Liu, L., Zhang, D., Dong, C.,
Shang, J., and Gao, J. rious rewards: Rethinking training signals in
rlvr. arXiv Your efficient rl framework secretly brings you off-policy
preprint arXiv:2506.10947, 2025b. rl training, August 2025. URL
https://fengyao. notion.site/off-policy-rl. Shao, Z., Wang, P., Zhu, Q.,
Xu, R., Song, J., Bi, X., Zhang, H., Zhang, M., Li, Y., Wu, Y., et
al. Deepseekmath: Push- Yu, Q., Zhang, Z., Zhu, R., Yuan, Y., Zuo, X.,
Yue, Y., Dai, ing the limits of mathematical reasoning in open language
W., Fan, T., Liu, G., Liu, L., et al. Dapo: An open-source models. arXiv
preprint arXiv:2402.03300, 2024. llm reinforcement learning system at
scale. arXiv preprint arXiv:2503.14476, 2025. Sharma, A. Openevolve: an
open-source evolution- ary coding agent, 2025. URL https://github. Zeng,
Z., Ivison, H., Wang, Y., Yuan, L., Li, S. S., Ye, Z., Li,
com/algorithmicsuperintelligence/ S., He, J., Zhou, R., Chen, T., Zhao,
C., Tsvetkov, Y., Du, openevolve. S. S., Jaques, N., Peng, H., Koh, P.
W., and Hajishirzi, H. Rlve: Scaling up reinforcement learning for
language Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., and
models with adaptive verifiable environments. arXiv Yao, S. Reflexion:
Language agents with verbal rein- preprint 2511.07317, 2025. forcement
learning. Advances in Neural Information Processing Systems,
36:8634–8652, 2023. Zhang, Q., Hu, C., Upasani, S., Ma, B., Hong, F.,
Kamanuru, V., Rainton, J., Wu, C., Ji, M., Li, H., et al. Agentic con-
Silver, D., Hubert, T., Schrittwieser, J., Antonoglou, I., Lai, text
engineering: Evolving contexts for self-improving M., Guez, A., Lanctot,
M., Sifre, L., Kumaran, D., Grae- language models. arXiv preprint
arXiv:2510.04618, pel, T., et al. A general reinforcement learning
algorithm 2025. that masters chess, shogi, and go through self-play.
Sci- Zhang, Z., Dai, Q., Bo, X., Ma, C., Li, R., Chen, X., Zhu, ence,
362(6419):1140–1144, 2018. J., Dong, Z., and Wen, J.-R. A survey on the
memory Tanese, R. Distributed genetic algorithms for function opti-
mechanism of large language model-based agents. ACM mization. University
of Michigan, 1989. Transactions on Information Systems.

Team, K., Du, A., Gao, B., Xing, B., Jiang, C., Chen, C., Zheng, L.,
Yin, L., Xie, Z., Sun, C. L., Huang, J., Yu, C. H., Li, C., Xiao, C.,
Du, C., Liao, C., et al. Kimi k1.5: Cao, S., Kozyrakis, C., Stoica, I.,
Gonzalez, J. E., et al. Scaling reinforcement learning with llms. arXiv
preprint Sglang: Efficient execution of structured language model
arXiv:2501.12599, 2025. programs. Advances in neural information
processing systems, 37:62557–62583, 2024. Wagner, A. Z. Constructions in
combinatorics via neural Zhu, Z., Xie, C., Lv, X., and slime
Contributors. slime: An networks. arXiv preprint arXiv:2104.14516, 2021.
llm post-training framework for rl scaling. https:// Wang, Y. and Tao,
T. Question about third autocorr github.com/THUDM/slime, 2025. GitHub
reposi- inequality (issue \#1). GitHub issue, repository tory.
Corresponding author: Xin Lv.

                                                                  13

ThetaEvolve: Test-time Learning on Open Problems

A. Details of Tasks In this section, we describe the details of the
tasks evaluated in our paper.

A.1. Circle Packing CirclePacking is defined as follows: given a
positive integer n, the task is to pack n disjoint circles inside a unit
square so as to maximize the sum of their radii. For the case n = 26,
the previous best-known value was 2.634 (Friedman, 2012), and
AlphaEvolve (Novikov et al., 2025) improved this result to 2.63586276.
More recently, ShinkaEvolve (Lange et al., 2025) further increased the
best-known value to 2.635983283. One implementation detail worth noting
is that different pipelines adopt slightly different numerical
tolerances when checking the configuration. For example, in the official
OpenEvolve implementation, the evaluation function uses an absolute
tolerance of atol = 10−6 when checking the constraints. ShinkaEvolve
adopts a similar approach with atol = 10−7 , whereas AlphaEvolve uses
zero tolerance for overlap detection. Because of this discrepancy,
ShinkaEvolve reports two values for the packing: one evaluated with atol
= 10−7 and one with atol = 0. In our experiments, we adopt the
OpenEvolve-style evaluation (CirclePacking-T), and consider the setting
atol = 0 as the formal task CirclePacking. We can simply shrink the
radii of circles to obtain the results for CirclePacking by the program
found on CirclePacking-T.

A.2. First Autocorrelation Inequality For a function f : R → R, the
autoconvolution of f is given by Z (f ∗ f )(t) = f (t − x) f (x) dx. R

Define C1 as the largest constant such that Z 1/4 !2 max (f ∗ f )(t) ≥
C1 f (x) dx −1/2≤t≤1/2 −1/4

holds for all non-negative functions f : R → R. This inequality is
closely connected to additive combinatorics, particularly questions
concerning the size of Sidon sets. The best-known bounds satisfy

                                                    1.28 ≤ C1 ≤ 1.5098,

where the lower bound was established previously (Cloninger &
Steinerberger, 2017), and the upper bound originates from a
step-function construction (Matolcsi & Vinuesa, 2010). AlphaEvolve-v2
(Georgiev et al., 2025) constructed a step function with 600 evenly
spaced intervals over \[−1/4, 1/4\], yielding the improved upper
estimate

                                                        C1 ≤ 1.5032.

A.3. Second Autocorrelation Inequality Let C2 denote the smallest
constant such that

                                              ∥f ∗ f ∥22 ≤ C2 ∥f ∗ f ∥1 ∥f ∗ f ∥∞

holds for every non-negative function f : R → R. Previously, the best
lower bound for C2 was obtained using a step-function construction
(Matolcsi & Vinuesa, 2010), and AlphaEvolve-v1 further found a 50-piece
step function that achieved a slightly improved lower bound of 0.8962.
Independently, another workestablished a stronger lower bound using
gradient-based methods (Boyer & Li, 2025), obtaining 0.901564 ≤ C2 ≤ 1,
and recent work further improved this bound by constructing a 2399-step
function (Jaech & Joseph, 2025b), yielding

                                                      0.9414 ≤ C2 ≤ 1.

                                                              14

ThetaEvolve: Test-time Learning on Open Problems

Most recently, AlphaEvolve-v2 identified a step function with 50,000
pieces, raising the lower bound to

                                                                0.961 ≤ C2 .

Notably, AlphaEvolve-v2 remarks that this function is highly irregular,
both challenging to optimize and difficult to visualize, and is expected
to yield an even higher score if the search budget is increased further.

A.4. Third Autocorrelation Inequality Let C3 denote the largest constant
for which Z 1/4 !2 max \|f ∗ f (t)\| ≥ C3 f (x) dx −1/2≤t≤1/2 −1/4

holds for every function f : R → R. A step-function construction shows
that

                                            C3 ≤ 1.4581           (Cilleruelo et al., 2010).

AlphaEvolve identified a step function with 400 uniformly spaced
intervals on \[−1/4, 1/4\], yielding a slightly improved upper bound C3
≤ 1.4557.

However, we note a mismatch between the mathematical problem statement
and the code implementation (Wang & Tao, 2025). In the AlphaEvolve
implementation, a step function is discretized as a height sequence {hi
}ni=1 , and its autoconvolution is evaluated at n discrete points {conv3
(k)}nk=1 . The upper bound computed in AlphaEvolve is

                                             (AlphaEvolve)          2n maxk conv3 (k)
                                            C3                  =       Pn      2    .
                                                                         i=1 hi

If one discretizes the theoretical inequality in the natural way, the
verification formula should instead be

                                                 (theory)        2n · maxk | conv3 (k)|
                                             C3             =          Pn       2      .
                                                                         i=1 hi


           (theory)    (AlphaEvolve)

Clearly, C3 ≥ C3 . Using this theoretically correct expression, neither
the previously reported bound 1.4581 (theory) nor the improved value
1.4557 can be recovered by evaluating their corresponding step
functions, their C3 scores are substantially higher. This discrepancy
reflects that two closely related but distinct optimization problems are
being (theory) considered (Wang & Tao, 2025). In our paper, we use
formula C3 in our evaluator; therefore, our results are not directly
comparable to the previously reported scores 1.4581 or 1.4557 in
AlphaEvolve.

A.5. Hadamard matrix A Hadamard matrix is an n × n matrix H with entries
±1 such that HH T = nI, where I is the identity matrix. The maximal
determinant problem asks for the largest possible value of \| det(H)\|
over all {±1} matrices of order n, subject to the classical upper bound
\| det(H)\| ≤ n n/2 .

For n = 29, the best-known result was obtained by Orrick (Orrick et al.,
2003), achieving

                                                  | det(H)| = 228 × 712 × 320,

Following previous work, in our paper we compute the objective score for
n = 29 as \| det(H)\| s= . 228 × 712 × 342

                                                                     15

ThetaEvolve: Test-time Learning on Open Problems

B. Details of ThetaEvolve We discuss additional implementation details
of ThetaEvolve below.

B.1. More Implementation Details Verifier. For each problem, we provide
two evaluator helper functions: one for validity checking and another
for computing the objective score. We also require each program to save
its solution in a separate file that is accessible to the evaluator
defined in an immutable file. This design prevents reward hacking, such
as attempts to modify the evaluation logic within the program file.

Lazy Penalty. For the lazy penalty, we consider equivalence to all
historical programs, not just the parent, because RL training may cause
the model to memorize previously successful programs stored in the
database.

Prompt Cleaning. We also clean and unify some prompt templates from
OpenEvolve, such as moving the metrics to the top of each program as
done in AlphaEvolve.

Mixing Meta-Information. OpenEvolve introduces a two-stage setup that
achieves performance close to AlphaEvolve on CirclePacking-T: (1) the
system first guides the program to discover strong constructive
solutions, and then (2) let the model optimizes a search algorithm that
may use the previously found construction as an initialization trick. In
ThetaEvolve, we simplify this process by allowing multiple pieces of
meta information (kept fixed and not evolved as in AlphaEvolve), each
describing a different strategy and associated with a corresponding
weight. During generation, the prompt is constructed by sampling from
these meta-information entries according to their weights. Our
experiments can be conducted on 8x80G A100s. See more implementation
details in our codebase.

B.2. Parameters in ThetaEvolve The parameters used in ThetaEvolve are
shown in Tab. 8. For reward shaping, we mainly apply it to tasks that
have a narrow range of scores (SecondAutoCorrIneq) or are minimization
tasks (ThirdAutoCorrIneq). Notably, the value L = 1.4557 used for
ThirdAutoCorrIneq is the best bound reported in AlphaEvolve (Novikov
(AlphaEvolve) (theory) et al., 2025). However, as mentioned in Appendix
A, it is actually the bound for C3 rather than C3 . (AlphaEvolve)
(theory) But since C3 ≤ C3 , it is still reasonable to use it as the
truncated lower bound L. We use α = 3 for Distill-Qwen3-8B, since it can
more easily achieve scores close to lower bound (e.g., 1.4930 from the
best w/ RL run), but adopt a more conservative setup α = 1 for
ProRL-1.5B-v2. See the discussion in Sec. 4.4.3.

                Model                          Task                  Timeout (s)   Reward Shaping?      U       L       α
          ProRL-1.5B-v2             CirclePacking-T (↑)                 70                ✗             -        -       -
          ProRL-1.5B-v2            ThirdAutoCorrIneq (↓)                70                ✓            2.5      1.5     1.0
          ProRL-1.5B-v2              HadamardMatrix (↑)                 350               ✗             -        -       -
        Distill-Qwen3-8B            CirclePacking-T (↑)                  70              ✗              -        -       -
        Distill-Qwen3-8B           ThirdAutoCorrIneq (↓)                 70              ✓             3.2    1.4557    3.0
        Distill-Qwen3-8B             HadamardMatrix (↑)                  350             ✗              -        -       -
        Distill-Qwen3-8B          SecondAutoCorrIneq (↑)                 350             ✓            0.96     0.91     1.0
        Distill-Qwen3-8B           FirstAutoCorrIneq (↓)                1150         No RL runs         -        -       -

Table 8: Configurations of the main experiments. Here the timeout is for
the evaluator in OpenEvolve, which is slightly longer than the timeout
specified in the prompt.

B.3. Details of Meta Information As mentioned in Appendix B.1, in
ThetaEvolve, we sample the meta-information from several candidates. For
CirclePacking-T, we use meta-information and an initial program that
closely match those used in OpenEvolve. For FirstAutoCorrIneq,
AlphaEvolve-v2 (Georgiev et al., 2025) provides both the
meta-information and the initial program, and we adopt them directly for
a fair comparison. For the remaining three tasks that do not have
ready-made

                                                                16

ThetaEvolve: Test-time Learning on Open Problems

components, we prompt GPT-5 (OpenAI, 2025) and Claude 4.5 (Anthropic,
2025) to generate insights for improvement or to summarize ideas from
previous work, following the emphasis in AlphaEvolve-v2 that verbal
insights can significantly influence the evolution process, even for
strong closed-source models. Importantly, we only use these models to
generate insights and potential improvement directions for inclusion in
the prompt, rather than directly producing advanced programs. All runs
in our paper use the same prompt for each task to ensure a fair
comparison. Almost all initial programs are relatively simple and
achieve scores far away the best-known bounds. More details are
illustrated below.

B.3.1. P ROMPT OF C I R C L E P A C K I N G -T Notably, the prompts for
CirclePacking-T are adapted from OpenEvolve’s two-stage configuration.
We preserve the main structure of the original prompts and only
introduce minor modifications, such as adding information about timeouts
and brief instructions encouraging the model to explore more. The prompt
contains two components (Here we set: n circles = 26, MAX RUNTIME = 60,
target value = 2.635): (1) Part 1, weight = 0.3: You are an expert
mathematician specializing in circle packing problems and computational
geometry. Your task is to improve a constructor function that directly
produces a specific arrangement of {core_parameters.n_circles} circles
in a unit square, maximizing the sum of their radii. The AlphaEvolve
paper achieved a sum of {target_value} for
n={core_parameters.n_circles}. The time limit for each program
evaluation is {MAX_RUNTIME} seconds.

Key geometric insights: - Circle packings often follow hexagonal
patterns in the densest regions - Maximum density for infinite circle
packing is pi/(2\*sqrt(3)) approx 0.9069 - Edge effects make square
container packing harder than infinite packing - Circles can be placed
in layers or shells when confined to a square - Similar radius circles
often form regular patterns, while varied radii allow better space
utilization - Perfect symmetry may not yield the optimal packing due to
edge effects

Focus on designing an explicit constructor that places each circle in a
specific position, rather than an iterative search algorithm.

2)  Part 2, weight = 0.7: You are an expert mathematician specializing
    in circle packing problems and computational geometry. We’re trying
    to reach the AlphaEvolve target of {target_value} for the sum of
    radii when packing {core_parameters.n_circles} circles in a unit
    square. The current implementation has plateaued at some values, so
    we need significant improvements. The time limit for each program
    evaluation is {MAX_RUNTIME} seconds.

Key insights to explore: 1. The optimal arrangement likely involves
variable-sized circles 2. A pure hexagonal arrangement may not be
optimal due to edge effects 3. The densest known circle packings often
use a hybrid approach 4. The optimization routine is critically
important - simple physics-based models with carefully tuned parameters
5. Consider strategic placement of circles at square corners and edges
6. Adjusting the pattern to place larger circles at the center and
smaller at the edges 7. The math literature suggests special
arrangements for specific values of n 8. scipy has some useful functions
for optimization

Focus on breaking through the plateau by trying fundamentally different
approaches - don’t just tweak parameters.

IMPORTANT: If you find the previous programs produce similar results,
try as creative and evolutionary strategies as possible to explore
different approaches.

                                                             17

ThetaEvolve: Test-time Learning on Open Problems

B.3.2. P ROMPT OF F I R S T A U T O C O R R I N E Q The prompts for
FirstAutoCorrIneq are adapted from the one released by AlphaEvolve-v2
(Georgiev et al., 2025). We preserve the most of the parts of the
original prompts (here we set: MAX RUNTIME = 1000): (1) Part 1, weight =
1.0: You are an expert mathematician and computational scientist
specializing in harmonic analysis and extremal problems, specifically
the first autocorrelation inequality. Your task is to generate the
sequence of non-negative heights of a step functions on the domain
{core_parameters.domain}, that minimizes the following evaluation
function:

def evaluate_sequence_1(sequence: list\[float\]) -\> float: “““Evaluates
a sequence of coefficients.”“”

     # Protect against negative numbers
     sequence = [max(0.0, x) for x in sequence]
     n = len(sequence)
     b_sequence = np.convolve(sequence, sequence)
     max_b = max(b_sequence)
     sum_a = np.sum(sequence)
     return float(2 * n * max_b / (sum_a**2))

You don’t have to change the evaluation function in the program, it
would be provided in the evaluation environment that you cannot modify.

Your task is to write a search function that searches for the best
sequence of coefficients. Your function will have {MAX_RUNTIME} seconds
to run, and after that it has to have returned the best sequence it
found. If after {MAX_RUNTIME} seconds it has not returned anything, it
will be terminated with negative infinity points. All numbers in your
sequence have to be positive or zero. You may code up any search method
you want.

Feel free to change parameters like the length of the sequence, or any
other parameters you deem necessary to improve performance.

B.3.3. P ROMPT OF S E C O N D A U T O C O R R I N E Q We crafted our
prompt by drawing on insights from two papers that achieved
state-of-the-art results in this domain (Boyer & Li, 2025; Matolcsi &
Vinuesa, 2010). The prompt contains three components (here we set:
domain = \[-1/4, 1/4\], MAX RUNTIME = 300, target value = 0.96): (1)
Part 1, weight = 0.3: You are an expert in functional optimization and
harmonic analysis on autoconvolution inequalities. Your task is to
explicitly construct a single non-negative function f on
{core_parameters.domain} to maximize

R(f) = \|\|f \* f\|\|\_2ˆ2 / (\|\|f \* f\|\|\_1 \* \|\|f \* f\|\|\_inf),
with C_2 \>= R(f) and target R(f) \> {core_parameters.target_value}. The
time limit for each program evaluation is {MAX_RUNTIME} seconds.

High-impact constructive insights (no iterative search here): - Use a
two-/multi-scale piecewise-constant scaffold: an off-center tall narrow
spike riding on a broad, low-amplitude envelope. The goal is to inflate
the L2 mass of f*f while flattening its global peak. - Add a
phase-locked micro-comb with spacing aligned to the dominant offsets of
the current envelope autocorrelation; keep teeth weak but well-phased to
cancel incipient maxima in f*f and broaden the central plateau. - Allow
asymmetry deliberately; biasing mass away from the center often widens
the plateau without raising \|\|f\*f\|\|\_inf.

                                                              18

ThetaEvolve: Test-time Learning on Open Problems

- Parameterize nonnegativity by construction (e.g., nonnegative
  coefficients of bumps/steps) and keep a small number of tunable knobs
  (spike location/width/height, envelope level, comb spacing/phase,
  local refinement windows) so the ansatz evaluates instantly.
- Output a pure constructor that returns the heights array; do not
  implement any search/loop in this prompt.

IMPORTANT - Summary: Provide a fast, high-resolution ansatz (off-center
spike + envelope + phase-locked weak comb) that raises \|\|f\*f\|\|\_2
and suppresses \|\|f\*f\|\|\_inf by design, serving as a strong warm
start for downstream optimizers.

2)  Part 2, weight = 0.4: You are an expert in differentiable
    optimization for autoconvolution objectives. We need a peak-aware,
    curvature-sensitive optimizer to push

R(f) = \|\|f \* f\|\|\_2ˆ2 / (\|\|f \* f\|\|\_1 \* \|\|f \* f\|\|\_inf)
beyond {core_parameters.target_value}. The time limit for each program
evaluation is {MAX_RUNTIME} seconds.

Optimization insights (concise, no step-by-step plan): - Replace the
hard max by a temperature-annealed Top-k smooth max (softmax over the
top few entries of f*f). This focuses gradients on the peak set, not on
noise; validate with the true max when reporting. - Use Toeplitz-aware
preconditioning: precondition updates by local convolutional smoothing
(e.g., with a short triangular kernel) to approximate the inverse
curvature of the f -\> f*f map; this damps oscillatory directions that
spuriously raise \|\|f\*f\|\|\_inf. - Adopt a mirror-descent /
multiplicative parameterization (e.g., optimize a base field then apply
softplus/exponential), enforcing f \>= 0 and naturally emphasizing
relative (scale-aware) updates in high-impact regions. - Run
multi-resolution refinement in-place: briefly expose local
high-resolution windows only near indices that control the Top-k of f*f,
then fold improvements back to the global grid. Prefer short decisive
bursts over long loops. - Inject structured, peak-targeted perturbations
(small, phase-coherent comb nudges around the current argmax offsets) to
prevent peak lock-in while preserving the plateau that boosts
\|\|f*f\|\|\_2.

Diagnostics to log (lightweight): current R(f) with hard/smooth max,
Top-k peak values and gap, estimated plateau width.

IMPORTANT - Summary: Use Top-k smooth max, Toeplitz-aware
preconditioning, mirror descent, and local multi-resolution to lower the
peak without shrinking the plateau, enabling rapid gains within the
short time budget.

3)  Part 3, weight = 0.3: You are an expert in structural search for
    autoconvolution bounds under tight compute budgets. Goal: reveal
    diverse, high-payoff families of nonnegative f on
    {core_parameters.domain} that lift

R(f) = \|\|f \* f\|\|\_2ˆ2 / (\|\|f \* f\|\|\_1 \* \|\|f \* f\|\|\_inf)
above {core_parameters.target_value}. The time limit for each program
evaluation is {MAX_RUNTIME} seconds.

High-signal exploration heuristics (keep them lightweight): - Frequency
shaping: design envelopes that suppress Fourier modes responsible for
the argmax of f*f; add notch filters via weak combs whose spacing is
locked to the argmax offsets. - Asymmetric dual-spike with beat control:
two offset spikes with height/spacing tuned to create a broad, nearly
flat plateau in f*f through controlled interference; keep the secondary
spike weaker to avoid a new global maximum. - Adaptive resolution
windows: vary total segment counts aggressively but allocate

                                                   19

ThetaEvolve: Test-time Learning on Open Problems

fine resolution only near sensitivity hot zones (indices impacting Top-k
peaks of f\*f); prefer fast trials over long runs. - Budget-aware
gating: use quick proxy signals (Top-k peak gap, plateau width estimate)
to promote only the most promising shapes for any expensive refinement,
avoiding uniform spend.

Rank/Report: R(f) (hard max), Top-k peak gap, plateau width proxy, and
whether the best peak index stabilizes under small perturbations.

IMPORTANT - Summary: This prompt prioritizes frequency-domain
flattening, beat-pattern plateaus, and targeted resolution to uncover
novel high performers quickly, maximizing diversity per minute.

B.3.4. P ROMPT OF T H I R D A U T O C O R R I N E Q We designed our
prompt by drawing on insights from the thesis (Cilleruelo et al., 2010)
that achieved state-of-the-art results in this domain, though we find
that there are some mismatch in evaluation later (Appendix A). The
prompt contains three components (here we set: domain = \[-1/4, 1/4\],
MAX RUNTIME = 60, target value = 1.4557): (1) Part 1, weight = 0.4: You
are an expert mathematician and computational scientist specializing in
harmonic analysis and extremal problems, specifically the third
autocorrelation inequality.

Your task is to design a Python program that constructs a discrete
function f on the domain {core_parameters.domain} to minimize C3, aiming
to beat the SOTA of {core_parameters.target_value}.

The time limit for each program evaluation is {MAX_RUNTIME} seconds.

Key Insight from Mathematical Literature (Host, Vinuesa): The best-known
constructions are often based on the product of a smooth, oscillating
function and a window function with compact support. A highly successful
continuous analog is f(x) = (1 + cos(2*pi*x)) for x in \[-1/4, 1/4\] and
0 otherwise.

Your primary goal is to create a discrete version of this construction.

Construction Guidelines: 1. Window Function: Define a “window” or
“support” for your function. This window should be centered and occupy a
fraction of the total domain (e.g., the middle 50%, like n_steps//4 to
3*n_steps//4). The function should be zero outside this window. 2.
Oscillatory Component: Inside the window, define the function using a
smooth, symmetric, oscillating pattern. A cosine-based function is an
excellent starting point. A* (1 + B \* cos(C \* x)) is a powerful
template. 3. Parameterization: Your code should explore different
parameters for this construction: - support_width: The width of the
non-zero window. - amplitude (A) and modulation (B): Controls the scale
and contrast of the function. - frequency (C): Controls the oscillatory
behavior. 4. Discretization: Carefully map the continuous functional
form onto the discrete domain {core_parameters.domain}. Pay attention to
boundary conditions at the edge of the window.

Focus on building a function generator based on this
theoretically-grounded “window \* oscillation” structure. Explore the
parameter space of this structure to find the optimal discrete function.

2)  Part 2, weight = 0.3: You are an expert in computational
    optimization and harmonic analysis, tasked with refining a candidate
    function to minimize the C3 autocorrelation constant.

Your goal is to take a given function f on the domain
{core_parameters.domain} and meticulously improve it to push past the
SOTA benchmark of C3 =

                                                              20

ThetaEvolve: Test-time Learning on Open Problems

{core_parameters.target_value}.

The time limit for each program evaluation is {MAX_RUNTIME} seconds. Use
this time for intensive, focused local search.

Refinement Strategy: 1. Iterative Improvement: Perform a high number of
iterations (e.g., 5,000-20,000) on the input candidate. 2. Adaptive
Perturbations: Employ a multi-stage adaptive step size. Start with
larger changes (e.g., +/- 0.05) to explore the local landscape, then
gradually decrease the step size (e.g., to +/- 0.01, then +/- 0.001) to
fine-tune the solution. 3. Targeted Search: Identify the indices where
the convolution conv(f,f) has the highest absolute values. Focus your
perturbations on and around these critical indices, as they have the
most impact on the C3 score. 4. Escape Local Minima: Implement a
simulated annealing schedule or a similar mechanism. If the search
stagnates for hundreds of iterations, introduce a larger, random
perturbation to jump to a new region. 5. Sign Flipping: Systematically
test flipping the signs of small segments of the function, as phase
cancellation is a key mechanism for reducing convolution peaks.

Focus on making small, intelligent adjustments to an existing strong
candidate. Your task is not to invent a new function, but to perfect the
one you are given.

3)  Part 3, weight = 0.3: You are an expert in signal processing and
    creative algorithm design, tasked with finding novel functions that
    minimize the C3 autocorrelation constant. The goal is to break the
    SOTA of {core_parameters.target_value}.

Current approaches have converged on certain types of smooth, symmetric
functions. Your task is to explore fundamentally different, potentially
superior, structural paradigms.

The time limit for each program evaluation is {MAX_RUNTIME} seconds.

Radical Exploration Strategies: 1. Wavelet-inspired Structures: Instead
of a simple cosine, construct the function from a mother wavelet (like
Mexican Hat or Morlet) that is scaled and translated. This combines
oscillation with compact support naturally. 2. Fractal and Self-Similar
Functions: Design a function using a recursive or fractal construction
(e.g., a modified Cantor set distribution or a Weierstrass-like
function). These have unique spectral properties. 3. Chirp Signals
(Frequency Sweeps): Construct a function where the frequency of
oscillation changes across the domain (e.g., sin(a\*x\*\*2)). This can
spread the energy of the autoconvolution in novel ways. 4. Optimized
Piecewise Polynomials: Define the function as a series of connected
polynomial segments (splines). Use an optimization routine to find the
optimal coefficients for a small number of segments (e.g., 3-7). 5.
Algebraic Constructions: Use number-theoretic sequences (e.g., based on
quadratic residues or finite fields) to generate the function’s values.
These can have surprisingly good autocorrelation properties.

IMPORTANT: Your goal is to generate diverse and unconventional
candidates. Do not simply replicate previous solutions. If prior
programs look similar, make a deliberate and drastic shift in the
underlying mathematical structure.

B.3.5. P ROMPT OF H A D A M A R D M A T R I X Our prompt design was
highly inspired by the work of Orrick (Orrick et al., 2003). The prompt
contains three components (here we set: matrix size = 29, theoretical
max = 228 · 712 · 342, KNOWN BOUNDS = 0.935673, MAX RUNTIME = 300): (1)
Part 1, weight = 0.3:

                                                             21

ThetaEvolve: Test-time Learning on Open Problems

You are an expert Python programmer and mathematician working on
constructing optimal Hadamard matrices. Your goal is to improve the
Python code in the EVOLVE-BLOCK to find better Hadamard matrices.

Problem parameters: - Matrix size: {core_parameters.matrix_size} -
Theoretical maximum determinant: {core_parameters.theoretical_max} -
Target: Maximize \|det(H)\| / theoretical_max ratio

Your program is allowed to run for a maximum of {MAX_RUNTIME} seconds.
You should use this time wisely, both for construction and optimization.

A Hadamard matrix is an n x n matrix H with entries +1 or -1 such that
H*HˆT = n*I, where I is the identity matrix. The determinant of a
Hadamard matrix H satisfies \|det(H)\| \<= nˆ(n/2), with equality
achieved by “perfect” Hadamard matrices. For
N={core_parameters.matrix_size}, theoretical max is
{core_parameters.theoretical_max}.

Known SOTA ratios: {KNOWN_BOUNDS}

Your program should output the matrix in a parseable format (in +/-
format, one row per line). Mainly follow the current output format. Keep
all the current functions about verbose and saving files, and don’t need
to change other unrelated functions. If the results can be regularly
update (like at least every 2 minutes), you may also try more aggressive
and long_lasting search. Include diagnostic information to help
understand the optimization process.

NOTE: If you find the previous code can not pass compilation, maybe you
could just modify the code for fixing syntax errors without changing the
logic. You can also see the problems of previous program based on the
previous output, and then optimize correspondingly.

Focus on finetuning parameters or minor adjustments to get the local
best programs.

2)  Part 2, weight = 0.4: You are an expert Python programmer and
    mathematician working on constructing optimal Hadamard matrices.
    Your goal is to improve the Python code in the EVOLVE-BLOCK to find
    better Hadamard matrices.

Problem parameters: - Matrix size: {core_parameters.matrix_size} -
Theoretical maximum determinant: {core_parameters.theoretical_max} -
Target: Maximize \|det(H)\| / theoretical_max ratio

Your program is allowed to run for a maximum of {MAX_RUNTIME} seconds.
You should use this time wisely, both for construction and optimization.

A Hadamard matrix is an n x n matrix H with entries +1 or -1 such that
H*HˆT = n*I, where I is the identity matrix. The determinant of a
Hadamard matrix H satisfies \|det(H)\| \<= nˆ(n/2), with equality
achieved by “perfect” Hadamard matrices. For
N={core_parameters.matrix_size}, theoretical max is
{core_parameters.theoretical_max}.

Known SOTA ratios: {KNOWN_BOUNDS}

Key optimization strategies (inspired by Orrick et al.’s breakthrough
methods https://arxiv.org/abs/math/0304410): 1. Advanced hill-climbing
algorithms: Implement sophisticated gradient-ascent with

                                                   22

ThetaEvolve: Test-time Learning on Open Problems

multiple temperature schedules and adaptive cooling rates for simulated
annealing 2. Conference matrix techniques: For cases where n mod 16 ==
15, construct using antisymmetric (k+1) x (k+1) conference matrices,
normalize appropriately, and tensor with Hadamard matrices 3. Finite
field methods: Utilize Jacobsthal matrices from finite fields GF(k) when
k is prime power, providing matrices with optimal orthogonality
properties 4. Multi-scale optimization: Combine local search with global
perturbations, using different step sizes and mutation rates at
different stages 5. Structural exploitation: Use the row-independence
property in cofactor expansion to parallelize row-wise optimizations
across multiple workers 6. Memory-guided search: Implement tabu search
or other memory-based techniques to avoid revisiting poor local optima
7. Hybrid construction approaches: Combine algebraic methods (Paley,
Sylvester) with numerical optimization for superior starting points 8.
Parallel processing: Use multiple workers to explore different regions
of the search space simultaneously

Evaluation criteria: - Primary: Ratio of \|det(H)\| to theoretical
maximum nˆ(n/2) - Secondary: Orthogonality constraint satisfaction (how
close H*HˆT is to n*I)

Your program should output the matrix in +/- format (+ for 1, - for -1,
one row per line). Mainly follow the current output format. Keep all the
current functions about verbose and saving files, and don’t need to
change other unrelated functions. If the results can be regularly update
(like at least every 2 minutes), you may also try more aggressive and
long_lasting search. Include diagnostic information to help understand
the optimization process.

NOTE: If you find the previous code can not pass compilation, maybe you
could just modify the code for fixing syntax errors without changing the
logic. You can also see the problems of previous program based on the
previous output, and then optimize correspondingly.

Focus on algorithmic improvements and mathematical insights rather than
just parameter tuning.

3)  Part 3, weight = 0.3:

You are an expert in computational optimization and matrix theory
working on the Hadamard matrix construction problem. Your goal is to
evolve Python code that generates high-quality Hadamard matrices.

Problem parameters: - Matrix size: {core_parameters.matrix_size} -
Theoretical maximum determinant: {core_parameters.theoretical_max} -
Target: Maximize \|det(H)\| / theoretical_max ratio

Your program is allowed to run for a maximum of {MAX_RUNTIME} seconds.
You should use this time wisely, both for construction and optimization.

Mathematical background: - Hadamard matrices H satisfy H*HˆT = n*I with
entries +/-1 - The Hadamard bound: \|det(H)\| \<= nˆ(n/2) (for
N={core_parameters.matrix_size}, theoretical max is
{core_parameters.theoretical_max}) - For
N={core_parameters.matrix_size}: No perfect Hadamard matrices exist, so
we seek the best approximations - Known SOTA ratios: {KNOWN_BOUNDS}

Advanced techniques to explore (building on Orrick et al.
https://arxiv.org/abs/math/0304410): 1. Conference matrix constructions:
Implement the explicit construction for n mod 16 == 15 using
antisymmetric conference matrices, proper normalization, and 4 x 4
Hadamard tensor products

                                                   23

ThetaEvolve: Test-time Learning on Open Problems

2.  Finite field algebraic methods: Use Jacobsthal matrices from GF(k)
    when k is prime power, providing structured starting points with
    proven determinant properties
3.  Multi-stage optimization: Combine the proven hill-climbing approach
    with adaptive simulated annealing, using cofactor expansion for
    O(nˆ2) determinant updates instead of O(nˆ3)
4.  Advanced search techniques: Implement sophisticated escape
    mechanisms from local maxima using strategic perturbations informed
    by matrix structure
5.  Evolutionary and swarm approaches: Design population-based methods
    that maintain diversity while exploiting the best-known
    constructions
6.  Machine learning integration: Use neural networks or reinforcement
    learning to guide the search process based on patterns in successful
    matrices
7.  Spectral and eigenvalue optimization: Leverage spectral properties
    and eigenvalue distributions for matrix quality assessment beyond
    determinant maximization
8.  Hybrid parallel architectures: Design algorithms that effectively
    utilize multiple computational threads while maintaining search
    coherence

Implementation considerations: - Efficient matrix operations using
NumPy/SciPy with careful attention to numerical stability -
Memory-efficient algorithms for larger matrices and population-based
methods - Robust error handling and graceful degradation for edge
cases - Comprehensive logging and diagnostic output for algorithm
analysis

The program must be robust and handle edge cases gracefully. Output
format: Matrix in +/- format (+ for 1, - for -1), diagnostic info for
debugging. Mainly follow the current output format. Keep all the current
functions about verbose and saving files, and don’t need to change other
unrelated functions. If the results can be regularly update (like at
least every 2 minutes), you may also try more aggressive and
long_lasting search.

NOTE: If you find the previous code can not pass compilation, maybe you
could just modify the code for fixing syntax errors without changing the
logic. You can also see the problems of previous program based on the
previous output, and then optimize correspondingly.

Prioritize novel algorithmic approaches that could breakthrough current
best-known results.

C. Details of AlphaEvolve/OpenEvolve Pipeline In this section, we
mention more details about the AlphaEvolve/OpenEvolve pipeline. For
details not covered in the AlphaEvolve papers, we follow the default
setup in OpenEvolve.

C.1. Meta Information and Initial Program For the target task we aim to
optimize, we have to manually design an unhackable evaluator that maps
solutions to scalar scores. It is proven important to handle corner
cases to prevent LLMs from exploiting loopholes (Georgiev et al., 2025).
These systems also require an initial program that specifies the basic
evaluation format, including a code block delimited by the comments
\#EVOLVE-BLOCK-START and \#EVOLVE-BLOCK-END, which define the region
that LLM can modify Finally, the system requires meta-information that
describes the problem and outlines possible directions for improving
existing bounds. AlphaEvolve-v2 demonstrates that the advice provided in
the prompt can significantly influence the final performance (Georgiev
et al., 2025). AlphaEvolve also includes a meta–prompt-evolution
mechanism, which allows the LLM to evolve the meta-information stored in
a separate database. OpenEvolve does not currently support this feature,
and neither does our work.

C.2. LLM Ensemble AlphaEvolve leverages state-of-the-art LLMs to drive
the evolutionary procedure while balancing performance and compu-
tational throughput during evolution. Follow-up work such as
ShinkaEvolve (Lange et al., 2025) further emphasizes the

                                                             24

ThetaEvolve: Test-time Learning on Open Problems

importance of LLM ensembles and proposes specialized model selection
strategies. The LLM output typically includes Chain-of-Thought (CoT)
reasoning (Wei et al., 2022) for analysis, followed by one or more
SEARCH/REPLACE diff blocks that modify the parent program.

C.3. Global Best Solution We note that AlphaEvolve maintains a global
variable to store the best solution found so far, which is reused in
subsequent evolutionary steps. OpenEvolve and our implementation do not
currently support this feature. Incorporating it may further improve the
achieved bounds under the same time budget, particularly for tasks that
rely heavily on search-based programs (e.g., the autocorrelation
inequalities in Sec. 4.1). However, if the referenced solution in the
initial program is already very strong and the meta prompt is relatively
simple, the generated programs may only apply small perturbations to the
SOTA solution, reducing diversity, as discussed in Sec. 4.4.4.

C.4. Evolutionary Database AlphaEvolve briefly mentions that its
database management is inspired by the MAP-Elites algorithm (Mouret &
Clune, 2015) and island-based population models (Tanese, 1989;
Romera-Paredes et al., 2024), but does not provide further details.
OpenEvolve implements this hybrid approach, where each island is a
relatively independent subgroup for evolution, and MAP-Elites provide
feature bins for keeping diversity. The details are as below

C.4.1. A DD AND R EPLACE When a new candidate program is generated, the
database follows the logic below to determine whether it should be
stored: (1) Island inheritance: To maintain population isolation, a
newly generated program is automatically assigned to the same island as
its parent, except when an island switch is explicitly triggered. This
ensures that distinct evolutionary lineages develop independently within
their respective islands. (2) Grid-based competition: Once assigned to
an island, the program is mapped to a cell in that island’s feature grid
based on discretized feature coordinates (e.g., complexity and
diversity). If the target cell is empty, the candidate immediately
occupies it. If the cell is already occupied, the system triggers a
cell-level replacement rule based on a fitness comparison, prioritizing
a predefined score (combined score, similar to our objective scores).
The new program replaces the existing one only if it has higher fitness.
This ensures that only the highest-scoring candidates in each bin are
retained for future evolution. Additionally, the system maintains an
elite archive (archive size) that tracks top-performing programs across
all islands for exploitation-based sampling.

C.4.2. DATABASE C APACITY M ANAGEMENT OpenEvolve enforces a global
population limit (population size) to control memory usage and maintain
stable selection pressure. When the number of stored programs exceeds
this limit, the system automatically performs cleanup: (1) Rank all
programs in the database by fitness score. (2) Remove the
lowest-performing programs until the count returns to the limit. (3)
Always preserve the global best program, and also protect the most
recently added program.

C.4.3. I NTER -I SLAND M IGRATION To allow successful traits to
propagate across isolated populations, the system periodically executes
migration, where only a small fraction of top programs from one island
are copied to neighboring islands. All migrated programs are then
integrated through the same MAP-Elites selection process as local ones,
so they replace existing entries only if they offer a fitness
improvement.

D. Discussions: Limitations of RLVR on Challenging Problems In this
section, we give a non-formal mathematical intuition about why RLVR is
in-efficient for challenging open problems, and how dynamic environment
can alleviate it. We use the following simple example to illustrate
this. Consider optimizing an open problem with basic context C and an
initial program P0 . Assume that there exists an advanced but very
low-probability program P that is sampled in an AlphaEvolve-style
evolutionary pipeline, with a program trajectory {P0 , P1 , . . . , PN
−1 , P}, where N is the number of generations required to reach P ≡ PN .
We denote Pθ (P \| C, P0 ) := ϵθ ≪ 1 for LLM parameter θ. For
simplicity, we consider only iterative refinement in the evolutionary
trajectory and thus assume a reasonable approximate

                                                               25

ThetaEvolve: Test-time Learning on Open Problems

Markov property:

                                  Pθ (Pi | C, P0 , . . . , Pi−1 ) ≈ Pθ (Pi | C, Pi−1 ) =: ϵθ,i                         (5)

Note that

                                   ϵθ = Pθ (P | C, P0 )
                                      ≥ Pθ (P1 , . . . , P | C, P0 )        (marginalization)
                                          N
                                          Y
                                      =         Pθ (Pi | C, P0 , . . . , Pi−1 )   (chain rule)                         (6)
                                          i=1
                                          YN
                                      ≈         ϵθ,i      (approx. Markov).
                                          i=1

This makes it clear that RL with a static environment is highly
inefficient compared to a dynamic one:

1.  Since ϵθ ≪ 1, the program P is extremely unlikely to be sampled
    under traditional RL training, where we always start from the same
    initial state (C, P0 ). The resulting reward is therefore extremely
    sparse.

2.  In contrast, if we perform RL in an AlphaEvolve-style dynamic
    environment (Fig. 1, Bottom), we attempt to sample Pi at each
    intermediate environment state with probability ϵθ,i (since we have
    Pi−1 in the database). These intermediate probabilities have an
    estimated magnitude of Θ(logN (ϵθ )) ≫ ϵθ from Eq. 6, and thus
    provide much richer training signal throughout the evolutionary
    process.

3.  Moreover, as RL training progresses, the ϵθ,i values also increase,
    which in turn improves ϵθ from Eq. 6, meaning that the model becomes
    more likely to sample the final advanced program P.

E. Detailed Experimental Results E.1. Main Experiments In Tab. 9, we
show the full results of our main experiments.

E.2. Analysis of Discovered Program Here, we use GPT-5 to briefly
illustrate how the circle-packing program discovered by
Distill-Qwen3-8B, which achieves a new best-known bound, differs from
the initial program.

                                                                  26

ThetaEvolve: Test-time Learning on Open Problems

Table 9: Main results. For different models and tasks, w/ RL
consistently outperform w/o RL baseline when using proper reward shaping
setup, and both of them significantly improve initial program. Here “↑”
corresponds to maximization task, and “↓” denotes the minimization task.
We evaluate on three seeds, report their mean and best value for
reducing variance. (a) ProRL-1.5B-v2 Task Split @ Step Seed 42 Seed 1234
Seed 3407 Mean Best CirclePacking-T (↑) Initial @ 0 0.9598 w/ RL @ 200
2.5225 2.2382 2.2887 2.3498 2.5225 w/o RL @ 200 2.0980 2.1343 1.8473
2.0265 2.1343 w/o RL @ 600 2.2491 2.1865 1.8617 2.0991 2.2491
ThirdAutoCorrIneq (↓) Initial @ 0 3.1586 w/ RL @ 200 1.6053 1.6944
1.6241 1.6412 1.6053 w/o RL @ 200 1.7103 1.6155 1.7235 1.6831 1.6155 w/o
RL @ 600 1.7053 1.6123 1.7121 1.6766 1.6123 HadamardMatrix (↑) Initial @
0 0.1433 w/ RL @ 100 0.3888 0.5635 0.4901 0.4808 0.5635 w/o RL @ 100
0.3376 0.4961 0.1454 0.3264 0.4961 w/o RL @ 300 0.5048 0.5375 0.4338
0.4920 0.5375

                                                (b) Distill-Qwen3-8B
       Task                           Split @ Step        Seed 42     Seed 1234    Seed 3407     Mean           Best
       CirclePacking-T (↑)             Initial @ 0                                                             0.9598
                                       w/ RL @ 65        2.6359857    2.6359831    2.6359833    2.6359840    2.6359857
                                      w/o RL @ 65        2.6342924    2.6359830    2.6359831    2.6354195    2.6359831
                                      w/o RL @ 100       2.6358957    2.6359830    2.6359834    2.6359541    2.6359834
       SecondAutoCorrIneq (↑)          Initial @ 0                                                             0.9055
                                       w/ RL @ 65         0.9399       0.9469       0.9465       0.9444        0.9469
                                      w/o RL @ 65         0.9433       0.9385       0.9416       0.9411        0.9433
                                      w/o RL @ 100        0.9434       0.9390       0.9431       0.9418        0.9434
       ThirdAutoCorrIneq (↓)           Initial @ 0                                                             3.1586
                                       w/ RL @ 65         1.5551       1.4930       1.5150       1.5210        1.4930
                                      w/o RL @ 65         1.5652       1.5084       1.5759       1.5498        1.5084
                                      w/o RL @ 100        1.5631       1.5084       1.5759       1.5491        1.5084
       HadamardMatrix (↑)              Initial @ 0                                                             0.1433
                                       w/ RL @ 65         0.5733       0.5764       0.5591       0.5696        0.5764
                                      w/o RL @ 65         0.5244       0.5524       0.5734       0.5500        0.5733
                                      w/o RL @ 100        0.5244       0.5568       0.5733       0.5515        0.5733




                                                             27

ThetaEvolve: Test-time Learning on Open Problems

                            Analysis Report: Ours v.s. Initial Solution (by ChatGPT 5)

1.  Overview The file Init.py implements a heuristic constructor for
    circle packing, providing a deterministic geometric initialization
    pattern. In contrast, 8B-w_RL@ 65.py introduces a constrained
    optimization framework using scipy.optimize.SLSQP, ex- tending the
    formulation into a mathematically defined optimization problem that
    seeks to maximize the sum of circle radii under geometric
    constraints.

2.  Methodological Comparison

Aspect Init.py 8B-w_RL@ 65.py Generates a feasible non-overlapping
pattern Maximizes total radii ∑ 𝑟𝑖 through constrained Design Objective
within a unit square. optimization. Circle centers fixed by pre-defined
ring pattern; Decision Variables Each circle’s (𝑥𝑖 , 𝑦𝑖 , 𝑟𝑖 ) jointly
optimized. radii adjusted heuristically. Optimization SLSQP with
explicit constraints and tunable toler- None (rule-based adjustments).
Method ances (ftol, eps). Constraint Pairwise shrinkage to resolve
overlaps; clipping at Analytical inequality constraints for overlap and
Handling borders. boundary inclusion. One central circle, 8 inner-ring,
16 outer-ring cir- Default random or hexagonal pattern; specialized
Initial Layout cles. initialization for 𝑛 = 26. Objective Implicit
(maximize feasible packing). Explicit: minimize − ∑𝑖 𝑟𝑖 . Function
Jacobian / Analytical Jacobian for objective prepared (can be Not
available. Gradient integrated for efficiency). Exception handling and
fallback to initial solution Error Handling Implicitly stable (no solver
used). on optimization failure. Numerical Configurable iteration limits
and precision Static geometry only. Parameters (maxiter=5000–15000).
Code Purpose in Robust high-quality initialization or local refine-
Baseline constructor for environment setup. RL Pipeline ment module for
RL training.

3.  Technical Enhancements in 8B-w_RL@ 65.py

4.  Formulation Upgrade: Transforms heuristic geometry construction into
    a continuous optimization problem with a clear mathematical
    objective and constraint formulation.

5.  Constraint Modeling: Introduces explicit non-overlap and boundary
    constraints using analytic functions:

                             (𝑥𝑖 − 𝑥𝑗 )2 + (𝑦𝑖 − 𝑦𝑗 )2 − (𝑟𝑖 + 𝑟𝑗 )2 ≥ 0,      𝑥𝑖 ± 𝑟𝑖 , 𝑦𝑖 ± 𝑟𝑖 ∈ [0, 1]

    This ensures feasible configurations throughout the optimization
    process.

6.  Specialized Initialization (𝑛 = 26): Implements a hexagonal lattice
    arrangement with dynamic centering to ap- proximate theoretical
    dense packing, improving convergence for benchmark cases.

7.  Numerical Stability and Robustness: Adds solver-level tolerance
    control (ftol, eps) and fallback strategies to preserve workflow
    continuity during large-scale or batch RL execution.

8.  Extensibility: The modular design allows integration of gradient
    information (objective_jac) for future perfor- mance optimization
    and potential hybrid RL–SLSQP training loops.

                                                                28

     ThetaEvolve: Test-time Learning on Open Problems

E.3. More Visualizations Performance Curve. We include the performance
curves of ThetaEvolve with RL and pure inference in Fig. 7-10.

                           ProRL-v2-1.5B - Mean over seeds                                         ProRL-v2-1.5B - Best Seed                                          Distill-Qwen3-8B - Mean over seeds                                      Distill-Qwen3-8B - Best Seed
                     2.5                                                            2.5                                                                         2.5                     w/o RL (2.6359541)                          2.5                   w/o RL (2.6359834)

CirclePacking CirclePacking CirclePacking CirclePacking w/ RL
(2.6359840) w/ RL (2.6359857) 2.0 2.0 2.0 2.0 w/o RL (2.0991) w/o RL
(2.2491) 1.5 w/ RL (2.3498) 1.5 w/ RL (2.5225) 1.5 1.5 0 200 400 600 0
200 400 600 0 25 50 75 100 0 25 50 75 100 Step Step Step Step

                                                               Figure 7: Performance Curve of CirclePacking-T (↑).


                                                                                                                                                                                                                                              Distill-Qwen3-8B - Best Seed
                     1.700 ProRL-v2-1.5B - Mean over seeds                                          ProRL-v2-1.5B - Best Seed                                   1.7Distill-Qwen3-8B - Mean over seeds                               1.7


                                                                                                                                                                                                                ThirdAutoCorrIneq
                                                                                    1.700


                                                                                                                                           ThirdAutoCorrIneq
                                                                                                                                                                                                                                                             w/o RL (1.5084)

ThirdAutoCorrIneq ThirdAutoCorrIneq w/o RL (1.6123) w/o RL (1.5491)
1.675 1.675 w/ RL (1.6053) w/ RL (1.5210) w/ RL (1.4930) w/o RL (1.6766)
1.6 1.6 1.650 w/ RL (1.6412) 1.650 1.625 1.625 1.5 1.5 1.600 1.600 0 25
50 75 100 0 25 50 75 100 0 200 400 600 0 200 400 600 Step Step Step Step

                                                          Figure 8: Performance Curve of ThirdAutoCorrIneq (↓).


                                                                                                                                                                            Distill-Qwen3-8B - Best Seed
                                                                                    0.96Distill-Qwen3-8B - Mean over seeds                                      0.96



                                                               SecondAutoCorrIneq                                                          SecondAutoCorrIneq
                                                                                    0.94                                                                        0.94
                                                                                    0.92                             w/o RL (0.9418)                            0.92                         w/o RL (0.9434)
                                                                                                                     w/ RL (0.9467)                                                          w/ RL (0.9469)
                                                                                    0.90                                                                        0.90
                                                                                            0          25          50        75      100                                0        25     50        75      100
                                                                                                                  Step                                                                 Step

                                                         Figure 9: Performance Curve of SecondAutoCorrIneq (↑).


                     0.6 ProRL-v2-1.5B - Mean over seeds                            0.6            ProRL-v2-1.5B - Best Seed                                    0.6 Distill-Qwen3-8B - Mean over seeds                              0.6       Distill-Qwen3-8B - Best Seed

HadamardMatrix HadamardMatrix HadamardMatrix HadamardMatrix 0.4 0.4 0.4
0.4 w/o RL (0.4920) w/o RL (0.5375) w/o RL (0.5515) w/o RL (0.5733) 0.2
w/ RL (0.4808) 0.2 w/ RL (0.5635) 0.2 w/ RL (0.5696) 0.2 w/ RL (0.5764)
0 100 200 300 0 100 200 300 0 25 50 75 100 0 25 50 75 100 Step Step Step
Step

                                                               Figure 10: Performance Curve of HadamardMatrix (↑).

Results of CirclePacking-T. In Fig. 11, we compare the circle packing
solutions found by ThetaEvolve and AlphaEvolve. We find that our best
solution differs from that of AlphaEvolve: although the two
configurations look very similar, ours is clearly asymmetric, whereas
the AlphaEvolve solution appears (almost) symmetric.

E.4. Ablation of Database Management We further ablate whether the
MAP-Elites algorithm and island-based models are critical for program
database management. To this end, we simplify the database into a
vanilla priority queue that depends only on objective scores by setting
num islands = 1, using a single feature dimension (score only, no
diversity metric), and a single feature bin for MAP-Elites. As shown in
Tab. 10, this simplification leads to noticeably weaker evolutionary
performance, indicating that the original database design remains
important.

                                                                                                                                           29

ThetaEvolve: Test-time Learning on Open Problems

           1.0 Packing: 8B-w_RL@65-Formal, score=2.6359830774 1.0 Circle Packing: AlphaEvolve, score=2.6358627564
           Circle
                   21                              23                             25                      17                             4              0
                                                                                                                          19                                            12
                                     22                       24
           0.8                                                                                    0.8
                                                                                                                                                              18
                    16                             18                            20                            9                                  10
                                                                                                                               8                                        15
           0.6                       17                       19                                  0.6                                                        24
                   11                                                            15                       6               25                 14                          1
                                                   13
           0.4                      12                            14                              0.4                                                        16
                    6                                                            10                            20              23                                       21
                                              2         3                                                                                         11
                                1                                      4                                                                                      22
           0.2                                                                                    0.2
                    0                    7         8          9                  5                                         7             3              13              5
                                                                                                          2
           0.0                                                                                    0.0
             0.0          0.2                0.4        0.6                0.8         1.0          0.0             0.2            0.4            0.6             0.8        1.0

Figure 11: Our best solution differs from that found by AlphaEvolve.
Although they look very similar (up to a 90-degree rotation of the
AlphaEvolve solution), our configuration is asymmetric: only adjacent
circles 19 and 24 do not touch, whereas the AlphaEvolve solution appears
(almost) symmetric, with only adjacent circles 25 and 14 not touching.

                         Method                                                  Seed42           Seed1234           Seed3407            Mean                Best
                         w/ RL                                                   2.5225            2.2382                 2.2887         2.3498          2.5225
                         w/ RL, priority queue on score                          1.9232            2.1154                 2.1072         2.0486          2.1154

     Table 10: Ablation of program-database design. Results on CirclePacking-T with ProRL-1.5B-v2.




                                                                                             30


