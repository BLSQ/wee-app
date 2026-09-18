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
  const regionId = 'never-synced-devices'

  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        justify="start"
        w="fit-content"
        onClick={toggle}
        aria-expanded={opened}
        aria-controls={regionId}
      >
        {/* The triangle is decoration: aria-expanded already says which way the
            section is folded, and a screen reader would read the glyph out. */}
        <span aria-hidden>{opened ? '▾' : '▸'}</span> Never synced ({devices.length})
      </Button>
      <Collapse id={regionId} expanded={opened} keepMounted={false}>
        <StaleDeviceTable devices={devices} emptyMessage="Every device has synced at least once" />
      </Collapse>
    </Stack>
  )
}
