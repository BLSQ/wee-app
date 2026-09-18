import { Button, Collapse, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { StaleDevice } from '../api/queries'
import { StaleDeviceTable } from './StaleDeviceTable'

/**
 * The devices that have never synced, folded away behind their count.
 *
 * keepMounted={false} so the rows leave the document while the section is
 * closed: a collapsed table that is still in the page is one a screen reader
 * still reads out.
 */
export function NeverSyncedSection({ devices }: { devices: StaleDevice[] }) {
  const [opened, { toggle }] = useDisclosure(false)

  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        justify="start"
        w="fit-content"
        onClick={toggle}
        aria-expanded={opened}
      >
        {opened ? '▾' : '▸'} Never synced ({devices.length})
      </Button>
      <Collapse expanded={opened} keepMounted={false}>
        <StaleDeviceTable devices={devices} emptyMessage="Every device has synced at least once" />
      </Collapse>
    </Stack>
  )
}
