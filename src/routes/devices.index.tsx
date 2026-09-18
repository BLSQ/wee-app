import { createFileRoute } from '@tanstack/react-router'
import { DevicesPage } from '#/features/devices/ui/DevicesPage'

export const Route = createFileRoute('/devices/')({ component: DevicesPage })
