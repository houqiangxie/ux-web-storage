

### Install

```shell
npm i ux-web-storage
```

### Features

#### 1. Syntax sugar

Keep the type of storage value unchanged and change array and object directly.

```js
import { local, session,db } from 'ux-web-storage'

local.test = 'hello' // works
delete local.test // works

// number
local.test = 0
local.test === 0 // true

// boolean
local.test = false
local.test === false // true

// undefined
local.test = undefined
local.test === undefined // true

// null
local.test = null
local.test === null // true

// object
local.test = { hello: 'world' }
local.test.hello = 'stokado' // works

// array
local.test = ['hello']
local.test.push('stokado') // works
local.test.length // 2

// Date
local.test = new Date('2000-01-01T00:00:00.000Z')
local.test.getTime() === 946684800000 // true

// RegExp
local.test = /d(b+)d/g
local.test.test('cdbbdbsbz') // true

// function
local.test = function () {
  return 'hello stokado!'
}
local.test() === 'hello stokado!' // true

// indexdb用法
db.set('key',value)
db.setMany([['key1','val1'],['key1','val1']])
await db.get('key')
await db.getMany(['key1','key2'])
db.update((oldVal)=>return newVal)
db.del('key')
db.clear()

```

The `local`, `session` also have the same methods and properties: `key()`, `getItem()`, `setItem()`, `removeItem()`, `clear()` and `length`.

**Extra:**

`setItem(key, value, options)` supports setting attributes, `options` configuration fields are as follows:

| | type | effect |
| ---- | ---- | ---- |
| expires | string \| number \| Date | set the expires for the item |
| disposable | boolean | set a one-time value for the item |

#### 2. Subscribe

Listen to the changes.

```js
import { local,session } from 'ux-web-storage'
// indexdb订阅器
db.useSubDb('key',(val)=>{})

local.on('test', (newVal, oldVal) => {
  console.log('test', newVal, oldVal)
})
local.on('test.a', (newVal, oldVal) => {
  console.log('test.a', newVal, oldVal)
})

local.test = {}
// test {} undefined

local.test.a = 1
// test.a 1 undefined
```

##### on

Subscribe to an item.

- `key`: the name of the item to subscribe to. Support `obj.a` for `Object` and `list[0]` for `Array`, and also `Array` length.
- `callback`: the function to call when the item is changed. Includes `newValue` and `oldValue`.

##### once

Subscribe to an item only once.

- `key`: the name of the item to subscribe to. Support `obj.a` for `Object` and `list[0]` for `Array`.
- `callback`: the function to call when the item is changed. Includes `newValue` and `oldValue`.

##### off

Unsubscribe from an item or all items.

- `key(optional)`: the name of the item to unsubscribe from. If no key is provided, it unsubscribes you from all items.
- `callback(optional)`: the function used when binding to the item. If no callback is provided, it unsubscribes you from all functions binding to the item.

#### 3. Expired

Set expires for items.

```js
import { local,db } from 'ux-web-storage'
db.set('key',value,10000) //10s后过期，不传不过期
local.setItem('test', 'hello ', { expires:10000 })
// local.test = 'hello '
// local.setExpires('test', 10000)

// within 10's
local.test // 'hello '

// after 10's
local.test // undefined
```

The expires is saved to localStorage.
So no matter how you reload it within 10's, the value still exists.
But after 10's, it has been removed.

##### setExpires

Set expires for an item.

- `key`: the name of the item to set expires.
- `expires`: accept `string`、`number` and `Date`.

##### getExpires

Return the expires(`Date`) of the item.

- `key`: the name of the item that has set expires.

##### removeExpires

Cancel the expires of the item.

- `key`: the name of the item that has set expires.

#### 4. Disposable

Get the value once.

```js
import { local } from 'ux-web-storage'

local.setItem('test', 'hello ', { disposable: true })
// local.test = 'hello '
// local.setDisposable('test')

local.test // 'hello '
local.test // undefined
```

##### setDisposable

Set a one-time value for the item.

- `key`：the name of the item to set disposable.