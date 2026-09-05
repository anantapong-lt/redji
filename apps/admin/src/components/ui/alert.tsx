import * as React from 'react'
import { cn } from '@/lib/utils'

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert" className={cn(className)} {...props} />
}

export { Alert }
