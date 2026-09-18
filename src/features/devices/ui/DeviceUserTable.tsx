import { Table, Text } from '@mantine/core'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceUser } from '../api/queries'

export function DeviceUserTable({ users }: { users: DeviceUser[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Syncs</Table.Th>
          <Table.Th>Last used</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={3}>
              <Text size="sm" c="dimmed" ta="center">
                No users yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {users.map((user) => (
          <Table.Tr key={user.id}>
            <Table.Td>{user.username}</Table.Td>
            <Table.Td>{user.syncCount}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={user.lastSyncedAt.toISOString()}>
                {relativeDays(user.lastSyncedAt)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
