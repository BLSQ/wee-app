import { Table, Text } from '@mantine/core'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceSyncRow } from '../api/queries'

/** No serial column: the page title already says which device these syncs belong to. */
export function DeviceSyncTable({ syncs }: { syncs: DeviceSyncRow[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Synced</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Submissions</Table.Th>
          <Table.Th>Org units</Table.Th>
          <Table.Th>Entities</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {syncs.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                No syncs yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {syncs.map((sync) => (
          <Table.Tr key={sync.id}>
            <Table.Td>
              <Text size="sm" c="dimmed" title={sync.syncedAt.toISOString()}>
                {relativeDays(sync.syncedAt)}
              </Text>
            </Table.Td>
            <Table.Td>{sync.username}</Table.Td>
            <Table.Td>{sync.submissionCount}</Table.Td>
            <Table.Td>{sync.orgUnitCount}</Table.Td>
            <Table.Td>{sync.entityCount}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
