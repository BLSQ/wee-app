import { Alert, Button, Group, Loader, Stack, TextInput, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc } from '#/lib/trpc'
import { SyncTable } from './SyncTable'

export function SyncsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'device' | 'user' | 'facility' | 'district' | undefined>()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>()
  const limit = 50

  const { data, isPending, error } = useQuery(
    trpc.deviceSyncs.list.queryOptions({
      limit,
      page,
      search: search || undefined,
      sortBy,
      sortOrder,
    }),
  )

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  const handleSort = (column: string, order: 'asc' | 'desc') => {
    setSortBy(column as 'device' | 'user' | 'facility' | 'district')
    setSortOrder(order)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <Stack>
      <Title order={3}>Recent syncs</Title>

      <TextInput
        placeholder="Search devices, users, facilities, districts..."
        value={search}
        onChange={(e) => handleSearch(e.currentTarget.value)}
        disabled={isPending}
      />

      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && (
        <>
          <SyncTable
            syncs={data.rows}
            sortConfig={{ sortBy, sortOrder }}
            onSort={handleSort}
          />

          {totalPages > 0 && (
            <Group justify="space-between" mt="md">
              <div>
                Showing {data.rows.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                {Math.min(page * limit, data.total)} of {data.total} syncs
              </div>
              <Group gap="xs">
                <Button
                  variant="default"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div>
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="default"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </Group>
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}
