# NestUp Work Process Tracker

A comprehensive web-based work management system designed to handle task dependencies, member assignments, and process visualization. Engineered for the NestUp Intern Assignment.

## 🚀 Quick Start (Local Setup)

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Database Initialization:**
   Open the `supabase-schema.sql` file located in the root of this project. Copy its contents and execute it in your Supabase SQL Editor. This initializes the custom database schema, dropping any external auth dependencies.
3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   *Navigate to `http://localhost:3000` to access the portal.*

---

## 🎯 How to Demo (Step-by-Step)

The application handles roles via a seamless custom authentication system. 

### Step 1: Create a Member Account
- Go to `/login` and select **"Create Account"**.
- Create an account using an email without the word "admin" (e.g., `employee@nestup.com`).
- Once entered into the Member Dashboard, take note that it is empty. Log out.

### Step 2: Create an Admin Account
- Return to `/login` and select **"Create Account"**.
- Register using any email containing the word `"admin"` (e.g., `admin@nestup.com`). 
- *The Custom Auth logic automatically detects this keyword and assigns you the Administrator role.*

### Step 3: Assign Tasks as Admin
- In the **Admin Dashboard**, utilize the "Create Work Item" form.
- Create Task A: "Design Database" (Priority: High). Assign it to `employee@nestup.com` from the dropdown list.
- Create Task B: "Build Auth API" (Priority: Critical). Assign it to the same employee.

### Step 4: Forge Dependencies & Visuals
- Using the **"Create Dependency"** form, select "Design Database" as your *Predecessor* and "Build Auth API" as your *Successor*. Set the type to **full**.
- Observe the **Live Dependency Graph** below dynamically updating to visualize the strict hierarchy flow between the tasks.

### Step 5: Test the Logic as a Member
- Log out of your Admin account, and log back in as `employee@nestup.com`.
- You will see "Design Database" in progress, but "Build Auth API" will be strictly **blocked**.
- Use the Progress Slider to drag "Design Database" to 100%. 
- The system's downstream cascade engine will immediately unblock "Build Auth API", and you will receive a notification that your work has successfully cleared a bottleneck downstream!

---

## 🧠 System Architecture & Dependency Logic

This platform answers the assignment's core "Thinking Test". Here is how the system solves complex workflow math natively:

### 1. Cycle Detection (Iterative DFS)
*Found in `src/lib/graphLogic.ts`*
- Every time a new dependency is requested, the system loads an Adjacency List representing the graph of all tasks. 
- It executes a **3-State Iterative Depth-First Search (DFS)** (Unvisited, Visiting, Finished).
- If the recursive traversal encounters a "Visiting" node, a backward dependency flow edge (Loop) is detected. The server instantly rejects the dependency to prevent the workflow from spiraling infinitely. Iterative DFS was specifically chosen to prevent stack-overflow limits on excessively deep project management chains.

### 2. Downstream Cascade (BFS Flow)
*Found in `src/lib/graphLogic.ts`*
- When progress % is updated on a task, the platform uses **Breadth-First Search (BFS)** to scan downstream successors. 
- It evaluates independent thresholds (Full 100%, or Partial %>X). 
- If `Task B` depends on `Task A` hitting 50%, and `A` crosses that threshold, the system independently unblocks `B` entirely autonomously, resolving real-world staggered deliverables perfectly.

### 3. Edge Case Mitigation
- **Threshold Validation:** Rejecting dependencies created with a 0% threshold since 0% implies no dependency is required.
- **Member Independence:** Members can securely update their tasks independently without risking data bleeds, ensured by our Custom Authentication session tracking in Next.js Server Actions.
- **Self Loops:** Explicitly rejecting scenarios where `Task A` lists itself as its own dependent.
