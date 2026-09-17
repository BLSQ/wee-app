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
      {/* Box consumes `size` itself, so the icon size goes through width and height. */}
      <Box component={IconMoon} width={18} height={18} stroke={1.5} darkHidden />
      <Box component={IconSun} width={18} height={18} stroke={1.5} lightHidden />
    </ActionIcon>
  )
}
