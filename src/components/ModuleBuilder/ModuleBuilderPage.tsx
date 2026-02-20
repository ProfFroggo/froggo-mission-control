import { Plus, RotateCcw } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import SpecPreviewPanel from './SpecPreviewPanel';
import { useModuleSpec } from './useModuleSpec';
import { useConversationFlow } from './useConversationFlow';
import { generateTasks, exportSpecAsJson } from './TaskGenerator';
import type { ModuleSpec } from './types';

export default function ModuleBuilderPage() {
  const moduleSpec = useModuleSpec();
  const { spec, resetSpec, sectionProgress, overallProgress, isComplete } = moduleSpec;
  const flow = useConversationFlow({ moduleSpec });

  const handleGenerateTasks = async () => {
    try {
      const result = await generateTasks(spec as ModuleSpec);
      alert(`Created task ${result.taskId} with ${result.subtaskIds.length} subtasks!`);
    } catch (err: any) {
      alert(`Task generation failed: ${err.message}`);
    }
  };

  const handleExportJson = () => {
    const json = exportSpecAsJson(spec as ModuleSpec);
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
      window.location.reload();
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
            onClick={handleReset}
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
            sectionProgress={sectionProgress}
            currentSection={flow.currentSection}
            overallProgress={overallProgress}
            isStarted={flow.isStarted}
            isFinished={flow.isFinished}
            onSend={flow.submitAnswer}
            onStart={flow.startInterview}
            onJumpToSection={flow.jumpToSection}
          />
        </div>
        <div className="w-1/2 min-w-0">
          <SpecPreviewPanel
            spec={spec}
            sectionProgress={sectionProgress}
            isComplete={isComplete}
            onGenerateTasks={handleGenerateTasks}
            onExportJson={handleExportJson}
          />
        </div>
      </div>
    </div>
  );
}
