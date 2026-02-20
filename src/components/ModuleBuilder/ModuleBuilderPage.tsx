import { Plus, RotateCcw } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import SpecPreviewPanel from './SpecPreviewPanel';
import { useModuleSpec } from './useModuleSpec';
import { useConversationFlow } from './useConversationFlow';
import { generateTasks, exportSpecJson } from './TaskGenerator';

export default function ModuleBuilderPage() {
  const { spec, updateSpec, resetSpec, completedSections, complexity } = useModuleSpec();
  const flow = useConversationFlow(updateSpec);

  const handleGenerateTasks = () => generateTasks(spec);

  const handleExportJson = () => {
    const json = exportSpecJson(spec);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.id || 'module'}-spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm('Reset the module builder? All progress will be lost.')) {
      resetSpec();
      window.location.reload(); // simplest way to reset conversation state
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Module Builder</h1>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 min-w-0">
          <ConversationPanel
            messages={flow.messages}
            sections={flow.sections}
            currentSection={flow.currentSection}
            totalSections={flow.totalSections}
            completedCount={flow.completedCount}
            progress={flow.progress}
            isComplete={flow.isComplete}
            isProcessing={flow.isProcessing}
            onSend={flow.sendMessage}
            onAdvanceSection={flow.advanceSection}
          />
        </div>
        <div className="w-1/2 min-w-0">
          <SpecPreviewPanel
            spec={spec}
            sections={flow.sections}
            complexity={complexity}
            onGenerateTasks={handleGenerateTasks}
            onExportJson={handleExportJson}
            isComplete={flow.isComplete}
          />
        </div>
      </div>
    </div>
  );
}
