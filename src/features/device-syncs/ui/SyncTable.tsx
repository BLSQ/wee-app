import { Table, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { relativeDays } from '#/lib/relative-days'
import type { RecentSync } from '../api/queries'

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
            <Table.Td>
              {/* A feature may name another feature's route. It may not import its code. */}
              <Link to="/devices/$deviceId" params={{ deviceId: String(sync.deviceId) }}>
                {sync.deviceSerial}
              </Link>
            </Table.Td>
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
