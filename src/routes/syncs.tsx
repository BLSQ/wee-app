import { createFileRoute } from '@tanstack/react-router'
import { SyncsPage } from '#/features/device-syncs/ui/SyncsPage'

export const Route = createFileRoute('/syncs')({ component: SyncsPage })
