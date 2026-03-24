# Workflow Executor — Contract Types

> Types exchanged between the **orchestrator (server)**, the **executor (agent-nodejs)**, and the **frontend**.
> Last updated: 2026-03-24

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
  userConfirmed?: boolean; // true = user confirmed a pending action on this step
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

> ⚠️ **NEVER contains client data** (field values, AI reasoning, etc.) — those stay in the `RunStore` on the client side.

---

## 3. Pending Data

Steps that require user input pause with `status: "awaiting-input"`. The frontend writes `pendingData` to unblock them via a dedicated endpoint on the executor HTTP server.

> **TODO** — The pending-data write endpoint is not yet implemented. Route, method, and per-step-type body shapes are TBD (PRD-240).

Once written, the frontend calls `POST /runs/:runId/trigger` and the executor resumes with `userConfirmed: true`.

### update-record — user picks a field + value to write

> **TODO** — Pending-data write endpoint TBD (PRD-240).

```typescript
interface UpdateRecordPendingData {
  name:        string; // technical field name
  displayName: string; // label shown in the UI
  value:       string; // value chosen by the user
}
```

### trigger-action — user confirmation only

No payload required from the frontend. The executor selects the action and writes `pendingData` itself (action name + displayName) to the RunStore. The frontend just confirms:

```
POST /runs/:runId/trigger
```

### load-related-record — user picks the relation and/or the record

The frontend can override **both** the relation (field) and the selected record.

> **Current status** — The frontend cannot yet override the AI selection. The executor HTTP server does not yet expose the pending-data write endpoint. Until it is implemented, the executor writes the AI's pick directly into `selectedRecordId`.

```typescript
// Written by the executor; overwritable by the frontend via the pending-data endpoint (TBD)
interface LoadRelatedRecordPendingData {
  name:                  string;               // technical relation name
  displayName:           string;               // label shown in the UI
  relatedCollectionName: string;               // collection of the related record
  suggestedFields?:      string[];             // fields suggested for display
  selectedRecordId:      Array<string|number>; // AI's pick; overwritten by the frontend via the pending-data endpoint
}
```

The executor initially writes the AI's pick into `selectedRecordId`. The pending-data endpoint overwrites it (and optionally `name`, `displayName`, `relatedCollectionName`) when the user changes the selection.

#### Future endpoint — pending-data write (not yet implemented)

> **TODO** — Route and method TBD (PRD-240).

Request body:

```typescript
{
  selectedRecordId?:      Array<string | number>; // record chosen by the user
  name?:                  string;                 // relation changed
  displayName?:           string;                 // relation changed
  relatedCollectionName?: string;                 // required if name is provided
}
```

Response: `204 No Content`.

The frontend calls this endpoint **before** `POST /runs/:runId/trigger`. On the next poll, `userConfirmed: true` and the executor reads `selectedRecordId` from the RunStore.

### mcp-task — user confirmation only

No payload required from the frontend. The executor selects the tool and writes `pendingData` itself (tool name + input) to the RunStore. The frontend just confirms:

```
POST /runs/:runId/trigger
```

The executor resumes with `userConfirmed: true` and executes the pre-selected tool.

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
                 Frontend writes pendingData
                 to executor HTTP server       TODO: route TBD
                            │
                  POST /runs/:runId/trigger
                  (next poll: userConfirmed = true)
                            │
                      Executor resumes
```
