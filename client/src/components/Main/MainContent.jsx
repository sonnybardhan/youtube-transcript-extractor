import { useApp } from '../../context/AppContext';
import { InputView } from './InputView';
import { ResultsView } from './ResultsView';
import { LoadingOverlay } from '../common/LoadingOverlay';

export function MainContent() {
  const { state, actions } = useApp();
  const { view, isLoading, loadingMessage } = state;

  return (
    <main className="main-content">
      {view === 'input' && <InputView />}
      {view === 'results' && <ResultsView />}

      {isLoading && (
        <LoadingOverlay
          message={loadingMessage}
          onCancel={actions.cancelCurrentRequest}
        />
      )}
    </main>
  );
}
