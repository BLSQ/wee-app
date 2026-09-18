import {
  Alert,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc } from '#/lib/trpc'
import { SyncTable, type SortColumn } from './SyncTable'

const PAGE_SIZES = ['25', '50', '100']

export function SyncsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortColumn | undefined>()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>()

  // The field stays on what was typed; the query follows the settled value, so a burst of
  // keystrokes costs one round-trip instead of one per letter.
  const [debouncedSearch] = useDebouncedValue(search, 300)

  const { data, isPending, isFetching, error } = useQuery(
    trpc.deviceSyncs.list.queryOptions(
      {
        limit: pageSize,
        page,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
      },
      // Hold the rows already on screen while the next page loads, so the table does not
      // disappear and come back on every keystroke or page change.
      { placeholderData: keepPreviousData },
    ),
  )

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const firstRow = (page - 1) * pageSize + 1
  const lastRow = data ? Math.min(page * pageSize, data.total) : 0

  const handleSort = (column: SortColumn, order: 'asc' | 'desc') => {
    setSortBy(column)
    setSortOrder(order)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handlePageSize = (value: string | null) => {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  return (
    <Stack>
      <Title order={3}>Recent syncs</Title>

      <Group gap="sm">
        <TextInput
          w={320}
          placeholder="Search devices, users, facilities, districts"
          aria-label="Search syncs"
          value={search}
          onChange={(event) => handleSearch(event.currentTarget.value)}
        />
        {isFetching && <Loader size="sm" />}
      </Group>

      {error && <Alert color="red">{error.message}</Alert>}
      {isPending && <Loader />}

      {data && (
        <>
          <SyncTable syncs={data.rows} sortConfig={{ sortBy, sortOrder }} onSort={handleSort} />

          {data.total > 0 && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {firstRow}–{lastRow} of {data.total}
              </Text>
              <Group gap="sm">
                <Select
                  w={90}
                  data={PAGE_SIZES}
                  value={String(pageSize)}
                  onChange={handlePageSize}
                  allowDeselect={false}
                  aria-label="Rows per page"
                />
                <Pagination value={page} onChange={setPage} total={totalPages} />
              </Group>
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}
