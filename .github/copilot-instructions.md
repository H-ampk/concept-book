# ConceptBook Copilot Instructions

## Project overview

ConceptBook is a TypeScript-based PWA for organizing concepts, contextual definitions, relations, quizzes, learning logs, and mastery information.

The application uses IndexedDB for local persistence.

## Code review policy

When performing a pull request code review, first identify the Issue linked from the pull request.

Review the implementation against that Issue, not only against general code quality.

Check the following points.

### 1. Issue requirements

- Read the linked Issue.
- Extract its purpose, scope, and completion criteria.
- Check each completion criterion against the actual code changes.
- Report whether each criterion is:
  - satisfied
  - partially satisfied
  - not satisfied
  - outside the pull request scope

Do not assume that an implementation satisfies the Issue only because the code builds.

### 2. Scope control

Check whether the pull request contains changes that are not required by the linked Issue.

Flag:
- unrelated refactors
- speculative features
- behavior changes outside the Issue
- unnecessary data-model changes

Small supporting changes required to implement or test the Issue are acceptable.

### 3. Existing behavior

Check whether existing ConceptBook behavior is unintentionally changed.

Pay particular attention to:
- Concept editing
- Concept relations
- filtering and search
- graph and tree behavior
- quiz generation and learning
- import/export
- backup and restore

### 4. IndexedDB and compatibility

Treat persisted data compatibility as important.

When types, stored objects, import/export formats, or IndexedDB handling change, check:

- whether existing stored data can still be read
- whether optional fields are handled safely
- whether legacy data requires hydration or normalization
- whether backup/import compatibility is preserved
- whether new required fields can break old records

Do not recommend destructive migrations unless explicitly required by the Issue.

### 5. Data flow

Check that data transformations occur in the intended order.

Look for:
- filtering being applied at the wrong stage
- hidden data being unintentionally restored
- inconsistent Concept IDs
- duplicate relationship calculations
- state derived from stale or different data sets

### 6. Tests

Check whether behavior introduced or changed by the Issue has appropriate automated tests.

Prefer tests for:
- pure utilities
- boundary conditions
- legacy-data compatibility
- filtering behavior
- relationship traversal
- deterministic ordering
- regression cases

Do not require tests for trivial presentational-only changes unless there is meaningful behavior to verify.

### 7. Performance

For graph, tree, search, or large Concept collections, check for:

- unnecessary repeated O(n) / O(n²) work
- recalculation on every render
- redundant relation traversal
- unnecessary allocation of large intermediate collections

Do not propose premature optimization without evidence.

### 8. Review output

Prioritize concrete problems over stylistic preferences.

When reporting a problem:

- identify the relevant file/code
- explain the behavior that can fail
- relate it to the Issue or an existing ConceptBook requirement
- suggest the smallest reasonable correction

Do not request unrelated architectural rewrites.

If no meaningful problem is found, say so rather than inventing issues.
