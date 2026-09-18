import { Table, Text } from '@mantine/core'
import type { RecentSync } from '../api/queries'

const DAY_MS = 86_400_000

function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export type SortColumn = 'device' | 'user' | 'facility' | 'district'

export type SortConfig = {
  sortBy?: SortColumn
  sortOrder?: 'asc' | 'desc'
}

type OnSort = (sortBy: SortColumn, sortOrder: 'asc' | 'desc') => void

interface SyncTableProps {
  syncs: RecentSync[]
  sortConfig?: SortConfig
  onSort?: OnSort
}

function SortIndicator({ column, sortConfig }: { column: SortColumn; sortConfig?: SortConfig }) {
  if (sortConfig?.sortBy !== column) return null
  return <span style={{ marginLeft: 6 }}>{sortConfig.sortOrder === 'asc' ? '↑' : '↓'}</span>
}

function SortableHeader({
  column,
  label,
  sortConfig,
  onSort,
}: {
  column: SortColumn
  label: string
  sortConfig?: SortConfig
  onSort?: OnSort
}) {
  const handleClick = () => {
    if (!onSort) return
    const newOrder =
      sortConfig?.sortBy === column && sortConfig?.sortOrder === 'asc' ? 'desc' : 'asc'
    onSort(column, newOrder)
  }

  return (
    <Table.Th
      style={{
        cursor: onSort ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={handleClick}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {label}
        <SortIndicator column={column} sortConfig={sortConfig} />
      </div>
    </Table.Th>
  )
}

export function SyncTable({ syncs, sortConfig, onSort }: SyncTableProps) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <SortableHeader column="device" label="Device" sortConfig={sortConfig} onSort={onSort} />
          <SortableHeader column="user" label="User" sortConfig={sortConfig} onSort={onSort} />
          <SortableHeader
            column="facility"
            label="Facility"
            sortConfig={sortConfig}
            onSort={onSort}
          />
          <SortableHeader
            column="district"
            label="District"
            sortConfig={sortConfig}
            onSort={onSort}
          />
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
