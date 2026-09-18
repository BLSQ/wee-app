import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '#/features/devices/ui/DevicePage'

export const Route = createFileRoute('/devices/$deviceId')({ component: RouteComponent })

// The route file knows about routing; the page only takes the id it was given.
function RouteComponent() {
  const { deviceId } = Route.useParams()
  return <DevicePage deviceId={deviceId} />
}
