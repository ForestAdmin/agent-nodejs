# Workflow Executor — Contract Types

> Types exchanged between the **orchestrator (server)**, the **executor (agent-nodejs)**, and the **frontend**.
> Last updated: 2026-03-25

---

## 1. Polling

**`GET /liana/v1/workflow-step-executions/pending?runId=<runId>`**

The executor polls for the current pending step of a run. The server must return **one object** (not an array), or `null` if the run is not found.

```typescript
interface PendingStepExecution {
  runId:          string;
  stepId:         string;
  stepIndex:      number;
  baseRecordRef:  RecordRef;
  stepDefinition: StepDefinition;
  previousSteps:  Step[];
}
```

> **`null` response** → executor throws `RunNotFoundError` → HTTP 404 returned to caller.

### RecordRef

Lightweight pointer to a specific record.

```typescript
interface RecordRef {
  collectionName: string;
  recordId:       Array<string | number>;
  stepIndex:      number; // index of the workflow step that loaded this record
}
```

### Step

History entry for an already-executed step (used in `previousSteps`).

```typescript
interface Step {
  stepDefinition: StepDefinition;
  stepOutcome:    StepOutcome;
}
```

### StepDefinition

Discriminated union on `type`.

```typescript
type StepDefinition =
  | ConditionStepDefinition
  | RecordTaskStepDefinition
  | McpTaskStepDefinition;

interface ConditionStepDefinition {
  type:          "condition";
  options:       [string, ...string[]]; // at least one option required
  prompt?:       string;
  aiConfigName?: string;
}

interface RecordTaskStepDefinition {
  type:                "read-record"
                     | "update-record"
                     | "trigger-action"
                     | "load-related-record";
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
}

interface McpTaskStepDefinition {
  type:                "mcp-task";
  mcpServerId?:        string;
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
}
```

### StepOutcome

What the executor previously reported for each past step (used in `previousSteps`).

```typescript
type StepOutcome =
  | ConditionStepOutcome
  | RecordTaskStepOutcome
  | McpTaskStepOutcome;

interface ConditionStepOutcome {
  type:            "condition";
  stepId:          string;
  stepIndex:       number;
  status:          "success" | "error" | "manual-decision";
  selectedOption?: string; // present when status = "success"
  error?:          string; // present when status = "error"
}

interface RecordTaskStepOutcome {
  type:      "record-task";
  stepId:    string;
  stepIndex: number;
  status:    "success" | "error" | "awaiting-input";
  error?:    string; // present when status = "error"
}

interface McpTaskStepOutcome {
  type:      "mcp-task";
  stepId:    string;
  stepIndex: number;
  status:    "success" | "error" | "awaiting-input";
  error?:    string; // present when status = "error"
}
```

---

## 2. Step Result

**`POST /liana/v1/workflow-step-executions/<runId>/complete`**

After executing a step, the executor posts the outcome back to the server. The body is one of the `StepOutcome` shapes above.

> **NEVER contains client data** (field values, AI reasoning, etc.) — those stay in the `RunStore` on the client side.

---

## 3. Pending Data

Steps that require user input pause with `status: "awaiting-input"`. The executor writes its AI-selected data to `pendingData` in the RunStore. The frontend can then override fields and confirm via the pending-data endpoint.

**`PATCH /runs/:runId/steps/:stepIndex/pending-data`**

The frontend writes user overrides + confirmation to the executor HTTP server. Request bodies are validated per step type using strict Zod schemas (unknown fields are rejected).

Once written, the frontend calls `POST /runs/:runId/trigger`. On the next execution, the executor reads `pendingData` from the RunStore and checks `userConfirmed`:
- `undefined` → re-emit `awaiting-input` (safe no-op)
- `true` → execute the confirmed action
- `false` → skip the step (mark as success)

### update-record — user picks a field + value to write

The executor writes the AI's field selection to `pendingData`. The frontend can override `value` and confirm.

Stored in RunStore:
```typescript
interface UpdateRecordPendingData {
  name:            string;  // technical field name (set by executor)
  displayName:     string;  // label shown in the UI (set by executor)
  value:           string;  // AI-proposed value; overridable by frontend
  userConfirmed?:  boolean; // set by frontend via PATCH
}
```

PATCH request body:
```typescript
{
  userConfirmed: boolean;
  value?:        string;  // optional override of AI-proposed value
}
```

### trigger-action — user confirmation only

The executor selects the action and writes `pendingData` (action name + displayName) to the RunStore. The frontend only confirms or rejects.

PATCH request body:
```typescript
{
  userConfirmed: boolean;
}
```

### load-related-record — user picks the relation and/or the record

The executor writes the AI's relation selection to `pendingData`. The frontend can override the relation, the selected record, or both.

Stored in RunStore:
```typescript
interface LoadRelatedRecordPendingData {
  name:             string;               // technical relation name
  displayName:      string;               // label shown in the UI
  suggestedFields?: string[];             // fields suggested for display
  selectedRecordId: Array<string|number>; // AI's pick; overridable by frontend
  userConfirmed?:   boolean;              // set by frontend via PATCH
}
```

> `relatedCollectionName` is **not** stored in `pendingData` — the executor re-derives it from the `FieldSchema` at execution time using the (possibly overridden) relation `name`.

PATCH request body:
```typescript
{
  userConfirmed:    boolean;
  name?:            string;                // override relation
  displayName?:     string;                // override relation label
  selectedRecordId?: Array<string|number>; // override selected record (min 1 element)
}
```

### mcp-task — user confirmation only

The executor selects the MCP tool and writes `pendingData` (tool name + input) to the RunStore. The frontend only confirms or rejects.

PATCH request body:
```typescript
{
  userConfirmed: boolean;
}
```

Response for all types: `204 No Content`.

---

## Flow Summary

```
Orchestrator ──► GET pending?runId=X ──► Executor
                                            │
                                      executes step
                                            │
                            ┌───────────────┴───────────────┐
                       needs input                      done
                            │                              │
                   status: awaiting-input          POST /complete
                            │                         (StepOutcome)
                            │
              Executor writes pendingData
              to RunStore (AI selection)
                            │
               Frontend reads pendingData
              via GET /runs/:runId
                            │
              Frontend overrides + confirms
              via PATCH /runs/:runId/steps/:stepIndex/pending-data
              (sets userConfirmed: true/false)
                            │
                  POST /runs/:runId/trigger
                            │
                      Executor resumes
              (reads pendingData.userConfirmed from RunStore)
```
