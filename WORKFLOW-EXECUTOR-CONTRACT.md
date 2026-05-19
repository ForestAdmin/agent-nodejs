# Workflow Executor — Contract Types

> Types exchanged between the **orchestrator (server)**, the **executor (agent-nodejs)**, and the **frontend**.
> Last updated: 2026-04-28

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/workflow-orchestrator/pending-run` | Batch poll — all pending runs |
| GET | `/api/workflow-orchestrator/available-run/:runId` | Single run fetch (HTTP trigger path) |
| POST | `/api/workflow-orchestrator/update-step` | Report step outcome + receive next step |
| GET | `/api/workflow-orchestrator/collection-schema/:collectionName?runId=:runId` | Collection schema |
| GET | `/api/workflow-orchestrator/run/:runId/access-check?userId=:userId` | Authorization check |
| GET | `/liana/mcp-server-configs-with-details` | MCP server configurations |

---

## 1. Polling

### Batch poll — `GET /api/workflow-orchestrator/pending-run`

Returns `ServerHydratedWorkflowRun[]`. The executor maps each run to an `AvailableStepExecution`.
Runs that fail to map are reported as malformed (error outcome posted, run stops re-dispatching).

### Single-run fetch — `GET /api/workflow-orchestrator/available-run/:runId`

Returns `ServerHydratedWorkflowRun | null`. Used by the HTTP trigger path only.
`null` → no available step (run finished, awaiting input, or not found).

Both responses use the same envelope, mapped to:

```typescript
interface AvailableStepExecution {
  runId:          string;
  stepId:         string;
  stepIndex:      number;
  collectionId:   string;
  baseRecordRef:  RecordRef;
  stepDefinition: StepDefinition;
  previousSteps:  Step[];
  user:           StepUser;
}

interface StepUser {
  id:              number;
  email:           string;
  firstName:       string;
  lastName:        string;
  team:            string;
  renderingId:     number;
  role:            string;
  permissionLevel: string;
  tags:            Record<string, string>;
}
```

Each dispatch also carries a `forestServerToken` (from `userProfile.serverToken`) used for
per-step API calls (activity logs, collection schema). It is **not** part of `AvailableStepExecution` —
it lives in `AvailableRunDispatch.auth`.

### RecordRef

```typescript
interface RecordRef {
  collectionName: string;
  recordId:       Array<string | number>;
  stepIndex:      number; // index of the workflow step that loaded this record
}
```

### Step (history entry for `previousSteps`)

```typescript
interface Step {
  stepDefinition: StepDefinition;
  stepOutcome:    StepOutcome;
}
```

### StepDefinition

Discriminated union on `type`:

```typescript
type StepDefinition =
  | ConditionStepDefinition
  | ReadRecordStepDefinition
  | UpdateRecordStepDefinition
  | TriggerActionStepDefinition
  | LoadRelatedRecordStepDefinition
  | McpStepDefinition
  | GuidanceStepDefinition;

interface ConditionStepDefinition {
  type:          "condition";
  options:       string[];    // minimum 2 options
  prompt?:       string;
  aiConfigName?: string;
}

interface ReadRecordStepDefinition {
  type:                "read-record";
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    fieldDisplayNames?:       string[];  // display names of fields to read
  };
}

interface UpdateRecordStepDefinition {
  type:                "update-record";
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    fieldDisplayName?:        string;  // display name of field to update
    value?:                   string;
  };
}

interface TriggerActionStepDefinition {
  type:                "trigger-action";
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    actionDisplayName?:       string;  // display name of action to trigger
  };
}

interface LoadRelatedRecordStepDefinition {
  type:                "load-related-record";
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    relationDisplayName?:     string;  // display name of relation to follow
    selectedRecordIndex?:     number;
  };
}

interface McpStepDefinition {
  type:                "mcp";
  mcpServerId?:        string;
  prompt?:             string;
  aiConfigName?:       string;
  automaticExecution?: boolean;
}

// Manual guidance step — saves user input, no AI call.
interface GuidanceStepDefinition {
  type:          "guidance";
  prompt?:       string;
  aiConfigName?: string;
}
```

### StepOutcome

What the executor reports per step, and what `previousSteps` carries for past steps.

```typescript
type StepOutcome =
  | ConditionStepOutcome
  | RecordStepOutcome
  | McpStepOutcome
  | GuidanceStepOutcome;

interface ConditionStepOutcome {
  type:            "condition";
  stepId:          string;
  stepIndex:       number;
  status:          "success" | "error";
  selectedOption?: string;  // present when status = "success"
  error?:          string;  // present when status = "error"
}

// Covers read-record, update-record, trigger-action, load-related-record
interface RecordStepOutcome {
  type:      "record";
  stepId:    string;
  stepIndex: number;
  status:    "success" | "error" | "awaiting-input";
  error?:    string;
}

interface McpStepOutcome {
  type:      "mcp";
  stepId:    string;
  stepIndex: number;
  status:    "success" | "error" | "awaiting-input";
  error?:    string;
}

interface GuidanceStepOutcome {
  type:      "guidance";
  stepId:    string;
  stepIndex: number;
  status:    "success" | "error";
  error?:    string;
}
```

> **NEVER contains client data** (field values, AI reasoning, etc.) — those stay in the `RunStore`
> on the client side.

---

## 2. Step Result + Auto-chain

**`POST /api/workflow-orchestrator/update-step`**

After executing a step, the executor posts the outcome. Response: `ServerHydratedWorkflowRun | null`.

- **`null`** → run is finished / awaiting input / errored → executor stops the chain, yields to next poll.
- **non-null** → a next step is available → executor runs it **inline** (auto-chain) without waiting for
  the next poll cycle. Chain continues until `null`, a non-progressing `stepIndex`, the depth cap
  (`maxChainDepth`, default 50), or graceful shutdown.

Request body:

```typescript
interface UpdateStepRequest {
  runId:      number;
  stepUpdate: {
    stepIndex:  number;
    attributes: {
      done?:    boolean;
      context?: Record<string, unknown>; // stores status, error, selectedOption for round-trip
    };
  };
  executionStatus:
    | { type: "success" }
    | { type: "error";          message: string }
    | { type: "awaiting-input" };
}
```

**Idempotency requirement**: the server must deduplicate identical outcomes for a given
`(runId, stepIndex)`. The port retries `POST /update-step` on transient failures (network, 5xx) —
without server-side dedup, retries cause double side-effects.

---

## 3. Pending Data (awaiting-input flow)

Steps that require user input pause with `status: "awaiting-input"`. The executor writes its
AI-selected data to `pendingData` in the RunStore. The frontend reads it via `GET /runs/:runId`
(executor HTTP server), then confirms by calling `POST /runs/:runId/trigger` with the data.

**`POST /runs/:runId/trigger`** — executor HTTP server

Request body:
```typescript
{ pendingData?: unknown }
```

On re-execution, the executor reads `pendingData` from the RunStore and checks `userConfirmed`:
- `undefined` → returns `awaiting-input` again (step not yet actionable)
- `true` → executes the confirmed action
- `false` → skips the step (marks as success)

### update-record

```typescript
// Stored in RunStore (pendingData written by executor):
interface UpdateRecordPendingData {
  name:           string;   // technical field name
  displayName:    string;   // label shown in UI
  value:          string;   // AI-proposed value; overridable by frontend
  userConfirmed?: boolean;
}

// pendingData field of POST /runs/:runId/trigger body:
{ userConfirmed: boolean; value?: string; }
```

### trigger-action & mcp

```typescript
// pendingData field of POST /runs/:runId/trigger body:
{ userConfirmed: boolean; }
```

### load-related-record

```typescript
// Stored in RunStore (pendingData written by executor):
interface LoadRelatedRecordPendingData {
  name:              string;
  displayName:       string;
  suggestedFields?:  string[];
  selectedRecordId:  Array<string | number>;
  userConfirmed?:    boolean;
}

// pendingData field of POST /runs/:runId/trigger body:
{
  userConfirmed:      boolean;
  name?:              string;                 // override relation
  selectedRecordId?:  Array<string | number>; // min 1 element
  // displayName is NOT accepted — derived from FieldSchema after resolving name.
}
```

---

## Flow Summary

### Polling loop

```
Executor ──► GET /api/workflow-orchestrator/pending-run
                          │
              [ServerHydratedWorkflowRun, ...]
                          │
             map → AvailableStepExecution[]
             (malformed runs reported as error)
                          │
              for each run, execute step
                          │
        POST /api/workflow-orchestrator/update-step
                          │
           ┌──────────────┴──────────────┐
         null                        non-null
  (done / error /                (next step)
  awaiting-input)                     │
         │                   auto-chain inline ──► (loop)
      stop chain
```

### HTTP trigger

```
Frontend ──► POST /runs/:runId/trigger
                      │
     GET /api/workflow-orchestrator/available-run/:runId
                      │
              execute step + auto-chain
                      │
     POST /api/workflow-orchestrator/update-step
```
