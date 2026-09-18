import { createFileRoute } from '@tanstack/react-router'
import { TrendPage } from '#/features/sync-trend/ui/TrendPage'

export const Route = createFileRoute('/trend')({ component: TrendPage })
