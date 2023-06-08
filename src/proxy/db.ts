
import mediator,{MediatorProps} from "@/extends/mediator";

const createMediator = () => mediator.install({});

const sub:any = createMediator();
export function promisifyRequest<T = undefined>(
  request: IDBRequest<T> | IDBTransaction
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-ignore - file size hacks
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    // @ts-ignore - file size hacks
    request.onabort = request.onerror = () => reject(request.error);
  });
}

export function createStore(dbName: string, storeName: string): UseStore {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  const dbp = promisifyRequest(request);

  return (txMode, callback) =>
    dbp.then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    );
}

export type UseStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>
) => Promise<T>;

let defaultGetStoreFunc: UseStore | undefined;

function defaultGetStore() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("indexdb-store", "indexdb");
  }
  return defaultGetStoreFunc;
}

// 获取存储的value值
const getValue = async (
  data: Promise<{ expire: number | null; value: any }>
): Promise<any> => {
  let { expire = null, value = null } = (await data|| {});
  if (!expire || (expire && expire >= Date.now())) return value;
  else return null;
};
// 设置存储的value值
const setValue = (data: any, expire: number|undefined,key:IDBValidKey): any => {
  sub.publish(key, data);
  return { expire: expire ? expire + Date.now() : null, value: data };
};

/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function get<T = any>(
  key: IDBValidKey,
  customStore = defaultGetStore()
): Promise<T | undefined> {
  return customStore("readonly", async (store) =>
    getValue(await promisifyRequest(store.get(key)))
  );
}

/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function set(
  key: IDBValidKey,
  value: any,
  expire?: number,
  customStore = defaultGetStore()
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.put(setValue(value, expire,key), key);
    return promisifyRequest(store.transaction);
  });
}

/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function setMany(
  entries: [IDBValidKey, any][],
  expire?: number,
  customStore = defaultGetStore()
): Promise<void> {
  return customStore("readwrite", (store) => {
    entries.forEach((entry) => store.put(setValue(entry[1], expire,entry[0]), entry[0]));
    return promisifyRequest(store.transaction);
  });
}

/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function getMany<T = any>(
  keys: IDBValidKey[],
  customStore = defaultGetStore()
): Promise<T[]> {
  return customStore("readonly", (store) =>
    Promise.all(
      keys.map(async (key) => getValue(await promisifyRequest(store.get(key))))
    )
  );
}

/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function update<T = any>(
  key: IDBValidKey,
  updater: (oldValue: T | undefined) => T,
  expire?: number,
  customStore = defaultGetStore()
): Promise<void> {
  return customStore(
    "readwrite",
    (store) =>
      // Need to create the promise manually.
      // If I try to chain promises, the transaction closes in browsers
      // that use a promise polyfill (IE10/11).
      new Promise((resolve, reject) => {
        store.get(key).onsuccess = function () {
          try {
            store.put(updater(setValue(this.result, expire,key)), key);
            resolve(promisifyRequest(store.transaction));
          } catch (err) {
            reject(err);
          }
        };
      })
  );
}

/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function del(
  key: IDBValidKey,
  customStore = defaultGetStore()
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.delete(key);
    sub.publish(key, null);
    return promisifyRequest(store.transaction);
  });
}

/**
 * Delete multiple keys at once.
 *
 * @param keys List of keys to delete.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function delMany(
  keys: IDBValidKey[],
  customStore = defaultGetStore()
): Promise<void> {
  return customStore("readwrite", (store: IDBObjectStore) => {
    keys.forEach((key: IDBValidKey) => { store.delete(key); sub.publish(key, null);});
    return promisifyRequest(store.transaction);
  });
}

/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function clear(customStore = defaultGetStore()): Promise<void> {
  return customStore("readwrite", (store) => {
    keys().then(storeKeys=>storeKeys.forEach((key: IDBValidKey) => {sub.publish(key, null);}))
    store.clear();
    return promisifyRequest(store.transaction);
  });
}

function eachCursor(
  store: IDBObjectStore,
  callback: (cursor: IDBCursorWithValue) => void
): Promise<void> {
  store.openCursor().onsuccess = function () {
    if (!this.result) return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction);
}

/**
 * Get all keys in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function keys<KeyType extends IDBValidKey>(
  customStore = defaultGetStore()
): Promise<KeyType[]> {
  return customStore("readonly", (store) => {
    // Fast path for modern browsers
    if (store.getAllKeys) {
      return promisifyRequest(
        store.getAllKeys() as unknown as IDBRequest<KeyType[]>
      );
    }

    const items: KeyType[] = [];

    return eachCursor(store, (cursor) =>
      items.push(cursor.key as KeyType)
    ).then(() => items);
  });
}

/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function values<T = any>(customStore = defaultGetStore()): Promise<T[]> {
  return customStore("readonly", async (store) => {
    // Fast path for modern browsers
    if (store.getAll) {
      const data = await promisifyRequest(store.getAll() as IDBRequest<T[]>);
      return data.map((d: any) => d?.value);
    }

    const items: T[] = [];

    return eachCursor(store, (cursor) => items.push(cursor.value as T)).then(
      () => items
    );
  });
}

/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
export function entries<KeyType extends IDBValidKey, ValueType = any>(
  customStore = defaultGetStore()
): Promise<[KeyType, ValueType][]> {
  return customStore("readonly", (store) => {
    // Fast path for modern browsers
    // (although, hopefully we'll get a simpler path some day)
    if (store.getAll && store.getAllKeys) {
      return Promise.all([
        promisifyRequest(
          store.getAllKeys() as unknown as IDBRequest<KeyType[]>
        ),
        promisifyRequest(store.getAll() as IDBRequest<ValueType[]>),
      ]).then(([keys, values]) =>
        keys.map((key, i) => [key, (values[i] as any)?.value])
      );
    }

    const items: [KeyType, ValueType][] = [];

    return customStore("readonly", (store) =>
      eachCursor(store, (cursor) =>
        items.push([cursor.key as KeyType, cursor.value])
      ).then(() => items)
    );
  });
}

export const on = (key:string,callback:Function=()=>{}) => {
  sub.subscribe(key, (value:unknown) => callback(value));
}

