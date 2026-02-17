import QuickActions from './QuickActions';

const w = window as any;

export default function FloatingToolbar() {
  return (
    <div className="w-full h-full bg-transparent overflow-visible">
      <QuickActions
        isFloating
        onSearch={() => w.clawdbot?.toolbar?.action?.('search')}
        onNewTask={() => w.clawdbot?.toolbar?.action?.('new-task')}
        onApproveAll={() => {}}
        currentView="dashboard"
      />
    </div>
  );
}
