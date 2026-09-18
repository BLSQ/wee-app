import { createFileRoute } from '@tanstack/react-router'
import { UserActivityPage } from '#/features/user-activity/ui/UserActivityPage'

export const Route = createFileRoute('/users')({ component: UserActivityPage })
