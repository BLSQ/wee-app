import { ActionIcon, Box, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

// Both icons are always rendered; Mantine's CSS hides the one that does not
// match the scheme, so server markup never depends on it.
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
    >
      <Box component={IconMoon} size={18} stroke={1.5} darkHidden />
      <Box component={IconSun} size={18} stroke={1.5} lightHidden />
    </ActionIcon>
  )
}
