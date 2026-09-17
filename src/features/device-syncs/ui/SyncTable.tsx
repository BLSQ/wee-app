import { Table, Text } from '@mantine/core'
import type { RecentSync } from '../api/queries'

const DAY_MS = 86_400_000

function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function SyncTable({ syncs }: { syncs: RecentSync[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Device</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Synced</Table.Th>
          <Table.Th>Submissions</Table.Th>
          <Table.Th>Org units</Table.Th>
          <Table.Th>Entities</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {syncs.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={8}>
              <Text size="sm" c="dimmed" ta="center">
                No syncs yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {syncs.map((sync) => (
          <Table.Tr key={sync.id}>
            <Table.Td>{sync.deviceSerial}</Table.Td>
            <Table.Td>{sync.username}</Table.Td>
            <Table.Td>{sync.facilityName}</Table.Td>
            <Table.Td>{sync.districtName}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={sync.syncedAt.toISOString()}>
                {relativeDays(sync.syncedAt)}
              </Text>
            </Table.Td>
            <Table.Td>{sync.submissionCount}</Table.Td>
            <Table.Td>{sync.orgUnitCount}</Table.Td>
            <Table.Td>{sync.entityCount}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
