# AI Quiz Prep (Next Week) — Based on Latest Blackboard Slides

课程：Artificial Intelligence Spring 2026  
资料来源：`~/proj/sustech` 刷新后同步到 Blackboard 的 `Course Materials/Lecture`（Lec00~Lec04）

## 0) 你这次 quiz 最该押什么

按当前课件结构，最可能考的是：
1. **Search 基础和性质比较**（Lec01）
2. **Heuristic 与 A\***（Lec01/Lec02/Lec03）
3. **Problem-specific search**：CSP、minimax、alpha-beta、局部搜索（Lec03）
4. **ML principles 基础概念**：supervised / unsupervised / overfitting（Lec04）

如果只剩很少时间，优先背：
- BFS/DFS/UCS/A* 的完备性、最优性、时间空间复杂度趋势
- admissible vs consistent heuristic
- minimax 与 alpha-beta 剪枝逻辑
- CSP 的变量/域/约束 + 回溯基本思路
- overfitting 的定义与常见缓解方法

---

## 1) Lec00 Introduction（通常占少量概念题）

### 必记
- AI 课程主线：搜索（search）和学习（learning）两大范式。
- 这门课后续重点不是“会调库”，而是抽象建模与推理策略。

### 可能题型
- “AI 问题为什么可以转化为搜索问题？”
- “AI 课程中的两条核心方法线是什么？”

---

## 2) Lec01 AI as Search（高频）

## 2.1 基本建模
- **State（状态）**：问题在某一时刻的描述
- **Action（动作）**：状态转移操作
- **Transition model（转移）**：动作导致的新状态
- **Goal test（目标测试）**：判断是否到达目标
- **Path cost（路径代价）**：累计成本

一句话：把问题转成“从初始状态到目标状态的路径搜索”。

## 2.2 经典无信息搜索（uninformed）

### BFS
- 优点：若每步代价相同，能找最短步数解
- 缺点：空间爆炸（队列很大）

### DFS
- 优点：空间小、实现简单
- 缺点：可能陷入深层、非最优，图有环时需去重

### Uniform-Cost Search (UCS)
- 按当前累计代价最小优先扩展
- 只要 step cost 非负，最优性强

### Iterative Deepening
- 结合 BFS 的层次性 + DFS 的低空间
- 适合解深度未知但分支较大的情况

## 2.3 高频比较题模板

- “谁更省空间”：通常 DFS / IDDFS
- “谁保证最优”：UCS（非负边权），A*（条件满足时）
- “谁更适合单位代价最短步”：BFS

---

## 3) Lec02 Beyond Classical Search（从树到更泛化表示）

重点是：
- 不只把问题看成“树”，而是更一般的状态空间图
- 允许更复杂搜索场景（重复状态、局部最优、大规模空间）

### 你要会说的核心句
- Classical tree search 在大规模问题上会遭遇重复扩展与组合爆炸。
- 引入 heuristic 和更贴合问题结构的表示，能显著提升效率。

---

## 4) Lec03 Problem-Specific Search（超高频）

## 4.1 Heuristic 与 A*

### Heuristic h(n)
- 估计从 n 到目标的剩余代价
- 好 heuristic = 更接近真实代价、计算又不过贵

### A* 评价函数
- `f(n) = g(n) + h(n)`
  - g(n): 已走代价
  - h(n): 预计剩余代价

### admissible（可采纳）
- 从不高估真实代价（乐观估计）
- 常用于证明 A* 最优

### consistent（单调）
- 满足三角不等式形式约束
- 一般意味着图搜索时不必反复回退修正

#### 高频易错点
- admissible 不一定推出高效率，只是最优性安全条件之一
- heuristic 太弱时，A* 退化接近 UCS

## 4.2 Local Search（局部搜索）

### Hill-climbing
- 每步走向更优邻居
- 易卡局部最优/平台

### Simulated Annealing
- 早期允许“差一点的跳跃”，后期降温收敛
- 目的是跳出局部最优

### Genetic Algorithm（若老师提到）
- 种群、选择、交叉、变异
- 全局探索能力强，但参数敏感

## 4.3 Constraint Satisfaction Problems (CSP)

建模三件套：
- Variables（变量）
- Domains（取值域）
- Constraints（约束）

基础求解：
- Backtracking（回溯）
- 配合约束传播（如 arc consistency）提升剪枝效率

## 4.4 Adversarial Search（博弈搜索）

### Minimax
- MAX 层选最大收益，MIN 层选最小收益
- 反映“对手最优对抗”假设

### Alpha-Beta Pruning
- 与 minimax 最优决策等价，但能剪去不可能影响结果的分支
- move ordering 越好，剪枝越充分

---

## 5) Lec04 Principles of Machine Learning（概念题高频）

## 5.1 学习的本质
- 学习可看作：在假设空间中搜索一个泛化最好的函数

## 5.2 核心概念
- **Supervised learning**：有标签学习映射
- **Unsupervised learning**：无标签发现结构
- **Overfitting**：训练集表现好，测试泛化差

## 5.3 常见追问
- 为什么会 overfit？（模型太复杂、数据少、噪声大）
- 怎么缓解？（正则化、更多数据、早停、交叉验证、简化模型）

---

## 6) 一页速记（考前 10 分钟）

1. 搜索建模五件套：state/action/transition/goal/path cost  
2. BFS vs DFS vs UCS：最优性与空间开销对比  
3. A*：`f=g+h`，记住 admissible / consistent  
4. Problem-specific：CSP、minimax、alpha-beta、local search  
5. ML 基础：supervised/unsupervised/overfitting

---

## 7) 可能的 quiz 题型清单（按概率）

### A. 选择题（高概率）
- 哪个算法在单位边权下最可能给最短步数解？
- 哪个算法空间消耗通常更低？
- 哪个条件保证 A* 的最优性？
- overfitting 的定义是哪一个？

### B. 简答题（高概率）
- 比较 BFS / DFS / UCS 的适用场景
- 解释 admissible heuristic 的含义及意义
- 说明 alpha-beta 为什么不改变 minimax 最终结果
- 举例说明如何把实际任务建模为 CSP

### C. 小推导/小案例（中概率）
- 给一个小图，手工跑 2~4 步 A*/UCS
- 给博弈树，做一次 alpha-beta 剪枝示意
- 给训练误差/测试误差描述，判断是否 overfitting

---

## 8) 今晚可执行的复习计划（90 分钟版）

- 0~20 分钟：过 Lec01，做“算法对比表”
- 20~45 分钟：过 Lec03 的 A* + heuristic + minimax/alpha-beta
- 45~65 分钟：过 Lec03 的 CSP + local search
- 65~80 分钟：过 Lec04（学习范式 + overfitting）
- 80~90 分钟：自测 10 题（口头快速回答）

---

## 9) 给你的一句话策略

这次 quiz 不要死记算法细节实现，重点是：
**“给场景选方法 + 解释为什么”**。  
只要你能稳定回答“这个问题该用哪类搜索/学习方法、为什么”，分数会很稳。
