export interface SelectionActionKeepTarget {
  surface: string;
  url: string;
  target_key: string;
}

export interface SelectionActionKeepAttempt {
  id: string;
  content: string;
  target: SelectionActionKeepTarget;
}

export interface SelectionActionKeepAdoption extends SelectionActionKeepAttempt {
  runId: string;
}

function sameTarget(
  left: SelectionActionKeepTarget,
  right: SelectionActionKeepTarget,
) {
  return (
    left.surface === right.surface &&
    left.url === right.url &&
    left.target_key === right.target_key
  );
}

export function prepareSelectionActionKeep(
  previous: SelectionActionKeepAttempt | undefined,
  content: string,
  target: SelectionActionKeepTarget,
  createId: () => string,
): SelectionActionKeepAttempt {
  if (
    previous &&
    previous.content === content &&
    sameTarget(previous.target, target)
  ) return previous;
  return { id: createId(), content, target: { ...target } };
}

export function completeSelectionActionKeep(
  runId: string,
  attempt: SelectionActionKeepAttempt,
): SelectionActionKeepAdoption {
  return {
    runId,
    id: attempt.id,
    content: attempt.content,
    target: { ...attempt.target },
  };
}
