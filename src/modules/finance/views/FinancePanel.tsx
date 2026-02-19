/**
 * Finance Module — View wrapper
 *
 * This is the PoC module extraction pattern. The actual component still
 * lives in src/components/FinancePanel.tsx. The module wraps it with
 * ModuleProvider context so it has access to module APIs.
 *
 * FUTURE: Move the actual component code here and remove the wrapper.
 */

import OriginalFinancePanel from '../../../components/FinancePanel';
import { ModuleProvider } from '../../../core/ModuleContext';

export default function FinanceModuleView() {
  return (
    <ModuleProvider moduleId="froggo-finance">
      <OriginalFinancePanel />
    </ModuleProvider>
  );
}
