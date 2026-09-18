import { Table, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceListItem } from '../api/queries'

export function DeviceTable({ devices }: { devices: DeviceListItem[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Serial</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Syncs</Table.Th>
          <Table.Th>Last sync</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                No devices yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>
              <Link to="/devices/$deviceId" params={{ deviceId: String(device.id) }}>
                {device.serial}
              </Link>
            </Table.Td>
            <Table.Td>{device.facilityName}</Table.Td>
            <Table.Td>{device.districtName}</Table.Td>
            <Table.Td>{device.syncCount}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={device.lastSyncedAt?.toISOString()}>
                {relativeDays(device.lastSyncedAt)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
