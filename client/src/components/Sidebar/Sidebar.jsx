import { HistorySection } from './HistorySection';
import { SidebarFooter } from './SidebarFooter';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-content">
          <HistorySection />
        </div>

        <SidebarFooter />
      </div>
    </aside>
  );
}
