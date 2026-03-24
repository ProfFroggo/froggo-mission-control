/**
 * Loading Panel - Fallback UI for lazy-loaded components
 */

import { Spinner, Flex, Text } from '@radix-ui/themes';

export default function LoadingPanel() {
  return (
    <div className="h-full flex items-center justify-center">
      <Flex direction="column" align="center" gap="3">
        <Spinner size="3" />
        <Text size="2" color="gray">Loading...</Text>
      </Flex>
    </div>
  );
}
