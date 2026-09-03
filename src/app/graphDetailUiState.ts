export type GraphDetailUiState = {
  selectedId: string | undefined;
  graphDetailOpen: boolean;
};

export const selectGraphConcept = (
  _state: GraphDetailUiState,
  id: string
): GraphDetailUiState => ({
  selectedId: id,
  graphDetailOpen: true
});

export const closeGraphDetail = (state: GraphDetailUiState): GraphDetailUiState => ({
  selectedId: state.selectedId,
  graphDetailOpen: false
});

export const clearGraphSelectionIfDeleted = (
  state: GraphDetailUiState,
  deletedId: string
): GraphDetailUiState => {
  if (state.selectedId !== deletedId) {
    return state;
  }
  return { selectedId: undefined, graphDetailOpen: false };
};

export const isGraphDetailPanelVisible = (
  hasSelectedConcept: boolean,
  graphDetailOpen: boolean
): boolean => hasSelectedConcept && graphDetailOpen;
