import { Box, Group, List, Text } from '@mantine/core'
import { BUCKETS } from './health'

/** Reads the colours off BUCKETS, so the legend cannot drift from the map. */
export function DistrictLegend() {
  return (
    <Group gap="md" align="center">
      <Text size="sm" c="dimmed">
        Devices synced in the last 7 days
      </Text>
      <List
        aria-label="Legend"
        listStyleType="none"
        display="flex"
        style={{ gap: 'var(--mantine-spacing-md)' }}
      >
        {BUCKETS.map((bucket) => (
          <List.Item
            key={bucket.key}
            icon={
              <Box
                w={12}
                h={12}
                style={{ backgroundColor: bucket.color, borderRadius: 2 }}
                aria-hidden
              />
            }
          >
            <Text size="sm">{bucket.label}</Text>
          </List.Item>
        ))}
      </List>
    </Group>
  )
}
