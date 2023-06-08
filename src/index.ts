import { emit } from '@/extends/watch'
import { decode } from '@/proxy/transform'
import { createProxyStorage } from '@/proxy/storage'
import { deleteFunc, getPrefix, proxyMap } from '@/shared'
import { isObject } from '@/utils'
import type { StorageValue } from '@/types'
export { setPrefix } from './shared'
export * as db from '@/proxy/db'
export const local: any = createProxyStorage(localStorage)
export const session: any = createProxyStorage(sessionStorage)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key && e.key.startsWith(getPrefix())) {
      let newValue: StorageValue = e.newValue
      let oldValue: StorageValue = e.oldValue
      if (e.newValue) {
        newValue = decode(e.newValue, deleteFunc(localStorage, e.key))
        if (isObject(newValue))
          newValue = proxyMap.get(newValue) || newValue
      }
      if (e.oldValue) {
        oldValue = decode(e.oldValue, deleteFunc(localStorage, e.key))
        if (isObject(oldValue))
          oldValue = proxyMap.get(oldValue) || oldValue
      }

      emit(localStorage, e.key.slice(getPrefix().length), newValue, oldValue)
    }
  })
}
