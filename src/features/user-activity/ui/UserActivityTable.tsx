import { Table, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { UserActivity } from '../api/queries'

const DAY_MS = 86_400_000

function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

type SortKey = 'username' | 'syncCount' | 'submissionCount' | 'deviceCount' | 'lastSyncAt'

const columns: { key: SortKey; label: string }[] = [
  { key: 'username', label: 'User' },
  { key: 'syncCount', label: 'Syncs' },
  { key: 'submissionCount', label: 'Submissions' },
  { key: 'deviceCount', label: 'Devices' },
  { key: 'lastSyncAt', label: 'Last sync' },
]

/** A Date compares as its epoch, so one comparison serves every column. */
function value(row: UserActivity, key: SortKey): string | number | null {
  const raw = row[key]
  return raw instanceof Date ? raw.getTime() : raw
}

function sortRows(rows: UserActivity[], key: SortKey, direction: 'asc' | 'desc'): UserActivity[] {
  return [...rows].sort((a, b) => {
    const left = value(a, key)
    const right = value(b, key)
    // A user with nothing in the window stays at the bottom, whichever way the column points.
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    // Keyed off the column, not off typeof: a count that ever arrived as a string would
    // otherwise compare as text and sort "10" before "9". See docs/adr/0017.
    const order =
      key === 'username' ? String(left).localeCompare(String(right)) : Number(left) - Number(right)
    return direction === 'asc' ? order : -order
  })
}

export function UserActivityTable({ rows }: { rows: UserActivity[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'username',
    direction: 'asc',
  })

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          {columns.map((column) => (
            <Table.Th
              key={column.key}
              aria-sort={
                sort.key === column.key
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <UnstyledButton fz="sm" fw={700} onClick={() => toggle(column.key)}>
                {column.label}
                {sort.key === column.key && (sort.direction === 'asc' ? ' ▲' : ' ▼')}
              </UnstyledButton>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Text size="sm" c="dimmed" ta="center">
                No users yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {sortRows(rows, sort.key, sort.direction).map((row) => (
          <Table.Tr key={row.userId} style={{ opacity: row.lastSyncAt ? 1 : 0.55 }}>
            <Table.Td>{row.username}</Table.Td>
            <Table.Td>{row.syncCount}</Table.Td>
            <Table.Td>{row.submissionCount}</Table.Td>
            <Table.Td>{row.deviceCount}</Table.Td>
            <Table.Td>
              {row.lastSyncAt ? (
                <Text size="sm" c="dimmed" title={row.lastSyncAt.toISOString()}>
                  {relativeDays(row.lastSyncAt)}
                </Text>
              ) : (
                '—'
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
