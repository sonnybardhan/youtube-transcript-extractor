export function MatchingFilesList({ files, selectedTermCount, filterMode, onFileClick }) {
  if (selectedTermCount === 0) {
    return (
      <div className="matching-files-empty">
        <span className="material-symbols-outlined">touch_app</span>
        <h3>Select metadata terms to filter</h3>
        <p>Check terms in the left panel to find videos that share those concepts, entities, tags, or categories.</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="matching-files-empty">
        <span className="material-symbols-outlined">search_off</span>
        <h3>No matching videos</h3>
        <p>
          {filterMode === 'AND'
            ? 'No videos match ALL selected terms. Try switching to OR mode or select fewer terms.'
            : 'No videos match ANY of the selected terms.'}
        </p>
      </div>
    );
  }

  return (
    <div className="matching-files">
      <div className="matching-files-header">
        <h2>
          <span className="material-symbols-outlined">video_library</span>
          Matching Videos
        </h2>
        <span className="match-count">
          {files.length} video{files.length !== 1 ? 's' : ''} found
          <span className="filter-mode-indicator">({filterMode} mode)</span>
        </span>
      </div>

      <div className="matching-files-list">
        {files.map((file) => (
          <button
            key={file.filename}
            className="matching-file-item"
            onClick={() => onFileClick(file.filename)}
          >
            <div className="file-info">
              <span className="material-symbols-outlined file-icon">article</span>
              <span className="file-title">{file.title}</span>
            </div>
            {file.date && (
              <span className="file-date">
                {new Date(file.date).toLocaleDateString()}
              </span>
            )}
            <span className="material-symbols-outlined arrow-icon">chevron_right</span>
          </button>
        ))}
      </div>
    </div>
  );
}
