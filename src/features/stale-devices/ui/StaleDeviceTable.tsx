import { Table, Text } from '@mantine/core'
import type { StaleDevice } from '../api/queries'

const DAY_MS = 86_400_000

// Copied from device-syncs/ui/SyncTable.tsx on purpose: features stay independent here.
// Extract it when a third copy appears.
function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function StaleDeviceTable({
  devices,
  emptyMessage,
}: {
  devices: StaleDevice[]
  emptyMessage: string
}) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Device</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Last sync</Table.Th>
          <Table.Th>Last user</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                {emptyMessage}
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>{device.serial}</Table.Td>
            <Table.Td>{device.facilityName}</Table.Td>
            <Table.Td>{device.districtName}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={device.lastSyncedAt?.toISOString()}>
                {device.lastSyncedAt ? relativeDays(device.lastSyncedAt) : 'never'}
              </Text>
            </Table.Td>
            <Table.Td>{device.lastUsername ?? '—'}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
