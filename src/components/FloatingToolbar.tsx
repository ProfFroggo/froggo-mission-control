import QuickActions from './QuickActions';

export default function FloatingToolbar() {
  return (
    <div className="w-full h-full bg-transparent overflow-visible">
      <QuickActions
        isFloating
        onSearch={() => {}}
        onNewTask={() => {}}
        onApproveAll={() => {}}
        currentView="dashboard"
      />
    </div>
  );
}
